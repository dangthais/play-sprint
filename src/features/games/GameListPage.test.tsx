import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../../api/types.ts';
import { resetCatalogForTests } from '../catalog/catalog.ts';
import { GameListPage } from './GameListPage.tsx';

function makeGames(n: number): Game[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `game-${i + 1}`,
    title: `Game ${i + 1}`,
    thumbnailUrl: `http://localhost:5173/thumbnails/game-${i + 1}.svg`,
    embedUrl: `http://localhost:5174/games/game-${i + 1}/`,
    orientation: 'any' as const,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  }));
}

function pageResponse(all: Game[], url: string): Response {
  const u = new URL(url, 'http://localhost');
  const page = Number(u.searchParams.get('page'));
  const limit = Number(u.searchParams.get('limit'));
  const items = all.slice((page - 1) * limit, page * limit);
  return new Response(JSON.stringify({ items, total: all.length, page, limit }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(all: Game[]) {
  const f = vi.fn((url: string) => Promise.resolve(pageResponse(all, url)));
  vi.stubGlobal('fetch', f);
  return f;
}

const isCatalog = (url: string) => url.includes('limit=100');

/** URL các request của lưới phân trang (limit=12), không tính request catalog dùng chung. */
function urls(f: ReturnType<typeof vi.fn>): string[] {
  return f.mock.calls.map((c) => String(c[0])).filter((u) => !isCatalog(u));
}

beforeEach(() => {
  resetCatalogForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetCatalogForTests();
});

describe('GameListPage', () => {
  it('shows loading then grid with cards', async () => {
    const f = stubFetch(makeGames(25));
    render(<GameListPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải…');
    const grid = await screen.findByTestId('game-grid');
    expect(grid).toHaveAttribute('aria-label', 'Danh sách game');
    expect(urls(f)).toEqual(['/api/games?page=1&limit=12']);
    const cards = screen.getAllByTestId('game-card');
    expect(cards).toHaveLength(12);
    expect(cards[0]).toHaveAttribute('data-game-id', 'game-1');
    expect(within(cards[0]!).getByRole('heading', { level: 2 })).toHaveTextContent('Game 1');
    const img = within(cards[0]!).getByTestId('game-thumbnail');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('width', '320');
    expect(img).toHaveAttribute('height', '240');
  });

  it('wraps thumbnail and title in a link to the game page', async () => {
    stubFetch(makeGames(2));
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    const card = screen.getAllByTestId('game-card')[0]!;
    const link = within(card).getByTestId('game-link');
    expect(link).toHaveAttribute('href', '/games/game-1');
    expect(link).toContainElement(within(card).getByTestId('game-thumbnail'));
    expect(link).toContainElement(within(card).getByRole('heading', { level: 2 }));
  });

  it('paginates next/prev, pushes URL and disables at edges', async () => {
    const user = userEvent.setup();
    stubFetch(makeGames(25));
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 1 / 3');
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() =>
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 2 / 3'),
    );
    expect(window.location.search).toBe('?page=2');
    expect(screen.getAllByTestId('game-card')[0]).toHaveAttribute('data-game-id', 'game-13');

    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() =>
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 3 / 3'),
    );
    expect(screen.getAllByTestId('game-card')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Trang trước' }));
    await waitFor(() =>
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 2 / 3'),
    );
  });

  it('restores page on popstate and keeps other params', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?foo=bar');
    stubFetch(makeGames(25));
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() =>
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 2 / 3'),
    );
    expect(new URLSearchParams(window.location.search).get('foo')).toBe('bar');

    act(() => {
      window.history.replaceState(null, '', '/?foo=bar&page=1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 1 / 3'),
    );
  });

  it.each(['abc', '0', '-2', '1.5', '10001', '20000'])(
    'normalises ?page=%s to page 1',
    async (bad) => {
      const f = stubFetch(makeGames(25));
      window.history.replaceState(null, '', `/?page=${bad}&x=1`);
      render(<GameListPage />);
      await screen.findByTestId('game-grid');
      expect(urls(f)).toEqual(['/api/games?page=1&limit=12']);
      expect(new URLSearchParams(window.location.search).get('page')).toBe('1');
      expect(new URLSearchParams(window.location.search).get('x')).toBe('1');
    },
  );

  it('shows empty state for out-of-range page and goes back to page 1', async () => {
    const user = userEvent.setup();
    const f = stubFetch(makeGames(25));
    window.history.replaceState(null, '', '/?page=99');
    render(<GameListPage />);
    const empty = await screen.findByTestId('empty-state');
    expect(empty).toHaveTextContent('Trang này không có game.');
    expect(screen.queryByRole('navigation', { name: 'Phân trang' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Về trang đầu' }));
    await screen.findByTestId('game-grid');
    expect(window.location.search).toBe('?page=1');
    expect(urls(f)).toEqual(['/api/games?page=99&limit=12', '/api/games?page=1&limit=12']);
  });

  it('shows empty state with no pagination when total is 0', async () => {
    stubFetch([]);
    render(<GameListPage />);
    expect(await screen.findByTestId('empty-state')).toHaveTextContent('Chưa có game nào.');
    expect(screen.queryByRole('button', { name: 'Về trang đầu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('hides pagination when only one page', async () => {
    stubFetch(makeGames(5));
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    expect(screen.queryByRole('navigation', { name: 'Phân trang' })).not.toBeInTheDocument();
  });

  it('shows friendly error and retries', async () => {
    const user = userEvent.setup();
    const all = makeGames(3);
    let failNext = true;
    const f = vi.fn((url: string) => {
      if (!isCatalog(url) && failNext) {
        failNext = false;
        return Promise.resolve(
          new Response('SECRET STACK TRACE', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
          }),
        );
      }
      return Promise.resolve(pageResponse(all, url));
    });
    vi.stubGlobal('fetch', f);
    render(<GameListPage />);
    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('SECRET');
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    await screen.findByTestId('game-grid');
    expect(urls(f)).toHaveLength(2);
  });

  it('aborts the stale request on fast page change and ignores its response', async () => {
    const user = userEvent.setup();
    const all = makeGames(25);
    const signals: AbortSignal[] = [];
    const resolvers: Array<() => void> = [];
    const f = vi.fn((url: string, init?: RequestInit) => {
      if (isCatalog(url)) return Promise.resolve(pageResponse(all, url));
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
        resolvers.push(() => resolve(pageResponse(all, url)));
      });
    });
    vi.stubGlobal('fetch', f);
    render(<GameListPage />);
    expect(urls(f)).toHaveLength(1);
    resolvers[0]!();
    await screen.findByTestId('game-grid');

    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(urls(f)).toHaveLength(2));
    act(() => {
      window.history.pushState(null, '', '/?page=3');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(urls(f)).toHaveLength(3));
    expect(signals[1]!.aborted).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    resolvers[2]!();
    await screen.findByTestId('game-grid');
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 3 / 3');
    resolvers[1]!();
    await act(async () => {});
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 3 / 3');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('falls back to placeholder exactly once on image error', async () => {
    stubFetch(makeGames(2));
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    const img = screen.getAllByTestId('game-thumbnail')[0]!;
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', '/thumbnails/placeholder.svg');
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', '/thumbnails/placeholder.svg');
  });

  it('uses placeholder for non-http(s) thumbnailUrl', async () => {
    const games = makeGames(2);
    games[0]!.thumbnailUrl = 'javascript:alert(1)';
    games[1]!.thumbnailUrl = 'data:image/svg+xml,<svg/>';
    stubFetch(games);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    for (const img of screen.getAllByTestId('game-thumbnail')) {
      expect(img).toHaveAttribute('src', '/thumbnails/placeholder.svg');
    }
  });
});
