const LOGIN_PATH = '/dang-nhap';
const REGISTER_PATH = '/dang-ky';
const MAX_NEXT_LENGTH = 2000;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Chống open redirect: chỉ nhận path nội bộ bắt đầu bằng đúng một "/" (không "//", không "\",
 * không scheme, không ký tự điều khiển) và không trỏ về trang đăng nhập/đăng ký. Sai → "/".
 */
export function safeNext(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_NEXT_LENGTH) return '/';
  if (raw[0] !== '/' || raw[1] === '/' || raw.includes('\\') || CONTROL_CHARS.test(raw)) return '/';
  let url: URL;
  try {
    url = new URL(raw, 'http://qp.invalid');
  } catch {
    return '/';
  }
  if (url.origin !== 'http://qp.invalid') return '/';
  const path = url.pathname.replace(/\/+$/, '');
  if (path === LOGIN_PATH || path === REGISTER_PATH) return '/';
  return raw;
}

export function readNext(search: string): string {
  return safeNext(new URLSearchParams(search).get('next'));
}

export function loginUrl(next: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

/** Đường dẫn trang đăng nhập/đăng ký giữ nguyên `next` hợp lệ (nếu có) khi chuyển qua lại. */
export function withNext(path: string, search: string): string {
  const next = readNext(search);
  return next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`;
}
