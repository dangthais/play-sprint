import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App.tsx';
import { resetCatalogForTests } from '../catalog/catalog.ts';
import { AuthProvider } from './AuthProvider.tsx';
import { USER, json, noContent, stubApi } from './testApi.ts';
import { useAuth } from './useAuth.ts';

beforeEach(() => {
  resetCatalogForTests();
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetCatalogForTests();
});

const signedIn = { 'GET /api/auth/me': () => json({ user: USER }) };

async function fillLogin(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  if (email) await user.type(screen.getByTestId('login-email'), email);
  if (password) await user.type(screen.getByTestId('login-password'), password);
}

describe('useAuth', () => {
  it('outside a provider is anonymous and actions reject', async () => {
    let value: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      value = useAuth();
      return null;
    }
    render(<Probe />);
    expect(value?.status).toBe('anonymous');
    expect(value?.user).toBeNull();
    await expect(value!.login('a@b.co', 'x')).rejects.toBeInstanceOf(Error);
    expect(() => value!.markSignedOut()).not.toThrow();
  });

  it('calls /auth/me exactly once on mount and sends credentials', async () => {
    const api = stubApi(signedIn);
    function Probe() {
      const { status, user } = useAuth();
      return <p data-testid="probe">{`${status}:${user?.displayName ?? ''}`}</p>;
    }
    const { rerender } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('loading:');
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:Lan'));
    rerender(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(api.of('GET', '/api/auth/me')).toHaveLength(1);
    expect(api.of('GET', '/api/auth/me')[0]?.init.credentials).toBe('same-origin');
  });

  it('treats an /auth/me failure as anonymous', async () => {
    stubApi({ 'GET /api/auth/me': () => json({ code: 'INTERNAL_ERROR', message: 'x' }, 500) });
    function Probe() {
      return <p data-testid="probe">{useAuth().status}</p>;
    }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('anonymous'));
  });
});

