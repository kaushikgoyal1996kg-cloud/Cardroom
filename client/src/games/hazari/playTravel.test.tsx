// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CardTable, type PlayedSetView } from '../../platform/components/CardTable';
import type { SeatPlayer } from '../../platform/components/Seat';
import type { CardData } from '../../platform/components/PlayingCard';
import {
  dealingOrderFromDealer,
  buildSeatLayout,
  playAreaFor,
  dealDelay,
} from '../../platform/table/seatLayout';

/**
 * These exercise the LIVE path: HazariTable is rendered with a mocked game
 * store, so the arriving/seen-key logic inside it is what is under test -
 * not CardTable in isolation.
 */

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

const card = (id: string): CardData => ({ id, rank: 'A', suit: 'SPADES' });

// ---------------------------------------------------------------------------
// Mocked game store
// ---------------------------------------------------------------------------

interface FakeState {
  roundNumber: number;
  currentSetIndex: number;
  dealerId: string;
  currentPlayOrder: string[];
  playersPlayedThisSubRound: string[];
  playedSetsThisSubRound: { playerId: string; cards: CardData[] }[];
  subRoundResultsThisRound: unknown[];
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

const { HazariTable } = await import('./HazariTable');

afterEach(cleanup);
beforeEach(() => setFake(baseState()));

const arrivingCount = (c: HTMLElement) =>
  c.querySelectorAll('.table__played.is-arriving').length;
const playedCount = (c: HTMLElement) => c.querySelectorAll('.table__played').length;

// ===========================================================================
// 1. Live play travel
// ===========================================================================

describe('live HazariTable play travel', () => {
  it('does NOT animate sets already on the table at first render', () => {
    setFake(
      baseState({
        playedSetsThisSubRound: [
          { playerId: 'p2', cards: [card('a'), card('b'), card('c')] },
          { playerId: 'p3', cards: [card('d'), card('e'), card('f')] },
        ],
        playersPlayedThisSubRound: ['p2', 'p3'],
      })
    );
    const { container } = render(<HazariTable />);

    expect(playedCount(container)).toBe(2);
    expect(arrivingCount(container)).toBe(0);
  });

  it('animates a genuinely new authoritative played set', () => {
    const { container, rerender } = render(<HazariTable />);
    expect(playedCount(container)).toBe(0);

    // The server reports a new play.
    setFake(
      baseState({
        playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('a'), card('b'), card('c')] }],
        playersPlayedThisSubRound: ['p2'],
      })
    );
    rerender(<HazariTable />);

    expect(playedCount(container)).toBe(1);
    expect(arrivingCount(container)).toBe(1);
  });

  it('does not replay it on an unrelated rerender', () => {
    const { container, rerender } = render(<HazariTable />);

    setFake(
      baseState({
        playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('a')] }],
        playersPlayedThisSubRound: ['p2'],
      })
    );
    rerender(<HazariTable />);
    expect(arrivingCount(container)).toBe(1);

    // Something unrelated changes - a score update, a voice indicator.
    fakeGame.gameState = {
      ...fakeGame.gameState,
      cumulativeScores: { p1: 10, p2: 20, p3: 0, p4: 0 },
    };
    rerender(<HazariTable />);

    expect(playedCount(container)).toBe(1);
    expect(arrivingCount(container)).toBe(0);
  });

  it('animates only the NEW set when a second player plays', () => {
    const { container, rerender } = render(<HazariTable />);

    setFake(
      baseState({
        playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('a')] }],
        playersPlayedThisSubRound: ['p2'],
      })
    );
    rerender(<HazariTable />);

    setFake(
      baseState({
        playedSetsThisSubRound: [
          { playerId: 'p2', cards: [card('a')] },
          { playerId: 'p3', cards: [card('b')] },
        ],
        playersPlayedThisSubRound: ['p2', 'p3'],
      })
    );
    rerender(<HazariTable />);

    expect(playedCount(container)).toBe(2);
    expect(arrivingCount(container)).toBe(1);
  });

  it('treats a remount (reconnect / refresh) as first observation - no replay', () => {
    const restored = baseState({
      playedSetsThisSubRound: [
        { playerId: 'p2', cards: [card('a')] },
        { playerId: 'p3', cards: [card('b')] },
        { playerId: 'p4', cards: [card('c')] },
      ],
      playersPlayedThisSubRound: ['p2', 'p3', 'p4'],
    });
    setFake(restored);

    // A remount is exactly what a refresh or a reconnect produces.
    const { container, unmount } = render(<HazariTable />);
    expect(arrivingCount(container)).toBe(0);
    unmount();

    const second = render(<HazariTable />);
    expect(arrivingCount(second.container)).toBe(0);
    expect(playedCount(second.container)).toBe(3);
  });

  it('a set in a LATER set index is new even for the same player', () => {
    const { container, rerender } = render(<HazariTable />);

    setFake(
      baseState({
        currentSetIndex: 0,
        playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('a')] }],
      })
    );
    rerender(<HazariTable />);
    expect(arrivingCount(container)).toBe(1);

    // Next sub-round: same player, different set index -> different key.
    setFake(
      baseState({
        currentSetIndex: 1,
        state: 'PLAYING_SET_2',
        playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('z')] }],
      })
    );
    rerender(<HazariTable />);
    expect(arrivingCount(container)).toBe(1);
  });

  it('origin matches the local player\'s bottom seat for their own play', () => {
    const { container, rerender } = render(<HazariTable />);

    setFake(
      baseState({
        playedSetsThisSubRound: [{ playerId: 'p1', cards: [card('a')] }],
        playersPlayedThisSubRound: ['p1'],
      })
    );
    rerender(<HazariTable />);

    const el = container.querySelector('.table__played') as HTMLElement;
    const layout = buildSeatLayout(PLAYERS, 'p1');
    expect(layout.p1.anchor).toBe('bottom');
    const area = playAreaFor(layout.p1);
    expect(el.style.getPropertyValue('--play-from-x')).toBe(`${layout.p1.x - area.x}%`);
    expect(el.style.getPropertyValue('--play-from-y')).toBe(`${layout.p1.y - area.y}%`);
    // Bottom seat is below the landing area.
    expect(parseFloat(el.style.getPropertyValue('--play-from-y'))).toBeGreaterThan(0);
  });

  it('origin matches a remote player\'s actual seat', () => {
    const { container, rerender } = render(<HazariTable />);

    setFake(
      baseState({
        playedSetsThisSubRound: [{ playerId: 'p3', cards: [card('a')] }],
        playersPlayedThisSubRound: ['p3'],
      })
    );
    rerender(<HazariTable />);

    const el = container.querySelector('.table__played') as HTMLElement;
    const layout = buildSeatLayout(PLAYERS, 'p1');
    const area = playAreaFor(layout.p3);
    expect(el.style.getPropertyValue('--play-from-x')).toBe(`${layout.p3.x - area.x}%`);
    expect(el.style.getPropertyValue('--play-from-y')).toBe(`${layout.p3.y - area.y}%`);
  });

  it('reduced motion is handled in CSS, so the class is still applied', () => {
    // The suppression is `@media (prefers-reduced-motion: reduce) { animation:
    // none }` on .table__played.is-arriving - the marker stays, the movement
    // does not. Asserted here so a future refactor to JS-gating is noticed.
    const { container, rerender } = render(<HazariTable />);
    setFake(
      baseState({
        playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('a')] }],
      })
    );
    rerender(<HazariTable />);
    expect(container.querySelector('.table__played.is-arriving')).not.toBeNull();
  });
});

