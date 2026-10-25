import { ApiError, getJson, postJson } from './client.ts';
import type { AuthResponse, AuthState, User } from './types.ts';

const invalid = () => new ApiError(200, 'UNKNOWN', 'Phản hồi không hợp lệ.');

export function isUser(v: unknown): v is User {
  if (typeof v !== 'object' || v === null) return false;
  const u = v as Record<string, unknown>;
  return (
    typeof u.id === 'string' &&
    typeof u.email === 'string' &&
    typeof u.displayName === 'string' &&
    typeof u.createdAt === 'string'
  );
}

export function parseAuthResponse(data: unknown): User {
  const user = (data as AuthResponse | null | undefined)?.user;
  if (!isUser(user)) throw invalid();
  return user;
}

export async function register(
  input: { email: string; password: string; displayName: string },
  signal?: AbortSignal,
): Promise<User> {
  return parseAuthResponse(await postJson<AuthResponse>('/api/auth/register', input, { signal }));
}

export async function login(email: string, password: string, signal?: AbortSignal): Promise<User> {
  return parseAuthResponse(
    await postJson<AuthResponse>('/api/auth/login', { email, password }, { signal }),
  );
}

export async function logout(signal?: AbortSignal): Promise<void> {
  await postJson<void>('/api/auth/logout', {}, { signal });
}

/** `null` = chưa đăng nhập. */
export async function fetchMe(signal?: AbortSignal): Promise<User | null> {
  const data = await getJson<AuthState>('/api/auth/me', { signal });
  if (data?.user === null) return null;
  if (!isUser(data?.user)) throw invalid();
  return data.user;
}
