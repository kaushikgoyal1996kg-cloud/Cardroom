import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../src/platform/cards/index.js';
import { createDeck } from '../src/platform/cards/index.js';
import {
  KittiGame,
  compareGroup,
  drawInitialDealer,
  kittiDealOrder,
  validateKittiArrangement,
  type KittiGroups,
} from '../src/games/kitti/engine.js';
import { KITTI_RULES, KITTI_SCORING_CONFIRMED, UNRESOLVED_RULES } from '../src/games/kitti/rules.js';
import { suggestKittiArrangement } from '../src/games/kitti/arrangement.js';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${suit}_${rank}` });
const players = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`);

function deckForHands(order: string[], hands: Record<string, Card[]>): Card[] {
  const dealt: Card[] = [];
  const cardsEach = hands[order[0]].length;
  for (let cardIndex = 0; cardIndex < cardsEach; cardIndex++) {
    for (const playerId of order) dealt.push(hands[playerId][cardIndex]);
  }
  const ids = new Set(dealt.map((card) => card.id));
  if (ids.size !== dealt.length) throw new Error('Test fixture contains duplicate physical cards');
  return [...dealt, ...createDeck().filter((card) => !ids.has(card.id))];
}

function twoPlayerWinningHands(): Record<string, Card[]> {
  return {
    p1: [
      c('9', 'SPADES'), c('9', 'HEARTS'), c('9', 'CLUBS'),
      c('7', 'SPADES'), c('6', 'HEARTS'), c('5', 'CLUBS'),
      c('A', 'SPADES'), c('Q', 'HEARTS'), c('10', 'CLUBS'),
    ],
    p2: [
      c('8', 'SPADES'), c('8', 'HEARTS'), c('8', 'CLUBS'),
      c('6', 'SPADES'), c('5', 'HEARTS'), c('4', 'CLUBS'),
      c('K', 'SPADES'), c('J', 'HEARTS'), c('9', 'DIAMONDS'),
    ],
  };
}

function threeDifferentWinnersHands(): Record<string, Card[]> {
  return {
    p1: [
      c('10', 'SPADES'), c('10', 'HEARTS'), c('10', 'DIAMONDS'),
      c('A', 'SPADES'), c('2', 'HEARTS'), c('3', 'DIAMONDS'),
      c('2', 'SPADES'), c('2', 'CLUBS'), c('4', 'HEARTS'),
    ],
    p2: [
      c('9', 'SPADES'), c('9', 'HEARTS'), c('9', 'DIAMONDS'),
      c('A', 'CLUBS'), c('K', 'CLUBS'), c('Q', 'CLUBS'),
      c('3', 'SPADES'), c('3', 'CLUBS'), c('5', 'HEARTS'),
    ],
    p3: [
      c('8', 'SPADES'), c('8', 'HEARTS'), c('8', 'DIAMONDS'),
      c('K', 'SPADES'), c('Q', 'HEARTS'), c('J', 'DIAMONDS'),
      c('A', 'HEARTS'), c('A', 'DIAMONDS'), c('6', 'HEARTS'),
    ],
  };
}

function groups(hand: Card[]): KittiGroups {
  return [hand.slice(0, 3), hand.slice(3, 6), hand.slice(6, 9)];
}

function playCurrentHandInOrder(game: KittiGame): void {
  const order = game.getPublicState().currentPlayOrder;
  if (!order) throw new Error('Expected Kitti play order');
  for (const playerId of order) game.playCurrentHand(playerId);
}

function dealerForNextDeal(game: KittiGame): string {
  const state = game.getPublicState();
  if (state.state !== 'ROUND_COMPLETE') return state.dealerId;
  const active = new Set(state.activePlayerIds);
  const start = game.playersClockwise.indexOf(state.dealerId);
  for (let offset = 1; offset <= game.playersClockwise.length; offset++) {
    const candidate = game.playersClockwise[(start + offset) % game.playersClockwise.length];
    if (active.has(candidate)) return candidate;
  }
  throw new Error('Expected an active dealer for next Kitti round');
}

