// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

/**
 * Bug 5 (confirmed on real Android PWA staging, THREE real-device retests):
 * the end-of-hand result screen was not reachable by touch-scroll in a short
 * landscape viewport. Two different CSS-only approaches (a fixed-height
 * shell with a nested scroll region, then normal page flow with a sticky
 * footer) were each confirmed still broken on a real device.
 *
 * These tests exercise what CSS-only tests in mobileSafety.test.ts cannot:
 * that RoundSummary actually WIRES UP the JS-measured viewport height
 * (`useVisualViewport()`) into the DOM, and that the shell/scroll/actions
 * structure the CSS assumes is what actually renders - not just that the
 * right class names and property strings exist somewhere in a stylesheet.
 */

let mockViewportHeight = 0;

vi.mock('../../platform/lib/useVisualViewport', () => ({
  useVisualViewport: () => ({
    viewportHeight: mockViewportHeight,
    keyboardHeight: 0,
    keyboardOpen: false,
  }),
}));

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function makeRoom() {
  return {
    roomCode: 'HZR482',
    players: PLAYERS.map((id, i) => ({
      playerId: id,
      name: id.toUpperCase(),
      avatar: undefined,
      connected: true,
      isBot: false,
      isHost: i === 0,
    })),
  };
}

function makeLastRoundResult() {
  return {
    roundNumber: 1,
    dismissed: false,
    dismissalReason: undefined,
    pointsThisRound: { p1: 40, p2: 10, p3: 5, p4: 0 },
    cumulativeScores: { p1: 40, p2: 10, p3: 5, p4: 0 },
    subRounds: [
      {
        setIndex: 0,
        winnerId: 'p1',
        pointsAwarded: 40,
        wasTie: false,
        playedSets: PLAYERS.map((id) => ({ playerId: id, cards: [] })),
      },
    ],
  };
}

let fakeGame: unknown;

vi.mock('../../lib/GameStore', () => ({
  useGame: () => fakeGame,
}));

function setFakeGame(myPlayerId = 'p1') {
  fakeGame = {
    room: makeRoom(),
    lastRoundResult: makeLastRoundResult(),
    gameState: { dealerId: 'p2', state: 'ROUND_COMPLETE' },
    myPlayerId,
    startNextRound: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  mockViewportHeight = 0;
});

describe('RoundSummary: bounded shell structure actually renders (Bug 5)', () => {
  it('the shell has exactly two children - the scroll region, then the actions row, in that order', async () => {
    setFakeGame();
    const { RoundSummary } = await import('./RoundSummary');
    const { container } = render(<RoundSummary />);

    const shell = container.querySelector('.rsum');
    expect(shell).not.toBeNull();
    expect(shell!.children).toHaveLength(2);
    expect(shell!.children[0].className).toBe('rsum__scroll');
    expect(shell!.children[1].className).toBe('rsum__actions');
  });

  it('the actions row is a sibling AFTER the scroll region in the DOM - not nested inside it', async () => {
    // Structural guard for "footer... outside the scroll body": if a
    // future change nested .rsum__actions inside .rsum__scroll, it would
    // scroll away with the rest of the content - exactly the reachability
    // bug this whole structure exists to prevent.
    setFakeGame();
    const { RoundSummary } = await import('./RoundSummary');
    const { container } = render(<RoundSummary />);

    const scroll = container.querySelector('.rsum__scroll');
    const actions = container.querySelector('.rsum__actions');
    expect(scroll).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(scroll!.contains(actions)).toBe(false);
    expect(actions!.contains(scroll)).toBe(false);
  });

  it('applies the JS-measured viewport height as --js-vh when useVisualViewport reports one', async () => {
    mockViewportHeight = 611; // a plausible short-landscape Android viewport
    setFakeGame();
    const { RoundSummary } = await import('./RoundSummary');
    const { container } = render(<RoundSummary />);

    const shell = container.querySelector('.rsum') as HTMLElement;
    expect(shell.style.getPropertyValue('--js-vh')).toBe('611px');
  });

  it('falls back to the CSS dvh default (no inline --js-vh) when the JS measurement is not yet available', async () => {
    // 0 is useVisualViewport's own pre-mount/SSR value - the component
    // must not write a nonsense `--js-vh: 0px` in that case, which would
    // collapse the whole shell to zero height. CSS's own
    // `var(--js-vh, 100dvh)` fallback is what should govern instead.
    mockViewportHeight = 0;
    setFakeGame();
    const { RoundSummary } = await import('./RoundSummary');
    const { container } = render(<RoundSummary />);

    const shell = container.querySelector('.rsum') as HTMLElement;
    expect(shell.style.getPropertyValue('--js-vh')).toBe('');
  });

  it('the Next round button (host) lives inside .rsum__actions, reachable outside the scroll region', async () => {
    setFakeGame('p1'); // p1 is host
    const { RoundSummary } = await import('./RoundSummary');
    const { container } = render(<RoundSummary />);

    const actions = container.querySelector('.rsum__actions');
    const button = container.querySelector('.rsum__next');
    expect(button).not.toBeNull();
    expect(actions!.contains(button)).toBe(true);
  });
});
