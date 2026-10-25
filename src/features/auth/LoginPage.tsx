import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, navigate, useSearch } from '../../routing/index.ts';
import { commonErrorMessage, isApiError } from './authErrors.ts';
import { readNext, withNext } from './safeNext.ts';
import { TextField } from './TextField.tsx';
import { useAuth } from './useAuth.ts';
import { PASSWORD_MAX_LENGTH, isValidExistingPassword } from './validate.ts';
import './auth.css';

const EMPTY_TEXT = 'Vui lòng nhập email và mật khẩu.';
const BAD_CREDENTIALS_TEXT = 'Email hoặc mật khẩu không đúng.';

export function LoginPage() {
  const auth = useAuth();
  const search = useSearch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    const trimmed = email.trim();
    if (trimmed === '' || password === '') {
      setError(EMPTY_TEXT);
      (trimmed === '' ? emailRef : passwordRef).current?.focus();
      return;
    }
    if (!isValidExistingPassword(password)) {
      // Server cũng từ chối (400); không cần gửi và không tiết lộ quy tắc.
      setError(BAD_CREDENTIALS_TEXT);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await auth.login(trimmed, password);
      navigate(readNext(search), { replace: true });
    } catch (err) {
      busy.current = false;
      setSubmitting(false);
      setError(
        isApiError(err, 401, 'INVALID_CREDENTIALS') || isApiError(err, 400)
          ? BAD_CREDENTIALS_TEXT
          : commonErrorMessage(err),
      );
      passwordRef.current?.focus();
    }
  };

  return (
    <section data-testid="login-page" className="auth-card" aria-labelledby="login-title">
      <h2 id="login-title" className="auth-card__title">
        Đăng nhập
      </h2>
      <form data-testid="login-form" className="auth-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputTestId="login-email"
          value={email}
          onChange={setEmail}
          inputRef={emailRef}
          maxLength={254}
          disabled={submitting}
        />
        <TextField
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          inputTestId="login-password"
          value={password}
          onChange={setPassword}
          inputRef={passwordRef}
          maxLength={PASSWORD_MAX_LENGTH * 2}
          disabled={submitting}
        />
        {error ? (
          <p role="alert" data-testid="login-error" className="auth-form__error">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          data-testid="login-submit"
          className="btn btn--primary auth-form__submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      <p className="auth-card__alt">
        Chưa có tài khoản?{' '}
        <Link href={withNext('/dang-ky', search)} data-testid="login-to-register">
          Đăng ký
        </Link>
      </p>
    </section>
  );
}
