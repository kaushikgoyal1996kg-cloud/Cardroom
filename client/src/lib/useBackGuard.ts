import { useEffect, useRef } from 'react';

/**
 * True once ANY screen in this page-load has established the app's history
 * root. Module-level (not per-hook-instance) because there is exactly one
 * browser/PWA history timeline regardless of which component is currently
 * mounted - HomeScreen and App.tsx each call this hook independently (see
 * ARCHITECTURE.md), and only the very first screen either of them renders
 * this page-load should REPLACE rather than PUSH, so Back from it exits the
 * app/tab instead of landing on a redundant empty entry.
 */
let hasEstablishedRoot = false;

/** Test-only: resets the module-level root flag between test files/cases. */
export function __resetBackGuardRootForTests(): void {
  hasEstablishedRoot = false;
}

export type BackGuardResult =
  /** No interception at all - default browser/PWA Back proceeds untouched.
   *  Used for true root-like screens (Welcome, an invite link's own landing
   *  page) so Back can still exit rather than trapping the user forever. */
  | 'root'
  /** The callback already performed a safe, reversible state change (e.g.
   *  setStage('welcome')) - the pop is allowed to complete. */
  | 'handled'
  /** The pop is cancelled (the current entry is pushed again) because
   *  leaving this screen needs confirmation first, or because this screen
   *  has no sensible Back destination and the press should just be
   *  absorbed. Callers that show a confirmation should call
   *  `consumeAsBack()` right before the state change once the user actually
   *  confirms, so the resulting screen change replaces this blocked entry
   *  instead of stacking a new one on top of it. */
  | 'blocked';

export interface UseBackGuardOptions {
  /** Identifies the current screen. Changing this syncs one history entry
   *  per meaningful screen so Android/PWA Back has something to navigate. */
  screenKey: string;
  /** Called on every Back press (a `popstate`) while this screen is showing. */
  onBack: () => BackGuardResult;
  /** Skip entirely - used when another mounted component (with its own
   *  `useBackGuard` call) is already the sole owner of Back behaviour for
   *  the current screen, so the two don't both react to the same press. */
  disabled?: boolean;
}

export interface BackGuardHandle {
  /** Call once, right before a confirmed/explicit state change that is
   *  logically "going back" (e.g. the user tapped Leave in a confirmation
   *  dialog opened by a blocked Back press) but did NOT itself arrive via a
   *  `popstate` event. Makes the next screenKey sync replace the blocked
   *  entry rather than push a new one on top of it. */
  consumeAsBack: () => void;
}

/**
 * Syncs one browser/PWA history entry per meaningful screen and intercepts
 * the Android/PWA/browser Back gesture so it never silently exits the app,
 * abandons a room, or re-runs a join/create. See ARCHITECTURE.md.
 *
 * This is deliberately NOT a router: it does not own what screen renders,
 * only observes the screenKey the caller already computed (the existing
 * plain conditional chain in App.tsx / HomeScreen.tsx) and keeps the
 * browser's own history in step with it.
 */
export function useBackGuard({ screenKey, onBack, disabled = false }: UseBackGuardOptions): BackGuardHandle {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const currentKeyRef = useRef(screenKey);
  const replaceNextRef = useRef(false);
  // Tracks whether THIS instance was already disabled on the previous
  // render, so the sync effect below can tell "I was never the active
  // owner" (skip - e.g. App.tsx mounting straight onto screenKey 'home',
  // where HomeScreen's own instance is the one that should claim the
  // history entry) apart from "I just handed ownership off this render"
  // (still sync once - see the comment in the effect for why).
  const wasDisabledRef = useRef(disabled);

  useEffect(() => {
    currentKeyRef.current = screenKey;
    const justBecameDisabled = disabled && !wasDisabledRef.current;
    wasDisabledRef.current = disabled;
    // Skip only when this instance has ALWAYS been the non-owner (never
    // active, nothing of its own to sync/hand off) - e.g. App.tsx's guard
    // mounting straight onto 'home' on a fresh visit with no active room,
    // where HomeScreen's own instance is correctly the one to claim the
    // root history entry. Syncing here too would race it (child effects
    // fire before parent effects in React), pushing a redundant, backwards
    // 'home' entry on TOP of HomeScreen's own 'welcome' one.
    //
    // Do NOT skip on the transition INTO disabled (`justBecameDisabled`):
    // that is the render where a guarded screen (Lobby, an active game)
    // hands off to 'home' - via either a confirmed Back-leave or the
    // screen's own visible Leave button - and this is the only chance to
    // sync that final screenKey change. Bug (found on real Android PWA
    // staging, see SESSION_CHANGELOG.md): skipping it left the PREVIOUS
    // screen's history entry orphaned - never replaced or advanced past,
    // permanently desynced from what was actually on screen - and left a
    // still-unconsumed `replaceNextRef` to corrupt a LATER, unrelated
    // transition too.
    if (disabled && !justBecameDisabled) return;
    if (!hasEstablishedRoot) {
      hasEstablishedRoot = true;
      window.history.replaceState({ cardroomScreen: screenKey }, '', window.location.href);
      return;
    }
    if (replaceNextRef.current) {
      replaceNextRef.current = false;
      window.history.replaceState({ cardroomScreen: screenKey }, '', window.location.href);
      return;
    }
    window.history.pushState({ cardroomScreen: screenKey }, '', window.location.href);
    // Deliberately runs on every screenKey OR disabled change, not just
    // mount - both can trigger the "just became disabled" hand-off sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey, disabled]);

  useEffect(() => {
    // This half - intercepting the actual Back press - IS correctly
    // exclusive: exactly one mounted `useBackGuard` instance should ever be
    // listening at a time (see App.tsx's `disabled: screenKey === 'home'`),
    // or a single press could be double-handled.
    if (disabled) return;
    function handlePopState() {
      const result = onBackRef.current();
      if (result === 'blocked') {
        window.history.pushState({ cardroomScreen: currentKeyRef.current }, '', window.location.href);
      } else if (result === 'handled') {
        replaceNextRef.current = true;
      }
      // 'root': nothing further - default browser/PWA back proceeds.
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [disabled]);

  return {
    consumeAsBack: () => {
      replaceNextRef.current = true;
    },
  };
}
