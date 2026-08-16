// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

/**
 * WinnerScreen shares RoundSummary's exact shell primitive (Bug 5,
 * 2026-08-15 THIRD real-device retest) - see RoundSummary.test.tsx for the
 * full reasoning on why this needs a component-level test, not just CSS
 * assertions.
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

function makeWinnerInfo() {
  return {
    winnerId: 'p1',
    finalScores: { p1: 1000, p2: 820, p3: 610, p4: 340 },
  };
}

let fakeGame: unknown;

vi.mock('../../lib/GameStore', () => ({
  useGame: () => fakeGame,
}));

function setFakeGame(myPlayerId = 'p1') {
  fakeGame = {
    room: makeRoom(),
    myPlayerId,
    winnerInfo: makeWinnerInfo(),
    leaveSession: vi.fn(),
    playAgain: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  mockViewportHeight = 0;
});

describe('WinnerScreen: bounded shell structure actually renders (Bug 5)', () => {
  it('the actions row is a sibling AFTER the scroll region in the DOM - not nested inside it', async () => {
    setFakeGame();
    const { WinnerScreen } = await import('./WinnerScreen');
    const { container } = render(<WinnerScreen />);

    const scroll = container.querySelector('.winner__scroll');
    const actions = container.querySelector('.winner__actions');
    expect(scroll).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(scroll!.contains(actions)).toBe(false);
    expect(actions!.contains(scroll)).toBe(false);

    // Actual DOM order, not just "not nested" - actions must come AFTER
    // scroll as a sibling so it is the LAST content in the flex column.
    const shell = container.querySelector('.winner') as HTMLElement;
    const children = Array.from(shell.children).map((c) => c.className);
    expect(children.indexOf('winner__scroll')).toBeLessThan(children.indexOf('winner__actions'));
  });

  it('applies the JS-measured viewport height as --js-vh when useVisualViewport reports one', async () => {
    mockViewportHeight = 611;
    setFakeGame();
    const { WinnerScreen } = await import('./WinnerScreen');
    const { container } = render(<WinnerScreen />);

    const shell = container.querySelector('.winner') as HTMLElement;
    expect(shell.style.getPropertyValue('--js-vh')).toBe('611px');
  });

  it('falls back to the CSS dvh default (no inline --js-vh) when the JS measurement is not yet available', async () => {
    mockViewportHeight = 0;
    setFakeGame();
    const { WinnerScreen } = await import('./WinnerScreen');
    const { container } = render(<WinnerScreen />);

    const shell = container.querySelector('.winner') as HTMLElement;
    expect(shell.style.getPropertyValue('--js-vh')).toBe('');
  });
});
