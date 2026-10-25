import { vi } from 'vitest';

export const USER = {
  id: '9b2e4c1a-0d7f-4f43-8f0e-2a6c5b1d3e77',
  email: 'lan@example.com',
  displayName: 'Lan',
  createdAt: '2026-10-24T08:00:00.000Z',
};

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const noContent = () => new Response(null, { status: 204 });

export interface Call {
  method: string;
  path: string;
  search: string;
  url: string;
  body: unknown;
  init: RequestInit;
}

export type Handler = (call: Call) => Response | Promise<Response>;

/** fetch giả theo contract: khoá handler là "METHOD /api/path". Mặc định: khách, catalog rỗng. */
export function stubApi(handlers: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  const f = vi.fn((input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost');
    const method = init.method ?? 'GET';
    const call: Call = {
      method,
      path: url.pathname,
      search: url.search,
      url: input,
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      init,
    };
    calls.push(call);
    const handler = handlers[`${method} ${url.pathname}`];
    if (handler) return Promise.resolve(handler(call));
    if (method === 'GET' && url.pathname === '/api/auth/me')
      return Promise.resolve(json({ user: null }));
    if (method === 'GET' && url.pathname === '/api/games') {
      return Promise.resolve(json({ items: [], total: 0, page: 1, limit: 12 }));
    }
    return Promise.resolve(json({ code: 'NOT_FOUND', message: 'x' }, 404));
  });
  vi.stubGlobal('fetch', f);
  return {
    calls,
    fetch: f,
    of: (method: string, path: string) =>
      calls.filter((c) => c.method === method && c.path === path),
  };
}
