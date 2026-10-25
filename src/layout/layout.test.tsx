import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../api/types.ts';
import { GAME_ORIGIN } from '../config.ts';
import { resetCatalogForTests } from '../features/catalog/catalog.ts';
import { CREDIT_REPO_URL, SiteFooter } from './SiteFooter.tsx';
import { MAIN_ID, SiteLayout } from './SiteLayout.tsx';
import { navigate } from '../routing/index.ts';
import { SEARCH_DEBOUNCE_MS, SiteSearch, searchUrl } from './SiteSearch.tsx';
import { SIDEBAR_STORAGE_KEY } from './useSidebar.ts';

function game(id: string, title: string, tags: string[]): Game {
  return {
    id,
    title,
    thumbnailUrl: 'http://localhost:5173/t.svg',
    embedUrl: `http://localhost:5174/games/${id}/`,
    orientation: 'any',
    tags,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const GAMES = [
  game('snake', 'Snake', ['arcade', 'classic']),
  game('brick', 'Brick Breaker', ['arcade']),
  game('2048', 'Merge 2048', ['puzzle', 'numbers']),
  game('ttt', 'Tic Tac Toe', ['classic', 'board']),
];

function stubCatalog(games: Game[] = GAMES) {
  const f = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify({ items: games, total: games.length, page: 1, limit: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', f);
  return f;
}

function stubMatchMedia(desktop: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: desktop,
      media,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

function renderLayout() {
  return render(
    <SiteLayout>
      <p>nội dung</p>
    </SiteLayout>,
  );
}

beforeEach(() => {
  resetCatalogForTests();
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetCatalogForTests();
});

describe('SiteHeader', () => {
  it('has a single h1 with a home link, a menu button and a labelled search form', () => {
    stubMatchMedia(true);
    stubCatalog();
    renderLayout();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Quick Playing' });
    expect(within(h1).getByRole('link')).toHaveAttribute('href', '/');

    const menu = screen.getByRole('button', { name: 'Mở/đóng menu' });
    expect(menu).toHaveAttribute('aria-controls', 'site-sidebar');
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('site-sidebar')).toBe(screen.getByTestId('sidebar'));

    const form = screen.getByRole('search');
    const input = within(form).getByLabelText('Tìm game');
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('placeholder', 'Tìm trò chơi…');
  });

  it('offers a random-game button that opens a game other than the current one', async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    stubCatalog();
    window.history.replaceState(null, '', '/games/snake');
    renderLayout();
    const btn = await screen.findByRole('button', { name: 'Chơi game ngẫu nhiên' });
    for (let i = 0; i < 5; i++) {
      act(() => {
        window.history.replaceState(null, '', '/games/snake');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await user.click(btn);
      expect(window.location.pathname).toMatch(/^\/games\/(brick|2048|ttt)$/);
    }
  });
});

describe('Sidebar', () => {
  it('lists home and only categories with games (with counts), marking home current', async () => {
    stubMatchMedia(true);
    stubCatalog();
    renderLayout();
    const nav = screen.getByRole('navigation', { name: 'Danh mục' });
    expect(within(nav).getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/');
    await within(nav).findByRole('link', { name: /Arcade/ });
    const links = within(nav)
      .getAllByRole('link')
      .map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Trang chủ', '/'],
      ['Arcade2', '/?tag=arcade'],
      ['Giải đố1', '/?tag=puzzle'],
      ['Cổ điển2', '/?tag=classic'],
      ['Bàn cờ1', '/?tag=board'],
    ]);
    expect(within(nav).getByRole('link', { name: 'Trang chủ' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: /Giải đố/ })).not.toHaveAttribute('aria-current');
  });

  it('hides categories that have no game', async () => {
    stubMatchMedia(true);
    stubCatalog([game('2048', 'Merge 2048', ['puzzle', 'numbers'])]);
    renderLayout();
    const nav = screen.getByRole('navigation', { name: 'Danh mục' });
    await within(nav).findByRole('link', { name: /Giải đố/ });
    expect(within(nav).queryByRole('link', { name: /Arcade/ })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Bàn cờ/ })).not.toBeInTheDocument();
  });

  it('marks the selected category with aria-current and clears it on home', async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    stubCatalog();
    window.history.replaceState(null, '', '/?tag=puzzle');
    renderLayout();
    const nav = screen.getByRole('navigation', { name: 'Danh mục' });
    const puzzle = await within(nav).findByRole('link', { name: /Giải đố/ });
    expect(puzzle).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Trang chủ' })).not.toHaveAttribute(
      'aria-current',
    );
    await user.click(within(nav).getByRole('link', { name: 'Trang chủ' }));
    expect(window.location.search).toBe('');
    expect(within(nav).getByRole('link', { name: 'Trang chủ' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(puzzle).not.toHaveAttribute('aria-current');
  });

  it('has no current item on a search result or a game page', async () => {
    stubMatchMedia(true);
    stubCatalog();
    window.history.replaceState(null, '', '/?q=snake');
    const { unmount } = renderLayout();
    const nav = screen.getByRole('navigation', { name: 'Danh mục' });
    await within(nav).findByRole('link', { name: /Arcade/ });
    expect(nav.querySelector('[aria-current]')).toBeNull();
    unmount();
    window.history.replaceState(null, '', '/games/snake');
    renderLayout();
    const nav2 = screen.getByRole('navigation', { name: 'Danh mục' });
    await within(nav2).findByRole('link', { name: /Arcade/ });
    expect(nav2.querySelector('[aria-current]')).toBeNull();
  });

  it('collapses to an icon rail on desktop and remembers it in localStorage', async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    stubCatalog();
    const first = renderLayout();
    const menu = screen.getByRole('button', { name: 'Mở/đóng menu' });
    const nav = screen.getByTestId('sidebar');
    expect(nav).toHaveAttribute('data-collapsed', 'false');

    await user.click(menu);
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    // Nhãn vẫn có trong DOM (screen reader) và `title` trên link.
    expect(within(nav).getByRole('link', { name: 'Trang chủ' })).toHaveAttribute(
      'title',
      'Trang chủ',
    );

    first.unmount();
    renderLayout();
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('button', { name: 'Mở/đóng menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Mở/đóng menu' }));
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'false');
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('expanded');
  });

  it('still works when localStorage throws', async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    stubCatalog();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderLayout();
    await user.click(screen.getByRole('button', { name: 'Mở/đóng menu' }));
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');
    vi.restoreAllMocks();
  });

  describe('drawer (below 1024px)', () => {
    it('is closed and inert by default, opens with the menu button', async () => {
      const user = userEvent.setup();
      stubMatchMedia(false);
      stubCatalog();
      renderLayout();
      const nav = screen.getByTestId('sidebar');
      const menu = screen.getByRole('button', { name: 'Mở/đóng menu' });
      expect(nav).toHaveAttribute('data-open', 'false');
      expect(nav).toHaveAttribute('inert');
      expect(menu).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('sidebar-overlay')).not.toBeInTheDocument();

      await user.click(menu);
      expect(nav).toHaveAttribute('data-open', 'true');
      expect(nav).not.toHaveAttribute('inert');
      expect(menu).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('sidebar-overlay')).toBeInTheDocument();
      expect(document.documentElement).toHaveClass('has-drawer');
      // Focus chuyển vào drawer.
      expect(nav.contains(document.activeElement)).toBe(true);
      // Không ghi đè trạng thái thu gọn của desktop.
      expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();
    });

    it('closes on Escape and returns focus to the menu button', async () => {
      const user = userEvent.setup();
      stubMatchMedia(false);
      stubCatalog();
      renderLayout();
      const menu = screen.getByRole('button', { name: 'Mở/đóng menu' });
      await user.click(menu);
      await user.keyboard('{Escape}');
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
      expect(menu).toHaveFocus();
      expect(document.documentElement).not.toHaveClass('has-drawer');
    });

    it('closes when the overlay is clicked and returns focus to the menu button', async () => {
      const user = userEvent.setup();
      stubMatchMedia(false);
      stubCatalog();
      renderLayout();
      const menu = screen.getByRole('button', { name: 'Mở/đóng menu' });
      await user.click(menu);
      await user.click(screen.getByTestId('sidebar-overlay'));
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
      expect(menu).toHaveFocus();
    });

    it('closes after choosing an item, navigates, and returns focus to the menu button', async () => {
      const user = userEvent.setup();
      stubMatchMedia(false);
      stubCatalog();
      renderLayout();
      const menu = screen.getByRole('button', { name: 'Mở/đóng menu' });
      await user.click(menu);
      const nav = screen.getByTestId('sidebar');
      await user.click(await within(nav).findByRole('link', { name: /Giải đố/ }));
      expect(window.location.search).toBe('?tag=puzzle');
      expect(nav).toHaveAttribute('data-open', 'false');
      expect(menu).toHaveFocus();
    });

    it('keeps Tab inside the open drawer', async () => {
      const user = userEvent.setup();
      stubMatchMedia(false);
      stubCatalog();
      renderLayout();
      await user.click(screen.getByRole('button', { name: 'Mở/đóng menu' }));
      const nav = screen.getByTestId('sidebar');
      const links = await within(nav).findAllByRole('link');
      const last = links[links.length - 1]!;
      act(() => last.focus());
      await user.tab();
      expect(within(nav).getByRole('button', { name: 'Đóng menu' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(last).toHaveFocus();
    });
  });
});

