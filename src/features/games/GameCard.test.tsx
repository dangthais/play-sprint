import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Game } from '../../api/types.ts';
import { GameCard } from './GameCard.tsx';

const base: Game = {
  id: 'snake',
  title: 'Snake',
  thumbnailUrl: 'http://localhost:5173/thumbnails/snake.svg',
  embedUrl: 'http://localhost:5174/games/snake/',
  orientation: 'any',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderCard(game: Game) {
  render(
    <ul>
      <GameCard game={game} />
    </ul>,
  );
  return screen.getByTestId('game-card');
}

describe('GameCard', () => {
  it('renders at most 3 unique tags outside the link and no description (tile style)', () => {
    const card = renderCard({
      ...base,
      description: 'Ăn mồi để dài ra.',
      tags: ['arcade', 'arcade', 'classic', 'retro', 'fun'],
    });
    expect(within(card).queryByText('Ăn mồi để dài ra.')).toBeNull();
    const chips = Array.from(card.querySelectorAll('.chip')).map((c) => c.textContent);
    expect(chips).toEqual(['arcade', 'classic', 'retro']);
    expect(screen.getByTestId('game-link')).toHaveAccessibleName('Snake');
  });

  it('shows the "Xếp hạng" badge only for ranked games, even without tags', () => {
    const ranked = renderCard({ ...base, ranked: true });
    expect(within(ranked).getByText('Xếp hạng')).toBeInTheDocument();
    expect(screen.getByTestId('game-link')).toHaveAccessibleName('Snake');
  });

  it('has no badge when the game is not ranked', () => {
    const card = renderCard({ ...base, ranked: false, tags: ['arcade'] });
    expect(within(card).queryByText('Xếp hạng')).toBeNull();
  });

  it('omits the body when there are no tags and the game is not ranked', () => {
    const card = renderCard(base);
    expect(card.querySelector('.game-card__body')).toBeNull();
  });

  it('renders HTML in tags and title as plain text', () => {
    const card = renderCard({
      ...base,
      title: '<img src=x onerror=alert(1)>',
      tags: ['<b>x</b>'],
    });
    expect(card.querySelector('img:not([data-testid="game-thumbnail"])')).toBeNull();
    expect(card.querySelector('b')).toBeNull();
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(
      '<img src=x onerror=alert(1)>',
    );
    expect(within(card).getByText('<b>x</b>')).toBeInTheDocument();
  });
});
