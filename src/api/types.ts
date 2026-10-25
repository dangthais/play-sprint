export type ScoreOrder = 'asc' | 'desc';

export interface Game {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  embedUrl: string;
  orientation: 'landscape' | 'portrait' | 'any';
  tags: string[];
  createdAt: string;
  /** Contract v0.4.0: luôn có; FE coi thiếu field (fixture cũ) là false. */
  ranked?: boolean;
  scoreOrder?: ScoreOrder;
}

export interface GameListResponse {
  items: Game[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface Session {
  id: string;
  gameId: string;
  status: 'active' | 'finished';
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  score: number | null;
  durationMs: number | null;
  playerName: string | null;
}

export interface SessionCreated {
  session: Session;
  sessionToken: string;
}

export interface ScoreSubmission {
  score: number;
  /** Chỉ khách gửi tên; tài khoản bỏ qua (server dùng tên hiển thị). */
  playerName?: string;
}

export interface ScoreResult {
  session: Session;
  rank: number;
  personalBest: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  /** Contract v0.5.0: true nếu là tài khoản; FE coi thiếu field là false. */
  isMember?: boolean;
  score: number;
  durationMs: number;
  achievedAt: string;
}

export interface LeaderboardResponse {
  gameId: string;
  scoreOrder: ScoreOrder;
  items: LeaderboardEntry[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
}

export interface AuthState {
  user: User | null;
}

export interface PlayHistoryItem {
  sessionId: string;
  gameId: string;
  gameTitle: string;
  scoreOrder: ScoreOrder | null;
  score: number;
  durationMs: number;
  result: 'accepted' | 'rejected';
  endedAt: string;
}

export interface PlayHistoryResponse {
  items: PlayHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PersonalBest {
  gameId: string;
  gameTitle: string;
  scoreOrder: ScoreOrder;
  score: number;
  durationMs: number;
  achievedAt: string;
  plays: number;
}

export interface PersonalBestsResponse {
  items: PersonalBest[];
}
