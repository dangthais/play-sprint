import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../../api/auth.ts';
import { ApiError, isAbortError } from '../../api/client.ts';
import * as meApi from '../../api/me.ts';
import type { User } from '../../api/types.ts';
import { AuthContext } from './authContext.ts';
import type { AuthContextValue, AuthStatus } from './authContext.ts';

interface State {
  status: AuthStatus;
  user: User | null;
}

const LOADING: State = { status: 'loading', user: null };
const ANONYMOUS: State = { status: 'anonymous', user: null };
const signedIn = (user: User): State => ({ status: 'authenticated', user });

/**
 * Trạng thái đăng nhập dùng chung. Chỉ lưu trong bộ nhớ: phiên là cookie httpOnly do server quản lý,
 * không có token/email nào được ghi vào localStorage/sessionStorage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(LOADING);
  // Nếu người dùng đã đăng nhập/đăng xuất trước khi /auth/me trả về, bỏ qua kết quả đó.
  const touched = useRef(false);
  // Một request /auth/me cho mỗi provider: StrictMode (dev) chạy effect hai lần trên cùng instance,
  // lần sau dùng lại request đang chạy thay vì huỷ rồi gọi lại.
  const meRequest = useRef<Promise<User | null> | null>(null);

  useEffect(() => {
    let active = true;
    meRequest.current ??= authApi.fetchMe();
    meRequest.current.then(
      (user) => {
        if (!active || touched.current) return;
        setState(user ? signedIn(user) : ANONYMOUS);
      },
      (err: unknown) => {
        if (!active || isAbortError(err) || touched.current) return;
        // Lỗi mạng/5xx: coi như khách, không chặn trang.
        setState(ANONYMOUS);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const user = await authApi.login(email, password);
    touched.current = true;
    setState(signedIn(user));
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; displayName: string }) => {
      const user = await authApi.register(input);
      touched.current = true;
      setState(signedIn(user));
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Mạng/5xx: phiên có thể vẫn còn hiệu lực phía server → giữ trạng thái, để UI báo lỗi.
      if (!(err instanceof ApiError) || err.status === 0 || err.status >= 500) throw err;
    }
    touched.current = true;
    setState(ANONYMOUS);
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const user = await meApi.updateDisplayName(displayName);
    setState((s) => (s.status === 'authenticated' ? signedIn(user) : s));
    return user;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await meApi.changePassword(currentPassword, newPassword);
  }, []);

  const markSignedOut = useCallback(() => {
    touched.current = true;
    setState((s) => (s.status === 'anonymous' ? s : ANONYMOUS));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      login,
      register,
      logout,
      updateDisplayName,
      changePassword,
      markSignedOut,
    }),
    [state, login, register, logout, updateDisplayName, changePassword, markSignedOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
