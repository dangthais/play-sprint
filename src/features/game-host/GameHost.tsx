import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { parseGameMessage } from './protocol';
import './game-host.css';

export const READY_TIMEOUT_MS = 15_000;

export interface GameHostProps {
  embedUrl: string;
  gameOrigin: string;
  title: string;
  orientation: 'landscape' | 'portrait' | 'any';
  /** Gọi cho mỗi `ready` được chấp nhận (kể cả ván mới khi đang playing). */
  onReady?: () => void;
  /** Gọi đúng một lần cho mỗi chuyển playing -> over. */
  onGameOver?: (score: number) => void;
  /** Nhãn điểm hiển thị, mặc định "Điểm". */
  scoreLabel?: string;
}

type Status = 'loading' | 'playing' | 'over' | 'error';

interface State {
  status: Status;
  score: number;
  lastScore: number | null;
  frameKey: number;
}

type Action =
  | { type: 'ready' }
  | { type: 'score'; score: number }
  | { type: 'gameOver'; score: number }
  | { type: 'timeout' }
  | { type: 'restart' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ready':
      if (state.status === 'error') return state;
      return { ...state, status: 'playing', score: 0 };
    case 'score':
      if (state.status !== 'playing') return state;
      return { ...state, score: action.score };
    case 'gameOver':
      if (state.status !== 'playing') return state;
      return { ...state, status: 'over', score: action.score, lastScore: action.score };
    case 'timeout':
      if (state.status !== 'loading') return state;
      return { ...state, status: 'error' };
    case 'restart':
      return {
        status: 'loading',
        score: 0,
        lastScore: state.lastScore,
        frameKey: state.frameKey + 1,
      };
  }
}

function safeOrigin(url: string): string | null {
  try {
    const origin = new URL(url).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

const STATUS_TEXT: Record<Status, string> = {
  loading: 'Đang tải game…',
  playing: 'Đang chơi',
  over: 'Kết thúc ván',
  error: 'Không thể tải game.',
};

function safeCall(fn: () => void): void {
  try {
    fn();
  } catch {
    // Callback của nơi dùng lỗi không được làm hỏng host.
  }
}

const INITIAL_STATE: State = { status: 'loading', score: 0, lastScore: null, frameKey: 0 };

export function GameHost({
  embedUrl,
  gameOrigin,
  title,
  orientation,
  onReady,
  onGameOver,
  scoreLabel = 'Điểm',
}: GameHostProps) {
  const [state, rawDispatch] = useReducer(reducer, INITIAL_STATE);
  // Bản sao đồng bộ của state (cùng reducer thuần) để quyết định gọi callback ngoài reducer,
  // đúng cả khi nhiều message đến trước lần render kế tiếp và khi StrictMode gọi reducer 2 lần.
  const stateRef = useRef<State>(INITIAL_STATE);
  const dispatch = useCallback((action: Action) => {
    stateRef.current = reducer(stateRef.current, action);
    rawDispatch(action);
  }, []);
  const cbRef = useRef({ onReady, onGameOver });
  useEffect(() => {
    cbRef.current = { onReady, onGameOver };
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const configValid = useMemo(() => {
    const embed = safeOrigin(embedUrl);
    const game = safeOrigin(gameOrigin);
    return embed !== null && game !== null && embed === game && game !== window.location.origin;
  }, [embedUrl, gameOrigin]);

  const status: Status = configValid ? state.status : 'error';

  useEffect(() => {
    if (!configValid) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source === null || event.source !== iframeRef.current?.contentWindow) return;
      // Tài liệu sandbox không có allow-same-origin có origin opaque => "null".
      if (event.origin !== 'null') return;
      const msg = parseGameMessage(event.data);
      if (msg === null) return;
      if (msg.type === 'ready') {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const accepted = stateRef.current.status !== 'error';
        dispatch({ type: 'ready' });
        if (accepted) safeCall(() => cbRef.current.onReady?.());
      } else {
        const wasPlaying = stateRef.current.status === 'playing';
        dispatch({ type: msg.type, score: msg.score });
        if (msg.type === 'gameOver' && wasPlaying) {
          const score = msg.score;
          safeCall(() => cbRef.current.onGameOver?.(score));
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [configValid, dispatch]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  // Đổi iframe (restart) thì huỷ timer cũ.
  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [state.frameKey]);

  const handleLoad = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      dispatch({ type: 'timeout' });
    }, READY_TIMEOUT_MS);
  };

  const handleRestart = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dispatch({ type: 'restart' });
  };

  const showScore = status === 'playing' || status === 'over';

  return (
    <div
      className={`game-host game-host--${orientation}`}
      data-testid="game-host"
      data-status={status}
    >
      <div className="game-host__frame-wrap">
        {status === 'error' ? (
          <div className="game-host__error">Không thể tải game.</div>
        ) : (
          <iframe
            key={state.frameKey}
            ref={iframeRef}
            className="game-host__frame"
            data-testid="game-frame"
            src={embedUrl}
            title={title}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            onLoad={handleLoad}
          />
        )}
      </div>
      <div className="game-host__bar">
        <span role="status" data-testid="game-status">
          {STATUS_TEXT[status]}
        </span>
        {showScore && (
          <span data-testid="game-score">
            {scoreLabel}: {state.score}
          </span>
        )}
        {state.lastScore !== null && (
          <span data-testid="game-last-score">Ván trước: {state.lastScore}</span>
        )}
        {configValid && (
          <button type="button" data-testid="game-restart" onClick={handleRestart}>
            {status === 'error' ? 'Thử lại' : 'Chơi lại'}
          </button>
        )}
      </div>
      <p className="game-host__hint">Nhấp vào khung game để điều khiển bằng bàn phím</p>
    </div>
  );
}
