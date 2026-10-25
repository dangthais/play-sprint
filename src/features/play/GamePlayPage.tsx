import { useEffect, useMemo, useState } from 'react';
import { ApiError, isAbortError } from '../../api/client.ts';
import { fetchGame } from '../../api/games.ts';
import type { Game } from '../../api/types.ts';
import { GAME_ORIGIN } from '../../config.ts';
import { Link } from '../../routing/index.ts';
import { useAuth } from '../auth/useAuth.ts';
import { getCategory } from '../catalog/categories.ts';
import { GameHost } from '../game-host/GameHost.tsx';
import { TrophyIcon, tagTone } from '../games/GameCard.tsx';
import { Leaderboard } from '../scoring/Leaderboard.tsx';
import { NicknameField } from '../scoring/NicknameField.tsx';
import { loadNickname, validateNickname } from '../scoring/nickname.ts';
import { NAME_TAKEN_GUEST_TEXT, ScoreResult } from '../scoring/ScoreResult.tsx';
import { useScoreSession } from '../scoring/useScoreSession.ts';
import type { Identity } from '../scoring/useScoreSession.ts';
import { PlayNext } from './PlayNext.tsx';
import '../games/games.css';
import '../scoring/scoring.css';
import './play-page.css';

export const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

type Result = { status: 'notFound' } | { status: 'error' } | { status: 'success'; game: Game };
type Settled = { key: string; result: Result };

function NotFound() {
  return (
    <div data-testid="game-not-found" className="games-message">
      <p>Không tìm thấy game.</p>
      <Link href="/" className="play-page__back">
        Về danh sách
      </Link>
    </div>
  );
}

function PlayInfo({ game }: { game: Game }) {
  const tags = [...new Set(game.tags)];
  return (
    <div className="play-info">
      <h2 data-testid="game-title" className="play-info__title">
        {game.title}
      </h2>
      {game.ranked === true || tags.length > 0 ? (
        <p className="play-info__meta">
          {game.ranked === true ? (
            <span className="game-card__badge">
              <TrophyIcon />
              Xếp hạng
            </span>
          ) : null}
          {tags.map((tag) => {
            const category = getCategory(tag);
            return category ? (
              <Link
                key={tag}
                href={`/?tag=${encodeURIComponent(tag)}`}
                className="chip chip--link"
                data-tone={tagTone(tag)}
              >
                {category.name}
              </Link>
            ) : (
              <span key={tag} className="chip" data-tone={tagTone(tag)}>
                {tag}
              </span>
            );
          })}
        </p>
      ) : null}
    </div>
  );
}

function PlayArea({ game }: { game: Game }) {
  const ranked = game.ranked === true;
  const [nickname, setNickname] = useState(loadNickname);
  const [forceNameError, setForceNameError] = useState(false);
  const auth = useAuth();
  const identity = useMemo<Identity>(() => {
    if (auth.status === 'authenticated' && auth.user) {
      return { kind: 'account', displayName: auth.user.displayName };
    }
    return auth.status === 'loading' ? { kind: 'loading' } : { kind: 'guest', nickname };
  }, [auth.status, auth.user, nickname]);
  const score = useScoreSession(game, identity);
  const takenName = score.outcome?.state === 'name-taken' ? score.outcome.takenName : undefined;
  const nameTaken = takenName !== undefined && validateNickname(nickname) === takenName;

  const onSave = () => {
    if (validateNickname(nickname) === null) {
      setForceNameError(true);
      return;
    }
    setForceNameError(false);
    score.save();
  };

  return (
    <>
      <GameHost
        embedUrl={game.embedUrl}
        gameOrigin={GAME_ORIGIN}
        title={game.title}
        orientation={game.orientation}
        {...(ranked
          ? {
              onReady: score.onReady,
              onGameOver: score.onGameOver,
              scoreLabel: game.scoreOrder === 'asc' ? 'Số lượt' : 'Điểm',
            }
          : {})}
      />
      <PlayInfo game={game} />
      <PlayNext currentId={game.id} />
      {ranked ? (
        <div className="scoring">
          {identity.kind === 'account' ? (
            <p data-testid="playing-as" className="playing-as">
              Đang chơi với tên {identity.displayName}
            </p>
          ) : (
            <NicknameField
              value={nickname}
              onChange={setNickname}
              forceError={forceNameError}
              serverError={nameTaken ? NAME_TAKEN_GUEST_TEXT : undefined}
            />
          )}
          {score.outcome ? (
            <ScoreResult outcome={score.outcome} onSave={onSave} onRetry={score.retry} />
          ) : null}
          <Leaderboard gameId={game.id} scoreOrder={game.scoreOrder} reloadKey={score.savedCount} />
        </div>
      ) : (
        <p data-testid="unranked-note" className="unranked-note">
          Game này không xếp hạng.
        </p>
      )}
      {game.description ? <p className="play-page__description">{game.description}</p> : null}
    </>
  );
}

export function GamePlayPage({ id }: { id: string }) {
  const validId = GAME_ID_PATTERN.test(id);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${id}:${attempt}`;

  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    fetchGame(id, controller.signal).then(
      (game) => {
        if (!controller.signal.aborted) setSettled({ key, result: { status: 'success', game } });
      },
      (err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        const notFound = err instanceof ApiError && err.status === 404;
        setSettled({ key, result: { status: notFound ? 'notFound' : 'error' } });
      },
    );
    return () => controller.abort();
  }, [id, validId, key]);

  const state: Result | null = !validId
    ? { status: 'notFound' }
    : settled !== null && settled.key === key
      ? settled.result
      : null;

  const title = state?.status === 'success' ? state.game.title : null;
  useEffect(() => {
    if (title === null) return;
    const previous = document.title;
    document.title = `${title} – Quick Playing`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  let body;
  if (state === null) {
    body = (
      <p role="status" className="games-message">
        Đang tải…
      </p>
    );
  } else if (state.status === 'notFound') {
    body = <NotFound />;
  } else if (state.status === 'error') {
    body = (
      <div role="alert" className="games-message">
        <p>Không thể tải game. Vui lòng thử lại.</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)}>
          Thử lại
        </button>
      </div>
    );
  } else {
    const { game } = state;
    body = <PlayArea key={game.id} game={game} />;
  }

  return (
    <section data-testid="play-page" className="play-page">
      <Link href="/" className="play-page__back" data-testid="back-to-list">
        ← Về danh sách
      </Link>
      {body}
    </section>
  );
}
