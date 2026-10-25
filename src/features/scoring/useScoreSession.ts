import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isAbortError } from '../../api/client.ts';
import { createSession, submitScore } from '../../api/sessions.ts';
import type { Game } from '../../api/types.ts';
import { saveNickname, validateNickname } from './nickname.ts';

export const RETRY_DELAYS_MS = [1000, 3000] as const;

export type ResultState =
  | 'pending'
  | 'saved'
  | 'rejected'
  | 'expired'
  | 'not-saved'
  | 'error'
  | 'needs-name'
  | 'name-taken';

/**
 * Danh tính người chơi (ADR-029). `loading` = chưa biết đã đăng nhập hay chưa: điểm của ván kết thúc
 * lúc này được giữ ở trạng thái `pending` cho tới khi biết (không nộp sai danh tính).
 */
export type Identity =
  | { kind: 'loading' }
  | { kind: 'account'; displayName: string }
  | { kind: 'guest'; nickname: string };

export interface ScoreOutcome {
  state: ResultState;
  score: number;
  rank?: number;
  personalBest?: boolean;
  rateLimited?: boolean;
  /** Với `name-taken`: tên (đã chuẩn hoá) bị từ chối. */
  takenName?: string;
}

/** Một ván: token chỉ nằm trong object này (giữ bằng ref, không bao giờ vào state/DOM/storage). */
interface Round {
  id: number;
  controller: AbortController;
  ready: Promise<void>;
  sessionId: string | null;
  token: string | null;
  createFailed: boolean;
  hasGameOver: boolean;
  /** Đang có request nộp điểm của ván này (chặn nộp đồng thời, vd. bấm "Thử lại" hai lần). */
  submitting: boolean;
}

