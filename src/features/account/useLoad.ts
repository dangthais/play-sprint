import { useCallback, useEffect, useState } from 'react';
import { ApiError, isAbortError } from '../../api/client.ts';

export type LoadState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'success'; data: T };

type Loader<T> = (signal: AbortSignal) => Promise<T>;
type Settled<T> = { loader: Loader<T>; attempt: number; state: LoadState<T> };

/**
 * Tải dữ liệu một lần cho mỗi `loader` (bọc bằng useCallback) và mỗi lần `retry()`.
 * 401 → `onUnauthorized` (vd. markSignedOut) thay vì hiện lỗi.
 */
export function useLoad<T>(
  loader: Loader<T>,
  onUnauthorized: () => void,
): [LoadState<T>, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loader(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setSettled({ loader, attempt, state: { status: 'success', data } });
      },
      (err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorized();
          return;
        }
        setSettled({ loader, attempt, state: { status: 'error' } });
      },
    );
    return () => controller.abort();
  }, [loader, attempt, onUnauthorized]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = settled !== null && settled.loader === loader && settled.attempt === attempt;
  return [current ? settled.state : { status: 'loading' }, retry];
}
