import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../../api/types.ts';
import { resetCatalogForTests, retryCatalog, useCatalog, useCategories } from './catalog.ts';

function game(id: string, tags: string[]): Game {
  return {
    id,
    title: id,
    thumbnailUrl: 'http://localhost:5173/t.svg',
    embedUrl: `http://localhost:5174/games/${id}/`,
    orientation: 'any',
    tags,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function Probe({ id }: { id: string }) {
  const c = useCatalog();
  const cats = useCategories();
  return (
    <p data-testid={id}>
      {c.status === 'ready'
        ? `ready:${c.games.length}:${cats.map((x) => x.slug).join(',')}`
        : c.status}
    </p>
  );
}

beforeEach(() => resetCatalogForTests());
afterEach(() => {
  vi.unstubAllGlobals();
  resetCatalogForTests();
});

describe('catalog store', () => {
  it('fetches limit=100 once and shares it between consumers', async () => {
    const f = vi.fn((_u: string, _i?: RequestInit) =>
      Promise.resolve(
        json({
          items: [game('a', ['arcade']), game('b', ['puzzle', 'numbers'])],
          total: 2,
          page: 1,
          limit: 100,
        }),
      ),
    );
    vi.stubGlobal('fetch', f);
    render(
      <>
        <Probe id="one" />
        <Probe id="two" />
      </>,
    );
    expect(screen.getByTestId('one')).toHaveTextContent('loading');
    await screen.findAllByText('ready:2:arcade,puzzle');
    expect(screen.getByTestId('two')).toHaveTextContent('ready:2:arcade,puzzle');
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]![0]).toBe('/api/games?page=1&limit=100');
  });

  it('reuses the cache for later mounts without another request', async () => {
    const f = vi.fn(() =>
      Promise.resolve(json({ items: [game('a', [])], total: 1, page: 1, limit: 100 })),
    );
    vi.stubGlobal('fetch', f);
    const first = render(<Probe id="x" />);
    await screen.findByText('ready:1:');
    first.unmount();
    render(<Probe id="y" />);
    expect(screen.getByTestId('y')).toHaveTextContent('ready:1:');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('reports an error state quietly and can retry', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValue(json({ items: [game('a', ['board'])], total: 1, page: 1, limit: 100 }));
    vi.stubGlobal('fetch', f);
    render(<Probe id="x" />);
    await screen.findByText('error');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => retryCatalog());
    await screen.findByText('ready:1:board');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('aborts the request when the last consumer unmounts', () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise(() => {});
      }),
    );
    const { unmount } = render(<Probe id="x" />);
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('rapid subscribe, unsubscribe, subscribe: request 1 is aborted and its late response is ignored', async () => {
    const resolvers: Array<(r: Response) => void> = [];
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise<Response>((resolve) => resolvers.push(resolve));
      }),
    );
    const first = render(<Probe id="a" />);
    first.unmount();
    render(<Probe id="b" />);
    expect(resolvers).toHaveLength(2);
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
    await act(async () => {
      resolvers[1]!(
        json({ items: [game('b1', []), game('b2', [])], total: 2, page: 1, limit: 100 }),
      );
    });
    await screen.findByText('ready:2:');
    await act(async () => {
      resolvers[0]!(json({ items: [game('late', [])], total: 1, page: 1, limit: 100 }));
    });
    expect(screen.getByTestId('b')).toHaveTextContent('ready:2:');
  });

  it('after an error and all consumers leaving, the next mount loads again', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValue(json({ items: [game('a', ['board'])], total: 1, page: 1, limit: 100 }));
    vi.stubGlobal('fetch', f);
    const first = render(<Probe id="x" />);
    await screen.findByText('error');
    first.unmount();
    render(<Probe id="y" />);
    await screen.findByText('ready:1:board');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('warns in dev when the catalog is larger than the loaded page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(json({ items: [game('a', [])], total: 150, page: 1, limit: 100 })),
      ),
    );
    render(<Probe id="x" />);
    await screen.findByText('ready:1:');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('150');
    warn.mockRestore();
  });
});
