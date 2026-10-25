import type { MouseEvent, ReactNode } from 'react';
import { SiteFooter } from './SiteFooter.tsx';
import { SiteHeader } from './SiteHeader.tsx';
import { Sidebar } from './Sidebar.tsx';
import { useSidebar } from './useSidebar.ts';
import './layout.css';

export const MAIN_ID = 'main-content';

// Chuyển focus tới <main> mà không đổi URL (router dựa vào pathname/search).
function skipToMain(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  document.getElementById(MAIN_ID)?.focus();
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const sidebar = useSidebar();
  return (
    <div className="site-shell">
      <a href={`#${MAIN_ID}`} className="skip-link" onClick={skipToMain}>
        Bỏ qua tới nội dung
      </a>
      <SiteHeader
        menuButtonRef={sidebar.menuButtonRef}
        menuExpanded={sidebar.expanded}
        onMenuToggle={sidebar.toggle}
      />
      <div className="site-body">
        <Sidebar
          collapsed={sidebar.collapsed}
          isDesktop={sidebar.isDesktop}
          drawerOpen={sidebar.drawerOpen}
          onCloseDrawer={sidebar.closeDrawer}
        />
        {sidebar.drawerOpen && (
          <div
            className="sidebar-overlay"
            data-testid="sidebar-overlay"
            aria-hidden="true"
            onClick={sidebar.closeDrawer}
          />
        )}
        <div className="site-content" inert={sidebar.drawerOpen}>
          <main id={MAIN_ID} tabIndex={-1} className="site-main">
            {children}
          </main>
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
