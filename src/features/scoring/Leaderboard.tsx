import { useEffect, useState } from 'react';
import { isAbortError } from '../../api/client.ts';
import { fetchLeaderboard } from '../../api/leaderboard.ts';
import type { LeaderboardResponse, ScoreOrder } from '../../api/types.ts';

interface Props {
  gameId: string;
  scoreOrder?: ScoreOrder;
  /** Đổi giá trị này để tải lại (vd. sau khi lưu điểm). */
  reloadKey?: number;
}

type State = { status: 'error' } | { status: 'success'; data: LeaderboardResponse };
type Settled = { key: string; state: State };

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s} giây`;
}

export function Leaderboard({ gameId, scoreOrder, reloadKey = 0 }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const key = `${gameId}:${reloadKey}:${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchLeaderboard(gameId, 10, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ key, state: { status: 'success', data } });
      },
      (err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setSettled({ key, state: { status: 'error' } });
      },
    );
    return () => controller.abort();
  }, [gameId, key]);

  // Khi đang tải lại (sau khi lưu điểm) vẫn hiển thị dữ liệu cũ để tránh nhấp nháy.
  const state = settled?.state ?? null;
  const order = (state?.status === 'success' ? state.data.scoreOrder : scoreOrder) ?? 'desc';
  const scoreHeader = order === 'asc' ? 'Số lượt' : 'Điểm';
  const headingId = `leaderboard-title-${gameId}`;

  let body;
  if (state === null) {
    body = <p role="status">Đang tải bảng xếp hạng…</p>;
  } else if (state.status === 'error') {
    body = (
      <div role="alert" data-testid="leaderboard-error">
        <p>Không thể tải bảng xếp hạng.</p>
        <button
          type="button"
          data-testid="leaderboard-retry"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Thử lại
        </button>
      </div>
    );
  } else if (state.data.items.length === 0) {
    body = (
      <p data-testid="leaderboard-empty">Chưa có ai trên bảng xếp hạng. Hãy là người đầu tiên!</p>
    );
  } else {
    body = (
      <table className="leaderboard__table">
        <thead>
          <tr>
            <th scope="col">Hạng</th>
            <th scope="col">Tên</th>
            <th scope="col">{scoreHeader}</th>
            <th scope="col">Thời lượng</th>
          </tr>
        </thead>
        <tbody>
          {state.data.items.map((e) => (
            <tr key={`${e.rank}:${e.playerName}`} data-testid="leaderboard-row">
              <td>#{e.rank}</td>
              <td className="leaderboard__name">
                {e.playerName}
                {e.isMember === true ? (
                  <span data-testid="leaderboard-member-badge" className="leaderboard__badge">
                    Thành viên
                  </span>
                ) : null}
              </td>
              <td>{e.score}</td>
              <td>{formatDuration(e.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <section data-testid="leaderboard" aria-labelledby={headingId} className="leaderboard">
      <h3 id={headingId}>Bảng xếp hạng</h3>
      {body}
    </section>
  );
}
