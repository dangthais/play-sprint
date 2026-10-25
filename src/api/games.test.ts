import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client.ts';
import { fetchGame } from './games.ts';

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const game = {
  id: 'snake',
  title: 'Snake',
  thumbnailUrl: 'http://x/t.svg',
  embedUrl: 'http://x/g/',
  orientation: 'any',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('fetchGame', () => {
  it('returns game and encodes id', async () => {
    const f = vi.fn((_url: string) => Promise.resolve(json(game)));
    vi.stubGlobal('fetch', f);
    await expect(fetchGame('a/b?c')).resolves.toEqual(game);
    expect(f.mock.calls[0]![0]).toBe('/api/games/a%2Fb%3Fc');
  });

  it('maps 404 to ApiError NOT_FOUND', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ code: 'NOT_FOUND', message: 'x' }, 404))),
    );
    await expect(fetchGame('nope')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it.each([{}, { ...game, embedUrl: 5 }, { ...game, orientation: 'diagonal' }, null])(
    'rejects invalid shape %#',
    async (body) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(json(body))),
      );
      await expect(fetchGame('snake')).rejects.toBeInstanceOf(ApiError);
    },
  );
});
