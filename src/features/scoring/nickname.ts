export const NICKNAME_STORAGE_KEY = 'qp:nickname';
export const NICKNAME_MAX_LENGTH = 20;

const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.-]*$/u;
const THREE_MARKS = /\p{M}{3}/u;
/** BOM (U+FEFF) ở bất kỳ vị trí nào: không hợp lệ, kiểm trên chuỗi thô trước khi trim. */
const BOM = /\uFEFF/u;
/** Ký tự "chữ" vô hình: Hangul filler (3164, 115F, 1160, FFA0), Braille blank, Khmer vowel (17B4/5), Mongolian separator. */
const INVISIBLE = /\u3164|\u115F|\u1160|\uFFA0|\u2800|\u17B4|\u17B5|\u180E/u;
/**
 * Ký tự điều khiển/định dạng (\n, \t, \r, zero-width, bidi…) và mọi khoảng trắng khác U+0020 (U+00A0,
 * U+3000…): không hợp lệ, kiểm trên chuỗi thô trước khi trim/gộp — giống server.
 */
const FORBIDDEN_RAW = /[\p{Cc}\p{Cf}]|[^\S ]/u;
const SPACE_RUN = / {2,}/g;
const EDGE_SPACE = /^ +| +$/g;

/** Chuẩn hoá giống server: trim dấu cách, NFC, gộp nhiều dấu cách liên tiếp thành một. */
export function normalizeNickname(raw: string): string {
  return raw.replace(EDGE_SPACE, '').normalize('NFC').replace(SPACE_RUN, ' ');
}

/** Trả về tên đã chuẩn hoá nếu hợp lệ (ADR-018), ngược lại null. Chỉ để UX; server mới quyết định. */
export function validateNickname(raw: string): string | null {
  if (FORBIDDEN_RAW.test(raw) || BOM.test(raw) || INVISIBLE.test(raw)) return null;
  const name = normalizeNickname(raw);
  if (INVISIBLE.test(name)) return null;
  const length = Array.from(name).length;
  if (length < 1 || length > NICKNAME_MAX_LENGTH) return null;
  if (!NAME_PATTERN.test(name)) return null;
  // Kiểm cả dạng NFD để dấu kết hợp bị gộp bởi NFC không lách được giới hạn 2 dấu liên tiếp.
  if (THREE_MARKS.test(name) || THREE_MARKS.test(name.normalize('NFD'))) return null;
  return name;
}

export function loadNickname(): string {
  try {
    return window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveNickname(name: string): void {
  try {
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, name);
  } catch {
    /* localStorage không dùng được: bỏ qua */
  }
}
