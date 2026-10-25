import type { RefObject } from 'react';
import { useCatalog } from '../features/catalog/catalog.ts';
import { Link, navigate, useRoute } from '../routing/index.ts';
import { SiteSearch } from './SiteSearch.tsx';
import { UserMenu } from './UserMenu.tsx';
import { SIDEBAR_ID } from './useSidebar.ts';

function LogoMark() {
  return (
    <svg
      className="site-header__logo"
      width="34"
      height="34"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="qp-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#qp-logo)" />
      <path
        d="M12 9.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7l-10.4-6.5A1 1 0 0 0 12 9.5z"
        fill="#fff"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="15" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

/** Chọn ngẫu nhiên một game trong catalog (khác game đang chơi nếu có thể). */
function RandomGameButton() {
  const catalog = useCatalog();
  const route = useRoute();
  if (catalog.status !== 'ready' || catalog.games.length === 0) return null;
  const { games } = catalog;
  const currentId = route.name === 'play' ? route.id : null;

  const onClick = () => {
    const pool = games.length > 1 ? games.filter((g) => g.id !== currentId) : games;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) navigate(`/games/${encodeURIComponent(pick.id)}`);
  };

  return (
    <button
      type="button"
      className="icon-btn site-header__random"
      aria-label="Chơi game ngẫu nhiên"
      title="Chơi game ngẫu nhiên"
      onClick={onClick}
    >
      <DiceIcon />
    </button>
  );
}

interface SiteHeaderProps {
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  menuExpanded: boolean;
  onMenuToggle: () => void;
}

export function SiteHeader({ menuButtonRef, menuExpanded, onMenuToggle }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-btn site-header__menu"
          aria-label="Mở/đóng menu"
          aria-expanded={menuExpanded}
          aria-controls={SIDEBAR_ID}
          onClick={onMenuToggle}
        >
          <MenuIcon />
        </button>
        <h1 className="site-title">
          <Link href="/">
            <LogoMark />
            <span className="site-title__text">Quick Playing</span>
          </Link>
        </h1>
        <SiteSearch />
        <div className="site-header__actions">
          <RandomGameButton />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
