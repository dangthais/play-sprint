import { useCallback } from 'react';
import { fetchBests, fetchHistory } from '../../api/me.ts';
import type { PersonalBest, PlayHistoryItem } from '../../api/types.ts';
import { Link } from '../../routing/index.ts';
import { useAuth } from '../auth/useAuth.ts';
import { Pagination } from '../games/Pagination.tsx';
import { usePageParam } from '../games/usePageParam.ts';
import { formatDuration } from '../scoring/Leaderboard.tsx';
import { useLoad } from './useLoad.ts';
import '../games/games.css';
import './account.css';

export const HISTORY_PAGE_SIZE = 20;

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
}

const loadBests = (signal: AbortSignal) => fetchBests(signal);
const gameHref = (id: string) => `/games/${encodeURIComponent(id)}`;

function ErrorBox({
  text,
  testId,
  retryTestId,
  onRetry,
}: {
  text: string;
  testId: string;
  retryTestId: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" data-testid={testId} className="games-message">
      <p>{text}</p>
      <button type="button" data-testid={retryTestId} onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}

function BestRow({ best }: { best: PersonalBest }) {
  const label = best.scoreOrder === 'asc' ? 'Số lượt' : 'Điểm';
  return (
    <li data-testid="personal-best-row" className="best-row">
      <Link href={gameHref(best.gameId)} className="best-row__game">
        {best.gameTitle}
      </Link>
      <p className="best-row__score">
        <span className="best-row__label">{label}</span> <strong>{best.score}</strong>
      </p>
      <p className="best-row__meta">
        Thời lượng {formatDuration(best.durationMs)} · {best.plays} lượt chơi
      </p>
    </li>
  );
}

function PersonalBests() {
  const { markSignedOut } = useAuth();
  const [state, retry] = useLoad(loadBests, markSignedOut);

  let body;
  if (state.status === 'loading') {
    body = <p role="status">Đang tải kỷ lục…</p>;
  } else if (state.status === 'error') {
    body = (
      <ErrorBox
        text="Không thể tải kỷ lục cá nhân."
        testId="personal-bests-error"
        retryTestId="personal-bests-retry"
        onRetry={retry}
      />
    );
  } else if (state.data.length === 0) {
    body = (
      <p data-testid="personal-bests-empty" className="account-empty">
        Bạn chưa có kỷ lục nào. Hãy chơi một game có bảng xếp hạng!
      </p>
    );
  } else {
    body = (
      <ul className="best-list">
        {state.data.map((b) => (
          <BestRow key={b.gameId} best={b} />
        ))}
      </ul>
    );
  }

  return (
    <section data-testid="personal-bests" className="account-card" aria-labelledby="bests-title">
      <h3 id="bests-title">Kỷ lục cá nhân</h3>
      {body}
    </section>
  );
}

function scoreText(item: PlayHistoryItem): string {
  return item.scoreOrder === 'asc' ? `${item.score} lượt` : String(item.score);
}

function HistoryRow({ item }: { item: PlayHistoryItem }) {
  return (
    <tr data-testid="history-row" data-result={item.result}>
      <td>
        <Link href={gameHref(item.gameId)}>{item.gameTitle}</Link>
      </td>
      <td>{scoreText(item)}</td>
      <td>
        <span className={`result-badge result-badge--${item.result}`}>
          {item.result === 'accepted' ? 'Đã ghi nhận' : 'Không được ghi nhận'}
        </span>
      </td>
      <td>{formatDuration(item.durationMs)}</td>
      <td>
        <time dateTime={item.endedAt}>{formatWhen(item.endedAt)}</time>
      </td>
    </tr>
  );
}

function History() {
  const { markSignedOut } = useAuth();
  const [page, setPage] = usePageParam();
  const loader = useCallback(
    (signal: AbortSignal) => fetchHistory(page, HISTORY_PAGE_SIZE, signal),
    [page],
  );
  const [state, retry] = useLoad(loader, markSignedOut);

  let body;
  if (state.status === 'loading') {
    body = <p role="status">Đang tải lịch sử…</p>;
  } else if (state.status === 'error') {
    body = (
      <ErrorBox
        text="Không thể tải lịch sử chơi."
        testId="history-error"
        retryTestId="history-retry"
        onRetry={retry}
      />
    );
  } else if (state.data.total === 0) {
    body = (
      <p data-testid="history-empty" className="account-empty">
        Bạn chưa có lượt chơi nào được nộp điểm.
      </p>
    );
  } else {
    const { items, total, limit } = state.data;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    body = (
      <>
        {items.length === 0 ? (
          <p className="account-empty">Không có lượt chơi nào ở trang này.</p>
        ) : (
          <div data-testid="history-list" className="history-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">Game</th>
                  <th scope="col">Điểm</th>
                  <th scope="col">Kết quả</th>
                  <th scope="col">Thời lượng</th>
                  <th scope="col">Thời điểm</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <HistoryRow key={item.sessionId} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 ? (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        ) : null}
      </>
    );
  }

  return (
    <section className="account-card" aria-labelledby="history-title">
      <h3 id="history-title">Lịch sử chơi</h3>
      {body}
    </section>
  );
}

/** Dùng bên trong `RequireAuth`. */
export function HistoryPage() {
  return (
    <div data-testid="history-page" className="account-page">
      <h2 className="account-page__title">Lịch sử chơi</h2>
      <PersonalBests />
      <History />
    </div>
  );
}
