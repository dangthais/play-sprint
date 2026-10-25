import type { Game } from '../../api/types.ts';

/**
 * Danh mục "gọn": ánh xạ cố định từ tag của game sang danh mục hiển thị.
 * Tag không có trong bảng (vd. `numbers`, `memory`) không phải danh mục.
 * `from`/`to` là cặp màu gradient của ô danh mục (chữ trắng đạt AA trên cả hai màu).
 */
export interface Category {
  slug: string;
  name: string;
  from: string;
  to: string;
}

export interface CategoryWithCount extends Category {
  count: number;
}

export const CATEGORIES: readonly Category[] = [
  { slug: 'arcade', name: 'Arcade', from: '#4f46e5', to: '#9333ea' },
  { slug: 'puzzle', name: 'Giải đố', from: '#0369a1', to: '#4f46e5' },
  { slug: 'classic', name: 'Cổ điển', from: '#9f1239', to: '#c2410c' },
  { slug: 'board', name: 'Bàn cờ', from: '#0f766e', to: '#0369a1' },
];

const BY_SLUG = new Map<string, Category>(CATEGORIES.map((c) => [c.slug, c]));

export function getCategory(slug: string | null | undefined): Category | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}

/** Danh mục có ít nhất 1 game (đếm từ `games`), giữ thứ tự của bảng ánh xạ. */
export function buildCategoryList(games: readonly Game[]): CategoryWithCount[] {
  const counts = new Map<string, number>();
  for (const g of games) {
    for (const slug of new Set(g.tags)) {
      if (BY_SLUG.has(slug)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return CATEGORIES.flatMap((c) => {
    const count = counts.get(c.slug) ?? 0;
    return count > 0 ? [{ ...c, count }] : [];
  });
}
