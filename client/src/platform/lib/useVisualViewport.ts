import { useEffect, useState } from 'react';

/**
 * Tracks the mobile virtual keyboard via `window.visualViewport`.
 *
 * WHY THIS EXISTS: on iOS Safari the layout viewport does not shrink when the
 * keyboard opens. A `position: fixed` element anchored to the bottom - like
 * the chat composer - therefore ends up *behind* the keyboard, and the player
 * cannot see what they are typing.
 *
 * `visualViewport` reports the actually-visible region, so the difference
 * between it and the window height is the keyboard's height. Anything pinned
 * to the bottom can be lifted by exactly that amount.
 *
 * Deliberately narrow in scope: this returns a number and nothing else. It
 * does not translate the page, which would fight the browser's own scrolling
 * and cause worse problems than it solves. Apply the offset only to the one
 * element that needs to stay above the keyboard.
 */
export interface ViewportInsets {
  /** Height in px currently obscured by the keyboard. 0 when closed. */
  keyboardHeight: number;
  /** True once the keyboard is meaningfully open. */
  keyboardOpen: boolean;
  /** Height of the visible viewport in px. */
  viewportHeight: number;
}

/**
 * Below this many pixels a viewport shrink is treated as browser chrome
 * (the collapsing address bar) rather than a keyboard, so the composer does
 * not jump around while scrolling.
 */
const KEYBOARD_THRESHOLD_PX = 120;

function readInsets(): ViewportInsets {
  // SSR / non-DOM test environments have no window at all.
  if (typeof window === 'undefined') {
    return { keyboardHeight: 0, keyboardOpen: false, viewportHeight: 0 };
  }

  const vv = window.visualViewport;
  if (!vv) {
    // Older browsers: degrade to "keyboard never detected". The composer
    // stays where it is, which is exactly the previous behaviour.
    return {
      keyboardHeight: 0,
      keyboardOpen: false,
      viewportHeight: window.innerHeight,
    };
  }

  // offsetTop matters when the page itself has been scrolled by the browser
  // to reveal the focused input; without it the composer over-corrects.
  const obscured = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  const keyboardHeight = obscured > KEYBOARD_THRESHOLD_PX ? Math.round(obscured) : 0;

  return {
    keyboardHeight,
    keyboardOpen: keyboardHeight > 0,
    viewportHeight: Math.round(vv.height),
  };
}

export function useVisualViewport(): ViewportInsets {
  const [insets, setInsets] = useState<ViewportInsets>(readInsets);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    const update = () => setInsets(readInsets());

    // Run once on mount: the keyboard may already be open if this component
    // mounted while an input was focused.
    update();

    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    // Rotation and desktop resizes do not always fire a visualViewport event.
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return insets;
}
