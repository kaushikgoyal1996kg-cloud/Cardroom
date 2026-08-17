// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { CardData } from '../../platform/components/PlayingCard';

/**
 * Bug 5, CLARIFIED (2026-08-16): the previous two rounds of "end-of-hand
 * scroll" fixes were applied to RoundSummary - the WRONG component. Real-
 * device evidence made the actual shape of the bug explicit: Hazari plays 4
 * SETS per round. After EACH set (1, 2, 3, AND 4), the SAME per-set result
 * sheet (`.reveal`, rendered inline by HazariTable.tsx) appears - not a
 * different screen for set 4. RoundSummary is a SEPARATE component, shown
 * once, only after the round's 4th set AND the round itself both resolve
 * (gameState.state transitions to ROUND_COMPLETE/DISMISSED_ROUND, at which
 * point HazariTable itself is unmounted by App.tsx and RoundSummary
 * replaces it) - already confirmed working and deliberately NOT touched by
 * this round's fix.
 *
 * These tests exercise the LIVE path (HazariTable rendered with a mocked
 * game store), the same style already used in playTravel.test.tsx/
 * dealing.test.tsx, so what is under test is HazariTable's own real
 * render logic, not a re-implementation of it.
 */

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];
const card = (id: string): CardData => ({ id, rank: 'A', suit: 'SPADES' });

interface FakeSubRoundResult {
  setIndex: 0 | 1 | 2 | 3;
  playedSets: { playerId: string; cards: CardData[] }[];
  winnerId: string;
  pointsAwarded: number;
  wasTie: boolean;
  tiedPlayerIds: string[];
}

interface FakeState {
  roundNumber: number;
  currentSetIndex: number;
  dealerId: string;
  currentPlayOrder: string[];
  playersPlayedThisSubRound: string[];
  playedSetsThisSubRound: { playerId: string; cards: CardData[] }[];
  subRoundResultsThisRound: FakeSubRoundResult[];
  cumulativeScores: Record<string, number>;
  state: string;
}

let fakeGame: {
  room: unknown;
  gameState: FakeState;
  myPlayerId: string;
  myArrangedSets: CardData[][] | null;
  playSet: () => void;
  gameError: null;
  clearGameError: () => void;
  voiceParticipants: string[];
  speakingPlayerIds: string[];
  freshDealCount: number;
  isRestoring: boolean;
  restorationGeneration: number;
};

function subRoundResult(setIndex: 0 | 1 | 2 | 3, winnerId = 'p2'): FakeSubRoundResult {
  return {
    setIndex,
    winnerId,
    pointsAwarded: 25,
    wasTie: false,
    tiedPlayerIds: [],
    playedSets: PLAYERS.map((id) => ({ playerId: id, cards: [card(`${id}-${setIndex}`)] })),
  };
}

function baseState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    roundNumber: 1,
    currentSetIndex: 0,
    dealerId: 'p1',
    currentPlayOrder: PLAYERS,
    playersPlayedThisSubRound: [],
    playedSetsThisSubRound: [],
    subRoundResultsThisRound: [],
    cumulativeScores: { p1: 0, p2: 0, p3: 0, p4: 0 },
    state: 'PLAYING_SET_1',
    ...overrides,
  };
}

function setFake(state: FakeState, myPlayerId = 'p1') {
  fakeGame = {
    room: {
      roomCode: 'HZR482',
      players: PLAYERS.map((id) => ({
        playerId: id,
        name: id.toUpperCase(),
        avatar: undefined,
        connected: true,
        isBot: false,
        isHost: id === 'p1',
      })),
    },
    gameState: state,
    myPlayerId,
    myArrangedSets: null,
    playSet: vi.fn(),
    gameError: null,
    clearGameError: vi.fn(),
    voiceParticipants: [],
    speakingPlayerIds: [],
    freshDealCount: 0,
    isRestoring: false,
    restorationGeneration: 0,
  };
}

vi.mock('../../lib/GameStore', () => ({
  useGame: () => fakeGame,
}));
vi.mock('../../lib/sound', () => ({
  playCardPlaySound: vi.fn(),
  playRevealSound: vi.fn(),
  playPointsSound: vi.fn(),
}));
vi.mock('../../lib/haptics', () => ({ hapticMedium: vi.fn() }));
vi.mock('../../lib/useWakeLock', () => ({ useWakeLock: vi.fn() }));

