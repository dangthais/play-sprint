import { ApiError } from '../../api/client.ts';

export const GENERIC_ERROR = 'Không thể kết nối. Vui lòng thử lại.';
export const NAME_TAKEN_TEXT = 'Tên hiển thị đã có người dùng.';
const RATE_LIMITED = 'Bạn thử quá nhiều lần, vui lòng thử lại sau.';
const FORBIDDEN = 'Yêu cầu bị từ chối. Hãy tải lại trang rồi thử lại.';

export function waitHint(sec: number | undefined): string {
  if (sec === undefined || sec < 1) return '';
  return sec >= 60
    ? ` Thời gian chờ khoảng ${Math.ceil(sec / 60)} phút.`
    : ` Thời gian chờ khoảng ${sec} giây.`;
}

/** Lỗi chung cho mọi form (các mã đặc thù được xử lý riêng trước khi gọi). */
export function commonErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return RATE_LIMITED + waitHint(err.retryAfterSec);
    if (err.status === 403) return FORBIDDEN;
  }
  return GENERIC_ERROR;
}

export function isApiError(err: unknown, status: number, code?: string): err is ApiError {
  return (
    err instanceof ApiError && err.status === status && (code === undefined || err.code === code)
  );
}
