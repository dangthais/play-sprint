import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { resetCatalogForTests } from './features/catalog/catalog.ts';

vi.mock('./features/game-host/GameHost.tsx', () => ({
  GameHost: () => <div data-testid="game-host" />,
}));

const mk = (n: number, tags: string[] = []) => ({
  id: `game-${n}`,
  title: `Game ${n}`,
  thumbnailUrl: 'http://localhost:5173/t.svg',
  embedUrl: `http://localhost:5174/games/game-${n}/`,
  orientation: 'any',
  tags,
  createdAt: '2026-01-01T00:00:00.000Z',
});
const all = Array.from({ length: 25 }, (_, i) => mk(i + 1, i < 2 ? ['puzzle'] : []));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/games') {
        const page = Number(u.searchParams.get('page'));
        const limit = Number(u.searchParams.get('limit'));
        return Promise.resolve(
          json({
            items: all.slice((page - 1) * limit, page * limit),
            total: all.length,
            page,
            limit,
          }),
        );
      }
      const g = all.find((x) => `/api/games/${x.id}` === u.pathname);
      return Promise.resolve(g ? json(g) : json({ code: 'NOT_FOUND', message: 'x' }, 404));
    }),
  );
}

beforeEach(() => {
  resetCatalogForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetCatalogForTests();
});

describe('App routing', () => {
  it('renders heading and list at /', async () => {
    stubApi();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Quick Playing' })).toBeInTheDocument();
    expect(await screen.findByTestId('game-grid')).toBeInTheDocument();
  });

  it('list -> play -> back to ?page=2', async () => {
    const user = userEvent.setup();
    stubApi();
    window.history.replaceState(null, '', '/?page=2');
    render(<App />);
    await screen.findByTestId('game-grid');
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 2 / 3');
    await user.click(screen.getAllByTestId('game-link')[0]!);
    expect(await screen.findByTestId('game-title')).toHaveTextContent('Game 13');
    expect(window.location.pathname).toBe('/games/game-13');
    expect(screen.getByTestId('game-host')).toBeInTheDocument();

    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(screen.getByTestId('game-grid')).toBeInTheDocument());
    expect(window.location.search).toBe('?page=2');
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 2 / 3');
  });

  it('site title link from ?page=2 shows page 1 without duplicate history entries', async () => {
    const user = userEvent.setup();
    stubApi();
    window.history.replaceState(null, '', '/?page=2');
    render(<App />);
    await screen.findByTestId('game-grid');
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 2 / 3');

    const titleLink = within(screen.getByRole('heading', { level: 1 })).getByRole('link');
    await user.click(titleLink);
    await waitFor(() =>
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 1 / 3'),
    );
    expect(window.location.search).toBe('');

    const before = window.history.length;
    await user.click(titleLink);
    expect(window.history.length).toBe(before);
  });

  it('shows game not found for unknown id and back link works', async () => {
    const user = userEvent.setup();
    stubApi();
    window.history.replaceState(null, '', '/games/missing');
    render(<App />);
    expect(await screen.findByTestId('game-not-found')).toBeInTheDocument();
    await user.click(screen.getByTestId('back-to-list'));
    expect(await screen.findByTestId('game-grid')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('shows page-not-found for unknown path', async () => {
    const user = userEvent.setup();
    stubApi();
    window.history.replaceState(null, '', '/whatever');
    render(<App />);
    expect(screen.getByTestId('page-not-found')).toHaveTextContent('Không tìm thấy trang.');
    await user.click(screen.getByRole('link', { name: 'Về trang chủ' }));
    expect(await screen.findByTestId('game-grid')).toBeInTheDocument();
  });

  it('sidebar category opens the filtered view and Trang chủ returns to the full list', async () => {
    const user = userEvent.setup();
    stubApi();
    render(<App />);
    await screen.findByTestId('game-grid');
    const nav = screen.getByRole('navigation', { name: 'Danh mục' });
    await user.click(await within(nav).findByRole('link', { name: /Giải đố/ }));
    expect(window.location.search).toBe('?tag=puzzle');
    expect(await screen.findByText('Giải đố · 2 game')).toBeInTheDocument();
    expect(screen.getAllByTestId('game-card')).toHaveLength(2);
    expect(screen.queryByRole('navigation', { name: 'Phân trang' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Giải đố/ })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(nav).getByRole('link', { name: 'Trang chủ' }));
    await waitFor(() =>
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 1 / 3'),
    );
    expect(window.location.search).toBe('');
  });

  it('typing in the header search filters the list and the logo clears it', async () => {
    const user = userEvent.setup();
    stubApi();
    render(<App />);
    await screen.findByTestId('game-grid');
    await user.type(screen.getByRole('searchbox', { name: 'Tìm game' }), 'game 2');
    await waitFor(() => expect(window.location.search).toBe('?q=game+2'));
    // 'game 2' khớp Game 2, Game 20..25 (catalog dùng chung, lọc phía client).
    expect(await screen.findByText('Kết quả cho “game 2” · 7 game')).toBeInTheDocument();
    expect(screen.getAllByTestId('game-card')).toHaveLength(7);

    await user.click(within(screen.getByRole('heading', { level: 1 })).getByRole('link'));
    await waitFor(() => expect(screen.getByTestId('pagination-status')).toBeInTheDocument());
    expect(screen.getByRole('searchbox', { name: 'Tìm game' })).toHaveValue('');
  });

  it('keeps focus in the search box while the debounce updates results, but Enter moves it to results', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    stubApi();
    render(<App />);
    await screen.findByTestId('game-grid');
    const input = screen.getByRole('searchbox', { name: 'Tìm game' });
    await user.type(input, 'game 1');
    await waitFor(() => expect(window.location.search).toBe('?q=game+1'));
    await screen.findByTestId('filter-announce');
    expect(input).toHaveFocus();
    expect(document.getElementById('games')).not.toHaveFocus();

    await user.type(input, '2{Enter}');
    await waitFor(() => expect(document.getElementById('games')).toHaveFocus());
    expect(window.location.search).toBe('?q=game+12');
  });

  it('clicking a sidebar category scrolls up and focuses the results section', async () => {
    const user = userEvent.setup();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    stubApi();
    render(<App />);
    await screen.findByTestId('game-grid');
    const nav = screen.getByRole('navigation', { name: 'Danh mục' });
    await user.click(await within(nav).findByRole('link', { name: /Giải đố/ }));
    await screen.findByText('Giải đố · 2 game');
    expect(scroll).toHaveBeenCalled();
    expect(document.getElementById('games')).toHaveFocus();
    expect(screen.getByTestId('filter-announce')).toHaveTextContent('2 game phù hợp');
  });
});
