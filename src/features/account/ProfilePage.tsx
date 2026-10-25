import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { NAME_TAKEN_TEXT, commonErrorMessage, isApiError } from '../auth/authErrors.ts';
import { TextField } from '../auth/TextField.tsx';
import { useAuth } from '../auth/useAuth.ts';
import {
  PASSWORD_ERROR_TEXT,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MISMATCH_TEXT,
  isValidExistingPassword,
  isValidNewPassword,
} from '../auth/validate.ts';
import { NICKNAME_MAX_LENGTH, validateNickname } from '../scoring/nickname.ts';
import { NICKNAME_ERROR_TEXT } from '../scoring/NicknameField.tsx';
import '../auth/auth.css';
import './account.css';

function NameForm({ displayName }: { displayName: string }) {
  const auth = useAuth();
  const [name, setName] = useState(displayName);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const onChange = (v: string) => {
    setName(v);
    setStatus(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    setStatus(null);
    const clean = validateNickname(name);
    if (clean === null) {
      setError(NICKNAME_ERROR_TEXT);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const user = await auth.updateDisplayName(clean);
      setName(user.displayName);
      setStatus('Đã lưu tên hiển thị.');
    } catch (err) {
      if (isApiError(err, 409, 'NAME_TAKEN')) setError(NAME_TAKEN_TEXT);
      else if (isApiError(err, 401)) auth.markSignedOut();
      else if (isApiError(err, 400)) setError(NICKNAME_ERROR_TEXT);
      else setError(commonErrorMessage(err));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form data-testid="profile-name-form" className="auth-form" onSubmit={onSubmit} noValidate>
      <TextField
        label="Tên hiển thị"
        autoComplete="nickname"
        inputTestId="profile-name-input"
        errorTestId="profile-name-error"
        value={name}
        onChange={onChange}
        error={error}
        maxLength={NICKNAME_MAX_LENGTH * 2}
        disabled={submitting}
      />
      <button
        type="submit"
        data-testid="profile-name-submit"
        className="btn btn--primary auth-form__submit"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? 'Đang lưu…' : 'Lưu tên'}
      </button>
      {status ? (
        <p role="status" data-testid="profile-name-status" className="auth-form__status">
          {status}
        </p>
      ) : null}
    </form>
  );
}

function PasswordForm() {
  const auth = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    setStatus(null);
    if (!isValidExistingPassword(current)) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!isValidNewPassword(next)) {
      setError(PASSWORD_ERROR_TEXT);
      return;
    }
    if (next !== confirm) {
      setError(PASSWORD_MISMATCH_TEXT);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await auth.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setStatus('Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
    } catch (err) {
      if (isApiError(err, 403, 'INVALID_CREDENTIALS')) setError('Mật khẩu hiện tại không đúng.');
      else if (isApiError(err, 401)) auth.markSignedOut();
      else if (isApiError(err, 400)) setError(PASSWORD_ERROR_TEXT);
      else setError(commonErrorMessage(err));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form data-testid="password-form" className="auth-form" onSubmit={onSubmit} noValidate>
      <TextField
        label="Mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        inputTestId="password-current"
        value={current}
        onChange={setCurrent}
        maxLength={PASSWORD_MAX_LENGTH * 2}
        disabled={submitting}
      />
      <TextField
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        inputTestId="password-new"
        value={next}
        onChange={setNext}
        hint="8–128 ký tự."
        maxLength={PASSWORD_MAX_LENGTH * 2}
        disabled={submitting}
      />
      <TextField
        label="Nhập lại mật khẩu mới"
        type="password"
        autoComplete="new-password"
        inputTestId="password-confirm"
        value={confirm}
        onChange={setConfirm}
        maxLength={PASSWORD_MAX_LENGTH * 2}
        disabled={submitting}
      />
      {error ? (
        <p role="alert" data-testid="password-error" className="auth-form__error">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        data-testid="password-submit"
        className="btn btn--primary auth-form__submit"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? 'Đang đổi…' : 'Đổi mật khẩu'}
      </button>
      {status ? (
        <p role="status" data-testid="password-status" className="auth-form__status">
          {status}
        </p>
      ) : null}
    </form>
  );
}

/** Dùng bên trong `RequireAuth`: chỉ render khi đã đăng nhập. */
export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div data-testid="profile-page" className="account-page">
      <h2 className="account-page__title">Hồ sơ</h2>
      <section className="account-card" aria-labelledby="profile-info-title">
        <h3 id="profile-info-title">Thông tin tài khoản</h3>
        <dl className="account-info">
          <dt>Email</dt>
          <dd data-testid="profile-email">{user.email}</dd>
        </dl>
        <NameForm displayName={user.displayName} />
      </section>
      <section className="account-card" aria-labelledby="password-title">
        <h3 id="password-title">Đổi mật khẩu</h3>
        <PasswordForm />
      </section>
    </div>
  );
}