function playTwoPlayerFixtureRound(game: KittiGame, winnerId: 'p1' | 'p2'): void {
  const base = twoPlayerWinningHands();
  const hands = winnerId === 'p1' ? base : { p1: base.p2, p2: base.p1 };
  const dealer = dealerForNextDeal(game);
  const order = kittiDealOrder(game.playersClockwise, dealer);
  game.dealNewRound(deckForHands(order, hands));
  for (const playerId of game.getPublicState().activePlayerIds) {
    expect(game.confirmArrangement(playerId, groups(hands[playerId])).ok).toBe(true);
  }
  while (game.state.startsWith('PLAYING_HAND_')) playCurrentHandInOrder(game);
}

describe('Kitti authoritative rules', () => {
  it('freezes the agreed table/match constants', () => {
    expect(KITTI_RULES.MIN_PLAYERS).toBe(2);
    expect(KITTI_RULES.MAX_PLAYERS).toBe(5);
    expect(KITTI_RULES.CARDS_PER_PLAYER).toBe(9);
    expect(KITTI_RULES.GROUP_COUNT).toBe(3);
    expect(KITTI_RULES.GROUP_SIZE).toBe(3);
    expect(KITTI_RULES.MATCH_ROUNDS).toBe(10);
    expect(KITTI_RULES.HANDS_TO_WIN_ROUND).toBe(2);
    expect(KITTI_RULES.TWO_THREE_FIVE_IS_SPECIAL).toBe(false);
    expect(KITTI_SCORING_CONFIRMED).toBe(true);
    expect(UNRESOLVED_RULES).toEqual([]);
  });

  it('accepts 2–5 players and rejects counts outside the rule', () => {
    for (const n of [2, 3, 4, 5]) expect(() => new KittiGame('K1', players(n))).not.toThrow();
    expect(() => new KittiGame('K1', players(1))).toThrow();
    expect(() => new KittiGame('K1', players(6))).toThrow();
  });
});

describe('Kitti dealer and dealing', () => {
  it('deals clockwise starting AT the dealer', () => {
    expect(kittiDealOrder(['p1', 'p2', 'p3', 'p4'], 'p3')).toEqual(['p3', 'p4', 'p1', 'p2']);
  });

  it('selects the initial dealer by Ace-high draw and redraws tied highest players', () => {
    const deck = [
      c('A', 'SPADES'), c('A', 'HEARTS'), c('K', 'SPADES'), // p1/p2 tie high
      c('Q', 'SPADES'), c('K', 'HEARTS'),                   // p2 wins redraw
      ...createDeck().filter((card) => !new Set([
        'SPADES_A', 'HEARTS_A', 'SPADES_K', 'SPADES_Q', 'HEARTS_K',
      ]).has(card.id)),
    ];
    const result = drawInitialDealer(['p1', 'p2', 'p3'], deck);
    expect(result.dealerId).toBe('p2');
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[1].contenders).toEqual(['p1', 'p2']);
  });

  it('deals exactly nine distinct cards to every active player', () => {
    const game = new KittiGame('K1', players(5), 'p3');
    game.dealNewRound();
    const ids = players(5).flatMap((playerId) => game.getPlayerHand(playerId).map((card) => card.id));
    expect(ids).toHaveLength(45);
    expect(new Set(ids).size).toBe(45);
  });
});

