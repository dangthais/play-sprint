import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadNickname,
  normalizeNickname,
  saveNickname,
  validateNickname,
  NICKNAME_STORAGE_KEY,
} from './nickname.ts';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('validateNickname', () => {
  it.each([
    ['empty', ''],
    ['spaces only', '   '],
    ['21 chars', 'a'.repeat(21)],
    ['angle bracket', 'a<b'],
    ['bidi override', '‮abc'],
    ['zero width', 'ab​'],
    ['emoji', 'ab😀'],
    ['3 combining marks', 'a\u0301\u0302̃̄'],
    ['leading dash', '-abc'],
    ['leading underscore', '_abc'],
  ])('rejects %s', (_label, input) => {
    expect(validateNickname(input)).toBeNull();
  });

  it.each([
    ['a', 'a'],
    ['  Lan  ', 'Lan'],
    ['Minh   Anh', 'Minh Anh'],
    ['Nguyễn Văn Ạ', 'Nguyễn Văn Ạ'],
    ['Trần_Hưng-2.0', 'Trần_Hưng-2.0'],
    ['a'.repeat(20), 'a'.repeat(20)],
  ])('accepts %j as %j', (input, expected) => {
    expect(validateNickname(input)).toBe(expected);
  });

  it.each([
    ['BOM leading', '\uFEFFLan'],
    ['BOM trailing', 'Lan\uFEFF'],
    ['BOM middle', 'La\uFEFFn'],
    ['U+3164', '\u3164'],
    ['U+3164 leading', '\u3164Lan'],
    ['U+115F trailing', 'Lan\u115F'],
    ['U+1160', 'La\u1160n'],
    ['U+FFA0', '\uFFA0'],
    ['U+2800', 'La\u2800n'],
    ['U+17B4', 'La\u17B4n'],
    ['U+17B5', 'La\u17B5n'],
    ['U+180E', 'La\u180En'],
    ['a + 3 marks', 'a\u0300\u0301\u0302'],
    ['precomposed + 2 marks', '\u00E0\u0301\u0302'],
  ])('rejects BOM/invisible/mark-stacking: %s', (_label, input) => {
    expect(validateNickname(input)).toBeNull();
  });

  it.each([
    ['Nguyễn Văn Ệ', 'Nguyễn Văn Ệ'],
    ['Trần Thị Ặ', 'Trần Thị Ặ'],
    ['  Lan  ', 'Lan'],
    ['Lan Anh', 'Lan Anh'],
    ['Lan  Anh', 'Lan Anh'],
  ])('accepts %j as %j (shared table)', (input, expected) => {
    expect(validateNickname(input)).toBe(expected);
  });

  const ch = (code: number) => String.fromCharCode(code);
  it.each([
    ['newline', 'a' + ch(0x0a) + 'b'],
    ['tab', 'a' + ch(0x09) + 'b'],
    ['carriage return', 'a' + ch(0x0d) + 'b'],
    ['no-break space', 'a' + ch(0xa0) + 'b'],
    ['ideographic space', 'a' + ch(0x3000) + 'b'],
    ['em space', 'Lan' + ch(0xa0) + ch(0x2003) + 'Anh'],
  ])('rejects control/format chars and non-U+0020 whitespace (raw string): %s', (_label, input) => {
    expect(validateNickname(input)).toBeNull();
  });

  it('counts code points, not UTF-16 units', () => {
    expect(validateNickname('𝒜'.repeat(20))).not.toBeNull();
    expect(validateNickname('𝒜'.repeat(21))).toBeNull();
  });

  it('normalizes to NFC', () => {
    expect(normalizeNickname('e\u0301')).toBe('é');
  });
});

describe('nickname storage', () => {
  it('round-trips through localStorage', () => {
    saveNickname('Lan');
    expect(window.localStorage.getItem(NICKNAME_STORAGE_KEY)).toBe('Lan');
    expect(loadNickname()).toBe('Lan');
  });

  it('returns empty string and does not throw when storage fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadNickname()).toBe('');
    expect(() => saveNickname('x')).not.toThrow();
  });
});
