// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: any[]) => void;

function makeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    connected: false,
    on(event: string, fn: Handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
    },
    off(event: string, fn: Handler) {
      handlers.get(event)?.delete(fn);
    },
    emit() {},
    connect() {},
    disconnect() {},
    fire(event: string, payload?: unknown) {
      for (const fn of handlers.get(event) ?? []) fn(payload);
    },
  };
}

let socket: ReturnType<typeof makeSocket>;

vi.mock('./socket', () => ({ getSocket: () => socket }));

beforeEach(() => {
  socket = makeSocket();
  localStorage.clear();
});

afterEach(() => {
  vi.resetModules();
  localStorage.clear();
});

async function loadStore() {
  return import('./GameStore');
}

const hazariRound = (score: number) => ({
  roundNumber: 1,
  dealerId: 'p1',
  subRounds: [],
  pointsThisRound: { p1: score, p2: 360 - score, p3: 0, p4: 0 },
  cumulativeScores: { p1: score, p2: 360 - score, p3: 0, p4: 0 },
  dismissed: false,
});

const kittiRound = (winnerId: string) => ({
  roundNumber: 1,
  dealerId: 'p1',
  participants: ['p1', 'p2'],
  suddenDeath: false,
  hands: [],
  winnerId,
  roundsWon: winnerId === 'p1' ? { p1: 1, p2: 0 } : { p1: 0, p2: 1 },
});

