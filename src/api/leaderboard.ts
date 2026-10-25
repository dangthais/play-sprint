import { ApiError, getJson } from './client.ts';
import type { LeaderboardResponse } from './types.ts';

export async function fetchLeaderboard(
  gameId: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<LeaderboardResponse> {
  const qs = new URLSearchParams({ limit: String(limit) });
  const data = await getJson<LeaderboardResponse>(
    `/api/games/${encodeURIComponent(gameId)}/leaderboard?${qs.toString()}`,
    { signal },
  );
  if (!data || !Array.isArray(data.items)) {
    throw new ApiError(200, 'UNKNOWN', 'Phản hồi không hợp lệ.');
  }
  return data;
}
