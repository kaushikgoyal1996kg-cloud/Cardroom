// ============================================================================
// PLATFORM - Three-card (Teen Patti style) hand evaluation
//
// Shared by Kitti and Teen Patti ONLY. Hazari has its own private copy.
// See platform/cards/index.ts for why that duplication is deliberate.
//
// OWNER-CONFIRMED SEQUENCE HIERARCHY (identical to Hazari's, which the owner
// confirmed independently for Kitti):
//   A-K-Q  (strongest)
//   A-2-3  (second)
//   K-Q-J, Q-J-10, J-10-9, 10-9-8, 9-8-7, 8-7-6, 7-6-5, 6-5-4, 5-4-3, 4-3-2
//
// A-2-3 is represented as 13.5 so plain numeric comparison places it strictly
// between K-Q-J (13) and A-K-Q (14) without needing a separate category.
// ============================================================================

import type { Card } from './index.js';
import { RANK_VALUE } from './index.js';

/** Weakest (0) to strongest (5). */
export enum ThreeCardCategory {
  HIGH_CARD = 0,
  PAIR = 1,
  COLOR = 2,         // Flush
  SEQUENCE = 3,      // Straight, mixed suits ("run")
  PURE_SEQUENCE = 4, // Straight flush
  TRAIL = 5,         // Three of a kind
}

export const CATEGORY_NAMES: Record<ThreeCardCategory, string> = {
  [ThreeCardCategory.HIGH_CARD]: 'High Card',
  [ThreeCardCategory.PAIR]: 'Pair',
  [ThreeCardCategory.COLOR]: 'Colour',
  [ThreeCardCategory.SEQUENCE]: 'Sequence',
  [ThreeCardCategory.PURE_SEQUENCE]: 'Pure Sequence',
  [ThreeCardCategory.TRAIL]: 'Trail',
};

export interface ThreeCardHandValue {
  category: ThreeCardCategory;
  /** Most significant first. Used only for tie-breaks WITHIN a category. */
  tiebreakRanks: number[];
  label: string;
}

function sortedValues(cards: Card[]): number[] {
  return cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
}

function isSameSuit(cards: Card[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit);
}

/**
 * Returns the comparison value of a 3-card run, or null if not a run.
 * A-K-Q -> 14, A-2-3 -> 13.5, K-Q-J -> 13, ... 4-3-2 -> 4.
 */
export function threeCardRunHighValue(cards: Card[]): number | null {
  const [a, b, c] = sortedValues(cards);
  if (a === b || b === c) return null; // pairs/trails are not runs
  if (a - b === 1 && b - c === 1) return a;
  // Ace-low A-2-3 sorts descending as [14, 3, 2].
  if (a === 14 && b === 3 && c === 2) return 13.5;
  return null;
}

export function classifyThreeCardHand(cards: Card[]): ThreeCardHandValue {
  if (cards.length !== 3) {
    throw new Error(`classifyThreeCardHand requires exactly 3 cards, got ${cards.length}`);
  }
  const ids = new Set(cards.map((c) => c.id));
  if (ids.size !== 3) throw new Error('Duplicate card passed to classifyThreeCardHand');

  const [a, b, c] = sortedValues(cards);
  const sameSuit = isSameSuit(cards);
  const runHigh = threeCardRunHighValue(cards);

  const make = (category: ThreeCardCategory, tiebreakRanks: number[]): ThreeCardHandValue => ({
    category,
    tiebreakRanks,
    label: CATEGORY_NAMES[category],
  });

  if (a === b && b === c) return make(ThreeCardCategory.TRAIL, [a]);
  if (runHigh !== null && sameSuit) return make(ThreeCardCategory.PURE_SEQUENCE, [runHigh]);
  if (runHigh !== null) return make(ThreeCardCategory.SEQUENCE, [runHigh]);
  if (sameSuit) return make(ThreeCardCategory.COLOR, [a, b, c]);
  if (a === b || b === c) {
    const pairValue = a === b ? a : b;
    const kicker = a === b ? c : a;
    return make(ThreeCardCategory.PAIR, [pairValue, kicker]);
  }
  return make(ThreeCardCategory.HIGH_CARD, [a, b, c]);
}

/**
 * Positive if a > b, negative if a < b, 0 if EXACTLY equal strength.
 * Suit is NEVER used as a tiebreaker - callers must resolve a 0 themselves.
 */
export function compareThreeCardHands(a: ThreeCardHandValue, b: ThreeCardHandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreakRanks.length, b.tiebreakRanks.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakRanks[i] ?? 0;
    const bv = b.tiebreakRanks[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** Full descriptive label, e.g. "Pure Sequence, A-K-Q" - for round summaries. */
export function describeThreeCardHand(cards: Card[]): string {
  const value = classifyThreeCardHand(cards);
  const ranks = [...cards]
    .sort((x, y) => RANK_VALUE[y.rank] - RANK_VALUE[x.rank])
    .map((c) => c.rank)
    .join('-');
  return `${value.label}, ${ranks}`;
}
