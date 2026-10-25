export const MAX_SCORE = 1_000_000_000;

export type GameMessage =
  | { qp: 1; type: 'ready' }
  | { qp: 1; type: 'score'; score: number }
  | { qp: 1; type: 'gameOver'; score: number };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isValidScore(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_SCORE
  );
}

function hasExactKeys(obj: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(obj);
  return actual.length === keys.length && keys.every((k) => Object.hasOwn(obj, k));
}

/** Trả về message hợp lệ (đã chuẩn hoá thành object mới) hoặc null. */
export function parseGameMessage(data: unknown): GameMessage | null {
  if (!isPlainObject(data) || data['qp'] !== 1) return null;
  const type = data['type'];
  if (type === 'ready') {
    return hasExactKeys(data, ['qp', 'type']) ? { qp: 1, type: 'ready' } : null;
  }
  if (type === 'score' || type === 'gameOver') {
    if (!hasExactKeys(data, ['qp', 'type', 'score'])) return null;
    const score = data['score'];
    return isValidScore(score) ? { qp: 1, type, score } : null;
  }
  return null;
}
