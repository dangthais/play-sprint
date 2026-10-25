import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate } from '../../routing/index.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../../api/types.ts';
import { resetCatalogForTests } from '../catalog/catalog.ts';
import { GameListPage } from '../games/GameListPage.tsx';
import { featuredCount, pickFeatured } from './FeaturedGames.tsx';

function game(id: string, title: string, tags: string[] = []): Game {
  return {
    id,
    title,
    thumbnailUrl: `http://localhost:5173/thumbnails/${id}.svg`,
    embedUrl: `http://localhost:5174/games/${id}/`,
    orientation: 'any',
    tags,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const REAL = [
  game('tic-tac-toe', 'Tic Tac Toe', ['classic', 'board']),
  game('merge-2048', 'Merge 2048', ['puzzle', 'numbers']),
  game('memory-match', 'Memory Match', ['puzzle', 'memory']),
  game('brick-breaker', 'Brick Breaker', ['arcade']),
  game('snake', 'Snake', ['arcade', 'classic']),
  game('dua-xe', 'Đua Xe', []),
];

function many(n: number): Game[] {
  return Array.from({ length: n }, (_, i) => game(`g${i + 1}`, `Game ${i + 1}`, ['arcade']));
}

function stubApi(all: Game[], opts: { catalogFails?: boolean } = {}) {
  const f = vi.fn((url: string) => {
    const u = new URL(url, 'http://localhost');
    const page = Number(u.searchParams.get('page'));
    const limit = Number(u.searchParams.get('limit'));
    if (limit === 100 && opts.catalogFails) {
      return Promise.resolve(new Response('boom', { status: 500 }));
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          items: all.slice((page - 1) * limit, page * limit),
          total: all.length,
          page,
          limit,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });
  vi.stubGlobal('fetch', f);
  return f;
}

beforeEach(() => {
  resetCatalogForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetCatalogForTests();
});

describe('featured helpers', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [5, 5],
    [40, 5],
  ])('featuredCount(%i) = %i', (available, expected) => {
    expect(featuredCount(available)).toBe(expected);
  });

  it('picks the first games in catalog order', () => {
    expect(pickFeatured(many(7)).map((g) => g.id)).toEqual(['g1', 'g2', 'g3', 'g4', 'g5']);
  });
});

