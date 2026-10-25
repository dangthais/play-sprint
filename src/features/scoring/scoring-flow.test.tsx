import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game, Session } from '../../api/types.ts';
import { GamePlayPage } from '../play/GamePlayPage.tsx';

interface HostProps {
  onReady?: () => void;
  onGameOver?: (score: number) => void;
  scoreLabel?: string;
}
const hostProps = vi.fn<(p: HostProps) => void>();
vi.mock('../game-host/GameHost.tsx', () => ({
  GameHost: (props: HostProps) => {
    hostProps(props);
    return <div data-testid="game-host" />;
  },
}));

const baseGame: Game = {
  id: 'snake',
  title: 'Snake',
  thumbnailUrl: 'http://localhost:5173/t.svg',
  embedUrl: 'http://localhost:5174/games/snake/',
  orientation: 'portrait',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ranked: true,
  scoreOrder: 'desc',
};

const TOKEN_A = 'A'.repeat(43);
const TOKEN_B = 'B'.repeat(43);
const ID_A = '00000000-0000-4000-8000-00000000000a';
const ID_B = '00000000-0000-4000-8000-00000000000b';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const err = (status: number, code: string, headers: Record<string, string> = {}) =>
  json({ code, message: 'x' }, status, headers);

function session(id: string): Session {
  return {
    id,
    gameId: 'snake',
    status: 'active',
    startedAt: '2026-10-24T08:00:00.000Z',
    expiresAt: '2026-10-24T10:00:00.000Z',
    endedAt: null,
    score: null,
    durationMs: null,
    playerName: null,
  };
}
const created = (id: string, token: string) =>
  json({ session: session(id), sessionToken: token }, 201);
const scored = (id: string, rank = 3, personalBest = true) =>
  json({ session: { ...session(id), status: 'finished' }, rank, personalBest });

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  signal: AbortSignal | undefined;
}

interface Router {
  game?: Game;
  create?: (n: number) => Response | Promise<Response>;
  score?: (n: number, call: Call) => Response | Promise<Response>;
  leaderboard?: () => Response | Promise<Response>;
}

function installFetch(r: Router) {
  const calls: Call[] = [];
  let creates = 0;
  let scores = 0;
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const call: Call = {
      url,
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      signal: init?.signal ?? undefined,
    };
    calls.push(call);
    if (url === '/api/games/snake') return json(r.game ?? baseGame);
    if (url.startsWith('/api/games/snake/leaderboard')) {
      return r.leaderboard?.() ?? json({ gameId: 'snake', scoreOrder: 'desc', items: [] });
    }
    if (url === '/api/sessions') return (r.create ?? (() => created(ID_A, TOKEN_A)))(++creates);
    if (/^\/api\/sessions\/[^/]+\/score$/.test(url)) {
      return (r.score ?? (() => scored(ID_A)))(++scores, call);
    }
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', f);
  return {
    calls,
    sessions: () => calls.filter((c) => c.url === '/api/sessions'),
    scores: () => calls.filter((c) => c.url.endsWith('/score')),
    boards: () => calls.filter((c) => c.url.includes('/leaderboard')),
  };
}

async function tick(ms = 0) {
  await act(async () => {
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(ms);
    else await new Promise((res) => setTimeout(res, ms));
  });
}

async function renderPage() {
  const utils = render(<GamePlayPage id="snake" />);
  await screen.findByTestId('game-title');
  await tick();
  return utils;
}

const host = () => hostProps.mock.lastCall![0];
async function ready() {
  await act(async () => host().onReady!());
  await tick();
}
async function gameOver(score: number) {
  await act(async () => host().onGameOver!(score));
  await tick();
}
const setName = (v: string) =>
  fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: v } });
const state = () => screen.getByTestId('score-result').getAttribute('data-state');

