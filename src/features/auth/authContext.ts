import { createContext } from 'react';
import type { User } from '../../api/types.ts';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login(email: string, password: string): Promise<void>;
  register(input: { email: string; password: string; displayName: string }): Promise<void>;
  logout(): Promise<void>;
  updateDisplayName(displayName: string): Promise<User>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /** Gọi khi API trả 401: coi như đã đăng xuất (không gọi server). */
  markSignedOut(): void;
}

const noProvider = () => Promise.reject(new Error('useAuth: thiếu AuthProvider'));

/** Mặc định (ngoài provider): khách. Cho phép render component riêng lẻ trong test. */
export const defaultAuth: AuthContextValue = {
  status: 'anonymous',
  user: null,
  login: noProvider,
  register: noProvider,
  logout: noProvider,
  updateDisplayName: noProvider,
  changePassword: noProvider,
  markSignedOut: () => undefined,
};

export const AuthContext = createContext<AuthContextValue>(defaultAuth);
