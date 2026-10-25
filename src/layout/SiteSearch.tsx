import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { MAX_QUERY_LENGTH, parseListQuery } from '../features/catalog/query.ts';
import { navigate, useRoute, useSearch } from '../routing/index.ts';

export const SEARCH_DEBOUNCE_MS = 250;

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

/** URL trang chủ cho từ khoá `value` (rỗng => `/`), bỏ `tag`/`page` vì đây là tìm kiếm mới. */
export function searchUrl(value: string, currentSearch = ''): string {
  const params = new URLSearchParams(currentSearch);
  params.delete('page');
  if (value.trim() === '') {
    params.delete('q');
  } else {
    params.set('q', value);
    params.delete('tag');
  }
  const qs = params.toString();
  return qs === '' ? '/' : `/?${qs}`;
}

export function SiteSearch() {
  const route = useRoute();
  const search = useSearch();
  const urlQ = route.name === 'list' ? parseListQuery(search).q : '';
  // Khoá đồng bộ gồm cả trang hiện tại: rời trang chơi về / thì ô được đặt lại theo URL.
  const syncKey = `${route.name === 'play' ? route.id : route.name}|${urlQ}`;
  const [value, setValue] = useState(urlQ);
  const [syncedKey, setSyncedKey] = useState(syncKey);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL đổi từ ngoài (logo, Back/Forward, link danh mục) thì ô tìm kiếm theo URL.
  if (syncedKey !== syncKey) {
    setSyncedKey(syncKey);
    // Giữ nguyên khi chỉ khác khoảng trắng đầu/cuối (đang gõ "snake ").
    if (value.trim() !== urlQ) setValue(urlQ);
  }

  const cancel = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const onChange = (next: string) => {
    setValue(next);
    cancel();
    const armedAt = window.location.pathname + window.location.search;
    timer.current = setTimeout(() => {
      timer.current = null;
      // Chỉ cập nhật `?q=` tại chỗ khi đang ở trang chủ; trang khác đợi Enter.
      if (window.location.pathname !== '/') return;
      // URL đã đổi do điều hướng khác từ lúc gõ (danh mục, logo...): không ghi đè.
      if (window.location.pathname + window.location.search !== armedAt) return;
      navigate(searchUrl(next, window.location.search), { replace: true });
    }, SEARCH_DEBOUNCE_MS);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    cancel();
    navigate(searchUrl(value, window.location.pathname === '/' ? window.location.search : ''));
  };

  return (
    <form role="search" className="site-search" onSubmit={onSubmit} data-testid="site-search">
      <label htmlFor="site-search-input" className="visually-hidden">
        Tìm game
      </label>
      <input
        id="site-search-input"
        className="site-search__input"
        type="search"
        name="q"
        value={value}
        placeholder="Tìm trò chơi…"
        autoComplete="off"
        maxLength={MAX_QUERY_LENGTH}
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="submit" className="site-search__btn" aria-label="Tìm kiếm">
        <SearchIcon />
      </button>
    </form>
  );
}
