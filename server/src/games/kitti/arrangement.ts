import type { Card } from '../../platform/cards/index.js';
import { classifyThreeCardHand, compareThreeCardHands, type ThreeCardHandValue } from '../../platform/cards/threeCardHand.js';
import type { KittiGroups } from './engine.js';
import { validateKittiArrangement } from './engine.js';
import { KITTI_RULES } from './rules.js';

interface Candidate {
  groups: KittiGroups;
  values: [ThreeCardHandValue, ThreeCardHandValue, ThreeCardHandValue];
}

function chooseThree(cards: Card[]): Card[][] {
  const out: Card[][] = [];
  for (let a = 0; a < cards.length - 2; a++) {
    for (let b = a + 1; b < cards.length - 1; b++) {
      for (let c = b + 1; c < cards.length; c++) {
        out.push([cards[a], cards[b], cards[c]]);
      }
    }
  }
  return out;
}

function without(cards: Card[], chosen: Card[]): Card[] {
  const ids = new Set(chosen.map((card) => card.id));
  return cards.filter((card) => !ids.has(card.id));
}

/**
 * Compares two already-valid Kitti arrangements strongest hand first, then
 * middle, then weakest. Positive means `a` is the stronger recommendation.
 *
 * This is intentionally based ONLY on the player's own nine cards. It does
 * not attempt to model or inspect any opponent hand.
 */
function compareCandidates(a: Candidate, b: Candidate): number {
  for (let i = 0; i < 3; i++) {
    const cmp = compareThreeCardHands(a.values[i], b.values[i]);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

/**
 * Finds a valid strict Hand 1 > Hand 2 > Hand 3 partition for a Kitti hand.
 * Among valid partitions it prefers the strongest Hand 1, then strongest
 * Hand 2, then strongest Hand 3. At nine cards this is at most 1,680
 * partitions, small enough to evaluate synchronously on the authoritative
 * server.
 *
 * GAME INTEGRITY: callers must enforce the "bots-only opponents" gate before
 * invoking this for a human player. Bots use the same helper for their own
 * private hand.
 */
export function suggestKittiArrangement(hand: Card[]): KittiGroups {
  if (hand.length !== KITTI_RULES.CARDS_PER_PLAYER) {
    throw new Error(`Kitti suggestion requires exactly ${KITTI_RULES.CARDS_PER_PLAYER} cards.`);
  }
  if (new Set(hand.map((card) => card.id)).size !== hand.length) {
    throw new Error('Kitti suggestion received duplicate cards.');
  }

  let best: Candidate | null = null;

  for (const first of chooseThree(hand)) {
    const remainingSix = without(hand, first);
    const firstValue = classifyThreeCardHand(first);

    for (const second of chooseThree(remainingSix)) {
      const third = without(remainingSix, second);
      const secondValue = classifyThreeCardHand(second);
      const thirdValue = classifyThreeCardHand(third);

      if (compareThreeCardHands(firstValue, secondValue) <= 0) continue;
      if (compareThreeCardHands(secondValue, thirdValue) <= 0) continue;

      const groups = [first, second, third] as KittiGroups;
      // Keep the engine validator as the final authority. This also protects
      // this helper if Kitti's structural validation evolves later.
      if (!validateKittiArrangement(hand, groups).valid) continue;

      const candidate: Candidate = {
        groups,
        values: [firstValue, secondValue, thirdValue],
      };
      if (!best || compareCandidates(candidate, best) > 0) best = candidate;
    }
  }

  if (!best) {
    throw new Error('No strictly strongest-to-weakest Kitti arrangement could be found for this hand.');
  }

  return best.groups.map((group) => [...group]) as KittiGroups;
}