describe('drawer as modal dialog', () => {
  it('has dialog semantics, a close button, and inert background while open', async () => {
    const user = userEvent.setup();
    stubMatchMedia(false);
    stubCatalog();
    renderLayout();
    const menu = screen.getByRole('button', { name: 'Mở/đóng menu' });
    const content = screen.getByRole('main').parentElement!;
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(content).not.toHaveAttribute('inert');

    await user.click(menu);
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('navigation', { name: 'Danh mục' })).toBeInTheDocument();
    expect(content).toHaveAttribute('inert');

    await user.click(within(dialog).getByRole('button', { name: 'Đóng menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(content).not.toHaveAttribute('inert');
    expect(menu).toHaveFocus();
  });

  it('has no dialog role or close button on desktop', () => {
    stubMatchMedia(true);
    stubCatalog();
    renderLayout();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đóng menu' })).not.toBeInTheDocument();
  });
});

describe('SiteSearch', () => {
  it('searchUrl builds /?q=…, drops tag/page and clears on empty input', () => {
    expect(searchUrl('snake')).toBe('/?q=snake');
    expect(searchUrl('đua xe')).toBe('/?q=%C4%91ua+xe');
    expect(searchUrl('x', '?tag=puzzle&page=2&foo=1')).toBe('/?foo=1&q=x');
    expect(searchUrl('   ', '?q=a&page=2')).toBe('/');
  });

  it('updates ?q= with replaceState after the debounce (no new history entry)', () => {
    vi.useFakeTimers();
    render(<SiteSearch />);
    const input = screen.getByRole('searchbox', { name: 'Tìm game' });
    const before = window.history.length;
    fireEvent.change(input, { target: { value: 'sna' } });
    fireEvent.change(input, { target: { value: 'snake' } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 10);
    });
    expect(window.location.search).toBe('');
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(window.location.search).toBe('?q=snake');
    expect(window.history.length).toBe(before);
  });

  it('removes ?q= when the input is cleared', () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/?q=snake&foo=1');
    render(<SiteSearch />);
    const input = screen.getByRole('searchbox', { name: 'Tìm game' });
    expect(input).toHaveValue('snake');
    fireEvent.change(input, { target: { value: '' } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 10);
    });
    expect(window.location.search).toBe('?foo=1');
  });

  it('does not rewrite the URL while typing on another page, and Enter goes to /?q=…', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/games/snake');
    render(<SiteSearch />);
    const input = screen.getByRole('searchbox', { name: 'Tìm game' });
    await user.type(input, 'brick');
    await new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS + 60));
    expect(window.location.pathname).toBe('/games/snake');
    await user.type(input, '{Enter}');
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('?q=brick');
  });

  it('does not overwrite a navigation that happens while the debounce is pending', () => {
    vi.useFakeTimers();
    render(<SiteSearch />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm game' }), {
      target: { value: 'sn' },
    });
    act(() => {
      navigate('/?tag=arcade');
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 50);
    });
    expect(window.location.pathname + window.location.search).toBe('/?tag=arcade');
  });

  it('typing on a game page then going home does not push the query to the URL', () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/games/snake');
    render(<SiteSearch />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm game' }), {
      target: { value: 'pong' },
    });
    act(() => {
      navigate('/');
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 50);
    });
    expect(window.location.pathname + window.location.search).toBe('/');
  });

  it('resets typed text to the URL query when leaving a game page for home', () => {
    window.history.replaceState(null, '', '/games/snake');
    render(<SiteSearch />);
    const input = screen.getByRole('searchbox', { name: 'Tìm game' });
    fireEvent.change(input, { target: { value: 'pong' } });
    expect(input).toHaveValue('pong');
    act(() => {
      navigate('/');
    });
    expect(input).toHaveValue('');
  });

  it('shows the trimmed q from the URL (whitespace-only q is empty)', () => {
    window.history.replaceState(null, '', '/?q=%20%20');
    render(<SiteSearch />);
    expect(screen.getByRole('searchbox', { name: 'Tìm game' })).toHaveValue('');
  });

  it('follows the URL when it changes elsewhere (logo, Back)', async () => {
    window.history.replaceState(null, '', '/?q=snake');
    render(<SiteSearch />);
    const input = screen.getByRole('searchbox', { name: 'Tìm game' });
    expect(input).toHaveValue('snake');
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(input).toHaveValue(''));
  });
});

describe('SiteFooter', () => {
  it('shows copyright and credit links that open safely in a new tab', () => {
    render(<SiteFooter year={2030} />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2030 Quick Playing');
    const repo = screen.getByRole('link', { name: 'mã nguồn gốc' });
    const licence = screen.getByRole('link', { name: 'giấy phép' });
    expect(repo).toHaveAttribute('href', CREDIT_REPO_URL);
    expect(licence).toHaveAttribute('href', `${GAME_ORIGIN}/games/LICENSE.txt`);
    for (const a of [repo, licence]) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('SiteLayout', () => {
  it('wraps content in main and skip link moves focus to it', async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    stubCatalog();
    renderLayout();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', MAIN_ID);
    expect(main).toHaveTextContent('nội dung');
    await user.click(screen.getByRole('link', { name: 'Bỏ qua tới nội dung' }));
    expect(main).toHaveFocus();
    expect(window.location.hash).toBe('');
  });
});
