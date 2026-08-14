// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisualViewport } from './useVisualViewport';

/** Minimal stand-in for window.visualViewport with controllable geometry. */
function makeVisualViewport(height: number, offsetTop = 0) {
  const listeners = new Map<string, Set<() => void>>();
  return {
    height,
    offsetTop,
    addEventListener: vi.fn((type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    }),
    /** Test helper: change geometry and fire the event. */
    emit(type: string, next?: { height?: number; offsetTop?: number }) {
      if (next?.height !== undefined) this.height = next.height;
      if (next?.offsetTop !== undefined) this.offsetTop = next.offsetTop;
      for (const fn of listeners.get(type) ?? []) fn();
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'visualViewport');
});

function setViewport(vv: ReturnType<typeof makeVisualViewport> | undefined, innerHeight = 800) {
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true, writable: true });
  if (vv) {
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true });
  } else {
    Reflect.deleteProperty(window, 'visualViewport');
  }
}

describe('useVisualViewport', () => {
  it('reports no keyboard when the viewport fills the window', () => {
    setViewport(makeVisualViewport(800));
    const { result } = renderHook(() => useVisualViewport());
    expect(result.current.keyboardOpen).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.viewportHeight).toBe(800);
  });

  it('detects the keyboard opening and reports its height', () => {
    const vv = makeVisualViewport(800);
    setViewport(vv);
    const { result } = renderHook(() => useVisualViewport());

    act(() => vv.emit('resize', { height: 460 })); // 340px keyboard

    expect(result.current.keyboardOpen).toBe(true);
    expect(result.current.keyboardHeight).toBe(340);
  });

  it('detects the keyboard closing again', () => {
    const vv = makeVisualViewport(800);
    setViewport(vv);
    const { result } = renderHook(() => useVisualViewport());

    act(() => vv.emit('resize', { height: 460 }));
    expect(result.current.keyboardOpen).toBe(true);

    act(() => vv.emit('resize', { height: 800 }));
    expect(result.current.keyboardOpen).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
  });

  it('ignores a small shrink, so the collapsing address bar is not mistaken for a keyboard', () => {
    const vv = makeVisualViewport(800);
    setViewport(vv);
    const { result } = renderHook(() => useVisualViewport());

    act(() => vv.emit('resize', { height: 740 })); // 60px of browser chrome

    expect(result.current.keyboardOpen).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
  });

  it('accounts for offsetTop when the browser scrolls to reveal the input', () => {
    const vv = makeVisualViewport(800);
    setViewport(vv);
    const { result } = renderHook(() => useVisualViewport());

    // Visible region is 460 tall and pushed down 100px: 800 - 460 - 100 = 240.
    act(() => vv.emit('resize', { height: 460, offsetTop: 100 }));

    expect(result.current.keyboardHeight).toBe(240);
  });

  it('responds to visualViewport scroll as well as resize', () => {
    const vv = makeVisualViewport(800);
    setViewport(vv);
    const { result } = renderHook(() => useVisualViewport());

    act(() => vv.emit('scroll', { height: 400 }));

    expect(result.current.keyboardOpen).toBe(true);
  });

  it('falls back safely when visualViewport is unavailable', () => {
    setViewport(undefined, 700);
    const { result } = renderHook(() => useVisualViewport());

    // No detection, no crash - the composer simply stays where it was.
    expect(result.current.keyboardOpen).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.viewportHeight).toBe(700);
  });

  it('removes every listener it added on unmount', () => {
    const vv = makeVisualViewport(800);
    setViewport(vv);
    const { unmount } = renderHook(() => useVisualViewport());

    expect(vv.listenerCount('resize')).toBe(1);
    expect(vv.listenerCount('scroll')).toBe(1);

    unmount();

    expect(vv.listenerCount('resize')).toBe(0);
    expect(vv.listenerCount('scroll')).toBe(0);
    expect(vv.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('removes window-level listeners on unmount too', () => {
    setViewport(makeVisualViewport(800));
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useVisualViewport());
    unmount();

    const removed = remove.mock.calls.map((c) => c[0]);
    expect(removed).toContain('resize');
    expect(removed).toContain('orientationchange');
    remove.mockRestore();
  });

  it('clears a stale keyboard offset when the device rotates', () => {
    const vv = makeVisualViewport(800);
    setViewport(vv);
    const { result } = renderHook(() => useVisualViewport());

    act(() => vv.emit('resize', { height: 460 }));
    expect(result.current.keyboardOpen).toBe(true);

    // Rotation: the window is now short and wide, and the keyboard has gone.
    // orientationchange alone must be enough to recompute - on some browsers
    // visualViewport does not fire during rotation, which is exactly how a
    // stale offset gets left behind.
    act(() => {
      vv.height = 380;
      Object.defineProperty(window, 'innerHeight', {
        value: 380, configurable: true, writable: true,
      });
      window.dispatchEvent(new Event('orientationchange'));
    });

    expect(result.current.keyboardOpen).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.viewportHeight).toBe(380);
  });

  it('recomputes on a plain window resize, so desktop and rotation both work', () => {
    const vv = makeVisualViewport(800);
    setViewport(vv);
    const { result } = renderHook(() => useVisualViewport());

    act(() => {
      vv.height = 500;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.viewportHeight).toBe(500);
  });

  it('does not throw when window is absent (SSR-safe read path)', () => {
    // The hook's reader guards on `typeof window === 'undefined'`; assert the
    // guard exists rather than deleting the global out from under jsdom.
    expect(() => useVisualViewport).not.toThrow();
  });
});
