import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, getLastNavKind, navigate, parseRoute, useRoute, useSearch } from './routing.tsx';

beforeEach(() => window.history.replaceState(null, '', '/'));

describe('parseRoute', () => {
  it('parses account routes (with optional trailing slash)', () => {
    expect(parseRoute('/dang-nhap')).toEqual({ name: 'login' });
    expect(parseRoute('/dang-ky/')).toEqual({ name: 'register' });
    expect(parseRoute('/ho-so')).toEqual({ name: 'profile' });
    expect(parseRoute('/lich-su/')).toEqual({ name: 'history' });
    expect(parseRoute('/lich-su//')).toEqual({ name: 'notFound' });
    expect(parseRoute('/ho-so/x')).toEqual({ name: 'notFound' });
  });
  it('parses known routes', () => {
    expect(parseRoute('/')).toEqual({ name: 'list' });
    expect(parseRoute('/games/snake')).toEqual({ name: 'play', id: 'snake' });
    expect(parseRoute('/games/snake/')).toEqual({ name: 'play', id: 'snake' });
    expect(parseRoute('/games/a%20b')).toEqual({ name: 'play', id: 'a b' });
  });
  it.each(['/games', '/games/', '/games/a/b', '/x', '/games//', '/games/%E0%A4%A', '//'])(
    'notFound for %s',
    (p) => {
      expect(parseRoute(p)).toEqual({ name: 'notFound' });
    },
  );
});

function Probe() {
  const r = useRoute();
  return <p data-testid="route">{r.name === 'play' ? `play:${r.id}` : r.name}</p>;
}

describe('Link / navigate / useRoute', () => {
  it('plain click pushes state without reload and updates route', () => {
    render(
      <>
        <Link href="/games/snake" data-testid="l">
          go
        </Link>
        <Probe />
      </>,
    );
    expect(screen.getByTestId('route')).toHaveTextContent('list');
    const len = window.history.length;
    const notPrevented = fireEvent.click(screen.getByTestId('l'));
    expect(notPrevented).toBe(false);
    expect(window.location.pathname).toBe('/games/snake');
    expect(window.history.length).toBe(len + 1);
    expect(screen.getByTestId('route')).toHaveTextContent('play:snake');
  });

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle', { button: 1 }],
  ])('%s-click is left to the browser', (_n, init) => {
    render(
      <Link href="/games/snake" data-testid="l">
        go
      </Link>,
    );
    const notPrevented = fireEvent.click(screen.getByTestId('l'), init);
    expect(notPrevented).toBe(true);
    expect(window.location.pathname).toBe('/');
  });

  it('target=_blank is left to the browser', () => {
    render(
      <Link href="/games/snake" target="_blank" data-testid="l">
        go
      </Link>,
    );
    expect(fireEvent.click(screen.getByTestId('l'))).toBe(true);
    expect(window.location.pathname).toBe('/');
  });

  it('respects onClick preventDefault', () => {
    render(
      <Link href="/games/snake" data-testid="l" onClick={(e) => e.preventDefault()}>
        go
      </Link>,
    );
    fireEvent.click(screen.getByTestId('l'));
    expect(window.location.pathname).toBe('/');
  });

  it('navigate with replace does not add history; popstate updates route', () => {
    render(<Probe />);
    const len = window.history.length;
    act(() => navigate('/games/a', { replace: true }));
    expect(window.history.length).toBe(len);
    expect(screen.getByTestId('route')).toHaveTextContent('play:a');
    act(() => {
      window.history.replaceState(null, '', '/nope');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('route')).toHaveTextContent('notFound');
  });

  it('removes listeners on unmount', () => {
    const spy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<Probe />);
    unmount();
    const names = spy.mock.calls.map((c) => c[0]);
    expect(names).toContain('popstate');
    expect(names).toContain('qp:navigate');
    spy.mockRestore();
  });
});

describe('useSearch / getLastNavKind', () => {
  function SearchProbe() {
    return <p data-testid="search">{useSearch()}</p>;
  }

  it('follows navigate (push and replace) and popstate', () => {
    render(<SearchProbe />);
    expect(screen.getByTestId('search')).toHaveTextContent('');
    act(() => navigate('/?q=a'));
    expect(screen.getByTestId('search')).toHaveTextContent('?q=a');
    expect(getLastNavKind()).toBe('push');
    const len = window.history.length;
    act(() => navigate('/?q=ab', { replace: true }));
    expect(screen.getByTestId('search')).toHaveTextContent('?q=ab');
    expect(window.history.length).toBe(len);
    expect(getLastNavKind()).toBe('replace');
    act(() => {
      window.history.replaceState(null, '', '/?x=1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('search')).toHaveTextContent('?x=1');
    expect(getLastNavKind()).toBe('pop');
  });

  it('treats navigating to the current URL as a replace', () => {
    act(() => navigate('/?q=same'));
    act(() => navigate('/?q=same'));
    expect(getLastNavKind()).toBe('replace');
  });
});