// ===========================================================================
// 2. Dealer-correct dealing order
// ===========================================================================

describe('dealingOrderFromDealer mirrors the server', () => {
  it('starts AT the dealer, then clockwise', () => {
    // Server: [...players.slice(idx), ...players.slice(0, idx)]
    expect(dealingOrderFromDealer(PLAYERS, 'p1')).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(dealingOrderFromDealer(PLAYERS, 'p2')).toEqual(['p2', 'p3', 'p4', 'p1']);
    expect(dealingOrderFromDealer(PLAYERS, 'p3')).toEqual(['p3', 'p4', 'p1', 'p2']);
    expect(dealingOrderFromDealer(PLAYERS, 'p4')).toEqual(['p4', 'p1', 'p2', 'p3']);
  });

  it('never loses or duplicates a player', () => {
    for (const dealer of PLAYERS) {
      const order = dealingOrderFromDealer(PLAYERS, dealer);
      expect(order).toHaveLength(PLAYERS.length);
      expect(new Set(order).size).toBe(PLAYERS.length);
    }
  });

  it('falls back to table order for an unknown or missing dealer', () => {
    expect(dealingOrderFromDealer(PLAYERS, 'ghost')).toEqual(PLAYERS);
    expect(dealingOrderFromDealer(PLAYERS, null)).toEqual(PLAYERS);
  });
});

