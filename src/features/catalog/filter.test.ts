import { describe, expect, it } from 'vitest';
import type { Game } from '../../api/types.ts';
import { filterGames, normaliseText } from './filter.ts';

function game(id: string, title: string, tags: string[] = []): Game {
  return {
    id,
    title,
    thumbnailUrl: 'http://localhost:5173/t.svg',
    embedUrl: `http://localhost:5174/games/${id}/`,
    orientation: 'any',
    tags,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const games = [
  game('snake', 'Snake', ['arcade', 'classic']),
  game('2048', 'Merge 2048', ['puzzle']),
  game('dua-xe', 'Đua Xe Tốc Độ', ['arcade']),
  game('ttt', 'Tic Tac Toe', ['classic', 'board']),
];

const ids = (list: Game[]) => list.map((g) => g.id);

describe('normaliseText', () => {
  it('lowercases and strips Vietnamese diacritics, including đ', () => {
    expect(normaliseText('Đua Xe Tốc Độ')).toBe('dua xe toc do');
    expect(normaliseText('Cổ điển')).toBe('co dien');
  });
});

describe('filterGames', () => {
  it('returns everything without a filter', () => {
    expect(ids(filterGames(games, {}))).toEqual(['snake', '2048', 'dua-xe', 'ttt']);
  });

  it('filters by tag', () => {
    expect(ids(filterGames(games, { tag: 'classic' }))).toEqual(['snake', 'ttt']);
    expect(ids(filterGames(games, { tag: 'board' }))).toEqual(['ttt']);
    expect(ids(filterGames(games, { tag: null }))).toHaveLength(4);
  });

  it('matches title case-insensitively', () => {
    expect(ids(filterGames(games, { q: 'SNAKE' }))).toEqual(['snake']);
    expect(ids(filterGames(games, { q: 'tac' }))).toEqual(['ttt']);
  });

  it('ignores Vietnamese diacritics in both title and query', () => {
    expect(ids(filterGames(games, { q: 'dua xe' }))).toEqual(['dua-xe']);
    expect(ids(filterGames(games, { q: 'đua' }))).toEqual(['dua-xe']);
    expect(ids(filterGames(games, { q: 'TỐC độ' }))).toEqual(['dua-xe']);
  });

  it('trims the query and combines tag with q', () => {
    expect(ids(filterGames(games, { q: '  snake  ' }))).toEqual(['snake']);
    expect(ids(filterGames(games, { tag: 'arcade', q: 'xe' }))).toEqual(['dua-xe']);
    expect(ids(filterGames(games, { tag: 'puzzle', q: 'snake' }))).toEqual([]);
  });

  it('does not treat the query as a regular expression', () => {
    expect(filterGames(games, { q: '.*' })).toEqual([]);
  });

  it('returns nothing when no title matches', () => {
    expect(filterGames(games, { q: 'zzzz' })).toEqual([]);
  });
});
