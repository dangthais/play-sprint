import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameHost, READY_TIMEOUT_MS, type GameHostProps } from './GameHost';

const GAME_ORIGIN = 'http://localhost:4000';
const props: GameHostProps = {
  embedUrl: `${GAME_ORIGIN}/snake/index.html`,
  gameOrigin: GAME_ORIGIN,
  title: 'Snake',
  orientation: 'landscape',
};

function frame(): HTMLIFrameElement {
  return screen.getByTestId('game-frame') as HTMLIFrameElement;
}

function send(data: unknown, opts: { origin?: string; source?: MessageEventSource | null } = {}) {
  const source = 'source' in opts ? opts.source : frame().contentWindow;
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data, origin: opts.origin ?? 'null', source }),
    );
  });
}

const status = () => screen.getByTestId('game-host').getAttribute('data-status');

describe('GameHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('render iframe với thuộc tính an toàn', () => {
    render(<GameHost {...props} />);
    const f = frame();
    expect(f.getAttribute('sandbox')).toBe('allow-scripts');
    expect(f.hasAttribute('allow')).toBe(false);
    expect(f.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(f.getAttribute('title')).toBe('Snake');
    expect(f.getAttribute('src')).toBe(props.embedUrl);
    expect(status()).toBe('loading');
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải game…');
    expect(screen.queryByTestId('game-score')).toBeNull();
  });

  it('luồng loading -> playing -> score -> over -> ready -> playing', () => {
    render(<GameHost {...props} />);
    send({ qp: 1, type: 'ready' });
    expect(status()).toBe('playing');
    expect(screen.getByTestId('game-score')).toHaveTextContent('Điểm: 0');
    send({ qp: 1, type: 'score', score: 7 });
    expect(screen.getByTestId('game-score')).toHaveTextContent('Điểm: 7');
    send({ qp: 1, type: 'gameOver', score: 9 });
    expect(status()).toBe('over');
    expect(screen.getByTestId('game-status')).toHaveTextContent('Kết thúc ván');
    expect(screen.getByTestId('game-last-score')).toHaveTextContent('Ván trước: 9');
    send({ qp: 1, type: 'ready' });
    expect(status()).toBe('playing');
    expect(screen.getByTestId('game-score')).toHaveTextContent('Điểm: 0');
    expect(screen.getByTestId('game-last-score')).toHaveTextContent('Ván trước: 9');
  });

  it('bỏ qua message từ window khác hoặc chính trang', () => {
    render(<GameHost {...props} />);
    send({ qp: 1, type: 'ready' }, { source: window });
    send({ qp: 1, type: 'ready' }, { source: null });
    const other = document.createElement('iframe');
    document.body.appendChild(other);
    send({ qp: 1, type: 'ready' }, { source: other.contentWindow });
    other.remove();
    expect(status()).toBe('loading');
  });

  it('bỏ qua origin khác "null"', () => {
    render(<GameHost {...props} />);
    send({ qp: 1, type: 'ready' }, { origin: GAME_ORIGIN });
    send({ qp: 1, type: 'ready' }, { origin: window.location.origin });
    expect(status()).toBe('loading');
  });

  it('bỏ qua schema sai', () => {
    render(<GameHost {...props} />);
    send({ qp: 1, type: 'ready', extra: 1 });
    send({ qp: 2, type: 'ready' });
    send('ready');
    expect(status()).toBe('loading');
    send({ qp: 1, type: 'ready' });
    send({ qp: 1, type: 'gameOver', score: -1 });
    send({ qp: 1, type: 'score', score: 1.5 });
    expect(status()).toBe('playing');
    expect(screen.getByTestId('game-score')).toHaveTextContent('Điểm: 0');
  });

  it('timeout sau load nếu không có ready, rồi Thử lại', () => {
    render(<GameHost {...props} />);
    // Chưa load thì chưa đếm.
    act(() => {
      vi.advanceTimersByTime(READY_TIMEOUT_MS * 2);
    });
    expect(status()).toBe('loading');
    fireEvent.load(frame());
    act(() => {
      vi.advanceTimersByTime(READY_TIMEOUT_MS - 1);
    });
    expect(status()).toBe('loading');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(status()).toBe('error');
    expect(screen.getByTestId('game-status')).toHaveTextContent('Không thể tải game.');
    expect(screen.queryByTestId('game-frame')).toBeNull();
    expect(screen.getByTestId('game-restart')).toHaveTextContent('Thử lại');
    fireEvent.click(screen.getByTestId('game-restart'));
    expect(status()).toBe('loading');
    expect(frame()).toBeInTheDocument();
  });

  it('ready trước hạn huỷ timeout', () => {
    render(<GameHost {...props} />);
    fireEvent.load(frame());
    send({ qp: 1, type: 'ready' });
    act(() => {
      vi.advanceTimersByTime(READY_TIMEOUT_MS * 2);
    });
    expect(status()).toBe('playing');
  });

  it('Chơi lại remount iframe và về loading', () => {
    render(<GameHost {...props} />);
    send({ qp: 1, type: 'ready' });
    send({ qp: 1, type: 'gameOver', score: 3 });
    const before = frame();
    expect(screen.getByTestId('game-restart')).toHaveTextContent('Chơi lại');
    fireEvent.click(screen.getByTestId('game-restart'));
    expect(frame()).not.toBe(before);
    expect(status()).toBe('loading');
    expect(screen.queryByTestId('game-score')).toBeNull();
    // iframe cũ không còn được chấp nhận
    send({ qp: 1, type: 'ready' }, { source: before.contentWindow });
    expect(status()).toBe('loading');
    send({ qp: 1, type: 'ready' });
    expect(status()).toBe('playing');
  });

  it('embedUrl khác origin với gameOrigin -> error, không iframe', () => {
    render(<GameHost {...props} embedUrl="http://evil.example/x.html" />);
    expect(status()).toBe('error');
    expect(screen.queryByTestId('game-frame')).toBeNull();
  });

  it('embedUrl không parse được -> error', () => {
    render(<GameHost {...props} embedUrl="not a url" />);
    expect(status()).toBe('error');
    expect(screen.queryByTestId('game-frame')).toBeNull();
  });

  it('gameOrigin trùng origin của trang -> error', () => {
    const same = window.location.origin;
    render(<GameHost {...props} embedUrl={`${same}/g/index.html`} gameOrigin={same} />);
    expect(status()).toBe('error');
    expect(screen.queryByTestId('game-frame')).toBeNull();
  });

  describe('callbacks', () => {
    it('onReady gọi cho mỗi ready hợp lệ, kể cả khi đang playing', () => {
      const onReady = vi.fn();
      render(<GameHost {...props} onReady={onReady} />);
      send({ qp: 1, type: 'ready', extra: 1 });
      send({ qp: 1, type: 'ready' }, { origin: GAME_ORIGIN });
      send({ qp: 1, type: 'ready' }, { source: window });
      expect(onReady).not.toHaveBeenCalled();
      send({ qp: 1, type: 'ready' });
      expect(onReady).toHaveBeenCalledTimes(1);
      send({ qp: 1, type: 'ready' });
      expect(onReady).toHaveBeenCalledTimes(2);
    });

    it('onReady không gọi khi trạng thái error', () => {
      const onReady = vi.fn();
      render(<GameHost {...props} onReady={onReady} />);
      fireEvent.load(frame());
      const w = frame().contentWindow;
      act(() => {
        vi.advanceTimersByTime(READY_TIMEOUT_MS);
      });
      expect(status()).toBe('error');
      send({ qp: 1, type: 'ready' }, { source: w });
      expect(onReady).not.toHaveBeenCalled();
    });

    it('onGameOver gọi đúng một lần cho mỗi playing -> over', () => {
      const onGameOver = vi.fn();
      render(<GameHost {...props} onGameOver={onGameOver} />);
      send({ qp: 1, type: 'gameOver', score: 5 }); // loading
      expect(onGameOver).not.toHaveBeenCalled();
      send({ qp: 1, type: 'ready' });
      send({ qp: 1, type: 'gameOver', score: 8 });
      send({ qp: 1, type: 'gameOver', score: 9 }); // đang over
      expect(onGameOver).toHaveBeenCalledTimes(1);
      expect(onGameOver).toHaveBeenCalledWith(8);
      send({ qp: 1, type: 'ready' });
      send({ qp: 1, type: 'gameOver', score: 3 });
      expect(onGameOver).toHaveBeenCalledTimes(2);
      expect(onGameOver).toHaveBeenLastCalledWith(3);
    });

    it('ready và gameOver liên tiếp trong cùng một tick vẫn đúng', () => {
      const onGameOver = vi.fn();
      render(<GameHost {...props} onGameOver={onGameOver} />);
      act(() => {
        const source = frame().contentWindow;
        for (const data of [
          { qp: 1, type: 'ready' },
          { qp: 1, type: 'gameOver', score: 2 },
          { qp: 1, type: 'gameOver', score: 2 },
        ]) {
          window.dispatchEvent(new MessageEvent('message', { data, origin: 'null', source }));
        }
      });
      expect(onGameOver).toHaveBeenCalledTimes(1);
    });

    it('đổi callback không đăng ký lại listener và dùng callback mới nhất', () => {
      const add = vi.spyOn(window, 'addEventListener');
      const first = vi.fn();
      const second = vi.fn();
      const { rerender } = render(<GameHost {...props} onGameOver={first} />);
      const count = () => add.mock.calls.filter((c) => c[0] === 'message').length;
      const before = count();
      rerender(<GameHost {...props} onGameOver={second} />);
      expect(count()).toBe(before);
      send({ qp: 1, type: 'ready' });
      send({ qp: 1, type: 'gameOver', score: 4 });
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith(4);
      add.mockRestore();
    });

    it('callback throw không làm hỏng host', () => {
      const onReady = vi.fn(() => {
        throw new Error('boom');
      });
      const onGameOver = vi.fn(() => {
        throw new Error('boom');
      });
      render(<GameHost {...props} onReady={onReady} onGameOver={onGameOver} />);
      send({ qp: 1, type: 'ready' });
      expect(status()).toBe('playing');
      send({ qp: 1, type: 'gameOver', score: 6 });
      expect(status()).toBe('over');
      expect(screen.getByTestId('game-last-score')).toHaveTextContent('Ván trước: 6');
      expect(onGameOver).toHaveBeenCalledTimes(1);
    });

    it('StrictMode: mỗi chuyển chỉ gọi callback một lần', () => {
      const onReady = vi.fn();
      const onGameOver = vi.fn();
      render(
        <StrictMode>
          <GameHost {...props} onReady={onReady} onGameOver={onGameOver} />
        </StrictMode>,
      );
      send({ qp: 1, type: 'ready' });
      send({ qp: 1, type: 'gameOver', score: 1 });
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(onGameOver).toHaveBeenCalledTimes(1);
    });
  });

  it('scoreLabel tuỳ chỉnh', () => {
    render(<GameHost {...props} scoreLabel="Lượt" />);
    send({ qp: 1, type: 'ready' });
    send({ qp: 1, type: 'score', score: 3 });
    expect(screen.getByTestId('game-score')).toHaveTextContent('Lượt: 3');
  });

  it('gỡ listener khi unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<GameHost {...props} />);
    unmount();
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
    remove.mockRestore();
  });
});