beforeEach(() => {
  hostProps.mockClear();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/games/snake');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ranked play: session and score request (AC24)', () => {
  it('creates a session per ready and submits with header token and body', async () => {
    const api = installFetch({});
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    expect(screen.getByTestId('nickname-input')).toHaveValue('Lan');
    expect(host().scoreLabel).toBe('Điểm');
    expect(screen.queryByTestId('unranked-note')).toBeNull();

    await ready();
    expect(api.sessions()).toHaveLength(1);
    expect(api.sessions()[0]).toMatchObject({ method: 'POST', body: { gameId: 'snake' } });
    expect(api.scores()).toHaveLength(0);

    await gameOver(17);
    expect(api.scores()).toHaveLength(1);
    const call = api.scores()[0]!;
    expect(call.url).toBe(`/api/sessions/${ID_A}/score`);
    expect(call.method).toBe('POST');
    expect(call.headers['X-Session-Token']).toBe(TOKEN_A);
    expect(call.headers['Content-Type']).toBe('application/json');
    expect(call.body).toEqual({ score: 17, playerName: 'Lan' });

    expect(state()).toBe('saved');
    expect(screen.getByTestId('score-result-rank')).toHaveTextContent('#3');
    expect(screen.getByTestId('score-result')).toHaveTextContent('Đã lưu điểm: 17. Hạng #3');
    expect(screen.getByTestId('score-result')).toHaveTextContent('(kỷ lục cá nhân)');
    expect(window.localStorage.getItem('qp:nickname')).toBe('Lan');
    // leaderboard tải lại sau khi lưu
    expect(api.boards()).toHaveLength(2);

    // token không rò rỉ
    for (const c of api.calls) {
      expect(c.url).not.toContain(TOKEN_A);
    }
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TOKEN_A);
    expect(document.body.innerHTML).not.toContain(TOKEN_A);
    expect(
      JSON.stringify(Object.values(host()).filter((v) => typeof v !== 'function')),
    ).not.toContain(TOKEN_A);
  });

  it('uses "Số lượt" label for asc games', async () => {
    installFetch({ game: { ...baseGame, id: 'snake', scoreOrder: 'asc' } });
    await renderPage();
    expect(host().scoreLabel).toBe('Số lượt');
  });

  it('a second ready before gameOver abandons the first session', async () => {
    const api = installFetch({
      create: (n) => (n === 1 ? created(ID_A, TOKEN_A) : created(ID_B, TOKEN_B)),
    });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    await ready();
    expect(api.sessions()).toHaveLength(2);
    expect(api.sessions()[0]!.signal?.aborted).toBe(true);
    await gameOver(4);
    expect(api.scores()[0]!.headers['X-Session-Token']).toBe(TOKEN_B);
  });
});

describe('needs-name (AC26)', () => {
  it('asks for a name, validates, then submits', async () => {
    const api = installFetch({});
    await renderPage();
    expect(screen.getByTestId('nickname-input')).toHaveValue('');
    expect(screen.queryByTestId('nickname-error')).toBeNull();
    await ready();
    await gameOver(9);
    expect(state()).toBe('needs-name');
    expect(screen.getByTestId('score-result')).toHaveTextContent('Nhập tên để lưu điểm');
    expect(api.scores()).toHaveLength(0);

    fireEvent.click(screen.getByTestId('score-save'));
    await tick();
    expect(screen.getByTestId('nickname-error')).toBeInTheDocument();
    expect(api.scores()).toHaveLength(0);

    setName('a<b');
    expect(screen.getByTestId('nickname-error')).toBeInTheDocument();
    setName('  Minh   Anh ');
    expect(screen.queryByTestId('nickname-error')).toBeNull();
    fireEvent.click(screen.getByTestId('score-save'));
    await tick();
    expect(api.scores()).toHaveLength(1);
    expect(api.scores()[0]!.body).toEqual({ score: 9, playerName: 'Minh Anh' });
    expect(state()).toBe('saved');
    expect(window.localStorage.getItem('qp:nickname')).toBe('Minh Anh');
  });
});

