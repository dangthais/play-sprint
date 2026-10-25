import type { RefObject } from 'react';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';

export const SIDEBAR_ID = 'site-sidebar';
export const SIDEBAR_STORAGE_KEY = 'qp:sidebar';
export const DESKTOP_QUERY = '(min-width: 1024px)';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Storage bị chặn (chế độ riêng tư...): chỉ mất việc nhớ trạng thái.
  }
}

function subscribeDesktop(cb: () => void): () => void {
  const mql = window.matchMedia?.(DESKTOP_QUERY);
  mql?.addEventListener('change', cb);
  return () => mql?.removeEventListener('change', cb);
}

const getDesktop = () => window.matchMedia?.(DESKTOP_QUERY).matches === true;

/** Desktop (≥1024px): sidebar là rail; nhỏ hơn: drawer. Không có matchMedia => coi là nhỏ. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, getDesktop, () => false);
}

export interface SidebarControls {
  isDesktop: boolean;
  /** Rail thu gọn (chỉ có nghĩa ở desktop). */
  collapsed: boolean;
  /** Drawer đang mở (chỉ có nghĩa ở màn hình nhỏ). */
  drawerOpen: boolean;
  /** Giá trị cho `aria-expanded` của nút menu. */
  expanded: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  toggle: () => void;
  /** Đóng drawer và trả focus về nút menu. */
  closeDrawer: () => void;
}

export function useSidebar(): SidebarControls {
  const isDesktop = useIsDesktop();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Lên desktop thì bỏ trạng thái drawer để lần thu nhỏ sau không tự bật lại.
  if (isDesktop && drawerOpen) setDrawerOpen(false);

  const toggle = useCallback(() => {
    if (isDesktop) {
      const next = !collapsed;
      setCollapsed(next);
      writeCollapsed(next);
    } else {
      setDrawerOpen((open) => !open);
    }
  }, [isDesktop, collapsed]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  return {
    isDesktop,
    collapsed,
    drawerOpen: !isDesktop && drawerOpen,
    expanded: isDesktop ? !collapsed : drawerOpen,
    menuButtonRef,
    toggle,
    closeDrawer,
  };
}
