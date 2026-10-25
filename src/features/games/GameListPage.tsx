import { useEffect, useRef, useState } from 'react';
import { isAbortError } from '../../api/client.ts';
import { fetchGames } from '../../api/games.ts';
import type { GameListResponse } from '../../api/types.ts';
import { isFiltering, useListQuery } from '../catalog/query.ts';
import type { ListQuery } from '../catalog/query.ts';
import { getLastNavKind } from '../../routing/index.ts';
import { CategoryTiles } from '../home/CategoryTiles.tsx';
import { FeaturedGames } from '../home/FeaturedGames.tsx';
import { PromoBanner } from '../home/PromoBanner.tsx';
import { FilteredGames } from './FilteredGames.tsx';
import { GameCard } from './GameCard.tsx';
import { GamesSection, GamesSkeleton } from './GamesSection.tsx';
import { Pagination } from './Pagination.tsx';
import { usePageParam } from './usePageParam.ts';
import './games.css';

export const PAGE_SIZE = 12;

type Result = { status: 'error' } | { status: 'success'; data: GameListResponse };
type Settled = { key: string; result: Result };

export function GameListPage() {
  const query = useListQuery();
  useRevealOnFilterChange(query);
  return isFiltering(query) ? <FilteredGames query={query} /> : <HomeView />;
}

/**
 * Khi tag/q đổi do điều hướng chủ động (push): cuộn lên đầu và chuyển focus vào section kết quả.
 * Replace (debounce ô tìm) và Back/Forward không cướp focus.
 */
function useRevealOnFilterChange(query: ListQuery) {
  const key = `${query.tag ?? ''}|${query.q}`;
  const filtering = isFiltering(query);
  const first = useRef(true);
  useEffect(() => {
    const wasFirst = first.current;
    first.current = false;
    if (getLastNavKind() !== 'push') return;
    if (wasFirst && !filtering) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    window.scrollTo?.({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById('games')?.focus({ preventScroll: true });
  }, [key, filtering]);
}

function HomeView() {
  const [page, setPage] = usePageParam();
  return (
    <>
      {/* Khối phụ chỉ ở trang 1 (không lọc); trang 2+ chỉ có lưới + phân trang. */}
      {page === 1 && (
        <div className="home-extras">
          <CategoryTiles />
          <PromoBanner />
          <FeaturedGames />
        </div>
      )}
      <AllGames page={page} setPage={setPage} />
    </>
  );
}

function AllGames({ page, setPage }: { page: number; setPage: (page: number) => void }) {
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${page}:${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchGames({ page, limit: PAGE_SIZE }, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ key, result: { status: 'success', data } });
      },
      (err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setSettled({ key, result: { status: 'error' } });
      },
    );
    return () => controller.abort();
  }, [page, attempt, key]);

  const state = settled !== null && settled.key === key ? settled.result : null;
  const title = 'Tất cả trò chơi';

  if (state === null) {
    return (
      <GamesSection title={title}>
        <GamesSkeleton />
      </GamesSection>
    );
  }

  if (state.status === 'error') {
    return (
      <GamesSection title={title}>
        <div role="alert" className="games-message">
          <p>Không thể tải danh sách game. Vui lòng thử lại.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Thử lại
          </button>
        </div>
      </GamesSection>
    );
  }

  const { items, total } = state.data;
  if (items.length === 0) {
    return (
      <GamesSection title={title}>
        <div data-testid="empty-state" className="games-message">
          {total === 0 ? (
            <p>Chưa có game nào.</p>
          ) : (
            <>
              <p>Trang này không có game.</p>
              <button type="button" onClick={() => setPage(1)}>
                Về trang đầu
              </button>
            </>
          )}
        </div>
      </GamesSection>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <GamesSection title={title} total={total}>
      <ul aria-label="Danh sách game" data-testid="game-grid" className="game-grid">
        {items.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </ul>
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
    </GamesSection>
  );
}
