import { useMemo } from 'react';
import { retryCatalog, useCatalog } from '../catalog/catalog.ts';
import { getCategory } from '../catalog/categories.ts';
import { filterGames } from '../catalog/filter.ts';
import type { ListQuery } from '../catalog/query.ts';
import { Link } from '../../routing/index.ts';
import { GameCard } from './GameCard.tsx';
import { GamesSection, GamesSkeleton } from './GamesSection.tsx';

export function filterTitle({ tag, q }: ListQuery): string {
  const category = getCategory(tag)?.name;
  if (q !== '') return category ? `Kết quả cho “${q}” trong ${category}` : `Kết quả cho “${q}”`;
  return category ?? 'Trò chơi';
}

/** Chế độ lọc (`?tag=` / `?q=`): lọc phía client trên catalog dùng chung, không phân trang. */
export function FilteredGames({ query }: { query: ListQuery }) {
  const catalog = useCatalog();
  const games = useMemo(
    () => (catalog.status === 'ready' ? filterGames(catalog.games, query) : []),
    [catalog, query],
  );
  const title = filterTitle(query);
  // Vùng thông báo ẩn (aria-live, không role=status để không trùng "Đang tải…" của lưới).
  const announce =
    catalog.status === 'ready'
      ? games.length === 0
        ? 'Không tìm thấy game phù hợp.'
        : `${games.length} game phù hợp`
      : '';
  const live = (
    <p aria-live="polite" className="visually-hidden" data-testid="filter-announce">
      {announce}
    </p>
  );
  const back = (
    <Link href="/" className="games-head__back">
      ← Tất cả trò chơi
    </Link>
  );

  if (catalog.status === 'loading') {
    return (
      <GamesSection title={title} action={back}>
        {live}
        <GamesSkeleton />
      </GamesSection>
    );
  }

  if (catalog.status === 'error') {
    return (
      <GamesSection title={title} action={back}>
        {live}
        <div role="alert" className="games-message">
          <p>Không thể tải danh sách game. Vui lòng thử lại.</p>
          <button type="button" onClick={retryCatalog}>
            Thử lại
          </button>
        </div>
      </GamesSection>
    );
  }

  if (games.length === 0) {
    return (
      <GamesSection title={title} action={back}>
        {live}
        <div data-testid="empty-state" className="games-message">
          <p>Không tìm thấy game phù hợp.</p>
        </div>
      </GamesSection>
    );
  }

  return (
    <GamesSection title={`${title} · ${games.length} game`} action={back}>
      {live}
      <ul aria-label="Danh sách game" data-testid="game-grid" className="game-grid">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </ul>
    </GamesSection>
  );
}
