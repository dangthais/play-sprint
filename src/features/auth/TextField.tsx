import { useId } from 'react';
import type { Ref } from 'react';

interface Props {
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  inputTestId: string;
  error?: string | null;
  errorTestId?: string;
  hint?: string;
  maxLength?: number;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

/** Ô nhập có nhãn, gợi ý và lỗi tại chỗ (aria-invalid + aria-describedby). */
export function TextField({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  inputTestId,
  error,
  errorTestId,
  hint,
  maxLength,
  disabled,
  inputRef,
}: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedIds =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        ref={inputRef}
        data-testid={inputTestId}
        type={type}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={maxLength}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedIds}
      />
      {hint ? (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" data-testid={errorTestId} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
