import { getJson, ApiError } from './client.ts';
import type { Game, GameListResponse } from './types.ts';

export async function fetchGames(
  params: { page: number; limit: number },
  signal?: AbortSignal,
): Promise<GameListResponse> {
  const qs = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  const data = await getJson<GameListResponse>(`/api/games?${qs.toString()}`, { signal });
  if (!data || !Array.isArray(data.items) || typeof data.total !== 'number') {
    throw new ApiError(200, 'UNKNOWN', 'Phản hồi không hợp lệ.');
  }
  return data;
}

export async function fetchGame(id: string, signal?: AbortSignal): Promise<Game> {
  const data = await getJson<Game>(`/api/games/${encodeURIComponent(id)}`, { signal });
  if (
    !data ||
    typeof data !== 'object' ||
    typeof data.id !== 'string' ||
    typeof data.title !== 'string' ||
    typeof data.embedUrl !== 'string' ||
    !['landscape', 'portrait', 'any'].includes(data.orientation)
  ) {
    throw new ApiError(200, 'UNKNOWN', 'Phản hồi không hợp lệ.');
  }
  return data;
}
