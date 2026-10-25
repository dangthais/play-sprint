import type { Game } from '../../api/types.ts';

/** Không phân biệt hoa thường và dấu tiếng Việt ("Đua xe" khớp "dua xe"). */
export function normaliseText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd');
}

export interface GameFilter {
  tag?: string | null;
  q?: string;
}

/**
 * Lọc phía client trên catalog đã tải (`limit=100`). Chỉ đủ khi catalog ≤ 100 game
 * (giới hạn `limit` của API); vượt ngưỡng đó cần lọc phía server.
 */
export function filterGames(games: readonly Game[], { tag, q }: GameFilter): Game[] {
  const needle = normaliseText((q ?? '').trim());
  return games.filter((g) => {
    if (tag && !g.tags.includes(tag)) return false;
    if (needle && !normaliseText(g.title).includes(needle)) return false;
    return true;
  });
}