describe('home (page 1, no filter)', () => {
  it('shows category tiles, banner and bento above the paginated grid', async () => {
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');

    const tiles = await screen.findAllByTestId('category-tile');
    expect(tiles.map((t) => t.getAttribute('href'))).toEqual([
      '/?tag=arcade',
      '/?tag=puzzle',
      '/?tag=classic',
      '/?tag=board',
    ]);
    expect(tiles[0]).toHaveTextContent('Arcade');
    expect(tiles[0]).toHaveTextContent('2 game');

    const featured = await screen.findAllByTestId('featured-tile');
    expect(featured.map((t) => t.getAttribute('href'))).toEqual([
      '/games/tic-tac-toe',
      '/games/merge-2048',
      '/games/memory-match',
      '/games/brick-breaker',
      '/games/snake',
    ]);
    expect(featured[0]).toHaveAccessibleName('Tic Tac Toe');

    const promo = screen.getByTestId('promo-banner');
    expect(within(promo).getByRole('link', { name: 'Chơi ngay' })).toHaveAttribute(
      'href',
      '/games/tic-tac-toe',
    );
  });

  it('does not reuse game-card / game-link / game-thumbnail / h2 / status / alert in extra blocks', async () => {
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    await screen.findAllByTestId('featured-tile');
    // Chỉ lưới chính có thẻ game: 6 game => đúng 6 thẻ/ảnh/link.
    expect(screen.getAllByTestId('game-card')).toHaveLength(REAL.length);
    expect(screen.getAllByTestId('game-link')).toHaveLength(REAL.length);
    expect(screen.getAllByTestId('game-thumbnail')).toHaveLength(REAL.length);
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(REAL.length);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    for (const block of [
      ...screen.getAllByTestId('featured-tile'),
      ...screen.getAllByTestId('category-tile'),
      screen.getByTestId('promo-banner'),
    ]) {
      expect(block.querySelector('h2, [data-testid^="game-"]')).toBeNull();
    }
  });

  it('marks the layout of the bento by game count', async () => {
    stubApi(many(3));
    const { container } = render(<GameListPage />);
    await screen.findAllByTestId('featured-tile');
    expect(container.querySelector('.featured')).toHaveAttribute('data-count', '3');
    expect(screen.getAllByTestId('featured-tile')).toHaveLength(3);
  });

  it('hides blocks (not the grid) when the catalog fails; the banner has no hard-coded CTA', async () => {
    stubApi(REAL, { catalogFails: true });
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    await waitFor(() => expect(screen.queryByTestId('category-tile')).not.toBeInTheDocument());
    expect(screen.queryByTestId('featured-tile')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('promo-banner')).queryByRole('link', { name: 'Chơi ngay' }),
    ).not.toBeInTheDocument();
  });

  it('shows the extras only on page 1', async () => {
    const user = userEvent.setup();
    stubApi(many(25));
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    await screen.findAllByTestId('featured-tile');
    expect(screen.getByTestId('promo-banner')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() =>
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 2 / 3'),
    );
    expect(screen.queryByTestId('category-tile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('featured-tile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('promo-banner')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Trang trước' }));
    await waitFor(() => expect(screen.getByTestId('promo-banner')).toBeInTheDocument());
  });

  it('opens straight on page 2 with the grid and pagination only', async () => {
    window.history.replaceState(null, '', '/?page=2');
    stubApi(many(25));
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 2 / 3');
    expect(screen.queryByTestId('promo-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('featured-tile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-tile')).not.toBeInTheDocument();
  });

  it('keeps the paginated request at limit=12 and fetches the catalog once', async () => {
    const f = stubApi(many(25));
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    await screen.findAllByTestId('featured-tile');
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes('limit=12'))).toEqual(['/api/games?page=1&limit=12']);
    expect(urls.filter((u) => u.includes('limit=100'))).toEqual(['/api/games?page=1&limit=100']);
  });
});

describe('filter mode', () => {
  it('?tag=puzzle lists only that category, without pagination or extras', async () => {
    window.history.replaceState(null, '', '/?tag=puzzle');
    const f = stubApi(REAL);
    render(<GameListPage />);
    const grid = await screen.findByTestId('game-grid');
    expect(screen.getByText('Giải đố · 2 game')).toBeInTheDocument();
    expect(grid).toHaveAttribute('aria-label', 'Danh sách game');
    expect(screen.getAllByTestId('game-card').map((c) => c.getAttribute('data-game-id'))).toEqual([
      'merge-2048',
      'memory-match',
    ]);
    expect(screen.queryByRole('navigation', { name: 'Phân trang' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('promo-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('featured-tile')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Tất cả trò chơi' })).toHaveAttribute('href', '/');
    expect(f.mock.calls.map((c) => String(c[0]))).toEqual(['/api/games?page=1&limit=100']);
  });

  it('?q= is case- and diacritic-insensitive and titles the results', async () => {
    window.history.replaceState(null, '', '/?q=DUA%20xe');
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    expect(screen.getByText('Kết quả cho “DUA xe” · 1 game')).toBeInTheDocument();
    expect(screen.getAllByTestId('game-card')).toHaveLength(1);
    expect(screen.getByTestId('game-card')).toHaveAttribute('data-game-id', 'dua-xe');
  });

  it('?q= with no match shows the empty state without a grid', async () => {
    window.history.replaceState(null, '', '/?q=zzzz');
    stubApi(REAL);
    render(<GameListPage />);
    const empty = await screen.findByTestId('empty-state');
    expect(empty).toHaveTextContent('Không tìm thấy game phù hợp.');
    expect(screen.queryByTestId('game-grid')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Tất cả trò chơi' })).toBeInTheDocument();
  });

  it('renders the query as text, never as HTML', async () => {
    window.history.replaceState(
      null,
      '',
      `/?q=${encodeURIComponent('<img src=x onerror=alert(1)>')}`,
    );
    stubApi(REAL);
    const { container } = render(<GameListPage />);
    await screen.findByTestId('empty-state');
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByText('Kết quả cho “<img src=x onerror=alert(1)>”')).toBeInTheDocument();
  });

  it('ignores an unknown tag and normalises the URL with replaceState', async () => {
    window.history.replaceState(null, '', '/?tag=numbers&x=1');
    const before = window.history.length;
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    expect(window.location.search).toBe('?x=1');
    expect(window.history.length).toBe(before);
    expect(screen.getByText('Tất cả trò chơi')).toBeInTheDocument();
    expect(screen.getByTestId('promo-banner')).toBeInTheDocument();
  });

  it('drops ?page while filtering', async () => {
    window.history.replaceState(null, '', '/?tag=arcade&page=2');
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    expect(window.location.search).toBe('?tag=arcade');
  });

  it('shows loading, then an alert with retry when the catalog fails', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?tag=arcade');
    let failing = true;
    const f = vi.fn((url: string) => {
      if (failing) return Promise.resolve(new Response('SECRET', { status: 500 }));
      const u = new URL(url, 'http://localhost');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            items: REAL,
            total: REAL.length,
            page: 1,
            limit: Number(u.searchParams.get('limit')),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    vi.stubGlobal('fetch', f);
    render(<GameListPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải…');
    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('SECRET');
    failing = false;
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByTestId('game-grid')).toBeInTheDocument();
    expect(screen.getByText('Arcade · 2 game')).toBeInTheDocument();
  });

  it('switches between home and filter on navigation', async () => {
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    expect(screen.getByTestId('promo-banner')).toBeInTheDocument();
    act(() => {
      window.history.pushState(null, '', '/?tag=board');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(screen.getByText('Bàn cờ · 1 game')).toBeInTheDocument());
    expect(screen.queryByTestId('promo-banner')).not.toBeInTheDocument();
    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(screen.getByTestId('promo-banner')).toBeInTheDocument());
  });

  it('deep link ?tag=puzzle&q=… combines both filters in the title', async () => {
    window.history.replaceState(null, '', '/?tag=puzzle&q=2048');
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    expect(screen.getByText('Kết quả cho “2048” trong Giải đố · 1 game')).toBeInTheDocument();
    expect(screen.getByTestId('game-card')).toHaveAttribute('data-game-id', 'merge-2048');
  });

  it('follows Back/Forward between ?tag=a and ?tag=b', async () => {
    window.history.replaceState(null, '', '/?tag=arcade');
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByText('Arcade · 2 game');
    act(() => navigate('/?tag=board'));
    await screen.findByText('Bàn cờ · 1 game');
    act(() => {
      window.history.back();
    });
    await screen.findByText('Arcade · 2 game');
    act(() => {
      window.history.forward();
    });
    await screen.findByText('Bàn cờ · 1 game');
  });

  it('announces the result count in an aria-live region (not role=status)', async () => {
    window.history.replaceState(null, '', '/?tag=puzzle');
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    const live = screen.getByTestId('filter-announce');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).not.toHaveAttribute('role');
    expect(live).toHaveTextContent('2 game phù hợp');
    act(() => navigate('/?q=zzzz'));
    await waitFor(() => expect(live).toHaveTextContent('Không tìm thấy game phù hợp.'));
  });

  it('moves focus to #games and scrolls up on a pushed filter change, but not on replace or pop', async () => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    stubApi(REAL);
    render(<GameListPage />);
    await screen.findByTestId('game-grid');
    expect(scroll).not.toHaveBeenCalled();

    act(() => navigate('/?tag=puzzle'));
    await screen.findByText('Giải đố · 2 game');
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(document.getElementById('games')).toHaveFocus();

    (document.activeElement as HTMLElement).blur();
    act(() => navigate('/?q=mem', { replace: true }));
    await screen.findByText('Kết quả cho “mem” · 1 game');
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(document.getElementById('games')).not.toHaveFocus();

    act(() => {
      window.history.back();
    });
    // replace đã ghi đè mục ?tag=puzzle nên Back về trang chủ, không cuộn/focus.
    await screen.findByText('Tất cả trò chơi');
    expect(scroll).toHaveBeenCalledTimes(1);
    scroll.mockRestore();
  });
});