interface Attempt {
  round: Round;
  score: number;
  /** `null` = nộp bằng tài khoản (body chỉ có `score`) hoặc chưa có tên. Khách: tên đã chuẩn hoá. */
  playerName: string | null;
  /** Đang chờ người dùng nhập/sửa tên rồi bấm "Lưu điểm" (needs-name, name-taken). */
  needsName: boolean;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function isRetryable(err: unknown): boolean {
  return err instanceof ApiError ? err.status === 0 || err.status >= 500 : false;
}

function mapError(err: unknown, score: number, playerName: string | null): ScoreOutcome {
  if (err instanceof ApiError) {
    if (err.status === 409 && err.code === 'NAME_TAKEN' && playerName !== null) {
      return { state: 'name-taken', score, takenName: playerName };
    }
    if (err.status === 422 && err.code === 'SCORE_REJECTED') return { state: 'rejected', score };
    if (err.status === 409 && err.code === 'SESSION_EXPIRED') return { state: 'expired', score };
    if (err.status === 429) return { state: 'error', score, rateLimited: true };
    if (err.status === 0 || err.status >= 500) return { state: 'error', score };
    if (err.status >= 400 && err.status < 500) return { state: 'not-saved', score };
  }
  return { state: 'error', score };
}

export interface ScoreSession {
  /** Kết quả của ván gần nhất đã kết thúc, hoặc null. */
  outcome: ScoreOutcome | null;
  /** Tăng mỗi khi một điểm được lưu; dùng để tải lại leaderboard. */
  savedCount: number;
  onReady: () => void;
  onGameOver: (score: number) => void;
  /** Nộp điểm đang chờ tên (khách; nickname hiện tại phải hợp lệ). */
  save: () => void;
  retry: () => void;
}

export function useScoreSession(game: Game, identity: Identity): ScoreSession {
  const ranked = game.ranked === true;
  const gameId = game.id;
  const [view, setView] = useState<{ roundId: number; outcome: ScoreOutcome } | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const mountedRef = useRef(false);
  const identityRef = useRef(identity);
  const roundRef = useRef<Round | null>(null);
  const roundsRef = useRef(new Set<Round>());
  const nextIdRef = useRef(0);
  const attemptRef = useRef<Attempt | null>(null);
  /** Ván đã kết thúc nhưng chưa biết danh tính (đang tải trạng thái đăng nhập). */
  const waitingRef = useRef<{ round: Round; score: number } | null>(null);

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  const show = useCallback((roundId: number, outcome: ScoreOutcome) => {
    if (!mountedRef.current) return;
    setView((prev) => {
      // Ván cũ đến muộn không được ghi đè kết quả của ván mới hơn.
      if (prev !== null && prev.roundId > roundId) return prev;
      return { roundId, outcome };
    });
  }, []);

  const send = useCallback(
    async (attempt: Attempt) => {
      const { round, score, playerName } = attempt;
      const { signal } = round.controller;
      attemptRef.current = { ...attempt, needsName: false };
      show(round.id, { state: 'pending', score });
      if (round.sessionId === null || round.token === null) {
        show(round.id, { state: 'not-saved', score });
        return;
      }
      for (let i = 0; ; i++) {
        try {
          const res = await submitScore(
            round.sessionId,
            round.token,
            playerName === null ? { score } : { score, playerName },
            signal,
          );
          if (signal.aborted || !mountedRef.current) return;
          // `qp:nickname` chỉ dành cho khách.
          if (playerName !== null) saveNickname(playerName);
          show(round.id, {
            state: 'saved',
            score,
            rank: res.rank,
            personalBest: res.personalBest,
          });
          setSavedCount((n) => n + 1);
          return;
        } catch (err) {
          if (signal.aborted || isAbortError(err) || !mountedRef.current) return;
          const delay = RETRY_DELAYS_MS[i];
          if (isRetryable(err) && delay !== undefined) {
            try {
              await sleep(delay, signal);
            } catch {
              return;
            }
            continue;
          }
          const outcome = mapError(err, score, playerName);
          // 409 NAME_TAKEN: phiên vẫn active (AC21) -> cho nộp lại cùng phiên/token với tên khác.
          if (outcome.state === 'name-taken') {
            attemptRef.current = { ...attempt, needsName: true };
          }
          show(round.id, outcome);
          return;
        }
      }
    },
    [show],
  );

  const submit = useCallback(
    async (attempt: Attempt) => {
      const { round } = attempt;
      if (round.submitting) return;
      round.submitting = true;
      try {
        await send(attempt);
      } finally {
        round.submitting = false;
      }
    },
    [send],
  );

  /** Chọn danh tính tại thời điểm ván kết thúc (và phiên đã sẵn sàng). */
  const proceed = useCallback(
    (round: Round, score: number) => {
      if (round.controller.signal.aborted || !mountedRef.current) return;
      const who = identityRef.current;
      if (who.kind === 'loading') {
        waitingRef.current = { round, score };
        return;
      }
      if (who.kind === 'account') {
        void submit({ round, score, playerName: null, needsName: false });
        return;
      }
      const name = validateNickname(who.nickname);
      if (name === null) {
        attemptRef.current = { round, score, playerName: null, needsName: true };
        show(round.id, { state: 'needs-name', score });
        return;
      }
      void submit({ round, score, playerName: name, needsName: false });
    },
    [show, submit],
  );

  useEffect(() => {
    if (identity.kind === 'loading') return;
    const waiting = waitingRef.current;
    if (!waiting) return;
    waitingRef.current = null;
    proceed(waiting.round, waiting.score);
  }, [identity.kind, proceed]);

  const onReady = useCallback(() => {
    if (!ranked || !mountedRef.current) return;
    const previous = roundRef.current;
    if (previous && !previous.hasGameOver) {
      // Ván cũ chưa có gameOver: bỏ (huỷ request, quên token).
      previous.controller.abort();
      previous.token = null;
      roundsRef.current.delete(previous);
    }
    const controller = new AbortController();
    const round: Round = {
      id: nextIdRef.current++,
      controller,
      ready: Promise.resolve(),
      sessionId: null,
      token: null,
      createFailed: false,
      hasGameOver: false,
      submitting: false,
    };
    round.ready = createSession(gameId, controller.signal).then(
      (created) => {
        round.sessionId = created.session.id;
        round.token = created.sessionToken;
      },
      () => {
        round.createFailed = true;
      },
    );
    roundRef.current = round;
    roundsRef.current.add(round);
  }, [ranked, gameId]);

  const onGameOver = useCallback(
    (score: number) => {
      const round = roundRef.current;
      if (!ranked || !round || round.hasGameOver || !mountedRef.current) return;
      round.hasGameOver = true;
      show(round.id, { state: 'pending', score });
      void round.ready.then(() => {
        if (round.controller.signal.aborted || !mountedRef.current) return;
        if (round.createFailed) {
          show(round.id, { state: 'not-saved', score });
          return;
        }
        proceed(round, score);
      });
    },
    [ranked, show, proceed],
  );

  const save = useCallback(() => {
    const attempt = attemptRef.current;
    const who = identityRef.current;
    if (!attempt || !attempt.needsName || who.kind !== 'guest') return;
    const name = validateNickname(who.nickname);
    if (name === null) return;
    void submit({ ...attempt, playerName: name, needsName: false });
  }, [submit]);

  const retry = useCallback(() => {
    const attempt = attemptRef.current;
    if (!attempt || attempt.needsName) return;
    void submit(attempt);
  }, [submit]);

  useEffect(() => {
    mountedRef.current = true;
    const rounds = roundsRef.current;
    return () => {
      mountedRef.current = false;
      for (const round of rounds) {
        round.controller.abort();
        round.token = null;
      }
      rounds.clear();
      roundRef.current = null;
      attemptRef.current = null;
      waitingRef.current = null;
    };
  }, []);

  return {
    outcome: ranked ? (view?.outcome ?? null) : null,
    savedCount,
    onReady,
    onGameOver,
    save,
    retry,
  };
}