describe('dealing ceremony follows the real dealer', () => {
  const seats: SeatPlayer[] = PLAYERS.map((id) => ({
    playerId: id,
    name: id.toUpperCase(),
    isBot: false,
    connection: 'CONNECTED' as const,
  }));

  /** Player id of the card with the smallest deal delay. */
  function firstRecipient(container: HTMLElement): string {
    const cards = [...container.querySelectorAll('.table__dealt')] as HTMLElement[];
    let best = cards[0];
    let bestDelay = Infinity;
    for (const el of cards) {
      const d = parseFloat(el.style.getPropertyValue('--deal-delay'));
      if (d < bestDelay) {
        bestDelay = d;
        best = el;
      }
    }
    // Match the element back to a seat by its position.
    const layout = buildSeatLayout(PLAYERS, 'p1');
    for (const pid of PLAYERS) {
      const area = playAreaFor(layout[pid]);
      if (best.style.left === `${area.x}%` && best.style.top === `${area.y}%`) return pid;
    }
    throw new Error('could not match dealt card to a seat');
  }

  it('deals first to p1 when p1 is dealer', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" dealing dealCardsEach={13} />
    );
    expect(firstRecipient(container)).toBe('p1');
  });

  it('deals first to p2 after the dealer rotates to p2', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p2" dealing dealCardsEach={13} />
    );
    expect(firstRecipient(container)).toBe('p2');
  });

  it('deals first to p3 and p4 when they deal', () => {
    for (const dealer of ['p3', 'p4']) {
      const { container, unmount } = render(
        <CardTable players={seats} selfId="p1" dealerId={dealer} dealing dealCardsEach={13} />
      );
      expect(firstRecipient(container)).toBe(dealer);
      unmount();
    }
  });

  it('continues clockwise from the dealer, one card at a time', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p3" dealing dealCardsEach={2} />
    );
    const layout = buildSeatLayout(PLAYERS, 'p1');
    const order = dealingOrderFromDealer(PLAYERS, 'p3'); // p3,p4,p1,p2

    // First four cards, in delay order, must be one each to p3,p4,p1,p2.
    const byDelay = ([...container.querySelectorAll('.table__dealt')] as HTMLElement[]).sort(
      (a, b) =>
        parseFloat(a.style.getPropertyValue('--deal-delay')) -
        parseFloat(b.style.getPropertyValue('--deal-delay'))
    );

    order.forEach((pid, i) => {
      const area = playAreaFor(layout[pid]);
      expect(byDelay[i].style.left, `position ${i} should be ${pid}`).toBe(`${area.x}%`);
    });
  });

  it('the delay sequence matches dealDelay computed over the dealing order', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p2" dealing dealCardsEach={3} />
    );
    const delays = ([...container.querySelectorAll('.table__dealt')] as HTMLElement[])
      .map((el) => parseFloat(el.style.getPropertyValue('--deal-delay')))
      .sort((a, b) => a - b);

    const expected: number[] = [];
    for (let c = 0; c < 3; c++) {
      for (let s = 0; s < 4; s++) expected.push(dealDelay(c, s, 4, false));
    }
    expect(delays).toEqual(expected.sort((a, b) => a - b));
  });

  it('SEAT POSITIONS do not change when the dealer changes', () => {
    const positionsFor = (dealer: string) => {
      const { container, unmount } = render(
        <CardTable players={seats} selfId="p1" dealerId={dealer} dealing dealCardsEach={1} />
      );
      const map: Record<string, string> = {};
      for (const el of container.querySelectorAll('.seat')) {
        const name = el.querySelector('.seat__name')?.textContent ?? '';
        map[name.trim()] = `${(el as HTMLElement).style.left},${(el as HTMLElement).style.top}`;
      }
      unmount();
      return map;
    };

    expect(positionsFor('p1')).toEqual(positionsFor('p3'));
  });

  it('the local player stays anchored at the bottom whoever deals', () => {
    for (const dealer of PLAYERS) {
      const layout = buildSeatLayout(PLAYERS, 'p1');
      expect(layout.p1.anchor, `dealer ${dealer}`).toBe('bottom');
    }
  });

  it('every ceremony card stays face down', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p3" dealing dealCardsEach={13} />
    );
    const dealt = container.querySelectorAll('.table__dealt');
    expect(dealt).toHaveLength(52);
    for (const el of dealt) {
      expect(el.querySelector('.pcard--back')).not.toBeNull();
      expect(el.querySelector('[role="img"]')).toBeNull();
    }
    expect(container.innerHTML).not.toMatch(/aria-label="[a-z]+ of (spades|hearts|diamonds|clubs)"/i);
  });
});

