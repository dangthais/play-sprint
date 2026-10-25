import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { loginUrl, withNext } from '../features/auth/safeNext.ts';
import { useAuth } from '../features/auth/useAuth.ts';
import { Link, navigate, useRoute, useSearch } from '../routing/index.ts';

const PROTECTED_ROUTES = new Set(['profile', 'history']);

function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? '?').toLocaleUpperCase();
}

function LoginLink() {
  const route = useRoute();
  const search = useSearch();
  const { pathname } = window.location;
  const href =
    route.name === 'login' || route.name === 'register'
      ? withNext('/dang-nhap', search)
      : loginUrl(pathname + search);
  return (
    <Link href={href} data-testid="auth-login-link" className="user-login-link">
      Đăng nhập
    </Link>
  );
}

function AccountMenu({ displayName }: { displayName: string }) {
  const auth = useAuth();
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Vị trí mục cần focus khi mở menu: đầu hoặc cuối (phím mũi tên lên).
  const focusOnOpen = useRef<'first' | 'last'>('first');
  const menuId = useId();

  const items = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    [],
  );

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setError(null);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const list = items();
    (focusOnOpen.current === 'last' ? list[list.length - 1] : list[0])?.focus();
  }, [open, items]);

  useEffect(() => {
    if (!open) return;
    // Dùng `click` (sau khi trình duyệt đã chuyển focus): chỉ trả focus về nút khi không có phần tử
    // nào khác đã nhận focus.
    const onClick = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      const active = document.activeElement;
      close(
        active === null || active === document.body || menuRef.current?.contains(active) === true,
      );
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open, close]);

  const onButtonKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first';
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      close(false);
      return;
    }
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    let target: HTMLElement | undefined;
    if (e.key === 'ArrowDown') target = list[(index + 1) % list.length];
    else if (e.key === 'ArrowUp') target = list[(index - 1 + list.length) % list.length];
    else if (e.key === 'Home') target = list[0];
    else if (e.key === 'End') target = list[list.length - 1];
    if (target) {
      e.preventDefault();
      target.focus();
    }
  };

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setError(null);
    try {
      await auth.logout();
      if (PROTECTED_ROUTES.has(route.name)) navigate('/', { replace: true });
    } catch {
      setError('Không thể đăng xuất. Vui lòng thử lại.');
      setLoggingOut(false);
    }
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        data-testid="user-menu-button"
        className="user-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          focusOnOpen.current = 'first';
          if (open) close(false);
          else setOpen(true);
        }}
        onKeyDown={onButtonKeyDown}
      >
        <span className="user-menu__avatar" aria-hidden="true">
          {initialOf(displayName)}
        </span>
        <span className="user-menu__name">{displayName}</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Tài khoản"
          data-testid="user-menu"
          className="user-menu__list"
          onKeyDown={onMenuKeyDown}
        >
          <Link
            href="/ho-so"
            role="menuitem"
            data-testid="user-menu-profile"
            onClick={() => close(false)}
          >
            Hồ sơ
          </Link>
          <Link
            href="/lich-su"
            role="menuitem"
            data-testid="user-menu-history"
            onClick={() => close(false)}
          >
            Lịch sử chơi
          </Link>
          <button
            type="button"
            role="menuitem"
            data-testid="user-menu-logout"
            disabled={loggingOut}
            onClick={onLogout}
          >
            Đăng xuất
          </button>
          {error ? (
            <p role="alert" data-testid="user-menu-error" className="user-menu__error">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function UserMenu() {
  const { status, user } = useAuth();
  if (status === 'loading') return <span className="user-menu__placeholder" aria-hidden="true" />;
  if (status === 'authenticated' && user) return <AccountMenu displayName={user.displayName} />;
  return <LoginLink />;
}
