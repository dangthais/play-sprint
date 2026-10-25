import { afterEach, describe, expect, it, vi } from 'vitest';
import { USER, json, noContent } from '../features/auth/testApi.ts';
import { changePassword, fetchBests, fetchHistory, updateDisplayName } from './me.ts';

afterEach(() => vi.unstubAllGlobals());

describe('me api', () => {
  it('updateDisplayName PATCHes /api/me', async () => {
    const f = vi.fn().mockResolvedValue(json({ user: { ...USER, displayName: 'Lan Anh' } }));
    vi.stubGlobal('fetch', f);
    const user = await updateDisplayName('Lan Anh');
    expect(user.displayName).toBe('Lan Anh');
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/me');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"displayName":"Lan Anh"}');
  });

  it('changePassword POSTs both passwords and accepts 204', async () => {
    const f = vi.fn().mockResolvedValue(noContent());
    vi.stubGlobal('fetch', f);
    await expect(changePassword('old-password', 'new-password-1')).resolves.toBeUndefined();
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/me/password');
    expect(JSON.parse(String(init.body))).toEqual({
      currentPassword: 'old-password',
      newPassword: 'new-password-1',
    });
  });

  it('changePassword surfaces 403 INVALID_CREDENTIALS', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ code: 'INVALID_CREDENTIALS', message: 'm' }, 403)),
    );
    await expect(changePassword('x', 'y')).rejects.toMatchObject({
      status: 403,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('fetchHistory sends page and limit', async () => {
    const f = vi.fn().mockResolvedValue(json({ items: [], total: 0, page: 2, limit: 20 }));
    vi.stubGlobal('fetch', f);
    await fetchHistory(2, 20);
    expect(f.mock.calls[0]?.[0]).toBe('/api/me/sessions?page=2&limit=20');
  });

  it('fetchHistory and fetchBests reject malformed payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ foo: 1 })));
    await expect(fetchHistory(1, 20)).rejects.toMatchObject({ code: 'UNKNOWN' });
    await expect(fetchBests()).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('fetchBests returns the items', async () => {
    const item = {
      gameId: 'snake',
      gameTitle: 'Snake',
      scoreOrder: 'desc',
      score: 5,
      durationMs: 1000,
      achievedAt: '2026-10-24T08:00:00.000Z',
      plays: 2,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ items: [item] })));
    expect(await fetchBests()).toEqual([item]);
  });
});
