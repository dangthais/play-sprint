import { describe, expect, it } from 'vitest';
import { loginUrl, readNext, safeNext, withNext } from './safeNext.ts';

describe('safeNext', () => {
  it.each([
    '/',
    '/ho-so',
    '/lich-su?page=2',
    '/games/snake',
    '/?tag=puzzle&q=a%20b',
    '/games/snake#top',
  ])('accepts internal path %s', (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([
    '//evil.example',
    '///evil.example',
    'https://evil.example',
    'http://evil.example/x',
    '/\\evil.example',
    '/\\/evil.example',
    '/a\\b',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,x',
    'evil.example',
    'ho-so',
    '',
    '/dang-nhap',
    '/dang-nhap?next=/ho-so',
    '/dang-nhap/',
    '/dang-ky',
    '/dang-ky#x',
    '/a\nb',
    '/a\tb',
    '/\u0000',
    '/\u007f',
    '/' + 'a'.repeat(2100),
  ])('falls back to / for %j', (p) => {
    expect(safeNext(p)).toBe('/');
  });

  it('handles null and undefined', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext(undefined)).toBe('/');
  });

  it('readNext reads and sanitises the next param', () => {
    expect(readNext('?next=%2Flich-su%3Fpage%3D2')).toBe('/lich-su?page=2');
    expect(readNext('?next=%2F%2Fevil.example')).toBe('/');
    expect(readNext('')).toBe('/');
  });

  it('loginUrl encodes next', () => {
    expect(loginUrl('/lich-su?page=2')).toBe('/dang-nhap?next=%2Flich-su%3Fpage%3D2');
  });

  it('withNext keeps only a safe next', () => {
    expect(withNext('/dang-ky', '?next=%2Fho-so')).toBe('/dang-ky?next=%2Fho-so');
    expect(withNext('/dang-ky', '?next=https%3A%2F%2Fevil.example')).toBe('/dang-ky');
    expect(withNext('/dang-ky', '')).toBe('/dang-ky');
  });
});