describe('authoritative in-game Round History hydration', () => {
  it('replaces stale Hazari event history with the server state snapshot', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('hazari:roundComplete', { result: hazariRound(0) }));
    expect(result.current.roundHistory[0].pointsThisRound.p1).toBe(0);

    act(() => socket.fire('hazari:state', {
      roomCode: 'HZR1', state: 'ARRANGING_HANDS', dealerId: 'p2', roundNumber: 2,
      cumulativeScores: { p1: 110, p2: 250, p3: 0, p4: 0 },
      roundHistory: [hazariRound(110)],
      currentSetIndex: 0, currentLeader: null, currentPlayOrder: null,
      playersPlayedThisSubRound: [], playersConfirmedArrangement: [],
      playedSetsThisSubRound: [], subRoundResultsThisRound: [], initialDealerDraws: [], winnerId: null,
    }));

    expect(result.current.roundHistory).toHaveLength(1);
    expect(result.current.roundHistory[0].pointsThisRound.p1).toBe(110);
    expect(result.current.roundHistory[0].dealerId).toBe('p1');
  });

  it('does the same for Kitti while later rounds remain in progress', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('kitti:roundComplete', { result: kittiRound('p2') }));
    expect(result.current.kittiRoundHistory[0].winnerId).toBe('p2');

    act(() => socket.fire('kitti:state', {
      roomCode: 'KIT1', game: 'KITTI', state: 'ARRANGING', dealerId: 'p2', roundDealerId: 'p2', roundNumber: 2,
      scheduledRoundsComplete: 1, suddenDeath: false, activePlayerIds: ['p1', 'p2'], spectatorIds: [],
      playersConfirmed: [], currentHandIndex: 0, currentLeader: null, currentPlayOrder: null,
      playersPlayedThisHand: [], playedThisHand: [], handResultsThisRound: [], handWinsThisRound: { p1: 0, p2: 0 },
      deciderPlayerIds: [], roundWinnerId: null, roundsWon: { p1: 1, p2: 0 },
      roundHistory: [kittiRound('p1')], matchWinnerId: null, initialDealerDraws: [],
    }));

    expect(result.current.kittiRoundHistory).toHaveLength(1);
    expect(result.current.kittiRoundHistory[0].winnerId).toBe('p1');
    expect(result.current.kittiRoundHistory[0].roundsWon.p1).toBe(1);
  });


  it('rehydrates Teen Patti round history from the authoritative next-round state', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    const stale = {
      roundNumber: 1, variantId: 'CLASSIC', variantName: 'Classic', dealerId: 'p1',
      winnerIds: ['p2'], potAwarded: 20, showdown: null, split: false, reason: 'LAST_STANDING',
    };
    const authoritative = { ...stale, winnerIds: ['p1'] };

    act(() => socket.fire('teenpatti:roundComplete', { result: stale }));
    expect(result.current.teenPattiRoundHistory[0].winnerIds).toEqual(['p2']);

    act(() => socket.fire('teenpatti:state', {
      roomCode: 'TP1', game: 'TEEN_PATTI', state: 'BETTING', dealerId: 'p1', roundNumber: 2,
      pot: 20, currentBlind: 10, seenAmount: 20, currentTurn: 'p2', sequence: 10,
      tableConfig: { startingBalance: 1000, bootAmount: 10, baseBlind: 10, maxBlind: 60 },
      variantPolicy: { mode: 'FIXED', fixedVariant: 'CLASSIC' },
      variant: { variantId: 'CLASSIC' }, variantDecision: null, variantWasSurprise: false,
      variantName: 'Classic', nextVariantChooserId: null, variantDealCount: 3, variantHelp: 'Classic',
      variantReferenceCards: [], twoReferenceAssignmentsComplete: 0, referenceAssignmentRequiredPlayerIds: [], referenceAssignmentReason: null, discardSelectionsComplete: 0, initialDealerDraws: [],
      lastSideshow: null, openShowRequestFrom: null, openShowAcceptedBy: [],
      players: [
        { playerId: 'p1', chips: 1010, seen: false, cardsViewed: false, packed: false, sittingOut: false, committed: 10, blindTurns: 0, topUps: 0, roundsWon: 1, profitLoss: 10, referenceAssigned: false, discardLocked: false },
        { playerId: 'p2', chips: 970, seen: false, cardsViewed: false, packed: false, sittingOut: false, committed: 10, blindTurns: 0, topUps: 0, roundsWon: 0, profitLoss: -30, referenceAssigned: false, discardLocked: false },
      ],
      roundHistory: [authoritative], lastOutcome: null,
    }));

    expect(result.current.teenPattiRoundHistory).toHaveLength(1);
    expect(result.current.teenPattiRoundHistory[0].winnerIds).toEqual(['p1']);
  });

  it('rehydrates Poker hand history from the authoritative next-hand state', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    const stale = {
      handNumber: 1, variantId: 'TEXAS_HOLDEM', variantName: 'Texas Hold’em', dealerId: 'A', board: [], pots: [{ amount: 30, eligiblePlayerIds: ['B'], winnerIds: ['B'] }],
      showdown: null, winnerIds: ['B'], reason: 'LAST_STANDING',
    };
    const authoritative = { ...stale, pots: [{ amount: 30, eligiblePlayerIds: ['C'], winnerIds: ['C'] }], winnerIds: ['C'] };

    act(() => socket.fire('poker:handComplete', { result: stale }));
    expect(result.current.pokerHandHistory[0].winnerIds).toEqual(['B']);

    act(() => socket.fire('poker:state', {
      state: 'PREFLOP', sequence: 12, handNumber: 2, variantId: 'TEXAS_HOLDEM',
      variant: { id: 'TEXAS_HOLDEM', name: 'Texas Hold’em', shortName: 'Texas', holeCards: 2, betting: 'NO_LIMIT', minPlayers: 2, maxPlayers: 9, howToPlay: 'Texas' },
      tableConfig: { mode: 'FIXED', fixedVariant: 'TEXAS_HOLDEM', startingStack: 1000, smallBlind: 10, bigBlind: 20, ante: 0, actionTimerSeconds: 0 },
      dealerId: 'B', nextVariantChooserId: null, approvedVariantIds: ['TEXAS_HOLDEM'], approvedVariants: [],
      currentTurn: 'A', board: [], pot: 30, currentBet: 20, minRaiseTo: 40, maxRaiseTo: 1000,
      players: [
        { playerId: 'A', stack: 1000, folded: false, allIn: false, streetCommitted: 0, handCommitted: 0, actedThisStreet: false, topUps: 0, handsWon: 0 },
        { playerId: 'B', stack: 990, folded: false, allIn: false, streetCommitted: 10, handCommitted: 10, actedThisStreet: false, topUps: 0, handsWon: 0 },
        { playerId: 'C', stack: 980, folded: false, allIn: false, streetCommitted: 20, handCommitted: 20, actedThisStreet: false, topUps: 0, handsWon: 1 },
      ],
      handHistory: [authoritative], outcome: null,
    }));

    expect(result.current.pokerHandHistory).toHaveLength(1);
    expect(result.current.pokerHandHistory[0].winnerIds).toEqual(['C']);
  });


  it('rebuilds Hazari and Kitti result/winner screens from completed public snapshots after reconnect', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    const hz = hazariRound(140);
    act(() => socket.fire('hazari:state', {
      roomCode: 'HZR1', state: 'ROUND_COMPLETE', dealerId: 'p1', roundNumber: 1,
      cumulativeScores: hz.cumulativeScores, roundHistory: [hz],
      currentSetIndex: 3, currentLeader: null, currentPlayOrder: null,
      playersPlayedThisSubRound: [], playersConfirmedArrangement: [],
      playedSetsThisSubRound: [], subRoundResultsThisRound: [], initialDealerDraws: [], winnerId: null,
    }));
    expect(result.current.lastRoundResult?.pointsThisRound.p1).toBe(140);

    act(() => socket.fire('hazari:state', {
      roomCode: 'HZR1', state: 'GAME_COMPLETE', dealerId: 'p1', roundNumber: 1,
      cumulativeScores: hz.cumulativeScores, roundHistory: [hz],
      currentSetIndex: 3, currentLeader: null, currentPlayOrder: null,
      playersPlayedThisSubRound: [], playersConfirmedArrangement: [],
      playedSetsThisSubRound: [], subRoundResultsThisRound: [], initialDealerDraws: [], winnerId: 'p1',
    }));
    expect(result.current.winnerInfo).toEqual({ winnerId: 'p1', finalScores: hz.cumulativeScores });

    const kr = kittiRound('p2');
    act(() => socket.fire('kitti:state', {
      roomCode: 'KIT1', game: 'KITTI', state: 'ROUND_COMPLETE', dealerId: 'p1', roundDealerId: 'p1', roundNumber: 1,
      scheduledRoundsComplete: 1, suddenDeath: false, activePlayerIds: ['p1', 'p2'], spectatorIds: [],
      playersConfirmed: [], currentHandIndex: 2, currentLeader: null, currentPlayOrder: null,
      playersPlayedThisHand: [], playedThisHand: [], handResultsThisRound: [], handWinsThisRound: { p1: 1, p2: 2 },
      deciderPlayerIds: [], roundWinnerId: 'p2', roundsWon: kr.roundsWon,
      roundHistory: [kr], matchWinnerId: null, initialDealerDraws: [],
    }));
    expect(result.current.lastKittiRoundResult?.winnerId).toBe('p2');

    act(() => socket.fire('kitti:state', {
      roomCode: 'KIT1', game: 'KITTI', state: 'MATCH_COMPLETE', dealerId: 'p1', roundDealerId: 'p1', roundNumber: 10,
      scheduledRoundsComplete: 10, suddenDeath: false, activePlayerIds: ['p1', 'p2'], spectatorIds: [],
      playersConfirmed: [], currentHandIndex: 2, currentLeader: null, currentPlayOrder: null,
      playersPlayedThisHand: [], playedThisHand: [], handResultsThisRound: [], handWinsThisRound: { p1: 1, p2: 2 },
      deciderPlayerIds: [], roundWinnerId: 'p2', roundsWon: { p1: 4, p2: 6 },
      roundHistory: [kr], matchWinnerId: 'p2', initialDealerDraws: [],
    }));
    expect(result.current.kittiWinnerInfo).toEqual({ winnerId: 'p2', roundsWon: { p1: 4, p2: 6 } });
  });

  it('rebuilds Teen Patti and Poker completed-hand summaries from authoritative snapshots', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    const tpOutcome = {
      roundNumber: 3, variantId: 'CLASSIC', variantName: 'Classic', dealerId: 'p1',
      winnerIds: ['p2'], potAwarded: 80, showdown: null, split: false, reason: 'LAST_STANDING',
    };
    act(() => socket.fire('teenpatti:state', {
      roomCode: 'TP1', game: 'TEEN_PATTI', state: 'ROUND_COMPLETE', dealerId: 'p1', roundNumber: 3,
      pot: 0, currentBlind: 10, seenAmount: 20, currentTurn: null, sequence: 30,
      tableConfig: { startingBalance: 1000, bootAmount: 10, baseBlind: 10, maxBlind: 60 },
      variantPolicy: { mode: 'FIXED', fixedVariant: 'CLASSIC' },
      variant: { variantId: 'CLASSIC' }, variantDecision: null, variantWasSurprise: false,
      variantName: 'Classic', nextVariantChooserId: null, variantDealCount: 3, variantHelp: 'Classic',
      variantReferenceCards: [], twoReferenceAssignmentsComplete: 0, referenceAssignmentRequiredPlayerIds: [], referenceAssignmentReason: null, discardSelectionsComplete: 0, initialDealerDraws: [],
      lastSideshow: null, openShowRequestFrom: null, openShowAcceptedBy: [], players: [],
      roundHistory: [tpOutcome], lastOutcome: tpOutcome,
    }));
    expect(result.current.lastTeenPattiRoundResult?.roundNumber).toBe(3);
    expect(result.current.lastTeenPattiRoundResult?.winnerIds).toEqual(['p2']);

    const pokerOutcome = {
      handNumber: 7, variantId: 'PLO4', variantName: 'PLO4', dealerId: 'A', board: [],
      pots: [{ amount: 120, eligiblePlayerIds: ['A'], winnerIds: ['A'] }],
      showdown: null, winnerIds: ['A'], reason: 'LAST_STANDING',
    };
    act(() => socket.fire('poker:state', {
      state: 'HAND_COMPLETE', sequence: 71, handNumber: 7, variantId: 'PLO4',
      variant: { id: 'PLO4', name: 'PLO4', shortName: 'PLO4', holeCards: 4, betting: 'POT_LIMIT', minPlayers: 2, maxPlayers: 9, howToPlay: 'Omaha' },
      tableConfig: { mode: 'FIXED', fixedVariant: 'PLO4', startingStack: 1000, smallBlind: 10, bigBlind: 20, ante: 0, actionTimerSeconds: 0 },
      dealerId: 'A', nextVariantChooserId: null, approvedVariantIds: ['PLO4'], approvedVariants: [],
      currentTurn: null, board: [], pot: 0, currentBet: 0, minRaiseTo: null, maxRaiseTo: null,
      players: [], handHistory: [pokerOutcome], outcome: pokerOutcome,
    }));
    expect(result.current.lastPokerHandResult?.handNumber).toBe(7);
    expect(result.current.lastPokerHandResult?.winnerIds).toEqual(['A']);
  });

});
