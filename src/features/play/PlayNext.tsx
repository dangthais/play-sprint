import { useMemo } from 'react';
import type { Game } from '../../api/types.ts';
import { useCatalog } from '../catalog/catalog.ts';
import { TileImage } from '../games/TileImage.tsx';
import { Link } from '../../routing/index.ts';

export const PLAY_NEXT_LIMIT = 12;

/** Các game khác, bắt đầu từ game ngay sau game hiện tại (quay vòng); không chứa game hiện tại. */
export function playNextGames(
  games: readonly Game[],
  currentId: string,
  limit = PLAY_NEXT_LIMIT,
): Game[] {
  const i = games.findIndex((g) => g.id === currentId);
  const rotated = i < 0 ? [...games] : [...games.slice(i + 1), ...games.slice(0, i)];
  return rotated.filter((g) => g.id !== currentId).slice(0, limit);
}

/** Hàng "Chơi tiếp" cuộn ngang. Đang tải/lỗi/không có game khác: ẩn khối. */
export function PlayNext({ currentId }: { currentId: string }) {
  const catalog = useCatalog();
  const games = useMemo(
    () => (catalog.status === 'ready' ? playNextGames(catalog.games, currentId) : []),
    [catalog, currentId],
  );
  if (games.length === 0) return null;

  return (
    <section className="play-next" data-testid="play-next" aria-labelledby="play-next-title">
      <p id="play-next-title" className="play-next__title">
        Chơi tiếp
      </p>
      <ul className="play-next__list">
        {games.map((g) => (
          <li key={g.id} className="play-next__item">
            <Link href={`/games/${encodeURIComponent(g.id)}`} className="play-next__link">
              <span className="play-next__media">
                <TileImage url={g.thumbnailUrl} className="play-next__img" />
              </span>
              <span className="play-next__name">{g.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
