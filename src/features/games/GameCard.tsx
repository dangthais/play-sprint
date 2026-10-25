import { Fragment, useState } from 'react';
import type { Game } from '../../api/types.ts';
import { Link } from '../../routing/index.ts';

export const PLACEHOLDER = '/thumbnails/placeholder.svg';

export function safeThumb(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : PLACEHOLDER;
  } catch {
    return PLACEHOLDER;
  }
}

const TONES = 6;

/** Màu chip ổn định theo nội dung tag (chỉ trình bày). */
export function tagTone(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return h % TONES;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M7 3h10v2h3a1 1 0 0 1 1 1v1.5A4.5 4.5 0 0 1 16.6 12 5 5 0 0 1 13 14.9V17h3v2h1.5v2h-11v-2H8v-2h3v-2.1A5 5 0 0 1 7.4 12 4.5 4.5 0 0 1 3 7.5V6a1 1 0 0 1 1-1h3V3zm-2 4.5c0 1.2.8 2.2 1.9 2.4A5 5 0 0 1 6.5 8V7H5v.5zM19 7h-1.5v1c0 .5-.1 1-.3 1.5A2.5 2.5 0 0 0 19 7.5V7z"
      />
    </svg>
  );
}

export function GameCard({ game }: { game: Game }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? PLACEHOLDER : safeThumb(game.thumbnailUrl);
  const ranked = game.ranked === true;

  return (
    <li className="game-card" data-testid="game-card" data-game-id={game.id}>
      <Link
        href={`/games/${encodeURIComponent(game.id)}`}
        className="game-card__link"
        data-testid="game-link"
      >
        <span className="game-card__media">
          <img
            data-testid="game-thumbnail"
            className="game-card__thumb"
            src={src}
            alt=""
            loading="lazy"
            width="320"
            height="240"
            onError={() => {
              if (!failed) setFailed(true);
            }}
          />
          <span className="game-card__shade" aria-hidden="true" />
          <span className="game-card__play" aria-hidden="true">
            <PlayIcon />
          </span>
        </span>
        <h2 className="game-card__title">{game.title}</h2>
      </Link>
      {game.tags.length > 0 || ranked ? (
        <div className="game-card__body">
          <p className="game-card__tags">
            {ranked ? (
              <span className="game-card__badge">
                <TrophyIcon />
                Xếp hạng
              </span>
            ) : null}
            {[...new Set(game.tags)].slice(0, 3).map((tag, i) => (
              <Fragment key={tag}>
                {i > 0 || ranked ? ' ' : null}
                <span className="chip" data-tone={tagTone(tag)}>
                  {tag}
                </span>
              </Fragment>
            ))}
          </p>
        </div>
      ) : null}
    </li>
  );
}
