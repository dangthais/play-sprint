import { useId } from 'react';
import { NICKNAME_MAX_LENGTH, validateNickname } from './nickname.ts';

export const NICKNAME_ERROR_TEXT =
  'Tên gồm 1–20 ký tự: chữ, số, dấu cách, "_", "-", "." (bắt đầu bằng chữ hoặc số).';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Hiện lỗi dù người dùng chưa gõ (vd. bấm "Lưu điểm" khi tên sai). */
  forceError?: boolean;
  /** Lỗi từ server (vd. tên thuộc về thành viên); ưu tiên hơn lỗi định dạng. */
  serverError?: string;
}

export function NicknameField({ value, onChange, forceError = false, serverError }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = validateNickname(value) === null;
  const showError = serverError !== undefined || (invalid && (value !== '' || forceError));
  return (
    <div className="nickname-field">
      <label htmlFor={id}>Tên người chơi</label>
      <input
        id={id}
        data-testid="nickname-input"
        type="text"
        autoComplete="nickname"
        maxLength={NICKNAME_MAX_LENGTH * 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : undefined}
      />
      {showError ? (
        <p id={errorId} role="alert" data-testid="nickname-error" className="nickname-field__error">
          {serverError ?? NICKNAME_ERROR_TEXT}
        </p>
      ) : null}
    </div>
  );
}
