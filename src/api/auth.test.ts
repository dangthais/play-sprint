import { afterEach, describe, expect, it, vi } from 'vitest';
import { USER, json, noContent } from '../features/auth/testApi.ts';
import { fetchMe, login, logout, register } from './auth.ts';

afterEach(() => vi.unstubAllGlobals());

function lastCall(f: ReturnType<typeof vi.fn>) {
  const [url, init] = f.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, body: JSON.parse(String(init.body ?? 'null')) as unknown };
}

describe('auth api', () => {
  it('register posts the body and returns the user', async () => {
    const f = vi.fn().mockResolvedValue(json({ user: USER }, 201));
    vi.stubGlobal('fetch', f);
    const input = { email: 'lan@example.com', password: 'mat-khau-dai-9', displayName: 'Lan' };
    expect(await register(input)).toEqual(USER);
    const c = lastCall(f);
    expect(c.url).toBe('/api/auth/register');
    expect(c.init.method).toBe('POST');
    expect(c.body).toEqual(input);
  });

  it('login posts email and password', async () => {
    const f = vi.fn().mockResolvedValue(json({ user: USER }));
    vi.stubGlobal('fetch', f);
    expect(await login('lan@example.com', 'pw-12345678')).toEqual(USER);
    expect(lastCall(f).body).toEqual({ email: 'lan@example.com', password: 'pw-12345678' });
  });

  it('login maps 401 to ApiError INVALID_CREDENTIALS', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ code: 'INVALID_CREDENTIALS', message: 'm' }, 401)),
    );
    await expect(login('a@b.co', 'x')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects a malformed user payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ user: { id: 1 } })));
    await expect(login('a@b.co', 'x')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('logout accepts 204', async () => {
    const f = vi.fn().mockResolvedValue(noContent());
    vi.stubGlobal('fetch', f);
    await expect(logout()).resolves.toBeUndefined();
    expect(lastCall(f).url).toBe('/api/auth/logout');
  });

  it('fetchMe returns the user or null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ user: USER })));
    expect(await fetchMe()).toEqual(USER);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ user: null })));
    expect(await fetchMe()).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({})));
    await expect(fetchMe()).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});