describe('Kitti arrangement', () => {
  const hand = twoPlayerWinningHands().p1;

  it('requires all nine dealt cards exactly once in 3+3+3', () => {
    expect(validateKittiArrangement(hand, groups(hand))).toEqual({ valid: true, errors: [] });
    const duplicate: KittiGroups = [hand.slice(0, 3), hand.slice(3, 6), [hand[0], hand[7], hand[8]]];
    expect(validateKittiArrangement(hand, duplicate).valid).toBe(false);
  });

  it('enforces strictly strongest → weakest group order', () => {
    const valid = groups(hand);
    expect(validateKittiArrangement(hand, valid).valid).toBe(true);
    const reversed: KittiGroups = [valid[2], valid[1], valid[0]];
    const result = validateKittiArrangement(hand, reversed);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Group 1 must be strictly stronger|Group 2 must be strictly stronger/);
  });

  it('server suggestion uses all nine own cards and returns a strict valid arrangement', () => {
    const suggested = suggestKittiArrangement(hand);
    expect(validateKittiArrangement(hand, suggested)).toEqual({ valid: true, errors: [] });
    const flat = suggested.flat();
    expect(flat).toHaveLength(9);
    expect(new Set(flat.map((card) => card.id))).toEqual(new Set(hand.map((card) => card.id)));
  });
});

describe('Kitti hand resolution', () => {
  it('keeps compareGroup pure and reports exact equal strength', () => {
    const arrangements = [
      {
        playerId: 'p1',
        groups: [
          [c('A', 'SPADES'), c('A', 'HEARTS'), c('K', 'DIAMONDS')],
          [c('Q', 'SPADES'), c('Q', 'HEARTS'), c('J', 'DIAMONDS')],
          [c('K', 'HEARTS'), c('9', 'SPADES'), c('4', 'CLUBS')],
        ] as KittiGroups,
        confirmed: true,
      },
      {
        playerId: 'p2',
        groups: [
          [c('A', 'DIAMONDS'), c('A', 'CLUBS'), c('K', 'SPADES')],
          [c('Q', 'DIAMONDS'), c('Q', 'CLUBS'), c('J', 'SPADES')],
          [c('K', 'CLUBS'), c('8', 'SPADES'), c('3', 'CLUBS')],
        ] as KittiGroups,
        confirmed: true,
      },
    ];
    const result = compareGroup(0, arrangements);
    expect(result.tied).toBe(true);
    expect(result.topPlayerIds.sort()).toEqual(['p1', 'p2']);
  });

  it('resolves an exact tie in favour of the later thrower', () => {
    const hands = {
      p1: [
        c('A', 'SPADES'), c('A', 'HEARTS'), c('K', 'DIAMONDS'),
        c('Q', 'SPADES'), c('Q', 'HEARTS'), c('J', 'DIAMONDS'),
        c('K', 'HEARTS'), c('9', 'SPADES'), c('4', 'CLUBS'),
      ],
      p2: [
        c('A', 'DIAMONDS'), c('A', 'CLUBS'), c('K', 'SPADES'),
        c('Q', 'DIAMONDS'), c('Q', 'CLUBS'), c('J', 'SPADES'),
        c('K', 'CLUBS'), c('8', 'SPADES'), c('3', 'CLUBS'),
      ],
    };
    const game = new KittiGame('K1', ['p1', 'p2'], 'p1');
    game.dealNewRound(deckForHands(['p1', 'p2'], hands));
    expect(game.confirmArrangement('p1', groups(hands.p1)).ok).toBe(true);
    expect(game.confirmArrangement('p2', groups(hands.p2)).ok).toBe(true);
    // Dealer p1 -> p2 throws first -> p1 throws later. Equal Hand 1 => p1.
    playCurrentHandInOrder(game);
    expect(game.getPublicState().handResultsThisRound[0].winnerId).toBe('p1');
    expect(game.getPublicState().handResultsThisRound[0].wasTie).toBe(true);
  });
});