// ===========================================================================
// 3. Reconnect restoration WITHOUT unmounting HazariTable
//
// App keeps the same screen mounted during a reconnect and simply shows the
// connection banner over it, so `screenKey` stays 'playing' and HazariTable
// never unmounts. Seeding on mount alone is therefore not sufficient: state
// restored by the server while we stayed mounted would look like a burst of
// brand-new plays and animate.
//
// Every test below uses ONE mounted instance and only ever calls rerender.
// ===========================================================================

describe('reconnect restoration on a still-mounted HazariTable', () => {
  it('does not animate historical plays restored while mounted', () => {
    // 1-2. Mounted with one existing play; it must not animate.
    setFake(
      baseState({
        playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('a')] }],
        playersPlayedThisSubRound: ['p2'],
      })
    );
    const { container, rerender } = render(<HazariTable />);
    expect(playedCount(container)).toBe(1);
    expect(arrivingCount(container)).toBe(0);

    // 3. Socket drops and a reconnect begins - NO unmount.
    setFake(
      baseState({
        playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('a')] }],
        playersPlayedThisSubRound: ['p2'],
      })
    );
    fakeGame.isRestoring = true;
    rerender(<HazariTable />);

    // 4. Restoration delivers additional historical plays we had not seen.
    setFake(
      baseState({
        playedSetsThisSubRound: [
          { playerId: 'p2', cards: [card('a')] },
          { playerId: 'p3', cards: [card('b')] },
          { playerId: 'p4', cards: [card('c')] },
        ],
        playersPlayedThisSubRound: ['p2', 'p3', 'p4'],
      })
    );
    fakeGame.isRestoring = true;
    rerender(<HazariTable />);

    // 5. None of them animate - they are history, not new plays.
    expect(playedCount(container)).toBe(3);
    expect(arrivingCount(container)).toBe(0);

    // 6. Restoration completes: flag clears and the generation ticks.
    setFake(
      baseState({
        playedSetsThisSubRound: [
          { playerId: 'p2', cards: [card('a')] },
          { playerId: 'p3', cards: [card('b')] },
          { playerId: 'p4', cards: [card('c')] },
        ],
        playersPlayedThisSubRound: ['p2', 'p3', 'p4'],
      })
    );
    fakeGame.isRestoring = false;
    fakeGame.restorationGeneration = 1;
    rerender(<HazariTable />);
    expect(arrivingCount(container)).toBe(0);

    // 7-8. A genuinely new play afterwards DOES animate - the suppression is
    // not permanent.
    setFake(
      baseState({
        currentSetIndex: 1,
        state: 'PLAYING_SET_2',
        playedSetsThisSubRound: [{ playerId: 'p1', cards: [card('d')] }],
        playersPlayedThisSubRound: ['p1'],
      })
    );
    fakeGame.restorationGeneration = 1;
    rerender(<HazariTable />);
    expect(playedCount(container)).toBe(1);
    expect(arrivingCount(container)).toBe(1);

    // 9. An unrelated rerender does not replay it.
    fakeGame.gameState = {
      ...fakeGame.gameState,
      cumulativeScores: { p1: 5, p2: 5, p3: 5, p4: 5 },
    };
    rerender(<HazariTable />);
    expect(arrivingCount(container)).toBe(0);
  });

  it('state arriving on the exact tick restoration closes is still not animated', () => {
    setFake(baseState());
    const { container, rerender } = render(<HazariTable />);

    // Restoration completes in the same render as the restored plays land -
    // the generation tick must still cause a seed rather than an animation.
    setFake(
      baseState({
        playedSetsThisSubRound: [
          { playerId: 'p2', cards: [card('a')] },
          { playerId: 'p3', cards: [card('b')] },
        ],
        playersPlayedThisSubRound: ['p2', 'p3'],
      })
    );
    fakeGame.isRestoring = false;
    fakeGame.restorationGeneration = 1;
    rerender(<HazariTable />);

    expect(playedCount(container)).toBe(2);
    expect(arrivingCount(container)).toBe(0);
  });

  it('a second reconnect later is also suppressed', () => {
    setFake(baseState());
    const { container, rerender } = render(<HazariTable />);

    // First reconnect.
    setFake(baseState({ playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('a')] }] }));
    fakeGame.isRestoring = false;
    fakeGame.restorationGeneration = 1;
    rerender(<HazariTable />);
    expect(arrivingCount(container)).toBe(0);

    // A real play in between.
    setFake(
      baseState({
        playedSetsThisSubRound: [
          { playerId: 'p2', cards: [card('a')] },
          { playerId: 'p3', cards: [card('b')] },
        ],
      })
    );
    fakeGame.restorationGeneration = 1;
    rerender(<HazariTable />);
    expect(arrivingCount(container)).toBe(1);

    // Second reconnect restores a fuller set - none of it animates.
    setFake(
      baseState({
        playedSetsThisSubRound: [
          { playerId: 'p2', cards: [card('a')] },
          { playerId: 'p3', cards: [card('b')] },
          { playerId: 'p4', cards: [card('c')] },
        ],
      })
    );
    fakeGame.isRestoring = true;
    fakeGame.restorationGeneration = 1;
    rerender(<HazariTable />);
    expect(arrivingCount(container)).toBe(0);
  });

  it('never unmounts during any of the above', () => {
    // Guards the test itself: if a future edit remounts to make this pass,
    // the DOM node identity would change.
    setFake(baseState({ playedSetsThisSubRound: [{ playerId: 'p2', cards: [card('a')] }] }));
    const { container, rerender } = render(<HazariTable />);
    const node = container.querySelector('.hazari');
    expect(node).not.toBeNull();

    fakeGame.isRestoring = true;
    rerender(<HazariTable />);
    fakeGame.isRestoring = false;
    fakeGame.restorationGeneration = 1;
    rerender(<HazariTable />);

    expect(container.querySelector('.hazari')).toBe(node);
  });
});
