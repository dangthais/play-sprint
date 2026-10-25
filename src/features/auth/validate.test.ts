import { describe, expect, it } from 'vitest';
import { isValidExistingPassword, isValidNewPassword, validateEmail } from './validate.ts';

describe('validateEmail', () => {
  it('normalises case and surrounding spaces', () => {
    expect(validateEmail('  Lan@Example.COM ')).toBe('lan@example.com');
    expect(validateEmail('a.b+c@sub.example.vn')).toBe('a.b+c@sub.example.vn');
  });
  it.each(['', 'a@b', 'a b@c.de', 'lan@ví.dụ', 'no-at.example.com', '@x.com', 'a@@b.co', '5'])(
    'rejects %j',
    (v) => {
      expect(validateEmail(v)).toBeNull();
    },
  );
  it('rejects emails longer than 254 chars', () => {
    expect(validateEmail('a'.repeat(250) + '@b.co')).toBeNull();
  });
});

describe('password rules', () => {
  it('new password is 8-128 characters', () => {
    expect(isValidNewPassword('1234567')).toBe(false);
    expect(isValidNewPassword('12345678')).toBe(true);
    expect(isValidNewPassword('a'.repeat(128))).toBe(true);
    expect(isValidNewPassword('a'.repeat(129))).toBe(false);
  });
  it('counts code points after NFC, not UTF-16 units', () => {
    expect(isValidNewPassword('😀'.repeat(8))).toBe(true);
    expect(isValidNewPassword('😀'.repeat(7))).toBe(false);
    expect(isValidNewPassword('mậtkhẩu'.normalize('NFD') + '12')).toBe(true);
  });
  it('does not trim', () => {
    expect(isValidNewPassword('       a')).toBe(true);
  });
  it('existing password is 1-128 characters', () => {
    expect(isValidExistingPassword('')).toBe(false);
    expect(isValidExistingPassword('x')).toBe(true);
    expect(isValidExistingPassword('a'.repeat(129))).toBe(false);
  });
});
