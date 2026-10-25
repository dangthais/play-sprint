import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, navigate, useSearch } from '../../routing/index.ts';
import { NICKNAME_MAX_LENGTH, validateNickname } from '../scoring/nickname.ts';
import { NICKNAME_ERROR_TEXT } from '../scoring/NicknameField.tsx';
import { NAME_TAKEN_TEXT, commonErrorMessage, isApiError } from './authErrors.ts';
import { readNext, withNext } from './safeNext.ts';
import { TextField } from './TextField.tsx';
import { useAuth } from './useAuth.ts';
import {
  EMAIL_ERROR_TEXT,
  PASSWORD_ERROR_TEXT,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MISMATCH_TEXT,
  isValidNewPassword,
  validateEmail,
} from './validate.ts';
import './auth.css';

interface Errors {
  email?: string;
  displayName?: string;
  password?: string;
  /** Ô mà lỗi mật khẩu gắn vào: mật khẩu sai độ dài → "password", không khớp → "confirm". */
  passwordField?: 'password' | 'confirm';
  form?: string;
}

export function RegisterPage() {
  const auth = useAuth();
  const search = useSearch();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;

    const cleanEmail = validateEmail(email);
    const cleanName = validateNickname(displayName);
    const next: Errors = {};
    if (cleanEmail === null) next.email = EMAIL_ERROR_TEXT;
    if (cleanName === null) next.displayName = NICKNAME_ERROR_TEXT;
    if (!isValidNewPassword(password)) {
      next.password = PASSWORD_ERROR_TEXT;
      next.passwordField = 'password';
    } else if (password !== confirm) {
      next.password = PASSWORD_MISMATCH_TEXT;
      next.passwordField = 'confirm';
    }
    if (next.email || next.displayName || next.password) {
      setErrors(next);
      const first = next.email
        ? emailRef
        : next.displayName
          ? nameRef
          : next.passwordField === 'confirm'
            ? confirmRef
            : passwordRef;
      first.current?.focus();
      return;
    }

    busy.current = true;
    setSubmitting(true);
    setErrors({});
    try {
      await auth.register({ email: cleanEmail!, password, displayName: cleanName! });
      navigate(readNext(search), { replace: true });
    } catch (err) {
      busy.current = false;
      setSubmitting(false);
      if (isApiError(err, 409, 'EMAIL_TAKEN')) {
        setErrors({ email: 'Email này đã được đăng ký.' });
        emailRef.current?.focus();
      } else if (isApiError(err, 409, 'NAME_TAKEN')) {
        setErrors({ displayName: NAME_TAKEN_TEXT });
        nameRef.current?.focus();
      } else if (isApiError(err, 400)) {
        setErrors({ form: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.' });
      } else {
        setErrors({ form: commonErrorMessage(err) });
      }
    }
  };

  const onPassword = errors.passwordField === 'password' ? errors.password : null;
  const onConfirm = errors.passwordField === 'confirm' ? errors.password : null;

  return (
    <section data-testid="register-page" className="auth-card" aria-labelledby="register-title">
      <h2 id="register-title" className="auth-card__title">
        Đăng ký
      </h2>
      <form data-testid="register-form" className="auth-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputTestId="register-email"
          errorTestId="register-email-error"
          value={email}
          onChange={setEmail}
          error={errors.email}
          inputRef={emailRef}
          maxLength={254}
          disabled={submitting}
        />
        <TextField
          label="Tên hiển thị"
          autoComplete="nickname"
          inputTestId="register-display-name"
          errorTestId="register-display-name-error"
          value={displayName}
          onChange={setDisplayName}
          error={errors.displayName}
          hint="Hiện trên bảng xếp hạng; không trùng tên của thành viên khác."
          inputRef={nameRef}
          maxLength={NICKNAME_MAX_LENGTH * 2}
          disabled={submitting}
        />
        <TextField
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          inputTestId="register-password"
          errorTestId="register-password-error"
          value={password}
          onChange={setPassword}
          error={onPassword}
          hint="8–128 ký tự."
          inputRef={passwordRef}
          maxLength={PASSWORD_MAX_LENGTH * 2}
          disabled={submitting}
        />
        <TextField
          label="Nhập lại mật khẩu"
          type="password"
          autoComplete="new-password"
          inputTestId="register-password-confirm"
          errorTestId="register-password-error"
          value={confirm}
          onChange={setConfirm}
          error={onConfirm}
          inputRef={confirmRef}
          maxLength={PASSWORD_MAX_LENGTH * 2}
          disabled={submitting}
        />
        {errors.form ? (
          <p role="alert" data-testid="register-error" className="auth-form__error">
            {errors.form}
          </p>
        ) : null}
        <button
          type="submit"
          data-testid="register-submit"
          className="btn btn--primary auth-form__submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Đang đăng ký…' : 'Đăng ký'}
        </button>
      </form>
      <p className="auth-card__alt">
        Đã có tài khoản?{' '}
        <Link href={withNext('/dang-nhap', search)} data-testid="register-to-login">
          Đăng nhập
        </Link>
      </p>
    </section>
  );
}
