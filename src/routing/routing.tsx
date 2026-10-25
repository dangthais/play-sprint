import { useMemo, useSyncExternalStore } from 'react';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';

export type Route =
  | { name: 'list' }
  | { name: 'play'; id: string }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'profile' }
  | { name: 'history' }
  | { name: 'notFound' };

const ACCOUNT_ROUTES: Record<string, Route> = {
  '/dang-nhap': { name: 'login' },
  '/dang-ky': { name: 'register' },
  '/ho-so': { name: 'profile' },
  '/lich-su': { name: 'history' },
};

export function parseRoute(pathname: string): Route {
  if (pathname === '/') return { name: 'list' };
  const account = ACCOUNT_ROUTES[pathname.replace(/\/$/, '')];
  if (account) return account;
  const m = /^\/games\/([^/]+)\/?$/.exec(pathname);
  if (m) {
    try {
      return { name: 'play', id: decodeURIComponent(m[1]!) };
    } catch {
      return { name: 'notFound' };
    }
  }
  return { name: 'notFound' };
}

const NAV_EVENT = 'qp:navigate';

/** Gọi `cb` khi URL đổi do Back/Forward hoặc do `navigate`. */
export function subscribeNavigation(cb: () => void): () => void {
  window.addEventListener('popstate', cb);
  window.addEventListener(NAV_EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(NAV_EVENT, cb);
  };
}

const getPathname = () => window.location.pathname;

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribeNavigation, getPathname, () => '/');
  return useMemo(() => parseRoute(pathname), [pathname]);
}

const getSearch = () => window.location.search;

/** Chuỗi query hiện tại (vd. `?q=snake`); render lại khi URL đổi qua Link/navigate/Back/Forward. */
export function useSearch(): string {
  return useSyncExternalStore(subscribeNavigation, getSearch, () => '');
}

export type NavKind = 'push' | 'replace' | 'pop';

// Lần đổi URL gần nhất: để UI phân biệt điều hướng chủ động (push) với replace/Back-Forward.
let lastNavKind: NavKind = 'pop';
window.addEventListener('popstate', () => {
  lastNavKind = 'pop';
});

export function getLastNavKind(): NavKind {
  return lastNavKind;
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const { pathname, search, hash } = window.location;
  const same =
    new URL(to, window.location.href).href ===
    new URL(pathname + search + hash, window.location.href).href;
  if (opts.replace || same) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  lastNavKind = opts.replace || same ? 'replace' : 'push';
  window.dispatchEvent(new Event(NAV_EVENT));
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  replace?: boolean;
};

export function Link({ href, replace, onClick, target, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      (target !== undefined && target !== '_self')
    ) {
      return;
    }
    e.preventDefault();
    navigate(href, { replace });
  };
  return <a {...rest} href={href} target={target} onClick={handle} />;
}
