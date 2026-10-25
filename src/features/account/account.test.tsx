import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App.tsx';
import type { PersonalBest, PlayHistoryItem } from '../../api/types.ts';
import { resetCatalogForTests } from '../catalog/catalog.ts';
import { USER, json, noContent, stubApi } from '../auth/testApi.ts';

beforeEach(() => {
  resetCatalogForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetCatalogForTests();
});

const signedIn = { 'GET /api/auth/me': () => json({ user: USER }) };
const err = (code: string, status: number, headers: Record<string, string> = {}) =>
  json({ code, message: 'x' }, status, headers);

describe('AC31 profile page', () => {
  async function openProfile(handlers: Parameters<typeof stubApi>[0] = {}) {
    const api = stubApi({ ...signedIn, ...handlers });
    window.history.replaceState(null, '', '/ho-so');
    render(<App />);
    await screen.findByTestId('profile-page');
    return api;
  }

  it('shows the email and a prefilled name', async () => {
    await openProfile();
    expect(screen.getByTestId('profile-email')).toHaveTextContent('lan@example.com');
    expect(screen.getByTestId('profile-name-input')).toHaveValue('Lan');
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('renders hostile name and email as text only (AC35)', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    stubApi({
      'GET /api/auth/me': () =>
        json({ user: { ...USER, displayName: evil, email: 'a@example.com' } }),
    });
    window.history.replaceState(null, '', '/ho-so');
    const { container } = render(<App />);
    await screen.findByTestId('profile-page');
    expect(screen.getByTestId('profile-name-input')).toHaveValue(evil);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renames successfully and the header updates immediately', async () => {
    const user = userEvent.setup();
    const api = await openProfile({
      'PATCH /api/me': () => json({ user: { ...USER, displayName: 'Lan Anh' } }),
    });
    await user.clear(screen.getByTestId('profile-name-input'));
    await user.type(screen.getByTestId('profile-name-input'), ' Lan  Anh ');
    await user.click(screen.getByTestId('profile-name-submit'));
    expect(await screen.findByTestId('profile-name-status')).toHaveTextContent(
      'Đã lưu tên hiển thị.',
    );
    expect(api.of('PATCH', '/api/me')[0]?.body).toEqual({ displayName: 'Lan Anh' });
    expect(api.of('PATCH', '/api/me')[0]?.init.credentials).toBe('same-origin');
    expect(screen.getByTestId('user-menu-button')).toHaveTextContent('Lan Anh');
    expect(screen.getByTestId('profile-name-input')).toHaveValue('Lan Anh');
    await user.type(screen.getByTestId('profile-name-input'), 'x');
    expect(screen.queryByTestId('profile-name-status')).not.toBeInTheDocument();
  });

  it('409 NAME_TAKEN shows the error', async () => {
    const user = userEvent.setup();
    await openProfile({ 'PATCH /api/me': () => err('NAME_TAKEN', 409) });
    await user.clear(screen.getByTestId('profile-name-input'));
    await user.type(screen.getByTestId('profile-name-input'), 'Minh');
    await user.click(screen.getByTestId('profile-name-submit'));
    expect(await screen.findByTestId('profile-name-error')).toHaveTextContent(
      'Tên hiển thị đã có người dùng.',
    );
    expect(screen.getByTestId('user-menu-button')).toHaveTextContent('Lan');
  });

  it('invalid name is rejected locally', async () => {
    const user = userEvent.setup();
    const api = await openProfile();
    await user.clear(screen.getByTestId('profile-name-input'));
    await user.type(screen.getByTestId('profile-name-input'), '<b>');
    await user.click(screen.getByTestId('profile-name-submit'));
    expect(screen.getByTestId('profile-name-error')).toBeInTheDocument();
    expect(api.of('PATCH', '/api/me')).toHaveLength(0);
  });

  it('401 on rename signs out and redirects to login with next', async () => {
    const user = userEvent.setup();
    await openProfile({ 'PATCH /api/me': () => err('UNAUTHORIZED', 401) });
    await user.clear(screen.getByTestId('profile-name-input'));
    await user.type(screen.getByTestId('profile-name-input'), 'Minh');
    await user.click(screen.getByTestId('profile-name-submit'));
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(window.location.search).toBe('?next=%2Fho-so');
  });

  async function fillPasswords(
    user: ReturnType<typeof userEvent.setup>,
    v: { current: string; next: string; confirm: string },
  ) {
    await user.type(screen.getByTestId('password-current'), v.current);
    await user.type(screen.getByTestId('password-new'), v.next);
    await user.type(screen.getByTestId('password-confirm'), v.confirm);
  }

  it('changes the password and clears the form', async () => {
    const user = userEvent.setup();
    const api = await openProfile({ 'POST /api/me/password': () => noContent() });
    await fillPasswords(user, {
      current: 'mat-khau-cu-1',
      next: 'mat-khau-moi-2',
      confirm: 'mat-khau-moi-2',
    });
    await user.click(screen.getByTestId('password-submit'));
    expect(await screen.findByTestId('password-status')).toHaveTextContent(
      'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.',
    );
    expect(api.of('POST', '/api/me/password')[0]?.body).toEqual({
      currentPassword: 'mat-khau-cu-1',
      newPassword: 'mat-khau-moi-2',
    });
    expect(screen.getByTestId('password-current')).toHaveValue('');
    expect(screen.getByTestId('password-new')).toHaveValue('');
    // Vẫn đăng nhập (server cấp cookie mới cho thiết bị này).
    expect(screen.getByTestId('user-menu-button')).toBeInTheDocument();
  });

  it('403 INVALID_CREDENTIALS shows the wrong current password error', async () => {
    const user = userEvent.setup();
    await openProfile({ 'POST /api/me/password': () => err('INVALID_CREDENTIALS', 403) });
    await fillPasswords(user, {
      current: 'sai-mat-khau',
      next: 'mat-khau-moi-2',
      confirm: 'mat-khau-moi-2',
    });
    await user.click(screen.getByTestId('password-submit'));
    expect(await screen.findByTestId('password-error')).toHaveTextContent(
      'Mật khẩu hiện tại không đúng.',
    );
    expect(screen.queryByTestId('password-status')).not.toBeInTheDocument();
  });

  it('429 shows the rate limit message', async () => {
    const user = userEvent.setup();
    await openProfile({
      'POST /api/me/password': () => err('RATE_LIMITED', 429, { 'Retry-After': '9' }),
    });
    await fillPasswords(user, {
      current: 'mat-khau-cu-1',
      next: 'mat-khau-moi-2',
      confirm: 'mat-khau-moi-2',
    });
    await user.click(screen.getByTestId('password-submit'));
    expect(await screen.findByTestId('password-error')).toHaveTextContent(
      'Bạn thử quá nhiều lần, vui lòng thử lại sau.',
    );
  });

  it('mismatched confirmation or short password sends no request', async () => {
    const user = userEvent.setup();
    const api = await openProfile();
    await fillPasswords(user, {
      current: 'mat-khau-cu-1',
      next: 'mat-khau-moi-2',
      confirm: 'khac-hoan-toan',
    });
    await user.click(screen.getByTestId('password-submit'));
    expect(screen.getByTestId('password-error')).toHaveTextContent('không khớp');

    await user.clear(screen.getByTestId('password-new'));
    await user.clear(screen.getByTestId('password-confirm'));
    await user.type(screen.getByTestId('password-new'), 'ngan');
    await user.type(screen.getByTestId('password-confirm'), 'ngan');
    await user.click(screen.getByTestId('password-submit'));
    expect(screen.getByTestId('password-error')).toHaveTextContent('8–128');

    await user.clear(screen.getByTestId('password-current'));
    await user.click(screen.getByTestId('password-submit'));
    expect(screen.getByTestId('password-error')).toHaveTextContent('mật khẩu hiện tại');
    expect(api.of('POST', '/api/me/password')).toHaveLength(0);
  });
});

const best = (over: Partial<PersonalBest> = {}): PersonalBest => ({
  gameId: 'snake',
  gameTitle: 'Snake',
  scoreOrder: 'desc',
  score: 17,
  durationMs: 90000,
  achievedAt: '2026-10-24T08:01:30.000Z',
  plays: 3,
  ...over,
});

const row = (n: number, over: Partial<PlayHistoryItem> = {}): PlayHistoryItem => ({
  sessionId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  gameId: 'snake',
  gameTitle: 'Snake',
  scoreOrder: 'desc',
  score: n,
  durationMs: 65000,
  result: 'accepted',
  endedAt: '2026-10-24T08:01:30.000Z',
  ...over,
});

describe('AC32 history page', () => {
  async function openHistory(handlers: Parameters<typeof stubApi>[0] = {}, path = '/lich-su') {
    const api = stubApi({ ...signedIn, ...handlers });
    window.history.replaceState(null, '', path);
    render(<App />);
    await screen.findByTestId('history-page');
    return api;
  }

  it('shows personal bests and history rows', async () => {
    await openHistory({
      'GET /api/me/bests': () =>
        json({
          items: [
            best(),
            best({
              gameId: 'memory-match',
              gameTitle: 'Memory Match',
              scoreOrder: 'asc',
              score: 12,
              plays: 1,
            }),
          ],
        }),
      'GET /api/me/sessions': () =>
        json({
          items: [
            row(3),
            row(2, { result: 'rejected' }),
            row(1, { gameId: 'memory-match', gameTitle: 'Memory Match', scoreOrder: 'asc' }),
          ],
          total: 3,
          page: 1,
          limit: 20,
        }),
    });

    const bests = await screen.findAllByTestId('personal-best-row');
    expect(bests).toHaveLength(2);
    expect(within(bests[0]!).getByRole('link', { name: 'Snake' })).toHaveAttribute(
      'href',
      '/games/snake',
    );
    expect(bests[0]).toHaveTextContent('Điểm');
    expect(bests[0]).toHaveTextContent('17');
    expect(bests[0]).toHaveTextContent('1:30');
    expect(bests[1]).toHaveTextContent('Số lượt');
    expect(bests[1]).toHaveTextContent('12');

    const rows = await screen.findAllByTestId('history-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute('data-result', 'accepted');
    expect(rows[0]).toHaveTextContent('Đã ghi nhận');
    expect(rows[1]).toHaveAttribute('data-result', 'rejected');
    expect(rows[1]).toHaveTextContent('Không được ghi nhận');
    expect(rows[2]).toHaveTextContent('1 lượt');
    expect(rows[0]).toHaveTextContent(new Date('2026-10-24T08:01:30.000Z').toLocaleString('vi-VN'));
    expect(within(rows[0]!).getByRole('link', { name: 'Snake' })).toHaveAttribute(
      'href',
      '/games/snake',
    );
    expect(screen.getByTestId('history-list')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Phân trang' })).not.toBeInTheDocument();
  });

  it('renders hostile game titles as text (AC35)', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    await openHistory({
      'GET /api/me/bests': () => json({ items: [best({ gameTitle: evil })] }),
      'GET /api/me/sessions': () =>
        json({ items: [row(1, { gameTitle: evil })], total: 1, page: 1, limit: 20 }),
    });
    await screen.findByTestId('history-row');
    expect(screen.getByTestId('history-row')).toHaveTextContent(evil);
    expect(document.querySelector('img')).toBeNull();
  });

  it('empty states', async () => {
    await openHistory({
      'GET /api/me/bests': () => json({ items: [] }),
      'GET /api/me/sessions': () => json({ items: [], total: 0, page: 1, limit: 20 }),
    });
    expect(await screen.findByTestId('personal-bests-empty')).toBeInTheDocument();
    expect(await screen.findByTestId('history-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('history-row')).not.toBeInTheDocument();
  });

  it('shows loading, then an error with retry that recovers', async () => {
    const user = userEvent.setup();
    let fail = true;
    const api = await openHistory({
      'GET /api/me/bests': () => json({ items: [] }),
      'GET /api/me/sessions': () =>
        fail ? err('INTERNAL_ERROR', 500) : json({ items: [row(1)], total: 1, page: 1, limit: 20 }),
    });
    expect(await screen.findByTestId('history-error')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByTestId('history-retry'));
    expect(await screen.findByTestId('history-row')).toBeInTheDocument();
    expect(screen.queryByTestId('history-error')).not.toBeInTheDocument();
    expect(api.of('GET', '/api/me/sessions')).toHaveLength(2);
  });

  it('bests failure has its own retry', async () => {
    const user = userEvent.setup();
    let fail = true;
    await openHistory({
      'GET /api/me/bests': () => (fail ? err('INTERNAL_ERROR', 500) : json({ items: [best()] })),
      'GET /api/me/sessions': () => json({ items: [], total: 0, page: 1, limit: 20 }),
    });
    expect(await screen.findByTestId('personal-bests-error')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByTestId('personal-bests-retry'));
    expect(await screen.findByTestId('personal-best-row')).toBeInTheDocument();
  });

  it('paginates with ?page=N', async () => {
    const user = userEvent.setup();
    const api = await openHistory(
      {
        'GET /api/me/bests': () => json({ items: [] }),
        'GET /api/me/sessions': (c) => {
          const page = Number(new URLSearchParams(c.search).get('page'));
          return json({ items: [row(page)], total: 45, page, limit: 20 });
        },
      },
      '/lich-su?page=2',
    );
    expect(await screen.findByTestId('pagination-status')).toHaveTextContent('Trang 2 / 3');
    expect(api.of('GET', '/api/me/sessions')[0]?.search).toBe('?page=2&limit=20');
    await user.click(screen.getByRole('button', { name: /Trang sau/ }));
    await waitFor(() =>
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Trang 3 / 3'),
    );
    expect(window.location.search).toBe('?page=3');
    expect(await screen.findByTestId('history-row')).toHaveTextContent('3');
    expect(api.of('GET', '/api/me/sessions').at(-1)?.search).toBe('?page=3&limit=20');
  });

  it('401 from the API marks the user signed out and redirects to login with next', async () => {
    const api = stubApi({
      ...signedIn,
      'GET /api/me/bests': () => err('UNAUTHORIZED', 401),
      'GET /api/me/sessions': () => err('UNAUTHORIZED', 401),
    });
    window.history.replaceState(null, '', '/lich-su?page=2');
    render(<App />);
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe(
      '/dang-nhap?next=%2Flich-su%3Fpage%3D2',
    );
    expect(screen.getByTestId('auth-login-link')).toBeInTheDocument();
    expect(api.of('GET', '/api/me/sessions').length).toBeGreaterThan(0);
  });
});