describe('AC27 header user menu', () => {
  it('anonymous: login link carries the current path as next', async () => {
    stubApi();
    window.history.replaceState(null, '', '/?tag=puzzle');
    render(<App />);
    const link = await screen.findByTestId('auth-login-link');
    expect(link).toHaveAttribute('href', '/dang-nhap?next=%2F%3Ftag%3Dpuzzle');
    expect(link).toHaveTextContent('Đăng nhập');
    expect(screen.queryByTestId('user-menu-button')).not.toBeInTheDocument();
  });

  it('shows a placeholder (no login link) while /auth/me is pending', async () => {
    stubApi({ 'GET /api/auth/me': () => new Promise<Response>(() => undefined) });
    render(<App />);
    expect(screen.queryByTestId('auth-login-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-menu-button')).not.toBeInTheDocument();
  });

  it('authenticated: button shows the name; menu has profile, history, logout', async () => {
    const user = userEvent.setup();
    stubApi(signedIn);
    render(<App />);
    const button = await screen.findByTestId('user-menu-button');
    expect(button).toHaveTextContent('Lan');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('auth-login-link')).not.toBeInTheDocument();

    await user.click(button);
    const menu = screen.getByTestId('user-menu');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByTestId('user-menu-profile')).toHaveAttribute('href', '/ho-so');
    expect(within(menu).getByTestId('user-menu-history')).toHaveAttribute('href', '/lich-su');
    expect(within(menu).getByTestId('user-menu-logout')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu-profile')).toHaveFocus();
  });

  it('Escape closes the menu and returns focus to the button', async () => {
    const user = userEvent.setup();
    stubApi(signedIn);
    render(<App />);
    const button = await screen.findByTestId('user-menu-button');
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('click outside closes the menu and returns focus to the button', async () => {
    const user = userEvent.setup();
    stubApi(signedIn);
    render(<App />);
    const button = await screen.findByTestId('user-menu-button');
    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('arrow keys move between menu items', async () => {
    const user = userEvent.setup();
    stubApi(signedIn);
    render(<App />);
    await user.click(await screen.findByTestId('user-menu-button'));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('user-menu-history')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('user-menu-logout')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('user-menu-profile')).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByTestId('user-menu-logout')).toHaveFocus();
  });

  it('choosing "Hồ sơ" navigates and closes the menu', async () => {
    const user = userEvent.setup();
    stubApi(signedIn);
    render(<App />);
    await user.click(await screen.findByTestId('user-menu-button'));
    await user.click(screen.getByTestId('user-menu-profile'));
    expect(window.location.pathname).toBe('/ho-so');
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
    expect(await screen.findByTestId('profile-page')).toBeInTheDocument();
  });

  it('logout posts to /api/auth/logout and shows the login link again', async () => {
    const user = userEvent.setup();
    const api = stubApi({ ...signedIn, 'POST /api/auth/logout': () => noContent() });
    render(<App />);
    await user.click(await screen.findByTestId('user-menu-button'));
    await user.click(screen.getByTestId('user-menu-logout'));
    expect(await screen.findByTestId('auth-login-link')).toBeInTheDocument();
    expect(api.of('POST', '/api/auth/logout')).toHaveLength(1);
    expect(api.of('POST', '/api/auth/logout')[0]?.init.credentials).toBe('same-origin');
    expect(screen.queryByTestId('user-menu-button')).not.toBeInTheDocument();
  });

  it('logout from a protected page goes home instead of the login page', async () => {
    const user = userEvent.setup();
    stubApi({
      ...signedIn,
      'POST /api/auth/logout': () => noContent(),
      'GET /api/me/bests': () => json({ items: [] }),
      'GET /api/me/sessions': () => json({ items: [], total: 0, page: 1, limit: 20 }),
    });
    window.history.replaceState(null, '', '/lich-su');
    render(<App />);
    await user.click(await screen.findByTestId('user-menu-button'));
    await user.click(screen.getByTestId('user-menu-logout'));
    await screen.findByTestId('auth-login-link');
    expect(window.location.pathname).toBe('/');
  });

  it('logout failure keeps the session and shows an error', async () => {
    const user = userEvent.setup();
    stubApi({
      ...signedIn,
      'POST /api/auth/logout': () => json({ code: 'INTERNAL_ERROR', message: 'x' }, 500),
    });
    render(<App />);
    await user.click(await screen.findByTestId('user-menu-button'));
    await user.click(screen.getByTestId('user-menu-logout'));
    expect(await screen.findByTestId('user-menu-error')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu-button')).toBeInTheDocument();
  });

  it('renders a hostile display name as text only (AC35)', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    stubApi({ 'GET /api/auth/me': () => json({ user: { ...USER, displayName: evil } }) });
    const { container } = render(<App />);
    const button = await screen.findByTestId('user-menu-button');
    expect(button).toHaveTextContent(evil);
    expect(container.querySelector('header img')).toBeNull();
  });
});

describe('AC28 login page', () => {
  async function openLogin(search = '') {
    window.history.replaceState(null, '', `/dang-nhap${search}`);
    render(<App />);
    return screen.findByTestId('login-form');
  }

  it('has labelled fields with the right autocomplete', async () => {
    stubApi();
    await openLogin();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'password');
    expect(screen.getByTestId('login-to-register')).toHaveAttribute('href', '/dang-ky');
  });

  it('empty fields show an inline error and send no request', async () => {
    const user = userEvent.setup();
    const api = stubApi();
    await openLogin();
    await user.click(screen.getByTestId('login-submit'));
    expect(screen.getByTestId('login-error')).toHaveTextContent('Vui lòng nhập email và mật khẩu.');
    await fillLogin(user, 'lan@example.com', '');
    await user.click(screen.getByTestId('login-submit'));
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
    expect(api.of('POST', '/api/auth/login')).toHaveLength(0);
  });

  it('401 shows a generic message', async () => {
    const user = userEvent.setup();
    stubApi({
      'POST /api/auth/login': () => json({ code: 'INVALID_CREDENTIALS', message: 'x' }, 401),
    });
    await openLogin();
    await fillLogin(user, 'lan@example.com', 'sai-mat-khau');
    await user.click(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Email hoặc mật khẩu không đúng.',
    );
    expect(screen.getByTestId('login-submit')).toBeEnabled();
    expect(window.location.pathname).toBe('/dang-nhap');
  });

  it('429 shows the rate limit message with the wait time', async () => {
    const user = userEvent.setup();
    stubApi({
      'POST /api/auth/login': () =>
        json({ code: 'RATE_LIMITED', message: 'x' }, 429, { 'Retry-After': '30' }),
    });
    await openLogin();
    await fillLogin(user, 'lan@example.com', 'mat-khau-dai-9');
    await user.click(screen.getByTestId('login-submit'));
    const error = await screen.findByTestId('login-error');
    expect(error).toHaveTextContent('Bạn thử quá nhiều lần, vui lòng thử lại sau.');
    expect(error).toHaveTextContent('30 giây');
  });

  it('403 shows a forbidden message', async () => {
    const user = userEvent.setup();
    stubApi({ 'POST /api/auth/login': () => json({ code: 'FORBIDDEN', message: 'x' }, 403) });
    await openLogin();
    await fillLogin(user, 'lan@example.com', 'mat-khau-dai-9');
    await user.click(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Yêu cầu bị từ chối');
  });

  it.each([
    ['5xx', () => json({ code: 'INTERNAL_ERROR', message: 'x' }, 500)],
    ['network failure', () => Promise.reject(new TypeError('fail')) as unknown as Response],
  ])('%s shows the connection message', async (_name, handler) => {
    const user = userEvent.setup();
    stubApi({ 'POST /api/auth/login': handler });
    await openLogin();
    await fillLogin(user, 'lan@example.com', 'mat-khau-dai-9');
    await user.click(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Không thể kết nối. Vui lòng thử lại.',
    );
  });

  it('disables submit while sending and prevents double submit', async () => {
    const user = userEvent.setup();
    let release!: (r: Response) => void;
    const api = stubApi({
      'POST /api/auth/login': () => new Promise<Response>((r) => (release = r)),
    });
    await openLogin();
    await fillLogin(user, 'lan@example.com', 'mat-khau-dai-9');
    await user.click(screen.getByTestId('login-submit'));
    expect(screen.getByTestId('login-submit')).toBeDisabled();
    await user.type(screen.getByTestId('login-password'), '{Enter}');
    expect(api.of('POST', '/api/auth/login')).toHaveLength(1);
    await act(async () => release(json({ user: USER })));
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('success sends the trimmed email and goes to a safe next', async () => {
    const user = userEvent.setup();
    const api = stubApi({
      'POST /api/auth/login': () => json({ user: USER }),
      'GET /api/me/bests': () => json({ items: [] }),
      'GET /api/me/sessions': () => json({ items: [], total: 0, page: 1, limit: 20 }),
    });
    await openLogin('?next=%2Flich-su');
    await fillLogin(user, '  lan@example.com ', 'mat-khau-dai-9');
    await user.click(screen.getByTestId('login-submit'));
    await waitFor(() => expect(window.location.pathname).toBe('/lich-su'));
    expect(api.of('POST', '/api/auth/login')[0]?.body).toEqual({
      email: 'lan@example.com',
      password: 'mat-khau-dai-9',
    });
    expect(await screen.findByTestId('user-menu-button')).toHaveTextContent('Lan');
    expect(await screen.findByTestId('history-page')).toBeInTheDocument();
  });

  it.each([
    '//evil.example',
    'https://evil.example',
    '/\\evil',
    'javascript:alert(1)',
    '/dang-nhap',
  ])('unsafe next %s goes to /', async (next) => {
    const user = userEvent.setup();
    stubApi({ 'POST /api/auth/login': () => json({ user: USER }) });
    await openLogin(`?next=${encodeURIComponent(next)}`);
    await fillLogin(user, 'lan@example.com', 'mat-khau-dai-9');
    await user.click(screen.getByTestId('login-submit'));
    await screen.findByTestId('user-menu-button');
    expect(window.location.pathname).toBe('/');
    expect(window.location.hostname).toBe('localhost');
  });

  it('login link in the header keeps next, and register link keeps next', async () => {
    stubApi();
    await openLogin('?next=%2Fho-so');
    expect(screen.getByTestId('login-to-register')).toHaveAttribute(
      'href',
      '/dang-ky?next=%2Fho-so',
    );
    expect(screen.getByTestId('auth-login-link')).toHaveAttribute(
      'href',
      '/dang-nhap?next=%2Fho-so',
    );
  });
});

describe('AC29 register page', () => {
  async function openRegister(search = '') {
    window.history.replaceState(null, '', `/dang-ky${search}`);
    render(<App />);
    return screen.findByTestId('register-form');
  }

  async function fill(
    user: ReturnType<typeof userEvent.setup>,
    v: { email?: string; name?: string; password?: string; confirm?: string },
  ) {
    if (v.email) await user.type(screen.getByTestId('register-email'), v.email);
    if (v.name) await user.type(screen.getByTestId('register-display-name'), v.name);
    if (v.password) await user.type(screen.getByTestId('register-password'), v.password);
    if (v.confirm) await user.type(screen.getByTestId('register-password-confirm'), v.confirm);
  }

  const valid = {
    email: 'lan@example.com',
    name: 'Lan',
    password: 'mat-khau-dai-9',
    confirm: 'mat-khau-dai-9',
  };

  it('has labelled fields with the right autocomplete', async () => {
    stubApi();
    await openRegister();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Tên hiển thị')).toHaveAttribute('autocomplete', 'nickname');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Nhập lại mật khẩu')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    expect(screen.getByTestId('register-to-login')).toHaveAttribute('href', '/dang-nhap');
  });

  it('client validation: nothing is sent', async () => {
    const user = userEvent.setup();
    const api = stubApi();
    await openRegister();

    await user.click(screen.getByTestId('register-submit'));
    expect(screen.getByTestId('register-email-error')).toBeInTheDocument();
    expect(screen.getByTestId('register-display-name-error')).toBeInTheDocument();
    expect(screen.getByTestId('register-password-error')).toHaveTextContent('8–128');
    expect(screen.getByTestId('register-email')).toHaveFocus();
    expect(screen.getByTestId('register-email')).toHaveAttribute('aria-invalid', 'true');

    await fill(user, { email: valid.email, name: 'Lan', password: 'short', confirm: 'short' });
    await user.click(screen.getByTestId('register-submit'));
    expect(screen.queryByTestId('register-email-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('register-password-error')).toHaveTextContent('8–128');

    await user.clear(screen.getByTestId('register-password'));
    await user.type(screen.getByTestId('register-password'), 'mat-khau-dai-9');
    await user.click(screen.getByTestId('register-submit'));
    expect(screen.getByTestId('register-password-error')).toHaveTextContent('không khớp');

    await user.clear(screen.getByTestId('register-display-name'));
    await user.type(screen.getByTestId('register-display-name'), '<b>');
    await user.click(screen.getByTestId('register-submit'));
    expect(screen.getByTestId('register-display-name-error')).toBeInTheDocument();

    expect(api.of('POST', '/api/auth/register')).toHaveLength(0);
  });

  it('409 EMAIL_TAKEN shows the field error', async () => {
    const user = userEvent.setup();
    stubApi({ 'POST /api/auth/register': () => json({ code: 'EMAIL_TAKEN', message: 'x' }, 409) });
    await openRegister();
    await fill(user, valid);
    await user.click(screen.getByTestId('register-submit'));
    expect(await screen.findByTestId('register-email-error')).toHaveTextContent(
      'Email này đã được đăng ký.',
    );
    expect(screen.getByTestId('register-submit')).toBeEnabled();
  });

  it('409 NAME_TAKEN shows the field error', async () => {
    const user = userEvent.setup();
    stubApi({ 'POST /api/auth/register': () => json({ code: 'NAME_TAKEN', message: 'x' }, 409) });
    await openRegister();
    await fill(user, valid);
    await user.click(screen.getByTestId('register-submit'));
    expect(await screen.findByTestId('register-display-name-error')).toHaveTextContent(
      'Tên hiển thị đã có người dùng.',
    );
  });

  it('429 and network errors show a general error', async () => {
    const user = userEvent.setup();
    stubApi({
      'POST /api/auth/register': () =>
        json({ code: 'RATE_LIMITED', message: 'x' }, 429, { 'Retry-After': '120' }),
    });
    await openRegister();
    await fill(user, valid);
    await user.click(screen.getByTestId('register-submit'));
    const error = await screen.findByTestId('register-error');
    expect(error).toHaveTextContent('Bạn thử quá nhiều lần, vui lòng thử lại sau.');
    expect(error).toHaveTextContent('2 phút');
  });

  it('success signs in, sends the normalised values and navigates to next', async () => {
    const user = userEvent.setup();
    const api = stubApi({
      'POST /api/auth/register': () => json({ user: USER }, 201),
      'GET /api/me/bests': () => json({ items: [] }),
      'GET /api/me/sessions': () => json({ items: [], total: 0, page: 1, limit: 20 }),
    });
    await openRegister('?next=%2Flich-su');
    await fill(user, { ...valid, email: ' Lan@Example.COM', name: ' Lan  ' });
    await user.click(screen.getByTestId('register-submit'));
    await waitFor(() => expect(window.location.pathname).toBe('/lich-su'));
    expect(api.of('POST', '/api/auth/register')[0]?.body).toEqual({
      email: 'lan@example.com',
      password: 'mat-khau-dai-9',
      displayName: 'Lan',
    });
    expect(await screen.findByTestId('user-menu-button')).toHaveTextContent('Lan');
  });
});

describe('AC30 route protection', () => {
  const pages = {
    'GET /api/me/bests': () => json({ items: [] }),
    'GET /api/me/sessions': () => json({ items: [], total: 0, page: 1, limit: 20 }),
  };

  it.each([
    ['/ho-so', '%2Fho-so'],
    ['/lich-su', '%2Flich-su'],
    ['/lich-su?page=2', '%2Flich-su%3Fpage%3D2'],
  ])('anonymous %s replaces to the login page', async (path, encoded) => {
    stubApi();
    window.history.replaceState(null, '', path);
    const before = window.history.length;
    render(<App />);
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe(`/dang-nhap?next=${encoded}`);
    expect(window.history.length).toBe(before);
  });

  it('does not redirect while loading', async () => {
    stubApi({ 'GET /api/auth/me': () => new Promise<Response>(() => undefined) });
    window.history.replaceState(null, '', '/ho-so');
    render(<App />);
    expect(await screen.findByTestId('auth-loading')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(window.location.pathname).toBe('/ho-so');
    expect(screen.queryByTestId('profile-page')).not.toBeInTheDocument();
  });

  it('login then returns to the protected page', async () => {
    const user = userEvent.setup();
    stubApi({ ...pages, 'POST /api/auth/login': () => json({ user: USER }) });
    window.history.replaceState(null, '', '/ho-so');
    render(<App />);
    await screen.findByTestId('login-form');
    await fillLogin(user, 'lan@example.com', 'mat-khau-dai-9');
    await user.click(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('profile-page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/ho-so');
  });

  it('authenticated users on /dang-nhap or /dang-ky go to /', async () => {
    stubApi(signedIn);
    window.history.replaceState(null, '', '/dang-nhap');
    const { unmount } = render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    unmount();

    window.history.replaceState(null, '', '/dang-ky');
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('authenticated user on /dang-nhap?next=/lich-su goes to next', async () => {
    stubApi({ ...signedIn, ...pages });
    window.history.replaceState(null, '', '/dang-nhap?next=%2Flich-su');
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe('/lich-su'));
    expect(await screen.findByTestId('history-page')).toBeInTheDocument();
  });

  it('an open redirect in next is ignored for authenticated users', async () => {
    stubApi(signedIn);
    window.history.replaceState(null, '', '/dang-nhap?next=%2F%2Fevil.example');
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(window.location.host).not.toBe('evil.example');
  });
});

describe('AC36 no secrets stored on the client', () => {
  it('login writes no email/password/token to storage, cookie or URLs', async () => {
    const user = userEvent.setup();
    const api = stubApi({ 'POST /api/auth/login': () => json({ user: USER }) });
    window.history.replaceState(null, '', '/dang-nhap');
    render(<App />);
    await screen.findByTestId('login-form');
    await fillLogin(user, USER.email, 'mat-khau-dai-9');
    await user.click(screen.getByTestId('login-submit'));
    await screen.findByTestId('user-menu-button');

    const dump = (s: Storage) =>
      JSON.stringify(Object.fromEntries(Object.keys(s).map((k) => [k, s.getItem(k)])));
    for (const text of [dump(window.localStorage), dump(window.sessionStorage), document.cookie]) {
      expect(text).not.toContain(USER.email);
      expect(text).not.toContain('mat-khau-dai-9');
      expect(text).not.toContain('qp_sid');
    }
    for (const call of api.calls) {
      expect(call.url).not.toContain(USER.email);
      expect(call.url).not.toContain('mat-khau');
      expect(call.url).not.toContain('token');
    }
  });
});
