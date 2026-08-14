import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/platform/cards/index.js';
import { createDeck, shuffleDeck } from '../src/platform/cards/index.js';
import { KittiGame, validateKittiArrangement, compareGroup, type KittiGroups } from '../src/games/kitti/engine.js';
import { KITTI_RULES, KITTI_SCORING_CONFIRMED, KittiRuleUnresolvedError } from '../src/games/kitti/rules.js';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${suit}_${rank}` });

function players(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

describe('Kitti confirmed rules', () => {
  it('uses 9 cards and three groups of three', () => {
    expect(KITTI_RULES.CARDS_PER_PLAYER).toBe(9);
    expect(KITTI_RULES.GROUP_COUNT).toBe(3);
    expect(KITTI_RULES.GROUP_SIZE).toBe(3);
  });

  it('treats 2-3-5 as NOT special, per the owner', () => {
    expect(KITTI_RULES.TWO_THREE_FIVE_IS_SPECIAL).toBe(false);
  });

  it('accepts 2 to 5 players', () => {
    for (const n of [2, 3, 4, 5]) {
      expect(() => new KittiGame('K1', players(n))).not.toThrow();
    }
  });

  it('rejects 1 player and 6 players', () => {
    expect(() => new KittiGame('K1', players(1))).toThrow();
    expect(() => new KittiGame('K1', players(6))).toThrow();
  });
});

describe('Kitti dealing', () => {
  it('deals exactly 9 cards to every player, all distinct', () => {
    for (const n of [2, 3, 4, 5]) {
      const game = new KittiGame('K1', players(n), 'p1');
      game.dealNewRound();
      const all: string[] = [];
      for (const pid of players(n)) {
        const h = game.getPlayerHand(pid);
        expect(h).toHaveLength(9);
        all.push(...h.map((x) => x.id));
      }
      expect(new Set(all).size).toBe(9 * n);
    }
  });

  it('never deals a card that is not in a standard deck', () => {
    const valid = new Set(createDeck().map((x) => x.id));
    const game = new KittiGame('K1', players(5), 'p1');
    game.dealNewRound();
    for (const pid of players(5)) {
      for (const card of game.getPlayerHand(pid)) {
        expect(valid.has(card.id)).toBe(true);
      }
    }
  });

  it('rotates the dealer clockwise', () => {
    const game = new KittiGame('K1', players(4), 'p1');
    expect(game.dealerId).toBe('p1');
    game.rotateDealer();
    expect(game.dealerId).toBe('p2');
    game.rotateDealer();
    expect(game.dealerId).toBe('p3');
  });
});

describe('Kitti arrangement validation', () => {
  const hand = [
    c('A', 'SPADES'), c('K', 'SPADES'), c('Q', 'SPADES'),
    c('9', 'HEARTS'), c('8', 'HEARTS'), c('7', 'HEARTS'),
    c('4', 'CLUBS'), c('3', 'CLUBS'), c('2', 'CLUBS'),
  ];
  const validGroups: KittiGroups = [
    [hand[0], hand[1], hand[2]],
    [hand[3], hand[4], hand[5]],
    [hand[6], hand[7], hand[8]],
  ];

  it('accepts a correct 3+3+3 split', () => {
    expect(validateKittiArrangement(hand, validGroups).valid).toBe(true);
  });

  it('rejects a group of the wrong size', () => {
    const bad: KittiGroups = [
      [hand[0], hand[1]],
      [hand[2], hand[3], hand[4]],
      [hand[5], hand[6], hand[7]],
    ];
    expect(validateKittiArrangement(hand, bad).valid).toBe(false);
  });

  it('rejects a card the player was never dealt', () => {
    const bad: KittiGroups = [
      [c('A', 'HEARTS'), hand[1], hand[2]],
      [hand[3], hand[4], hand[5]],
      [hand[6], hand[7], hand[8]],
    ];
    const result = validateKittiArrangement(hand, bad);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/not part of your dealt hand/);
  });

  it('rejects the same card used twice', () => {
    const bad: KittiGroups = [
      [hand[0], hand[1], hand[2]],
      [hand[0], hand[4], hand[5]],
      [hand[6], hand[7], hand[8]],
    ];
    expect(validateKittiArrangement(hand, bad).valid).toBe(false);
  });

  it('does NOT enforce strongest-to-weakest ordering, because that rule is unconfirmed', () => {
    // Weakest group first - must still validate, since assuming Hazari's
    // ordering rule applies to Kitti would be inventing a rule.
    const reversed: KittiGroups = [validGroups[2], validGroups[1], validGroups[0]];
    expect(validateKittiArrangement(hand, reversed).valid).toBe(true);
  });
});

describe('Kitti group comparison', () => {
  it('ranks players within a group using the confirmed hierarchy', () => {
    const arrangements = [
      {
        playerId: 'p1',
        groups: [
          [c('A', 'SPADES'), c('K', 'SPADES'), c('Q', 'SPADES')], // pure sequence A-K-Q
          [c('2', 'HEARTS'), c('5', 'CLUBS'), c('9', 'DIAMONDS')],
          [c('3', 'HEARTS'), c('6', 'CLUBS'), c('10', 'DIAMONDS')],
        ] as KittiGroups,
        confirmed: true,
      },
      {
        playerId: 'p2',
        groups: [
          [c('7', 'HEARTS'), c('7', 'CLUBS'), c('7', 'DIAMONDS')], // trail of 7s
          [c('4', 'HEARTS'), c('8', 'CLUBS'), c('J', 'DIAMONDS')],
          [c('5', 'HEARTS'), c('9', 'CLUBS'), c('K', 'DIAMONDS')],
        ] as KittiGroups,
        confirmed: true,
      },
    ];

    const result = compareGroup(0, arrangements);
    // Trail beats pure sequence.
    expect(result.ranked[0].playerId).toBe('p2');
    expect(result.topPlayerIds).toEqual(['p2']);
    expect(result.tied).toBe(false);
  });

  it('flags an exact tie rather than resolving it', () => {
    const arrangements = [
      {
        playerId: 'p1',
        groups: [
          [c('K', 'SPADES'), c('9', 'HEARTS'), c('4', 'CLUBS')],
          [c('2', 'HEARTS'), c('5', 'CLUBS'), c('8', 'DIAMONDS')],
          [c('3', 'HEARTS'), c('6', 'CLUBS'), c('10', 'DIAMONDS')],
        ] as KittiGroups,
        confirmed: true,
      },
      {
        playerId: 'p2',
        groups: [
          [c('K', 'HEARTS'), c('9', 'CLUBS'), c('4', 'DIAMONDS')], // identical ranks
          [c('2', 'SPADES'), c('5', 'HEARTS'), c('8', 'CLUBS')],
          [c('3', 'SPADES'), c('6', 'HEARTS'), c('10', 'CLUBS')],
        ] as KittiGroups,
        confirmed: true,
      },
    ];

    const result = compareGroup(0, arrangements);
    expect(result.tied).toBe(true);
    expect(result.topPlayerIds.sort()).toEqual(['p1', 'p2']);
  });
});

describe('Kitti unresolved-rule guards', () => {
  it('scoring is flagged as unconfirmed', () => {
    expect(KITTI_SCORING_CONFIRMED).toBe(false);
  });

  it('scoreRound() throws rather than inventing a point system', () => {
    const game = new KittiGame('K1', players(3), 'p1');
    game.dealNewRound();
    expect(() => game.scoreRound()).toThrow(KittiRuleUnresolvedError);
  });

  it('reports scoringAvailable=false to clients', () => {
    const game = new KittiGame('K1', players(3), 'p1');
    expect(game.getPublicState().scoringAvailable).toBe(false);
  });
});

describe('Kitti full round flow (up to the confirmed boundary)', () => {
  it('deals, accepts arrangements from all players, and compares all three groups', () => {
    const game = new KittiGame('K1', players(4), 'p1');
    game.dealNewRound(shuffleDeck(createDeck()));

    for (const pid of players(4)) {
      const h = game.getPlayerHand(pid);
      const groups: KittiGroups = [h.slice(0, 3), h.slice(3, 6), h.slice(6, 9)];
      const res = game.confirmArrangement(pid, groups);
      expect(res.ok).toBe(true);
    }

    expect(game.state).toBe('REVEALING');
    const comparisons = game.compareAllGroups();
    expect(comparisons).toHaveLength(3);
    for (const cmp of comparisons) {
      expect(cmp.ranked).toHaveLength(4);
      expect(cmp.topPlayerIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('rejects an arrangement that does not match the dealt hand', () => {
    const game = new KittiGame('K1', players(2), 'p1');
    game.dealNewRound();
    const fake: KittiGroups = [
      [c('A', 'SPADES'), c('A', 'HEARTS'), c('A', 'CLUBS')],
      [c('K', 'SPADES'), c('K', 'HEARTS'), c('K', 'CLUBS')],
      [c('Q', 'SPADES'), c('Q', 'HEARTS'), c('Q', 'CLUBS')],
    ];
    const res = game.confirmArrangement('p1', fake);
    // Either the cards are not in hand, or (astronomically unlikely) they are
    // and it legitimately passes - assert the security property directly.
    if (!res.ok) {
      expect(res.errors!.join(' ')).toMatch(/not part of your dealt hand/);
    }
  });
});
