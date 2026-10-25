import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getJson, patchJson, postJson } from './client.ts';
import { fetchGames } from './games.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('getJson', () => {
  it('returns parsed body on 2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ a: 1 })));
    expect(await getJson('/x')).toEqual({ a: 1 });
  });

  it('maps error body to ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ code: 'VALIDATION_ERROR', message: 'bad' }, 400)),
    );
    await expect(getJson('/x')).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });

  it('non-JSON error body gives UNKNOWN and hides raw body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>stack</html>', { status: 500 })),
    );
    const err = await getJson('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('UNKNOWN');
    expect((err as ApiError).message).not.toContain('stack');
  });

  it('non-JSON body on 200 is an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 200 })));
    await expect(getJson('/x')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('network failure gives NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
    await expect(getJson('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('rethrows AbortError unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('a', 'AbortError')));
    await expect(getJson('/x')).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('fetchGames', () => {
  it('calls /api/games with page and limit', async () => {
    const f = vi.fn().mockResolvedValue(json({ items: [], total: 0, page: 2, limit: 12 }));
    vi.stubGlobal('fetch', f);
    await fetchGames({ page: 2, limit: 12 });
    expect(f.mock.calls[0]?.[0]).toBe('/api/games?page=2&limit=12');
  });

  it('rejects malformed payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ foo: 1 })));
    await expect(fetchGames({ page: 1, limit: 12 })).rejects.toBeInstanceOf(ApiError);
  });
});

describe('postJson', () => {
  it('sends JSON body with extra headers and signal', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: 1 }, 201));
    vi.stubGlobal('fetch', f);
    const controller = new AbortController();
    const res = await postJson(
      '/x',
      { a: 1 },
      { headers: { 'X-Test': 'v' }, signal: controller.signal },
    );
    expect(res).toEqual({ ok: 1 });
    const init = f.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.signal).toBe(controller.signal);
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-Test': 'v' });
  });

  it('maps error body to ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ code: 'SCORE_REJECTED', message: 'm' }, 422)),
    );
    await expect(postJson('/x', {})).rejects.toMatchObject({ status: 422, code: 'SCORE_REJECTED' });
  });
});

describe('credentials, patchJson and 204', () => {
  it('sends credentials: same-origin on GET, POST and PATCH', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(json({ ok: 1 })));
    vi.stubGlobal('fetch', f);
    await getJson('/x');
    await postJson('/x', {});
    await patchJson('/x', {});
    for (const call of f.mock.calls) {
      expect((call[1] as RequestInit).credentials).toBe('same-origin');
    }
  });

  it('patchJson sends a JSON body with PATCH', async () => {
    const f = vi.fn().mockResolvedValue(json({ user: 1 }));
    vi.stubGlobal('fetch', f);
    expect(await patchJson('/me', { displayName: 'Lan' })).toEqual({ user: 1 });
    const init = f.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"displayName":"Lan"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('204 resolves undefined without parsing a body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(postJson('/auth/logout', {})).resolves.toBeUndefined();
  });

  it('keeps ApiError with retryAfterSec for 429', async () => {
    const res = new Response(JSON.stringify({ code: 'RATE_LIMITED', message: 'm' }), {
      status: 429,
      headers: { 'Retry-After': '12' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    await expect(patchJson('/me', {})).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSec: 12,
    });
  });
});
