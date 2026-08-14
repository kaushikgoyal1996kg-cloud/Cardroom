import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/platform/cards/index.js';
import { createDeck, shuffleDeck, dealCards, seatingOrderFromDealer } from '../src/platform/cards/index.js';
import {
  classifyThreeCardHand,
  compareThreeCardHands,
  threeCardRunHighValue,
  ThreeCardCategory,
} from '../src/platform/cards/threeCardHand.js';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${suit}_${rank}` });

const hand = (...cards: Card[]) => cards;

describe('platform deck', () => {
  it('creates 52 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((x) => x.id)).size).toBe(52);
  });

  it('shuffling preserves the exact multiset of cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled.map((x) => x.id).sort()).toEqual(deck.map((x) => x.id).sort());
  });

  it('deals one card at a time round the table, not in blocks', () => {
    const deck = createDeck();
    const { hands } = dealCards(deck, ['a', 'b', 'c'], 3);
    // Player a should hold deck[0], deck[3], deck[6] - not deck[0..2].
    expect(hands.a.map((x) => x.id)).toEqual([deck[0].id, deck[3].id, deck[6].id]);
    expect(hands.b.map((x) => x.id)).toEqual([deck[1].id, deck[4].id, deck[7].id]);
  });

  it('never deals the same card to two players', () => {
    const { hands } = dealCards(shuffleDeck(createDeck()), ['a', 'b', 'c', 'd', 'e'], 9);
    const all = Object.values(hands).flat().map((x) => x.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('seats clockwise starting left of the dealer', () => {
    expect(seatingOrderFromDealer(['p1', 'p2', 'p3', 'p4'], 'p2')).toEqual(['p3', 'p4', 'p1', 'p2']);
  });
});

describe('three-card hand classification', () => {
  it('identifies a trail', () => {
    const v = classifyThreeCardHand(hand(c('K', 'SPADES'), c('K', 'HEARTS'), c('K', 'CLUBS')));
    expect(v.category).toBe(ThreeCardCategory.TRAIL);
  });

  it('identifies a pure sequence', () => {
    const v = classifyThreeCardHand(hand(c('9', 'HEARTS'), c('8', 'HEARTS'), c('7', 'HEARTS')));
    expect(v.category).toBe(ThreeCardCategory.PURE_SEQUENCE);
  });

  it('identifies a mixed-suit sequence', () => {
    const v = classifyThreeCardHand(hand(c('9', 'HEARTS'), c('8', 'SPADES'), c('7', 'HEARTS')));
    expect(v.category).toBe(ThreeCardCategory.SEQUENCE);
  });

  it('identifies a colour', () => {
    const v = classifyThreeCardHand(hand(c('K', 'HEARTS'), c('8', 'HEARTS'), c('3', 'HEARTS')));
    expect(v.category).toBe(ThreeCardCategory.COLOR);
  });

  it('identifies a pair with the correct kicker', () => {
    const v = classifyThreeCardHand(hand(c('5', 'HEARTS'), c('5', 'SPADES'), c('A', 'CLUBS')));
    expect(v.category).toBe(ThreeCardCategory.PAIR);
    expect(v.tiebreakRanks).toEqual([5, 14]);
  });

  it('identifies high card', () => {
    const v = classifyThreeCardHand(hand(c('K', 'HEARTS'), c('8', 'SPADES'), c('3', 'CLUBS')));
    expect(v.category).toBe(ThreeCardCategory.HIGH_CARD);
  });

  it('rejects a set that is not exactly three cards', () => {
    expect(() => classifyThreeCardHand(hand(c('K', 'HEARTS'), c('8', 'SPADES')))).toThrow();
  });

  it('rejects duplicate cards', () => {
    expect(() =>
      classifyThreeCardHand(hand(c('K', 'HEARTS'), c('K', 'HEARTS'), c('8', 'SPADES')))
    ).toThrow();
  });
});

describe('OWNER-CONFIRMED sequence hierarchy', () => {
  // A-K-Q > A-2-3 > K-Q-J > Q-J-10 > ... > 4-3-2
  const runs: [string, Card[]][] = [
    ['A-K-Q', hand(c('A', 'SPADES'), c('K', 'HEARTS'), c('Q', 'CLUBS'))],
    ['A-2-3', hand(c('A', 'SPADES'), c('2', 'HEARTS'), c('3', 'CLUBS'))],
    ['K-Q-J', hand(c('K', 'SPADES'), c('Q', 'HEARTS'), c('J', 'CLUBS'))],
    ['Q-J-10', hand(c('Q', 'SPADES'), c('J', 'HEARTS'), c('10', 'CLUBS'))],
    ['J-10-9', hand(c('J', 'SPADES'), c('10', 'HEARTS'), c('9', 'CLUBS'))],
    ['10-9-8', hand(c('10', 'SPADES'), c('9', 'HEARTS'), c('8', 'CLUBS'))],
    ['9-8-7', hand(c('9', 'SPADES'), c('8', 'HEARTS'), c('7', 'CLUBS'))],
    ['8-7-6', hand(c('8', 'SPADES'), c('7', 'HEARTS'), c('6', 'CLUBS'))],
    ['7-6-5', hand(c('7', 'SPADES'), c('6', 'HEARTS'), c('5', 'CLUBS'))],
    ['6-5-4', hand(c('6', 'SPADES'), c('5', 'HEARTS'), c('4', 'CLUBS'))],
    ['5-4-3', hand(c('5', 'SPADES'), c('4', 'HEARTS'), c('3', 'CLUBS'))],
    ['4-3-2', hand(c('4', 'SPADES'), c('3', 'HEARTS'), c('2', 'CLUBS'))],
  ];

  it('every listed run is recognised as a sequence', () => {
    for (const [name, cards] of runs) {
      expect(threeCardRunHighValue(cards), `${name} should be a run`).not.toBeNull();
    }
  });

  it('ranks the twelve sequences in exactly the confirmed order', () => {
    for (let i = 0; i < runs.length - 1; i++) {
      const [nameA, cardsA] = runs[i];
      const [nameB, cardsB] = runs[i + 1];
      const cmp = compareThreeCardHands(
        classifyThreeCardHand(cardsA),
        classifyThreeCardHand(cardsB)
      );
      expect(cmp, `${nameA} must beat ${nameB}`).toBeGreaterThan(0);
    }
  });

  it('places A-2-3 second - above K-Q-J but below A-K-Q', () => {
    const akq = classifyThreeCardHand(runs[0][1]);
    const a23 = classifyThreeCardHand(runs[1][1]);
    const kqj = classifyThreeCardHand(runs[2][1]);
    expect(compareThreeCardHands(akq, a23)).toBeGreaterThan(0);
    expect(compareThreeCardHands(a23, kqj)).toBeGreaterThan(0);
  });

  it('applies the same order to pure sequences', () => {
    const a23Pure = classifyThreeCardHand(hand(c('A', 'HEARTS'), c('2', 'HEARTS'), c('3', 'HEARTS')));
    const kqjPure = classifyThreeCardHand(hand(c('K', 'SPADES'), c('Q', 'SPADES'), c('J', 'SPADES')));
    expect(a23Pure.category).toBe(ThreeCardCategory.PURE_SEQUENCE);
    expect(compareThreeCardHands(a23Pure, kqjPure)).toBeGreaterThan(0);
  });

  it('does not treat A-2-4 or K-A-2 as sequences (no wrap-around)', () => {
    expect(threeCardRunHighValue(hand(c('A', 'SPADES'), c('2', 'HEARTS'), c('4', 'CLUBS')))).toBeNull();
    expect(threeCardRunHighValue(hand(c('K', 'SPADES'), c('A', 'HEARTS'), c('2', 'CLUBS')))).toBeNull();
  });
});

describe('category ordering', () => {
  it('ranks trail > pure sequence > sequence > colour > pair > high card', () => {
    const ladder = [
      hand(c('2', 'SPADES'), c('2', 'HEARTS'), c('2', 'CLUBS')),   // lowest trail
      hand(c('A', 'HEARTS'), c('K', 'HEARTS'), c('Q', 'HEARTS')),  // best pure sequence
      hand(c('A', 'SPADES'), c('K', 'HEARTS'), c('Q', 'CLUBS')),   // best sequence
      hand(c('A', 'HEARTS'), c('K', 'HEARTS'), c('J', 'HEARTS')),  // best colour
      hand(c('A', 'SPADES'), c('A', 'HEARTS'), c('K', 'CLUBS')),   // best pair
      hand(c('A', 'SPADES'), c('K', 'HEARTS'), c('J', 'CLUBS')),   // best high card
    ];
    for (let i = 0; i < ladder.length - 1; i++) {
      const cmp = compareThreeCardHands(
        classifyThreeCardHand(ladder[i]),
        classifyThreeCardHand(ladder[i + 1])
      );
      expect(cmp, `ladder position ${i} must beat ${i + 1}`).toBeGreaterThan(0);
    }
  });

  it('never uses suit as a tiebreaker - identical ranks compare exactly equal', () => {
    const a = classifyThreeCardHand(hand(c('K', 'SPADES'), c('9', 'HEARTS'), c('4', 'CLUBS')));
    const b = classifyThreeCardHand(hand(c('K', 'HEARTS'), c('9', 'CLUBS'), c('4', 'DIAMONDS')));
    expect(compareThreeCardHands(a, b)).toBe(0);
  });
});
