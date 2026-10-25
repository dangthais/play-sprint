import { useCallback, useEffect, useState } from 'react';
import { subscribeNavigation } from '../../routing/index.ts';

// Khớp `page.maximum` trong docs/api-contract.yaml; vượt trần thì API trả 400.
export const MAX_PAGE = 10000;

export function parsePage(raw: string | null): number | null {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return n <= MAX_PAGE ? n : null;
}

function readPage(): number {
  return parsePage(new URLSearchParams(window.location.search).get('page')) ?? 1;
}

function urlWithPage(page: number): string {
  const params = new URLSearchParams(window.location.search);
  params.set('page', String(page));
  return `${window.location.pathname}?${params.toString()}${window.location.hash}`;
}

function normaliseInvalidPage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.has('page') && parsePage(params.get('page')) === null) {
    window.history.replaceState(null, '', urlWithPage(1));
  }
}

export function usePageParam(): [number, (page: number) => void] {
  const [page, setPageState] = useState(readPage);

  useEffect(() => {
    normaliseInvalidPage();
    return subscribeNavigation(() => {
      normaliseInvalidPage();
      setPageState(readPage());
    });
  }, []);

  const setPage = useCallback((next: number) => {
    window.history.pushState(null, '', urlWithPage(next));
    setPageState(next);
  }, []);

  return [page, setPage];
}
