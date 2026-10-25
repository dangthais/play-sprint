import { describe, expect, it } from 'vitest';
import { canonicalSearch, isFiltering, parseListQuery } from './query.ts';

describe('parseListQuery', () => {
  it('reads a valid tag and a trimmed q', () => {
    expect(parseListQuery('?tag=puzzle&q=%20snake%20')).toEqual({ tag: 'puzzle', q: 'snake' });
  });

  it.each(['?tag=numbers', '?tag=', '?tag=__proto__', '?tag=Puzzle', ''])(
    'ignores invalid tag in %j',
    (search) => {
      expect(parseListQuery(search).tag).toBeNull();
    },
  );

  it('caps very long queries', () => {
    expect(parseListQuery(`?q=${'a'.repeat(500)}`).q).toHaveLength(100);
  });

  it('isFiltering is true for a valid tag or non-empty q only', () => {
    expect(isFiltering(parseListQuery('?tag=arcade'))).toBe(true);
    expect(isFiltering(parseListQuery('?q=x'))).toBe(true);
    expect(isFiltering(parseListQuery('?tag=nope&q=%20'))).toBe(false);
  });
});

describe('canonicalSearch', () => {
  it('returns null when nothing needs fixing', () => {
    expect(canonicalSearch('')).toBeNull();
    expect(canonicalSearch('?page=2')).toBeNull();
    expect(canonicalSearch('?tag=puzzle')).toBeNull();
    expect(canonicalSearch('?q=a%20b')).toBeNull();
  });

  it('drops an invalid tag and keeps other params', () => {
    expect(canonicalSearch('?tag=numbers&x=1')).toBe('?x=1');
    expect(canonicalSearch('?tag=numbers')).toBe('');
  });

  it('drops an empty q', () => {
    expect(canonicalSearch('?q=%20%20')).toBe('');
  });

  it('drops page while filtering, but not otherwise', () => {
    expect(canonicalSearch('?tag=puzzle&page=2')).toBe('?tag=puzzle');
    expect(canonicalSearch('?q=snake&page=3')).toBe('?q=snake');
    expect(canonicalSearch('?tag=numbers&page=2')).toBe('?page=2');
  });
});
