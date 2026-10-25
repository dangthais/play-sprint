import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { navigate, useSearch } from '../../routing/index.ts';
import { loginUrl, readNext } from './safeNext.ts';
import { useAuth } from './useAuth.ts';

function AuthLoading() {
  return (
    <p role="status" data-testid="auth-loading" className="auth-loading">
      Đang tải…
    </p>
  );
}

/** Trang cần đăng nhập: khách → `/dang-nhap?next=<path>` (replace); đang tải → chờ, không chuyển sớm. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== 'anonymous') return;
    const { pathname, search } = window.location;
    navigate(loginUrl(pathname + search), { replace: true });
  }, [status]);

  return status === 'authenticated' ? <>{children}</> : <AuthLoading />;
}

/** Trang đăng nhập/đăng ký: đã đăng nhập → về `next` an toàn hoặc `/`. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const search = useSearch();
  useEffect(() => {
    if (status === 'authenticated') navigate(readNext(search), { replace: true });
  }, [status, search]);

  if (status === 'authenticated') return null;
  if (status === 'loading') return <AuthLoading />;
  return <>{children}</>;
}
