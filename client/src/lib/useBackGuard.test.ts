// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useBackGuard, __resetBackGuardRootForTests, type BackGuardResult } from './useBackGuard';

function fireBack() {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

beforeEach(() => {
  __resetBackGuardRootForTests();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('useBackGuard', () => {
  it('replaces (does not push) for the very first screen this page-load', () => {
    const lengthBefore = window.history.length;
    renderHook(() => useBackGuard({ screenKey: 'welcome', onBack: () => 'root' }));
    expect(window.history.length).toBe(lengthBefore);
    expect(window.history.state).toEqual({ cardroomScreen: 'welcome' });
  });

  it('pushes a new entry for a second, different screen', () => {
    const { rerender } = renderHook(({ key }) => useBackGuard({ screenKey: key, onBack: () => 'root' }), {
      initialProps: { key: 'welcome' },
    });
    const lengthAfterFirst = window.history.length;
    rerender({ key: 'profile' });
    expect(window.history.length).toBe(lengthAfterFirst + 1);
    expect(window.history.state).toEqual({ cardroomScreen: 'profile' });
  });

  it('does not push again for the same screenKey on re-render', () => {
    const { rerender } = renderHook(({ key }) => useBackGuard({ screenKey: key, onBack: () => 'root' }), {
      initialProps: { key: 'welcome' },
    });
    const length = window.history.length;
    rerender({ key: 'welcome' });
    expect(window.history.length).toBe(length);
  });

  it('"root" result leaves history exactly as the browser already moved it - no re-push', () => {
    renderHook(() => useBackGuard({ screenKey: 'welcome', onBack: () => 'root' }));
    const lengthBefore = window.history.length;
    fireBack();
    expect(window.history.length).toBe(lengthBefore);
  });

  it('"blocked" cancels the pop by pushing the current screen forward again', () => {
    let onBack: () => BackGuardResult = () => 'blocked';
    renderHook(() => useBackGuard({ screenKey: 'lobby', onBack: () => onBack() }));
    const lengthBefore = window.history.length;
    fireBack();
    expect(window.history.length).toBe(lengthBefore + 1);
    expect(window.history.state).toEqual({ cardroomScreen: 'lobby' });
  });

  it('"handled" lets the pop complete and marks the next sync as a replace', () => {
    const setStage = vi.fn();
    const { rerender } = renderHook(
      ({ key }) =>
        useBackGuard({
          screenKey: key,
          onBack: () => {
            setStage('welcome');
            return 'handled';
          },
        }),
      { initialProps: { key: 'cardroom' } }
    );
    fireBack();
    expect(setStage).toHaveBeenCalledWith('welcome');

    const lengthAfterPop = window.history.length;
    // The caller's own state actually changes on the next render, same as
    // real React usage (setStage triggers a re-render with a new screenKey).
    rerender({ key: 'welcome' });
    // A replace, not a push - length must not grow from this transition.
    expect(window.history.length).toBe(lengthAfterPop);
    expect(window.history.state).toEqual({ cardroomScreen: 'welcome' });
  });

  it('consumeAsBack() makes the NEXT screenKey sync replace instead of push', () => {
    let handle: { consumeAsBack: () => void } | undefined;
    const { rerender } = renderHook(
      ({ key }) => {
        handle = useBackGuard({ screenKey: key, onBack: () => 'root' });
      },
      { initialProps: { key: 'lobby' } }
    );
    const lengthBefore = window.history.length;
    act(() => {
      handle!.consumeAsBack();
    });
    rerender({ key: 'home' }); // e.g. a confirmed "Leave" changing the screen
    expect(window.history.length).toBe(lengthBefore);
    expect(window.history.state).toEqual({ cardroomScreen: 'home' });
  });

  it('disabled instances never push or listen', () => {
    const onBack = vi.fn(() => 'root' as BackGuardResult);
    renderHook(() => useBackGuard({ screenKey: 'home', onBack, disabled: true }));
    const lengthBefore = window.history.length;
    fireBack();
    expect(window.history.length).toBe(lengthBefore);
    expect(onBack).not.toHaveBeenCalled();
  });

  describe('Bug 2 regression: the disabled hand-off must not orphan a history entry', () => {
    it('an instance that transitions INTO disabled still syncs that final screenKey change (plain leave, no consumeAsBack)', () => {
      // Simulates App.tsx's own guard: active on 'lobby', then the screen
      // leaves (e.g. the visible Leave button, not the Back-guard dialog)
      // and screenKey/disabled both flip on the same render.
      const { rerender } = renderHook(
        ({ key, disabled }) => useBackGuard({ screenKey: key, onBack: () => 'root', disabled }),
        { initialProps: { key: 'lobby', disabled: false } }
      );
      const lengthBefore = window.history.length;

      rerender({ key: 'home', disabled: true });

      // Must have synced - not silently skipped - even though this
      // instance is now disabled.
      expect(window.history.length).toBe(lengthBefore + 1);
      expect(window.history.state).toEqual({ cardroomScreen: 'home' });
    });

    it('an instance that transitions INTO disabled respects consumeAsBack() (confirmed Back-leave) by replacing, not pushing', () => {
      let handle: { consumeAsBack: () => void } | undefined;
      const { rerender } = renderHook(
        ({ key, disabled }) => {
          handle = useBackGuard({ screenKey: key, onBack: () => 'root', disabled });
        },
        { initialProps: { key: 'playing', disabled: false } }
      );
      const lengthBefore = window.history.length;

      act(() => {
        handle!.consumeAsBack();
      });
      rerender({ key: 'home', disabled: true });

      // Replaced the blocked/pushed 'playing' entry, not stacked on top.
      expect(window.history.length).toBe(lengthBefore);
      expect(window.history.state).toEqual({ cardroomScreen: 'home' });
    });

    it('does not keep re-syncing on every subsequent render while it stays disabled', () => {
      const { rerender } = renderHook(
        ({ key, disabled }) => useBackGuard({ screenKey: key, onBack: () => 'root', disabled }),
        { initialProps: { key: 'lobby', disabled: false } }
      );
      rerender({ key: 'home', disabled: true }); // the one legitimate hand-off sync
      const lengthAfterHandoff = window.history.length;

      // Re-rendering again while still disabled (e.g. an unrelated parent
      // re-render) must not push additional entries.
      rerender({ key: 'home', disabled: true });
      expect(window.history.length).toBe(lengthAfterHandoff);
    });

    it('an instance that was ALWAYS disabled (fresh mount straight onto a disabled screenKey) does not sync at all', () => {
      // Simulates App.tsx mounting straight onto 'home' on a fresh visit
      // with no active room - HomeScreen's own instance is the one that
      // should claim the root history entry, not this one, or a race
      // between child-then-parent effect ordering would push a redundant,
      // backwards entry on top of HomeScreen's.
      const lengthBefore = window.history.length;
      renderHook(() => useBackGuard({ screenKey: 'home', onBack: () => 'root', disabled: true }));
      expect(window.history.length).toBe(lengthBefore);
    });

    it('end-to-end: App+HomeScreen handoff never produces a backwards or orphaned entry across a full leave cycle', () => {
      // A minimal simulation of the real App.tsx / HomeScreen.tsx pairing,
      // as two separately mounted hook instances (matching reality: they
      // are two different components, not conditional hook calls within
      // one) - HomeScreen's instance only exists while App's screenKey is
      // 'home', matching the real `disabled` condition.
      let appHandle: { consumeAsBack: () => void } | undefined;
      const app = renderHook(
        ({ key }) => {
          appHandle = useBackGuard({ screenKey: key, onBack: () => 'root', disabled: key === 'home' });
        },
        { initialProps: { key: 'lobby' } }
      );
      const lengthAfterLobby = window.history.length;

      act(() => appHandle!.consumeAsBack());
      app.rerender({ key: 'home' });

      // HomeScreen mounts only now, as App's screenKey becomes 'home' -
      // exactly mirroring the real conditional render in App.tsx.
      renderHook(() => useBackGuard({ screenKey: 'welcome', onBack: () => 'root' }));

      // App's 'home' sync replaced 'lobby' (consumeAsBack was called), then
      // HomeScreen's own 'welcome' entry pushed on top - exactly one net
      // new entry for the whole leave-and-land-on-Welcome transition, and
      // the top of the stack correctly reflects the visible screen.
      expect(window.history.length).toBe(lengthAfterLobby + 1);
      expect(window.history.state).toEqual({ cardroomScreen: 'welcome' });
    });
  });
});
