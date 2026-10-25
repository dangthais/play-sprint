import { ApiError, postJson } from './client.ts';
import type { ScoreResult, ScoreSubmission, SessionCreated } from './types.ts';

const invalid = () => new ApiError(200, 'UNKNOWN', 'Phản hồi không hợp lệ.');

export async function createSession(gameId: string, signal?: AbortSignal): Promise<SessionCreated> {
  const data = await postJson<SessionCreated>('/api/sessions', { gameId }, { signal });
  if (!data || typeof data.sessionToken !== 'string' || typeof data.session?.id !== 'string') {
    throw invalid();
  }
  return data;
}

export async function submitScore(
  sessionId: string,
  token: string,
  submission: ScoreSubmission,
  signal?: AbortSignal,
): Promise<ScoreResult> {
  const data = await postJson<ScoreResult>(
    `/api/sessions/${encodeURIComponent(sessionId)}/score`,
    // Đã đăng nhập: không gửi `playerName` (server bỏ qua, dùng tên tài khoản).
    submission.playerName
      ? { score: submission.score, playerName: submission.playerName }
      : { score: submission.score },
    { headers: { 'X-Session-Token': token }, signal },
  );
  if (!data || typeof data.rank !== 'number' || typeof data.personalBest !== 'boolean') {
    throw invalid();
  }
  return data;
}
