import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  // Tay cầm chơi game
  arcade: (
    <>
      <path d="M7 8h10a4 4 0 0 1 3.9 3.1l.9 4A2.5 2.5 0 0 1 19 18.5c-.8 0-1.5-.4-2-1l-1.2-1.5H8.2L7 17.5c-.5.6-1.2 1-2 1a2.5 2.5 0 0 1-2.8-3.4l.9-4A4 4 0 0 1 7 8z" />
      <path d="M8 10.5v3M6.5 12h3" />
      <circle cx="15.5" cy="11" r="0.6" />
      <circle cx="17.5" cy="13" r="0.6" />
    </>
  ),
  // Mảnh ghép
  puzzle: (
    <path d="M10 4a2 2 0 1 1 4 0v1h3a1 1 0 0 1 1 1v3h1a2 2 0 1 1 0 4h-1v3a1 1 0 0 1-1 1h-3v-1a2 2 0 1 0-4 0v1H7a1 1 0 0 1-1-1v-3H5a2 2 0 1 1 0-4h1V6a1 1 0 0 1 1-1h3z" />
  ),
  // Cần điều khiển
  classic: (
    <>
      <circle cx="12" cy="6.5" r="3" />
      <path d="M12 9.5V15" />
      <rect x="5" y="15" width="14" height="5" rx="2" />
      <circle cx="16" cy="17.5" r="0.6" />
    </>
  ),
  // Bàn cờ kẻ ô
  board: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M4 9.33h16M4 14.67h16M9.33 4v16M14.67 4v16" />
    </>
  ),
};

export function CategoryIcon({ slug, size = 24 }: { slug: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[slug] ?? PATHS.board}
    </svg>
  );
}
