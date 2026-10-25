import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../../api/types.ts';
import { resetCatalogForTests } from '../catalog/catalog.ts';
import { GamePlayPage } from './GamePlayPage.tsx';
import { playNextGames } from './PlayNext.tsx';

const hostProps = vi.fn();
vi.mock('../game-host/GameHost.tsx', () => ({
  GameHost: (props: Record<string, unknown>) => {
    hostProps(props);
    return <div data-testid="game-host" />;
  },
}));

const game: Game = {
  id: 'snake',
  title: 'Snake',
  description: '<b>Rắn</b> săn mồi',
  thumbnailUrl: 'http://localhost:5173/t.svg',
  embedUrl: 'http://localhost:5174/games/snake/',
  orientation: 'portrait',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  hostProps.mockClear();
  resetCatalogForTests();
  window.history.replaceState(null, '', '/games/snake');
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetCatalogForTests();
});

const gameCalls = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.filter((c) => String(c[0]) === '/api/games/snake');

describe('GamePlayPage', () => {
  it('shows loading then game with GameHost props', async () => {
    const f = vi.fn((_u: string) => Promise.resolve(json(game)));
    vi.stubGlobal('fetch', f);
    render(<GamePlayPage id="snake" />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải…');
    expect(await screen.findByTestId('game-title')).toHaveTextContent('Snake');
    expect(f.mock.calls[0]![0]).toBe('/api/games/snake');
    // mô tả hiển thị dạng text thuần, không phải HTML
    const desc = screen.getByText('<b>Rắn</b> săn mồi');
    expect(desc.querySelector('b')).toBeNull();
    expect(hostProps).toHaveBeenCalledWith({
      embedUrl: game.embedUrl,
      gameOrigin: 'http://localhost:5174',
      title: 'Snake',
      orientation: 'portrait',
    });
    expect(screen.getByTestId('back-to-list')).toHaveAttribute('href', '/');
    await waitFor(() => expect(document.title).toContain('Snake'));
  });

  it('shows not found on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ code: 'NOT_FOUND', message: 'x' }, 404))),
    );
    render(<GamePlayPage id="snake" />);
    const nf = await screen.findByTestId('game-not-found');
    expect(nf).toHaveTextContent('Không tìm thấy game.');
    expect(within(nf).getByRole('link', { name: 'Về danh sách' })).toHaveAttribute('href', '/');
  });

  it('shows alert and retries', async () => {
    const user = userEvent.setup();
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValue(json(game));
    vi.stubGlobal('fetch', f);
    render(<GamePlayPage id="snake" />);
    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('boom');
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByTestId('game-title')).toBeInTheDocument();
    expect(gameCalls(f)).toHaveLength(2);
  });

  it.each(['Snake', '-a', 'a_b', 'a/b', '', 'a'.repeat(65)])(
    'invalid id %j does not call the API',
    (id) => {
      const f = vi.fn();
      vi.stubGlobal('fetch', f);
      render(<GamePlayPage id={id} />);
      expect(screen.getByTestId('game-not-found')).toBeInTheDocument();
      expect(f).not.toHaveBeenCalled();
    },
  );

  it('aborts the request on unmount', () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise(() => {});
      }),
    );
    const { unmount } = render(<GamePlayPage id="snake" />);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  describe('layout below the player', () => {
    const others: Game[] = ['tic-tac-toe', 'merge-2048', 'brick-breaker'].map((id) => ({
      ...game,
      id,
      title: id.toUpperCase(),
      embedUrl: `http://localhost:5174/games/${id}/`,
    }));
    const catalog = [others[0]!, game, others[1]!, others[2]!];

    function stubWithCatalog(detail: Game) {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (String(url).startsWith('/api/games?')) {
            return Promise.resolve(
              json({ items: catalog, total: catalog.length, page: 1, limit: 100 }),
            );
          }
          return Promise.resolve(json(detail));
        }),
      );
    }

    it('shows title, ranked badge and tags (category tags link to /?tag=)', async () => {
      stubWithCatalog({ ...game, ranked: true, tags: ['arcade', 'classic', 'numbers'] });
      render(<GamePlayPage id="snake" />);
      const title = await screen.findByTestId('game-title');
      expect(title.tagName).toBe('H2');
      const meta = title.parentElement!;
      expect(within(meta).getByText('Xếp hạng')).toBeInTheDocument();
      expect(within(meta).getByRole('link', { name: 'Arcade' })).toHaveAttribute(
        'href',
        '/?tag=arcade',
      );
      expect(within(meta).getByRole('link', { name: 'Cổ điển' })).toHaveAttribute(
        'href',
        '/?tag=classic',
      );
      // Tag không phải danh mục chỉ là text.
      expect(within(meta).getByText('numbers').closest('a')).toBeNull();
    });

    it('lists other games in "Chơi tiếp", never the current one, starting after it', async () => {
      stubWithCatalog(game);
      render(<GamePlayPage id="snake" />);
      const next = await screen.findByTestId('play-next');
      expect(within(next).getByText('Chơi tiếp')).toBeInTheDocument();
      const links = within(next).getAllByRole('link');
      expect(links.map((a) => a.getAttribute('href'))).toEqual([
        '/games/merge-2048',
        '/games/brick-breaker',
        '/games/tic-tac-toe',
      ]);
      expect(within(next).queryByText('Snake')).toBeNull();
      expect(next.querySelector('h2, [data-testid^="game-"]')).toBeNull();
    });

    it('hides "Chơi tiếp" when the catalog has no other game or fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) =>
          String(url).startsWith('/api/games?')
            ? Promise.resolve(new Response('boom', { status: 500 }))
            : Promise.resolve(json(game)),
        ),
      );
      render(<GamePlayPage id="snake" />);
      await screen.findByTestId('game-title');
      await new Promise((r) => setTimeout(r, 30));
      expect(screen.queryByTestId('play-next')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('orders blocks: player, title row, play next, then the description', async () => {
      stubWithCatalog({ ...game, description: 'Mô tả game' });
      render(<GamePlayPage id="snake" />);
      await screen.findByTestId('play-next');
      const order = [
        screen.getByTestId('game-host'),
        screen.getByTestId('game-title'),
        screen.getByTestId('play-next'),
        screen.getByTestId('unranked-note'),
        screen.getByText('Mô tả game'),
      ];
      for (let i = 1; i < order.length; i++) {
        expect(
          order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    });
  });
});

describe('playNextGames', () => {
  const mk = (id: string): Game => ({ ...game, id });
  const list = ['a', 'b', 'c', 'd'].map(mk);

  it('rotates to start after the current game and excludes it', () => {
    expect(playNextGames(list, 'b').map((g) => g.id)).toEqual(['c', 'd', 'a']);
    expect(playNextGames(list, 'd').map((g) => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps order when the current game is not in the catalog, and applies the limit', () => {
    expect(playNextGames(list, 'zzz').map((g) => g.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(playNextGames(list, 'a', 2).map((g) => g.id)).toEqual(['b', 'c']);
  });

  it('is empty when the current game is the only one', () => {
    expect(playNextGames([mk('a')], 'a')).toEqual([]);
  });
});
