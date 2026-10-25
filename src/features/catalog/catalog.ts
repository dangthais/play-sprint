import { useMemo, useSyncExternalStore } from 'react';
import { isAbortError } from '../../api/client.ts';
import { fetchGames } from '../../api/games.ts';
import type { Game } from '../../api/types.ts';
import { buildCategoryList } from './categories.ts';
import type { CategoryWithCount } from './categories.ts';

/** Giới hạn `limit` của API: lọc/đếm phía client chỉ đúng khi catalog ≤ số này. */
export const CATALOG_LIMIT = 100;

export type CatalogState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; games: Game[] };

const LOADING: CatalogState = { status: 'loading' };
const FAILED: CatalogState = { status: 'error' };

// Cache cấp module: một request `GET /api/games?page=1&limit=100` dùng chung cho sidebar,
// ô danh mục, bento, "Chơi tiếp", lọc tag/q. Request bị huỷ khi không còn ai đăng ký.
let state: CatalogState = LOADING;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function start(): void {
  const c = new AbortController();
  controller = c;
  fetchGames({ page: 1, limit: CATALOG_LIMIT }, c.signal).then(
    (data) => {
      if (controller !== c) return;
      controller = null;
      if (import.meta.env.DEV && data.total > data.items.length) {
        console.warn(
          `[catalog] ${data.total} game nhưng chỉ tải ${data.items.length} (limit=${CATALOG_LIMIT}): lọc/đếm phía client sẽ thiếu.`,
        );
      }
      state = { status: 'ready', games: data.items };
      emit();
    },
    (err: unknown) => {
      if (controller !== c || c.signal.aborted || isAbortError(err)) return;
      controller = null;
      state = FAILED;
      emit();
    },
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && state.status !== 'ready' && controller === null) {
    // Đăng ký đầu tiên (hoặc sau lỗi): (tải lại) catalog. Trạng thái đổi được React đọc lại sau subscribe.
    state = LOADING;
    start();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && controller !== null) {
      controller.abort();
      controller = null;
      state = LOADING;
    }
  };
}

function getSnapshot(): CatalogState {
  return state;
}

/** Tải lại catalog sau lỗi (chỉ có tác dụng khi đang ở trạng thái lỗi). */
export function retryCatalog(): void {
  if (state.status !== 'error' || controller !== null) return;
  state = LOADING;
  emit();
  start();
}

/** Chỉ dùng trong test: xoá cache và huỷ request đang chạy. */
export function resetCatalogForTests(): void {
  controller?.abort();
  controller = null;
  state = LOADING;
}

export function useCatalog(): CatalogState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Danh mục có ≥1 game; mảng rỗng khi đang tải hoặc lỗi. */
export function useCategories(): CategoryWithCount[] {
  const catalog = useCatalog();
  return useMemo(
    () => (catalog.status === 'ready' ? buildCategoryList(catalog.games) : []),
    [catalog],
  );
}
