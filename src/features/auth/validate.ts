// Chỉ để UX; server mới là lớp quyết định (contract: RegisterRequest).
const EMAIL_PATTERN = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Trả về email đã chuẩn hoá (trim + chữ thường) nếu hợp lệ, ngược lại null. */
export function validateEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH) return null;
  return EMAIL_PATTERN.test(email) ? email : null;
}

function passwordLength(raw: string): number {
  return Array.from(raw.normalize('NFC')).length;
}

/** Mật khẩu mới/đăng ký: 8–128 ký tự (code point, NFC), không trim. */
export function isValidNewPassword(raw: string): boolean {
  const n = passwordLength(raw);
  return n >= PASSWORD_MIN_LENGTH && n <= PASSWORD_MAX_LENGTH;
}

/** Mật khẩu hiện có (đăng nhập, mật khẩu hiện tại): 1–128 ký tự. */
export function isValidExistingPassword(raw: string): boolean {
  const n = passwordLength(raw);
  return n >= 1 && n <= PASSWORD_MAX_LENGTH;
}

export const EMAIL_ERROR_TEXT = 'Email không hợp lệ.';
export const PASSWORD_ERROR_TEXT = 'Mật khẩu gồm 8–128 ký tự.';
export const PASSWORD_MISMATCH_TEXT = 'Mật khẩu xác nhận không khớp.';
