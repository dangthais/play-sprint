import { useEffect, useMemo, useRef } from 'react';
import { useCategories } from '../features/catalog/catalog.ts';
import { CategoryIcon } from '../features/catalog/CategoryIcon.tsx';
import { isFiltering, parseListQuery } from '../features/catalog/query.ts';
import { Link, useRoute, useSearch } from '../routing/index.ts';
import { SIDEBAR_ID } from './useSidebar.ts';

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled])';

interface SidebarProps {
  /** Rail thu gọn (desktop). */
  collapsed: boolean;
  isDesktop: boolean;
  /** Drawer đang mở (màn hình nhỏ). */
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

export function Sidebar({ collapsed, isDesktop, drawerOpen, onCloseDrawer }: SidebarProps) {
  const route = useRoute();
  const search = useSearch();
  const categories = useCategories();
  const panelRef = useRef<HTMLDivElement>(null);

  const query = useMemo(() => parseListQuery(search), [search]);
  const onList = route.name === 'list';
  const homeActive = onList && !isFiltering(query);
  const rail = isDesktop && collapsed;

  // Drawer mở: khoá cuộn nền, chuyển focus vào menu, Esc đóng, Tab quay vòng trong drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const nav = panelRef.current;
    nav?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    document.documentElement.classList.add('has-drawer');

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseDrawer();
        return;
      }
      if (e.key !== 'Tab' || !nav) return;
      const items = Array.from(nav.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      const inside = active instanceof Node && nav.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.documentElement.classList.remove('has-drawer');
    };
  }, [drawerOpen, onCloseDrawer]);

  // Chọn một mục khi đang ở drawer thì đóng drawer (focus về nút menu).
  const onSelect = isDesktop ? undefined : onCloseDrawer;

  return (
    <div
      ref={panelRef}
      id={SIDEBAR_ID}
      data-testid="sidebar"
      className="sidebar"
      data-collapsed={rail ? 'true' : 'false'}
      data-open={drawerOpen ? 'true' : 'false'}
      inert={!isDesktop && !drawerOpen}
      {...(drawerOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Menu' } : {})}
    >
      {!isDesktop && (
        <button
          type="button"
          className="icon-btn sidebar__close"
          aria-label="Đóng menu"
          onClick={onCloseDrawer}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
      <nav aria-label="Danh mục" className="sidebar__nav">
        <ul className="sidebar__list">
          <li>
            <Link
              href="/"
              className="sidebar__link"
              title="Trang chủ"
              aria-current={homeActive ? 'page' : undefined}
              onClick={onSelect}
            >
              <span className="sidebar__icon">
                <HomeIcon />
              </span>
              <span className="sidebar__label">Trang chủ</span>
            </Link>
          </li>
        </ul>
        {categories.length > 0 && (
          <>
            <hr className="sidebar__rule" />
            <p className="sidebar__heading">Danh mục</p>
            <ul className="sidebar__list">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/?tag=${encodeURIComponent(c.slug)}`}
                    className="sidebar__link"
                    title={`${c.name} (${c.count} game)`}
                    aria-current={onList && query.tag === c.slug ? 'page' : undefined}
                    onClick={onSelect}
                  >
                    <span className="sidebar__icon">
                      <CategoryIcon slug={c.slug} />
                    </span>
                    <span className="sidebar__label">{c.name}</span>
                    <span className="sidebar__count">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
    </div>
  );
}
