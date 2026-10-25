import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GAME_ORIGIN, normaliseOrigin } from './config.ts';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('normaliseOrigin', () => {
  it('reduces to origin', () => {
    expect(normaliseOrigin('https://games.example.com/a/b?x=1')).toBe('https://games.example.com');
    expect(normaliseOrigin('http://localhost:5174/')).toBe('http://localhost:5174');
  });
  it.each([undefined, '', 'nope', 'javascript:alert(1)', 'ftp://x.com', '*'])('rejects %s', (v) => {
    expect(normaliseOrigin(v)).toBeNull();
  });
});

describe('GAME_ORIGIN', () => {
  it('reads and normalises VITE_GAME_ORIGIN', async () => {
    vi.stubEnv('VITE_GAME_ORIGIN', 'https://g.example.com/path');
    const m = await import('./config.ts');
    expect(m.GAME_ORIGIN).toBe('https://g.example.com');
  });
  it('falls back to default when invalid', async () => {
    vi.stubEnv('VITE_GAME_ORIGIN', 'javascript:alert(1)');
    const m = await import('./config.ts');
    expect(m.GAME_ORIGIN).toBe(DEFAULT_GAME_ORIGIN);
  });
});