describe('Kitti round flow', () => {
  it('carries a Round Boot pot instead of dealing a decider after a 1–1–1 result', () => {
    const hands = threeDifferentWinnersHands();
    const game = new KittiGame('K1', ['p1', 'p2', 'p3'], 'p1', 'ROUND_BOOT');
    game.dealNewRound(deckForHands(['p1', 'p2', 'p3'], hands));
    for (const playerId of ['p1', 'p2', 'p3']) {
      expect(game.confirmArrangement(playerId, groups(hands[playerId])).ok).toBe(true);
    }

    playCurrentHandInOrder(game);
    playCurrentHandInOrder(game);
    playCurrentHandInOrder(game);

    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.getPublicState().mode).toBe('ROUND_BOOT');
    expect(game.getPublicState().deciderPlayerIds).toEqual([]);
    expect(game.roundHistory[0]).toMatchObject({ winnerId: null, potCarried: true });
    expect(game.roundsWon).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it('keeps Round Boot open-ended and awards a deal only for two hand wins', () => {
    const hands = twoPlayerWinningHands();
    const game = new KittiGame('K1', ['p1', 'p2'], 'p1', 'ROUND_BOOT');
    game.dealNewRound(deckForHands(['p1', 'p2'], hands));
    game.confirmArrangement('p1', groups(hands.p1));
    game.confirmArrangement('p2', groups(hands.p2));
    playCurrentHandInOrder(game);
    playCurrentHandInOrder(game);

    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.matchWinnerId).toBeNull();
    expect(game.roundHistory[0]).toMatchObject({ winnerId: 'p1', potCarried: false });
    expect(game.isComplete()).toBe(false);
  });

  it('ends the round immediately when a player wins the first two hands', () => {
    const hands = twoPlayerWinningHands();
    const game = new KittiGame('K1', ['p1', 'p2'], 'p1');
    game.dealNewRound(deckForHands(['p1', 'p2'], hands));
    expect(game.confirmArrangement('p1', groups(hands.p1)).ok).toBe(true);
    expect(game.confirmArrangement('p2', groups(hands.p2)).ok).toBe(true);

    playCurrentHandInOrder(game);
    expect(game.state).toBe('PLAYING_HAND_2');
    playCurrentHandInOrder(game);

    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.roundHistory[0].hands).toHaveLength(2);
    expect(game.roundHistory[0].winnerId).toBe('p1');
    // Same reconnect-safe authority contract as Hazari: completed Kitti rounds
    // travel in public state so Settings -> Round History works mid-match.
    expect(game.getPublicState().roundHistory).toHaveLength(1);
    expect(game.getPublicState().roundHistory[0]).toMatchObject({ roundNumber: 1, winnerId: 'p1' });
    expect(game.roundsWon.p1).toBe(1);
    expect(game.roundsWon.p2).toBe(0);
  });

  it('uses Hand 3 winner to lead a single three-winner decider', () => {
    const hands = threeDifferentWinnersHands();
    const game = new KittiGame('K1', ['p1', 'p2', 'p3'], 'p1');
    game.dealNewRound(deckForHands(['p1', 'p2', 'p3'], hands));
    for (const playerId of ['p1', 'p2', 'p3']) {
      expect(game.confirmArrangement(playerId, groups(hands[playerId])).ok).toBe(true);
    }

    playCurrentHandInOrder(game); // p1 wins
    expect(game.getPublicState().handResultsThisRound[0].winnerId).toBe('p1');
    playCurrentHandInOrder(game); // p2 wins
    expect(game.getPublicState().handResultsThisRound[1].winnerId).toBe('p2');
    playCurrentHandInOrder(game); // p3 wins
    expect(game.getPublicState().handResultsThisRound[2].winnerId).toBe('p3');
    expect(game.state).toBe('PLAYING_DECIDER');
    expect(game.getPublicState().currentPlayOrder?.[0]).toBe('p3');

    const deciderOrder = game.getPublicState().currentPlayOrder!;
    for (const playerId of deciderOrder) game.playDecider(playerId);
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.roundHistory[0].decider).toBeDefined();
    expect(game.roundHistory[0].winnerId).toBe(game.roundHistory[0].decider!.winnerId);
  });

  it('keeps the finished round number/dealer stable until the next deal begins', () => {
    const hands = twoPlayerWinningHands();
    const game = new KittiGame('K1', ['p1', 'p2'], 'p1');
    const deck = deckForHands(['p1', 'p2'], hands);
    game.dealNewRound(deck);
    game.confirmArrangement('p1', groups(hands.p1));
    game.confirmArrangement('p2', groups(hands.p2));
    playCurrentHandInOrder(game);
    playCurrentHandInOrder(game);

    expect(game.roundNumber).toBe(1);
    expect(game.dealerId).toBe('p1');
    game.dealNewRound(deck);
    expect(game.roundNumber).toBe(2);
    expect(game.dealerId).toBe('p2');
  });

  it('reports round wins as the Kitti score', () => {
    const hands = twoPlayerWinningHands();
    const game = new KittiGame('K1', ['p1', 'p2'], 'p1');
    game.dealNewRound(deckForHands(['p1', 'p2'], hands));
    game.confirmArrangement('p1', groups(hands.p1));
    game.confirmArrangement('p2', groups(hands.p2));
    playCurrentHandInOrder(game);
    playCurrentHandInOrder(game);
    expect(game.scoreRound()).toEqual({ p1: 1, p2: 0 });
  });

  it('runs all ten scheduled rounds, then resolves tied leaders by sudden death', () => {
    const game = new KittiGame('K1', ['p1', 'p2'], 'p1');

    for (let round = 1; round <= 10; round++) {
      playTwoPlayerFixtureRound(game, round % 2 === 1 ? 'p1' : 'p2');
      expect(game.roundNumber).toBe(round);
    }

    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.scheduledRoundsComplete).toBe(10);
    expect(game.suddenDeath).toBe(true);
    expect(game.roundsWon).toEqual({ p1: 5, p2: 5 });
    expect(game.getPublicState().activePlayerIds).toEqual(['p1', 'p2']);

    playTwoPlayerFixtureRound(game, 'p1');

    expect(game.roundNumber).toBe(11);
    expect(game.scheduledRoundsComplete).toBe(10);
    expect(game.state).toBe('MATCH_COMPLETE');
    expect(game.matchWinnerId).toBe('p1');
    expect(game.roundsWon).toEqual({ p1: 6, p2: 5 });
    expect(game.roundHistory).toHaveLength(11);
    expect(game.roundHistory[10].suddenDeath).toBe(true);
  });
});