describe('result states (AC25)', () => {
  it.each([
    [422, 'SCORE_REJECTED', 'rejected', 'Điểm của ván này không được ghi nhận.'],
    [409, 'SESSION_EXPIRED', 'expired', 'Phiên chơi đã hết hạn, điểm không được lưu.'],
    [409, 'SESSION_NOT_ACTIVE', 'not-saved', 'Không lưu được điểm cho ván này.'],
    [404, 'NOT_FOUND', 'not-saved', 'Không lưu được điểm cho ván này.'],
    [401, 'UNAUTHORIZED', 'not-saved', 'Không lưu được điểm cho ván này.'],
  ])('%i %s -> %s', async (status, code, expected, text) => {
    const api = installFetch({ score: () => err(status, code) });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    await gameOver(5);
    expect(state()).toBe(expected);
    expect(screen.getByTestId('score-result')).toHaveTextContent(text);
    expect(api.scores()).toHaveLength(1);
    expect(screen.queryByTestId('score-retry')).toBeNull();
  });

  it('shows pending while the request is in flight', async () => {
    installFetch({ score: () => new Promise<Response>(() => {}) });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    await gameOver(5);
    expect(state()).toBe('pending');
    expect(screen.getByTestId('score-result')).toHaveTextContent('Đang lưu điểm…');
  });
});

describe('retry (AC27)', () => {
  it('retries network/5xx twice (1 s, 3 s) with the same body and token, then offers retry', async () => {
    const api = installFetch({ score: () => err(503, 'INTERNAL_ERROR') });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    vi.useFakeTimers();
    await gameOver(12);
    expect(api.scores()).toHaveLength(1);
    expect(state()).toBe('pending');
    await tick(999);
    expect(api.scores()).toHaveLength(1);
    await tick(1);
    expect(api.scores()).toHaveLength(2);
    await tick(2999);
    expect(api.scores()).toHaveLength(2);
    await tick(1);
    expect(api.scores()).toHaveLength(3);
    expect(state()).toBe('error');
    expect(screen.getByTestId('score-result')).toHaveTextContent(
      'Không gửi được điểm. Kiểm tra kết nối và thử lại.',
    );
    await tick(10_000);
    expect(api.scores()).toHaveLength(3);
    for (const c of api.scores()) {
      expect(c.headers['X-Session-Token']).toBe(TOKEN_A);
      expect(c.body).toEqual({ score: 12, playerName: 'Lan' });
      expect(c.url).toBe(`/api/sessions/${ID_A}/score`);
    }
    expect(screen.getByTestId('score-retry')).toBeInTheDocument();
  });

  it('manual retry after error resubmits and can succeed', async () => {
    let n = 0;
    const api = installFetch({
      score: () => {
        n++;
        return n <= 3 ? err(500, 'INTERNAL_ERROR') : scored(ID_A, 1, false);
      },
    });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    vi.useFakeTimers();
    await gameOver(12);
    await tick(4000);
    expect(state()).toBe('error');
    fireEvent.click(screen.getByTestId('score-retry'));
    await tick();
    expect(api.scores()).toHaveLength(4);
    expect(api.scores()[3]!.headers['X-Session-Token']).toBe(TOKEN_A);
    expect(state()).toBe('saved');
    expect(screen.getByTestId('score-result')).not.toHaveTextContent('kỷ lục cá nhân');
  });

  it('network failure is retried like 5xx', async () => {
    let n = 0;
    const api = installFetch({
      score: () => {
        n++;
        if (n === 1) throw new TypeError('Failed to fetch');
        return scored(ID_A);
      },
    });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    vi.useFakeTimers();
    await gameOver(3);
    await tick(1000);
    expect(api.scores()).toHaveLength(2);
    expect(state()).toBe('saved');
  });

  it('429 is not retried automatically and has its own message', async () => {
    const api = installFetch({ score: () => err(429, 'RATE_LIMITED', { 'Retry-After': '30' }) });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    vi.useFakeTimers();
    await gameOver(3);
    await tick(10_000);
    expect(api.scores()).toHaveLength(1);
    expect(state()).toBe('error');
    expect(screen.getByTestId('score-result')).toHaveTextContent(
      'Bạn thao tác quá nhanh, vui lòng thử lại sau.',
    );
    expect(screen.getByTestId('score-retry')).toBeInTheDocument();
  });
});

