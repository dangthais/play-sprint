import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../../api/types.ts';
import type { AuthContextValue } from '../auth/authContext.ts';
import { USER, json } from '../auth/testApi.ts';
import { GamePlayPage } from '../play/GamePlayPage.tsx';
import { NAME_TAKEN_GUEST_TEXT } from './ScoreResult.tsx';

interface HostProps {
  onReady?: () => void;
  onGameOver?: (score: number) => void;
}
const hostProps = vi.fn<(p: HostProps) => void>();
vi.mock('../game-host/GameHost.tsx', () => ({
  GameHost: (props: HostProps) => {
    hostProps(props);
    return <div data-testid="game-host" />;
  },
}));

let authValue: Pick<AuthContextValue, 'status' | 'user'> = { status: 'anonymous', user: null };
vi.mock('../auth/useAuth.ts', () => ({ useAuth: () => authValue }));

const game: Game = {
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

const TOKEN = 'A'.repeat(43);
const ID = '00000000-0000-4000-8000-00000000000a';
const session = {
  id: ID,
  gameId: 'snake',
  status: 'active',
  startedAt: 'x',
  expiresAt: 'y',
  endedAt: null,
  score: null,
  durationMs: null,
  playerName: null,
};
const err = (status: number, code: string) => json({ code, message: 'x' }, status);

interface Call {
  url: string;
  body: unknown;
  headers: Record<string, string>;
}

function install(opts: { score?: (n: number) => Response; items?: unknown[] }) {
  const calls: Call[] = [];
  let scores = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      if (url === '/api/games/snake') return Promise.resolve(json(game));
      if (url.startsWith('/api/games/snake/leaderboard')) {
        return Promise.resolve(
          json({ gameId: 'snake', scoreOrder: 'desc', items: opts.items ?? [] }),
        );
      }
      if (url === '/api/sessions') {
        return Promise.resolve(json({ session, sessionToken: TOKEN }, 201));
      }
      if (url.endsWith('/score')) {
        return Promise.resolve(
          opts.score?.(++scores) ??
            json({ session: { ...session, status: 'finished' }, rank: 2, personalBest: false }),
        );
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    }),
  );
  return { scores: () => calls.filter((c) => c.url.endsWith('/score')) };
}

async function tick() {
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
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
const state = () => screen.getByTestId('score-result').getAttribute('data-state');
const setName = (v: string) =>
  fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: v } });
const BADGE = '[data-testid="leaderboard-member-badge"]';

beforeEach(() => {
  hostProps.mockClear();
  window.localStorage.clear();
  authValue = { status: 'anonymous', user: null };
});
afterEach(() => vi.unstubAllGlobals());

describe('AC33: signed-in play', () => {
  it('hides nickname, shows playing-as, submits exactly {score}', async () => {
    authValue = {
      status: 'authenticated',
      user: { ...USER, displayName: '<img src=x onerror=alert(1)>' },
    };
    window.localStorage.setItem('qp:nickname', 'Cũ');
    const api = install({});
    await renderPage();
    expect(screen.queryByTestId('nickname-input')).toBeNull();
    const as = screen.getByTestId('playing-as');
    expect(as).toHaveTextContent('Đang chơi với tên <img src=x onerror=alert(1)>');
    expect(as.querySelector('img')).toBeNull();

    await ready();
    await gameOver(21);
    expect(state()).toBe('saved');
    expect(api.scores()).toHaveLength(1);
    const call = api.scores()[0]!;
    expect(call.body).toEqual({ score: 21 });
    expect(Object.keys(call.body as object)).toEqual(['score']);
    expect(call.headers['X-Session-Token']).toBe(TOKEN);
    expect(window.localStorage.getItem('qp:nickname')).toBe('Cũ');
  });

  it('never enters needs-name and leaves qp:nickname untouched', async () => {
    authValue = { status: 'authenticated', user: USER };
    install({});
    await renderPage();
    await ready();
    await gameOver(3);
    expect(state()).not.toBe('needs-name');
    expect(window.localStorage.getItem('qp:nickname')).toBeNull();
  });

  it('404 on submit -> not-saved', async () => {
    authValue = { status: 'authenticated', user: USER };
    install({ score: () => err(404, 'NOT_FOUND') });
    await renderPage();
    await ready();
    await gameOver(3);
    expect(state()).toBe('not-saved');
  });

  it('uses the identity at gameOver time (guest -> account mid-round)', async () => {
    const api = install({});
    const utils = await renderPage();
    await ready();
    authValue = { status: 'authenticated', user: USER };
    utils.rerender(<GamePlayPage id="snake" />);
    await gameOver(8);
    expect(api.scores()[0]!.body).toEqual({ score: 8 });
    expect(state()).toBe('saved');
  });

  it('waits while auth is loading, then submits with the resolved identity', async () => {
    authValue = { status: 'loading', user: null };
    const api = install({});
    const utils = await renderPage();
    expect(screen.getByTestId('nickname-input')).toBeInTheDocument();
    await ready();
    await gameOver(8);
    expect(api.scores()).toHaveLength(0);
    expect(state()).toBe('pending');
    authValue = { status: 'authenticated', user: USER };
    utils.rerender(<GamePlayPage id="snake" />);
    await tick();
    expect(api.scores()).toHaveLength(1);
    expect(api.scores()[0]!.body).toEqual({ score: 8 });
  });
});

