import type { Game } from '../../api/types.ts';
import { useCatalog } from '../catalog/catalog.ts';
import { TileImage } from '../games/TileImage.tsx';
import { Link } from '../../routing/index.ts';
import './home.css';

/** 1 ô lớn + tối đa 4 ô nhỏ; 4 game thì bớt còn 3 để bố cục bento luôn kín. */
export function featuredCount(available: number): number {
  if (available >= 5) return 5;
  if (available === 4) return 3;
  return Math.max(0, available);
}

export function pickFeatured(games: readonly Game[]): Game[] {
  return games.slice(0, featuredCount(games.length));
}

function Tile({ game, big }: { game: Game; big: boolean }) {
  return (
    <Link
      href={`/games/${encodeURIComponent(game.id)}`}
      className={big ? 'featured__tile featured__tile--big' : 'featured__tile'}
      data-testid="featured-tile"
    >
      <TileImage url={game.thumbnailUrl} className="featured__img" />
      <span className="featured__shade" aria-hidden="true" />
      <span className="featured__name">{game.title}</span>
    </Link>
  );
}

/** Khối "Nổi bật" dạng bento. Lỗi hoặc không có game: ẩn khối. */
export function FeaturedGames() {
  const catalog = useCatalog();

  if (catalog.status === 'loading') {
    return (
      <section className="home-section" aria-hidden="true">
        <span className="home-section__title home-section__title--skeleton" />
        <div className="featured featured--skeleton" data-count="5" />
      </section>
    );
  }
  if (catalog.status === 'error') return null;
  const games = pickFeatured(catalog.games);
  if (games.length === 0) return null;

  const [big, ...small] = games;
  return (
    <section className="home-section" aria-labelledby="featured-title">
      <p id="featured-title" className="home-section__title">
        Nổi bật
      </p>
      <div className="featured" data-count={games.length}>
        <Tile game={big!} big />
        {small.map((g) => (
          <Tile key={g.id} game={g} big={false} />
        ))}
      </div>
    </section>
  );
}