describe('rounds (AC28, AC29)', () => {
  it('gameOver then ready back-to-back keeps tokens and results separate', async () => {
    let releaseFirst: (r: Response) => void = () => {};
    const api = installFetch({
      create: (n) => (n === 1 ? created(ID_A, TOKEN_A) : created(ID_B, TOKEN_B)),
      score: (_n, call) =>
        call.url.includes(ID_A)
          ? new Promise<Response>((res) => {
              releaseFirst = res;
            })
          : scored(ID_B, 1, true),
    });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    await act(async () => {
      host().onGameOver!(5);
      host().onReady!();
    });
    await tick();
    expect(api.sessions()).toHaveLength(2);
    expect(api.scores()).toHaveLength(1);
    expect(api.scores()[0]!.headers['X-Session-Token']).toBe(TOKEN_A);
    expect(api.scores()[0]!.body).toEqual({ score: 5, playerName: 'Lan' });

    await gameOver(7);
    expect(api.scores()).toHaveLength(2);
    expect(api.scores()[1]!.headers['X-Session-Token']).toBe(TOKEN_B);
    expect(api.scores()[1]!.url).toBe(`/api/sessions/${ID_B}/score`);
    expect(screen.getByTestId('score-result')).toHaveTextContent('Đã lưu điểm: 7. Hạng #1');

    // kết quả muộn của ván 1 không ghi đè ván 2
    await act(async () => releaseFirst(scored(ID_A, 9, false)));
    await tick();
    expect(screen.getByTestId('score-result')).toHaveTextContent('Đã lưu điểm: 7. Hạng #1');
  });

  it('session creation failure -> not-saved and no score request', async () => {
    const api = installFetch({ create: () => err(500, 'INTERNAL_ERROR') });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    await gameOver(5);
    expect(state()).toBe('not-saved');
    expect(api.scores()).toHaveLength(0);
  });

  it('gameOver while the session is still being created waits for it', async () => {
    let release: (r: Response) => void = () => {};
    const api = installFetch({
      create: () =>
        new Promise<Response>((res) => {
          release = res;
        }),
    });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    await gameOver(5);
    expect(api.scores()).toHaveLength(0);
    expect(state()).toBe('pending');
    await act(async () => release(created(ID_A, TOKEN_A)));
    await tick();
    expect(api.scores()).toHaveLength(1);
    expect(state()).toBe('saved');
  });
});

describe('needs-name across rounds and double retry', () => {
  it('a name entered after the next ready still submits round A with token A', async () => {
    const api = installFetch({
      create: (n) => (n === 1 ? created(ID_A, TOKEN_A) : created(ID_B, TOKEN_B)),
    });
    await renderPage();
    await ready();
    await gameOver(9);
    expect(state()).toBe('needs-name');
    await ready(); // ván B bắt đầu trong khi ván A còn chờ tên
    expect(api.sessions()).toHaveLength(2);
    expect(api.sessions()[0]!.signal?.aborted).toBe(false);
    expect(api.scores()).toHaveLength(0);

    setName('Lan');
    fireEvent.click(screen.getByTestId('score-save'));
    await tick();
    expect(api.scores()).toHaveLength(1);
    const call = api.scores()[0]!;
    expect(call.url).toBe(`/api/sessions/${ID_A}/score`);
    expect(call.headers['X-Session-Token']).toBe(TOKEN_A);
    expect(call.body).toEqual({ score: 9, playerName: 'Lan' });
    expect(state()).toBe('saved');

    // ván B vẫn dùng token B
    await gameOver(2);
    expect(api.scores()).toHaveLength(2);
    expect(api.scores()[1]!.headers['X-Session-Token']).toBe(TOKEN_B);
  });

  it('two quick retry clicks send a single request and end consistent', async () => {
    let n = 0;
    let release: (r: Response) => void = () => {};
    const api = installFetch({
      score: () => {
        n++;
        if (n <= 3) return err(500, 'INTERNAL_ERROR');
        return new Promise<Response>((res) => {
          release = res;
        });
      },
    });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    vi.useFakeTimers();
    await gameOver(12);
    await tick(4000);
    expect(state()).toBe('error');
    expect(api.scores()).toHaveLength(3);

    const retryButton = screen.getByTestId('score-retry');
    await act(async () => {
      fireEvent.click(retryButton);
      fireEvent.click(retryButton);
    });
    await tick();
    expect(api.scores()).toHaveLength(4);
    expect(state()).toBe('pending');

    await act(async () => release(scored(ID_A, 2, false)));
    await tick();
    expect(api.scores()).toHaveLength(4);
    expect(state()).toBe('saved');
  });
});

