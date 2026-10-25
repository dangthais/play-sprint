import { useEffect, useMemo } from 'react';
import { useSearch } from '../../routing/index.ts';
import { getCategory } from './categories.ts';

export const MAX_QUERY_LENGTH = 100;

export interface ListQuery {
  /** Slug danh mục hợp lệ, hoặc null (tag sai bị bỏ qua). */
  tag: string | null;
  /** Từ khoá đã cắt khoảng trắng đầu/cuối; '' = không tìm. */
  q: string;
}

export function parseListQuery(search: string): ListQuery {
  const params = new URLSearchParams(search);
  const rawTag = params.get('tag');
  const tag = rawTag !== null && getCategory(rawTag) !== undefined ? rawTag : null;
  const q = (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  return { tag, q };
}

export function isFiltering(query: ListQuery): boolean {
  return query.tag !== null || query.q !== '';
}

/**
 * Query đã chuẩn hoá (tag sai, q rỗng bị bỏ; khi đang lọc thì bỏ `page`);
 * `null` nếu URL đã chuẩn.
 */
export function canonicalSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  let changed = false;
  const rawTag = params.get('tag');
  if (rawTag !== null && getCategory(rawTag) === undefined) {
    params.delete('tag');
    changed = true;
  }
  const rawQ = params.get('q');
  if (rawQ !== null && rawQ.trim() === '') {
    params.delete('q');
    changed = true;
  }
  if (params.has('page') && isFiltering(parseListQuery(params.toString()))) {
    params.delete('page');
    changed = true;
  }
  if (!changed) return null;
  const next = params.toString();
  return next === '' ? '' : `?${next}`;
}

/** Đọc `?tag`/`?q` và chuẩn hoá URL bằng replaceState (giống cách `?page=` sai được xử lý). */
export function useListQuery(): ListQuery {
  const search = useSearch();
  useEffect(() => {
    const next = canonicalSearch(window.location.search);
    if (next === null) return;
    const { pathname, hash } = window.location;
    window.history.replaceState(null, '', `${pathname}${next}${hash}`);
  }, [search]);
  return useMemo(() => parseListQuery(search), [search]);
}
