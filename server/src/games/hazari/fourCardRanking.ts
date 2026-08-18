import type { Card, ThreeCardHandValue } from './types.js';
import { classifyThreeCardHand, compareThreeCardHands } from './hands.js';

// ============================================================================
// FOUR-CARD SET RANKING - isolated module (Section 11 / 52.3).
//
// CONFIRMED methodology: the 4-card set's strength is the BEST 3-CARD TEEN
// PATTI COMBINATION found among any 3 of its 4 cards, using the exact same
// hierarchy as the three-card sets (Trail > Pure Sequence > Sequence >
// Color > Pair > High Card). The fourth card is excluded completely from
// strength/tiebreak comparison: Set 4 is literally the strongest 3-card hand
// available from its four cards.
//
// Because this reuses the 3-card hierarchy directly, a FourCardHandValue is
// shape-compatible with ThreeCardHandValue (category + tiebreakRanks) and can
// be compared with the same compareThreeCardHands() function.
//
// ORDERING RULE: Set 4 must not rank STRONGER than Set 3 in a player's
// arrangement (see arrangement.ts). Exact equality is valid.
//
// This file is still the single place to change if the 4-card methodology
// is ever revised - nothing outside this file needs to know how the score
// is derived, only how to compare it.
// ============================================================================

export type FourCardHandValue = ThreeCardHandValue & { label: string };

const CATEGORY_NAMES = ['High Card', 'Pair', 'Color', 'Sequence', 'Pure Sequence', 'Trail'];

/** All four ways to choose 3 of the 4 cards. */
function threeCardSubsets(cards: Card[]): Card[][] {
  return cards.map((_, i) => cards.filter((_, j) => j !== i));
}

export function classifyFourCardHand(cards: Card[]): FourCardHandValue {
  if (cards.length !== 4) {
    throw new Error(`classifyFourCardHand requires exactly 4 cards, got ${cards.length}`);
  }

  const candidates = threeCardSubsets(cards).map((subset) => classifyThreeCardHand(subset));

  // Pick the strongest 3-card sub-combination. If multiple subsets are
  // exactly equal, they remain equal: the unused fourth card never breaks
  // the tie.
  let best = candidates[0];
  for (const c of candidates.slice(1)) {
    if (compareThreeCardHands(c, best) > 0) best = c;
  }

  return {
    category: best.category,
    tiebreakRanks: best.tiebreakRanks,
    label: CATEGORY_NAMES[best.category],
  };
}

/** Compares two 4-card hands using the identical Teen Patti comparator.
 *  Positive = a wins, negative = b wins, 0 = tie (caller applies last-throw
 *  tie rule; suit is never a tiebreaker). */
export function compareFourCardHands(a: FourCardHandValue, b: FourCardHandValue): number {
  return compareThreeCardHands(a, b);
}

/** Does this 4-card set contain any Sequence/Pure Sequence among its
 *  3-card subsets? Trial/Trail is deliberately excluded: it is not a sequence
 *  for Hazari dismissal eligibility. */
export function fourCardSetHasRun(cards: Card[]): boolean {
  return threeCardSubsets(cards).some((subset) => {
    const value = classifyThreeCardHand(subset);
    return value.category === 3 || value.category === 4; // SEQUENCE / PURE_SEQUENCE
  });
}

export function validateFourCardSet(cards: Card[]): { valid: boolean; error?: string } {
  if (cards.length !== 4) return { valid: false, error: 'The fourth set must contain exactly 4 cards.' };
  const ids = new Set(cards.map((c) => c.id));
  if (ids.size !== 4) return { valid: false, error: 'Duplicate card in set.' };
  return { valid: true };
}