describe('unmount (AC30)', () => {
  it('aborts in-flight requests and does not update state afterwards', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let release: (r: Response) => void = () => {};
    const api = installFetch({
      score: () =>
        new Promise<Response>((res) => {
          release = res;
        }),
    });
    window.localStorage.setItem('qp:nickname', 'Lan');
    const { unmount } = await renderPage();
    await ready();
    await gameOver(5);
    unmount();
    expect(api.scores()[0]!.signal?.aborted).toBe(true);
    expect(api.boards()[0]!.signal?.aborted).toBe(true);
    await act(async () => release(scored(ID_A)));
    await tick();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('pending retry timers are cancelled on unmount', async () => {
    const api = installFetch({ score: () => err(500, 'INTERNAL_ERROR') });
    window.localStorage.setItem('qp:nickname', 'Lan');
    const { unmount } = await renderPage();
    await ready();
    vi.useFakeTimers();
    await gameOver(5);
    unmount();
    await tick(10_000);
    expect(api.scores()).toHaveLength(1);
  });
});

describe('leaderboard (AC31)', () => {
  it('renders player names as plain text', async () => {
    installFetch({
      leaderboard: () =>
        json({
          gameId: 'snake',
          scoreOrder: 'desc',
          items: [
            {
              rank: 1,
              playerName: '<img src=x onerror=alert(1)>',
              score: 40,
              durationMs: 65_000,
              achievedAt: '2026-10-24T08:00:00.000Z',
            },
            { rank: 2, playerName: 'Lan', score: 30, durationMs: 9_000, achievedAt: 'x' },
          ],
        }),
    });
    await renderPage();
    const rows = screen.getAllByTestId('leaderboard-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(rows[0]!.querySelector('img')).toBeNull();
    expect(rows[0]).toHaveTextContent('#1');
    expect(rows[0]).toHaveTextContent('40');
    expect(rows[0]).toHaveTextContent('1:05');
    expect(rows[1]).toHaveTextContent('9 giây');
    expect(screen.getByRole('columnheader', { name: 'Điểm' })).toBeInTheDocument();
  });

  it('shows "Số lượt" column for asc games', async () => {
    installFetch({
      leaderboard: () =>
        json({
          gameId: 'snake',
          scoreOrder: 'asc',
          items: [{ rank: 1, playerName: 'Lan', score: 11, durationMs: 1000, achievedAt: 'x' }],
        }),
    });
    await renderPage();
    expect(screen.getByRole('columnheader', { name: 'Số lượt' })).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    installFetch({});
    await renderPage();
    expect(screen.getByTestId('leaderboard-empty')).toBeInTheDocument();
  });

  it('shows error and retries', async () => {
    let n = 0;
    const api = installFetch({
      leaderboard: () =>
        ++n === 1
          ? err(500, 'INTERNAL_ERROR')
          : json({ gameId: 'snake', scoreOrder: 'desc', items: [] }),
    });
    await renderPage();
    expect(screen.getByTestId('leaderboard-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('leaderboard-retry'));
    await tick();
    expect(screen.getByTestId('leaderboard-empty')).toBeInTheDocument();
    expect(api.boards()).toHaveLength(2);
  });
});

describe('unranked games (AC14, FE part)', () => {
  it.each([
    ['ranked false', { ranked: false }],
    ['ranked missing', {}],
  ])('%s: no sessions, no leaderboard, shows note', async (_n, extra) => {
    const unranked: Game = { ...baseGame, ...extra };
    delete unranked.scoreOrder;
    if (!('ranked' in extra)) delete unranked.ranked;
    const api = installFetch({ game: unranked });
    await renderPage();
    expect(screen.getByTestId('unranked-note')).toHaveTextContent('Game này không xếp hạng.');
    expect(screen.queryByTestId('leaderboard')).toBeNull();
    expect(screen.queryByTestId('nickname-input')).toBeNull();
    expect(host().onReady).toBeUndefined();
    expect(host().onGameOver).toBeUndefined();
    expect(api.sessions()).toHaveLength(0);
    expect(api.boards()).toHaveLength(0);
  });
});