describe('AC34: guest name taken', () => {
  it('shows name-taken, then resubmits on the same session and token', async () => {
    const api = install({
      score: (n) =>
        n <= 2 ? err(409, 'NAME_TAKEN') : json({ session, rank: 1, personalBest: true }),
    });
    window.localStorage.setItem('qp:nickname', 'Lan');
    await renderPage();
    await ready();
    await gameOver(5);
    expect(state()).toBe('name-taken');
    expect(NAME_TAKEN_GUEST_TEXT).toBe(
      'Tên này thuộc về một thành viên. Hãy chọn tên khác hoặc đăng nhập.',
    );
    expect(screen.getByTestId('score-result')).toHaveTextContent(NAME_TAKEN_GUEST_TEXT);
    expect(screen.getByTestId('nickname-error')).toHaveTextContent(NAME_TAKEN_GUEST_TEXT);
    expect(api.scores()).toHaveLength(1); // không tự retry
    expect(window.localStorage.getItem('qp:nickname')).toBe('Lan');

    // vẫn tên cũ -> server từ chối lần nữa
    fireEvent.click(screen.getByTestId('score-save'));
    await tick();
    expect(api.scores()).toHaveLength(2);
    expect(state()).toBe('name-taken');

    setName('Lan Anh');
    expect(screen.queryByTestId('nickname-error')).toBeNull();
    fireEvent.click(screen.getByTestId('score-save'));
    await tick();
    expect(api.scores()).toHaveLength(3);
    for (const c of api.scores()) {
      expect(c.url).toBe(`/api/sessions/${ID}/score`);
      expect(c.headers['X-Session-Token']).toBe(TOKEN);
    }
    expect(api.scores()[2]!.body).toEqual({ score: 5, playerName: 'Lan Anh' });
    expect(state()).toBe('saved');
    expect(window.localStorage.getItem('qp:nickname')).toBe('Lan Anh');
  });
});

describe('AC35: member badge', () => {
  it('shows the badge only when isMember is true; names stay text', async () => {
    const entry = { score: 9, durationMs: 1000, achievedAt: 'x' };
    install({
      items: [
        { ...entry, rank: 1, playerName: '<img src=x onerror=alert(1)>', isMember: true },
        { ...entry, rank: 2, playerName: 'Khách', isMember: false },
        { ...entry, rank: 3, playerName: 'Cũ' },
      ],
    });
    await renderPage();
    const rows = screen.getAllByTestId('leaderboard-row');
    expect(rows[0]!.querySelector(BADGE)).toHaveTextContent('Thành viên');
    expect(rows[0]).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(rows[0]!.querySelector('img')).toBeNull();
    expect(rows[1]!.querySelector(BADGE)).toBeNull();
    expect(rows[2]!.querySelector(BADGE)).toBeNull();
    expect(screen.getAllByTestId('leaderboard-member-badge')).toHaveLength(1);
  });
});
