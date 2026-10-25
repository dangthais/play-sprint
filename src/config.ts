export const DEFAULT_GAME_ORIGIN = 'http://localhost:5174';

/** Chuẩn hoá về origin http/https; giá trị sai thì trả về null. */
export function normaliseOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

// Origin cấu hình riêng, không suy ra từ embedUrl do API trả về.
export const GAME_ORIGIN: string =
  normaliseOrigin(import.meta.env.VITE_GAME_ORIGIN as string | undefined) ?? DEFAULT_GAME_ORIGIN;
