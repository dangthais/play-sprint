import type { ApiErrorBody } from './types.ts';

export class ApiError extends Error {
  status: number;
  code: string;
  retryAfterSec?: number;

  constructor(status: number, code: string, message: string, retryAfterSec?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (retryAfterSec !== undefined) this.retryAfterSec = retryAfterSec;
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

function isErrorBody(v: unknown): v is ApiErrorBody {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as ApiErrorBody).code === 'string' &&
    typeof (v as ApiErrorBody).message === 'string'
  );
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('Retry-After');
  if (raw === null || !/^\d{1,6}$/.test(raw.trim())) return undefined;
  return Number(raw.trim());
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, credentials: 'same-origin' });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối tới máy chủ.');
  }

  // 204 No Content: không có body để parse (đăng xuất, đổi mật khẩu).
  if (res.status === 204) return undefined as T;

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    if (isAbortError(err)) throw err;
    body = undefined;
  }

  if (!res.ok) {
    const code = isErrorBody(body) ? body.code : 'UNKNOWN';
    throw new ApiError(
      res.status,
      code,
      'Yêu cầu không thành công.',
      res.status === 429 ? parseRetryAfter(res) : undefined,
    );
  }
  if (body === undefined) {
    throw new ApiError(res.status, 'UNKNOWN', 'Phản hồi không hợp lệ.');
  }
  return body as T;
}

export function getJson<T>(path: string, opts: { signal?: AbortSignal } = {}): Promise<T> {
  return request<T>(path, { headers: { Accept: 'application/json' }, signal: opts.signal });
}

export function postJson<T>(
  path: string,
  body: unknown,
  opts: { headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...opts.headers },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
}

export function patchJson<T>(
  path: string,
  body: unknown,
  opts: { headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...opts.headers },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
}
