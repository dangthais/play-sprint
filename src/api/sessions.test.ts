import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client.ts';
import { fetchLeaderboard } from './leaderboard.ts';
import { createSession, submitScore } from './sessions.ts';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

afterEach(() => vi.unstubAllGlobals());

const TOKEN = 'T'.repeat(43);
const session = { id: 'sid', gameId: 'snake', status: 'active' };

describe('createSession', () => {
  it('POSTs gameId as JSON', async () => {
    const f = vi.fn().mockResolvedValue(json({ session, sessionToken: TOKEN }, 201));
    vi.stubGlobal('fetch', f);
    const res = await createSession('snake');
    expect(res.sessionToken).toBe(TOKEN);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/sessions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ gameId: 'snake' });
  });

  it('rejects malformed payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ foo: 1 }, 201)));
    await expect(createSession('snake')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('submitScore', () => {
  it('puts the token only in the header and encodes the id', async () => {
    const f = vi.fn().mockResolvedValue(json({ session, rank: 2, personalBest: true }));
    vi.stubGlobal('fetch', f);
    await submitScore('a/b c', TOKEN, { score: 5, playerName: 'Lan' });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/sessions/a%2Fb%20c/score');
    expect(url).not.toContain(TOKEN);
    expect((init.headers as Record<string, string>)['X-Session-Token']).toBe(TOKEN);
    expect(init.body as string).not.toContain(TOKEN);
    expect(JSON.parse(init.body as string)).toEqual({ score: 5, playerName: 'Lan' });
  });

  it('parses Retry-After on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ code: 'RATE_LIMITED', message: 'x' }, 429, { 'Retry-After': '12' }),
        ),
    );
    await expect(submitScore('i', TOKEN, { score: 1, playerName: 'a' })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSec: 12,
    });
  });

  it('ignores a bad Retry-After and non-429 headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          json({ code: 'RATE_LIMITED', message: 'x' }, 429, { 'Retry-After': 'soon' }),
        )
        .mockResolvedValueOnce(
          json({ code: 'INTERNAL_ERROR', message: 'x' }, 500, { 'Retry-After': '3' }),
        ),
    );
    const a = await submitScore('i', TOKEN, { score: 1, playerName: 'a' }).catch((e: unknown) => e);
    expect((a as ApiError).retryAfterSec).toBeUndefined();
    const b = await submitScore('i', TOKEN, { score: 1, playerName: 'a' }).catch((e: unknown) => e);
    expect((b as ApiError).retryAfterSec).toBeUndefined();
  });

  it('maps network failure to status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
    await expect(submitScore('i', TOKEN, { score: 1, playerName: 'a' })).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
});

describe('submitScore without playerName', () => {
  it('omits the playerName key entirely', async () => {
    const f = vi.fn().mockResolvedValue(json({ session, rank: 1, personalBest: true }));
    vi.stubGlobal('fetch', f);
    await submitScore('i', TOKEN, { score: 7 });
    const [, init] = f.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"score":7}');
  });
});

describe('fetchLeaderboard', () => {
  it('requests with limit (default 10)', async () => {
    const f = vi.fn((_u: string) =>
      Promise.resolve(json({ gameId: 'x', scoreOrder: 'desc', items: [] })),
    );
    vi.stubGlobal('fetch', f);
    await fetchLeaderboard('snake');
    expect(f.mock.calls[0]?.[0]).toBe('/api/games/snake/leaderboard?limit=10');
    await fetchLeaderboard('a/b', 5);
    expect(f.mock.calls[1]?.[0]).toBe('/api/games/a%2Fb/leaderboard?limit=5');
  });

  it('rejects malformed payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ gameId: 'x' })));
    await expect(fetchLeaderboard('x')).rejects.toBeInstanceOf(ApiError);
  });
});
