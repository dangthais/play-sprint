import { describe, expect, it } from 'vitest';
import type { Game } from '../../api/types.ts';
import { CATEGORIES, buildCategoryList, getCategory } from './categories.ts';

function game(id: string, tags: string[]): Game {
  return {
    id,
    title: id,
    thumbnailUrl: 'http://localhost:5173/t.svg',
    embedUrl: `http://localhost:5174/games/${id}/`,
    orientation: 'any',
    tags,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('categories', () => {
  it('maps the four fixed tags to named categories', () => {
    expect(CATEGORIES.map((c) => [c.slug, c.name])).toEqual([
      ['arcade', 'Arcade'],
      ['puzzle', 'Giải đố'],
      ['classic', 'Cổ điển'],
      ['board', 'Bàn cờ'],
    ]);
    expect(getCategory('puzzle')?.name).toBe('Giải đố');
  });

  it.each(['numbers', 'memory', '', '__proto__', 'constructor', 'Puzzle'])(
    'tag %j is not a category',
    (tag) => {
      expect(getCategory(tag)).toBeUndefined();
    },
  );

  it('returns undefined for null/undefined', () => {
    expect(getCategory(null)).toBeUndefined();
    expect(getCategory(undefined)).toBeUndefined();
  });

  it('lists only categories with at least one game, with counts, in table order', () => {
    const games = [
      game('snake', ['arcade', 'classic']),
      game('brick', ['arcade']),
      game('2048', ['puzzle', 'numbers']),
      game('memory', ['puzzle', 'memory']),
      game('ttt', ['classic', 'board']),
    ];
    expect(buildCategoryList(games).map((c) => [c.slug, c.count])).toEqual([
      ['arcade', 2],
      ['puzzle', 2],
      ['classic', 2],
      ['board', 1],
    ]);
  });

  it('hides categories without games and ignores non-category tags', () => {
    const games = [game('a', ['numbers', 'memory']), game('b', ['puzzle'])];
    expect(buildCategoryList(games).map((c) => c.slug)).toEqual(['puzzle']);
    expect(buildCategoryList([])).toEqual([]);
  });

  it('counts a game once even if its tag is repeated', () => {
    expect(buildCategoryList([game('a', ['arcade', 'arcade'])])[0]?.count).toBe(1);
  });
});
