import type { ReactNode } from 'react';

export function GamesSkeleton() {
  return (
    <>
      <p role="status" className="games-loading">
        Đang tải…
      </p>
      <ul className="game-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="game-skeleton">
            <span className="game-skeleton__media" />
            <span className="game-skeleton__line" />
            <span className="game-skeleton__line game-skeleton__line--short" />
          </li>
        ))}
      </ul>
    </>
  );
}

interface SectionProps {
  title: string;
  /** Số game hiển thị dạng chip cạnh tiêu đề (trang chủ). */
  total?: number;
  /** Hành động bên phải tiêu đề (vd. link quay về). */
  action?: ReactNode;
  children: ReactNode;
}

export function GamesSection({ title, total, action, children }: SectionProps) {
  return (
    <section id="games" tabIndex={-1} className="games-section" aria-labelledby="games-title">
      <div className="games-head">
        <p id="games-title" className="games-head__title">
          {title}
        </p>
        {total !== undefined ? <span className="games-head__count">{total} game</span> : null}
        {action}
      </div>
      {children}
    </section>
  );
}
