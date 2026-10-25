import { ApiError, getJson, patchJson, postJson } from './client.ts';
import { parseAuthResponse } from './auth.ts';
import type {
  AuthResponse,
  PersonalBest,
  PersonalBestsResponse,
  PlayHistoryResponse,
  User,
} from './types.ts';

const invalid = () => new ApiError(200, 'UNKNOWN', 'Phản hồi không hợp lệ.');

export async function updateDisplayName(displayName: string, signal?: AbortSignal): Promise<User> {
  return parseAuthResponse(await patchJson<AuthResponse>('/api/me', { displayName }, { signal }));
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  signal?: AbortSignal,
): Promise<void> {
  await postJson<void>('/api/me/password', { currentPassword, newPassword }, { signal });
}

export async function fetchHistory(
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<PlayHistoryResponse> {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  const data = await getJson<PlayHistoryResponse>(`/api/me/sessions?${q.toString()}`, { signal });
  if (
    !data ||
    !Array.isArray(data.items) ||
    typeof data.total !== 'number' ||
    typeof data.page !== 'number' ||
    typeof data.limit !== 'number'
  ) {
    throw invalid();
  }
  return data;
}

export async function fetchBests(signal?: AbortSignal): Promise<PersonalBest[]> {
  const data = await getJson<PersonalBestsResponse>('/api/me/bests', { signal });
  if (!data || !Array.isArray(data.items)) throw invalid();
  return data.items;
}