let mockViewportHeight = 0;
vi.mock('../../platform/lib/useVisualViewport', () => ({
  useVisualViewport: () => ({
    viewportHeight: mockViewportHeight,
    keyboardHeight: 0,
    keyboardOpen: false,
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  mockViewportHeight = 0;
});

describe('the per-set reveal sheet (Bug 5, clarified 2026-08-16): Sets 1, 2, 3 AND 4 all use the SAME component', () => {
  it.each([0, 1, 2, 3] as const)('Set %i completion renders .reveal with the correct "Set N" title', async (setIndex) => {
    setFake(
      baseState({
        state: `REVEALING_SET_${setIndex + 1}` as FakeState['state'],
        subRoundResultsThisRound: [subRoundResult(setIndex)],
      })
    );
    const { HazariTable } = await import('./HazariTable');
    const { container } = render(<HazariTable />);

    const reveal = container.querySelector('.reveal');
    expect(reveal, `Set ${setIndex + 1}: .reveal must render`).not.toBeNull();
    const title = container.querySelector('.reveal__title');
    expect(title?.textContent).toBe(`Set ${setIndex + 1}`);
  });

  it('this is genuinely ONE shared component for all 4 sets, not 4 separate ones - same class names throughout', async () => {
    for (const setIndex of [0, 1, 2, 3] as const) {
      cleanup();
      setFake(
        baseState({
          state: `REVEALING_SET_${setIndex + 1}` as FakeState['state'],
          subRoundResultsThisRound: [subRoundResult(setIndex)],
        })
      );
      const { HazariTable } = await import('./HazariTable');
      const { container } = render(<HazariTable />);
      expect(container.querySelector('.reveal__sheet')).not.toBeNull();
      expect(container.querySelector('.reveal__body')).not.toBeNull();
    }
  });

  it('the reveal sheet has a bounded scroll structure: header, ONE scrollable body, footer button - in that DOM order', async () => {
    setFake(
      baseState({
        state: 'REVEALING_SET_1',
        subRoundResultsThisRound: [subRoundResult(0)],
      })
    );
    const { HazariTable } = await import('./HazariTable');
    const { container } = render(<HazariTable />);

    const sheet = container.querySelector('.reveal__sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    const children = Array.from(sheet.children).map((c) => c.className);
    // Header (title) first, scrollable body second, footer (button) last.
    expect(children[0]).toBe('reveal__title');
    expect(children[1]).toBe('reveal__body');
    expect(children[children.length - 1]).toContain('btn');

    // The hands list and points line - the content that actually grows
    // with player count - live INSIDE the scrollable body, not as direct
    // siblings of the header/footer.
    const body = container.querySelector('.reveal__body') as HTMLElement;
    expect(body.querySelector('.reveal__hands')).not.toBeNull();
    expect(body.querySelector('.reveal__points')).not.toBeNull();
  });

  it('applies the JS-measured viewport height as --js-vh on the reveal overlay, inherited by the sheet', async () => {
    mockViewportHeight = 480; // a plausible short-landscape Android viewport
    setFake(
      baseState({
        state: 'REVEALING_SET_1',
        subRoundResultsThisRound: [subRoundResult(0)],
      })
    );
    const { HazariTable } = await import('./HazariTable');
    const { container } = render(<HazariTable />);

    const overlay = container.querySelector('.reveal') as HTMLElement;
    expect(overlay.style.getPropertyValue('--js-vh')).toBe('480px');
  });

  it('the Continue button dismisses the sheet on tap, independent of any scroll position', async () => {
    setFake(
      baseState({
        state: 'REVEALING_SET_1',
        subRoundResultsThisRound: [subRoundResult(0)],
      })
    );
    const { HazariTable } = await import('./HazariTable');
    const { container, rerender } = render(<HazariTable />);

    const button = container.querySelector('.reveal__sheet .btn') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe('Continue');
    button.click();
    rerender(<HazariTable />);
    expect(container.querySelector('.reveal')).toBeNull();
  });
});

describe('RoundSummary is a SEPARATE component, only reached via ROUND_COMPLETE - not part of this fix', () => {
  it('HazariTable does not render RoundSummary itself - that is App.tsx\'s job once gameState.state changes', async () => {
    // Regression guard for the exact confusion this bug's diagnosis went
    // through twice: HazariTable (and its .reveal sheet) is what's on
    // screen for EVERY set including set 4. RoundSummary only appears
    // once App.tsx swaps screens entirely, which happens OUTSIDE
    // HazariTable and is not something rendering .reveal could ever
    // trigger by itself.
    setFake(
      baseState({
        state: 'REVEALING_SET_4',
        subRoundResultsThisRound: [subRoundResult(3)],
      })
    );
    const { HazariTable } = await import('./HazariTable');
    const { container } = render(<HazariTable />);
    expect(container.querySelector('.rsum')).toBeNull();
    expect(container.querySelector('.reveal')).not.toBeNull();
  });
});