describe('Kitti privacy boundary', () => {
  it('does not put confirmed but unplayed arranged groups into public state', () => {
    const hands = twoPlayerWinningHands();
    const game = new KittiGame('K1', ['p1', 'p2'], 'p1');
    game.dealNewRound(deckForHands(['p1', 'p2'], hands));
    expect(game.confirmArrangement('p1', groups(hands.p1)).ok).toBe(true);

    const serialized = JSON.stringify(game.getPublicState());
    for (const card of hands.p1) expect(serialized).not.toContain(card.id);
  });

  it('reveals only cards that have actually been thrown', () => {
    const hands = twoPlayerWinningHands();
    const game = new KittiGame('K1', ['p1', 'p2'], 'p1');
    game.dealNewRound(deckForHands(['p1', 'p2'], hands));
    game.confirmArrangement('p1', groups(hands.p1));
    game.confirmArrangement('p2', groups(hands.p2));

    const firstPlayer = game.getPublicState().currentPlayOrder![0];
    game.playCurrentHand(firstPlayer);
    const state = JSON.stringify(game.getPublicState());
    const thrown = hands[firstPlayer].slice(0, 3);
    const hidden = hands[firstPlayer].slice(3);
    for (const card of thrown) expect(state).toContain(card.id);
    for (const card of hidden) expect(state).not.toContain(card.id);
  });

  it('does not put unplayed private hands into public state', () => {
    const game = new KittiGame('K1', ['p1', 'p2'], 'p1');
    game.dealNewRound();
    const hiddenIds = game.getPlayerHand('p1').map((card) => card.id);
    const serialized = JSON.stringify(game.getPublicState());
    for (const id of hiddenIds) expect(serialized).not.toContain(id);
  });
});
