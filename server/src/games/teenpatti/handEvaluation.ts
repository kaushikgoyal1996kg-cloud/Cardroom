import type { Card, Rank } from '../../platform/cards/index.js';
import { createDeck, RANK_VALUE } from '../../platform/cards/index.js';
import {
  classifyThreeCardHand,
  compareThreeCardHands,
  describeThreeCardHand,
  type ThreeCardHandValue,
} from '../../platform/cards/threeCardHand.js';
import {
  getTeenPattiVariant,
  teenPattiRoundJokerMode,
  type TeenPattiDiscardRule,
  type TeenPattiRoundVariantConfig,
  type TeenPattiTwoReferenceAssignment,
} from './rules.js';

export interface TeenPattiTargetResult {
  formedNumber: number;
  distance: number;
}

export interface TeenPattiEvaluatedHand {
  /** Every card physically dealt to the player this round. */
  dealtCards: Card[];
  /** The exact three cards used for ranking this hand. */
  selectedCards: Card[];
  /** Effective cards after joker substitution. Same as selectedCards when no joker applies. */
  effectiveCards: Card[];
  /** Physical dealt cards that acted as jokers for this evaluation. */
  wildCardIds: string[];
  value: ThreeCardHandValue;
  targetResult?: TeenPattiTargetResult;
  /** Physical dealt cards marked discarded by a retained 5-card round. */
  discardedCardIds?: string[];
  description: string;
}

const RANK_CYCLE: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function adjacentRank(rank: Rank, delta: -1 | 1): Rank {
  const index = RANK_CYCLE.indexOf(rank);
  return RANK_CYCLE[(index + delta + RANK_CYCLE.length) % RANK_CYCLE.length];
}

function referenceRank(referenceCards: Card[]): Rank {
  const reference = referenceCards[0];
  if (!reference) throw new Error('This Teen Patti joker variant needs a revealed reference card.');
  return reference.rank;
}

function wildIndexes(
  cards: Card[],
  config: TeenPattiRoundVariantConfig,
  referenceCards: Card[],
  twoReferenceAssignment?: TeenPattiTwoReferenceAssignment | null
): number[] {
  const descriptor = getTeenPattiVariant(config.variantId);
  const jokerMode = teenPattiRoundJokerMode(config);
  if (jokerMode === 'NONE') return [];

  if (jokerMode === 'PACK_RANK') {
    if (referenceCards.length === 0) throw new Error('This Teen Patti joker variant needs at least one revealed reference card.');
    const ranks = new Set(referenceCards.map((card) => card.rank));
    return cards.flatMap((card, index) => ranks.has(card.rank) ? [index] : []);
  }
  if (jokerMode === 'LOWEST_RANK') {
    const lowest = Math.min(...cards.map((card) => RANK_VALUE[card.rank]));
    return cards.flatMap((card, index) => RANK_VALUE[card.rank] === lowest ? [index] : []);
  }
  if (jokerMode === 'HIGHEST_RANK') {
    const highest = Math.max(...cards.map((card) => RANK_VALUE[card.rank]));
    return cards.flatMap((card, index) => RANK_VALUE[card.rank] === highest ? [index] : []);
  }
  if (jokerMode === 'AK47') {
    const ranks = new Set<Rank>(['A', 'K', '4', '7']);
    return cards.flatMap((card, index) => ranks.has(card.rank) ? [index] : []);
  }
  if (jokerMode === 'PAIRS') {
    const counts = new Map<Rank, number>();
    for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
    return cards.flatMap((card, index) => (counts.get(card.rank) ?? 0) >= 2 ? [index] : []);
  }
  if (jokerMode === 'NAMED_AND_LOWEST') {
    const namedRank = descriptor.fixedNamedRank;
    if (!namedRank) throw new Error(`${descriptor.name} needs a fixed named wild rank.`);
    const nonNamed = cards.filter((card) => card.rank !== namedRank);
    // K Little / Q Little / J Little are direct variants. The named rank is
    // already wild, and “Little” is the lowest remaining non-named rank in
    // this player's hand. If that rank is duplicated, every card of that rank
    // is wild. If all cards are the named rank there is no additional Little.
    const littleRankValue = nonNamed.length > 0
      ? Math.min(...nonNamed.map((card) => RANK_VALUE[card.rank]))
      : null;
    return cards.flatMap((card, index) => (
      card.rank === namedRank
      || (littleRankValue !== null && RANK_VALUE[card.rank] === littleRankValue)
        ? [index]
        : []
    ));
  }
  if (jokerMode === 'UP_DOWN_SAME' || jokerMode === 'UP_DOWN' || jokerMode === 'DOWN_ONLY') {
    const same = referenceRank(referenceCards);
    const up = adjacentRank(same, 1);
    const down = adjacentRank(same, -1);
    const ranks = jokerMode === 'UP_DOWN_SAME'
      ? new Set<Rank>([same, up, down])
      : jokerMode === 'UP_DOWN'
        ? new Set<Rank>([up, down])
        : new Set<Rank>([down]);
    return cards.flatMap((card, index) => ranks.has(card.rank) ? [index] : []);
  }
  if (jokerMode === 'TWO_REFERENCE') {
    if (referenceCards.length !== 2) throw new Error('Two-Reference Joker needs exactly two revealed reference cards.');
    if (!twoReferenceAssignment || (twoReferenceAssignment.upDownReferenceIndex !== 0 && twoReferenceAssignment.upDownReferenceIndex !== 1)) {
      throw new Error('Two-Reference Joker needs this player’s Up/Down reference assignment.');
    }
    const upDownRef = referenceCards[twoReferenceAssignment.upDownReferenceIndex];
    const sameRef = referenceCards[twoReferenceAssignment.upDownReferenceIndex === 0 ? 1 : 0];
    const ranks = new Set<Rank>([
      adjacentRank(upDownRef.rank, 1),
      adjacentRank(upDownRef.rank, -1),
      sameRef.rank,
    ]);
    return cards.flatMap((card, index) => ranks.has(card.rank) ? [index] : []);
  }

  throw new Error(`${descriptor.name} joker mode ${jokerMode} is not runtime-implemented yet.`);
}

function bestWildcardSubstitution(cards: Card[], wild: number[]): { cards: Card[]; value: ThreeCardHandValue } {
  if (wild.length === 0) {
    const copy = [...cards];
    return { cards: copy, value: classifyThreeCardHand(copy) };
  }

  /*
   * Card Room joker rule: a joker is fully wild. It may assume any legal
   * rank AND suit needed to make the strongest three-card hand. The
   * physical joker card is still tracked separately in wildCardIds, but its
   * printed rank/suit do not constrain its effective value.
   */
  const wildSet = new Set(wild);
  const fixedIds = new Set(cards.filter((_, index) => !wildSet.has(index)).map((card) => card.id));
  const candidates = createDeck().filter((card) => !fixedIds.has(card.id));
  let bestCards: Card[] | null = null;
  let bestValue: ThreeCardHandValue | null = null;
  const working = [...cards];
  const used = new Set<string>();

  const search = (depth: number) => {
    if (depth === wild.length) {
      const value = classifyThreeCardHand(working);
      if (!bestValue || compareThreeCardHands(value, bestValue) > 0) {
        bestValue = value;
        bestCards = working.map((card) => ({ ...card }));
      }
      return;
    }
    const targetIndex = wild[depth];
    for (const candidate of candidates) {
      if (used.has(candidate.id)) continue;
      used.add(candidate.id);
      working[targetIndex] = candidate;
      search(depth + 1);
      used.delete(candidate.id);
    }
  };

  search(0);
  if (!bestCards || !bestValue) throw new Error('Unable to evaluate Teen Patti joker hand.');
  return { cards: bestCards, value: bestValue };
}

function combinationsOfThree(cards: Card[]): Card[][] {
  const combinations: Card[][] = [];
  for (let a = 0; a < cards.length - 2; a++) {
    for (let b = a + 1; b < cards.length - 1; b++) {
      for (let c = b + 1; c < cards.length; c++) {
        combinations.push([cards[a], cards[b], cards[c]]);
      }
    }
  }
  return combinations;
}


function bestAssumedThird(actualCards: Card[]): { cards: Card[]; value: ThreeCardHandValue; assumed: Card } {
  if (actualCards.length !== 2) throw new Error('Assume the Third needs exactly two real cards.');
  const [first, second] = actualCards;
  const low = Math.min(RANK_VALUE[first.rank], RANK_VALUE[second.rank]);
  const high = Math.max(RANK_VALUE[first.rank], RANK_VALUE[second.rank]);
  const physicalIds = new Set(actualCards.map((card) => card.id));

  let best: { cards: Card[]; value: ThreeCardHandValue; assumed: Card } | null = null;
  for (const assumed of createDeck()) {
    if (physicalIds.has(assumed.id)) continue;
    const assumedValue = RANK_VALUE[assumed.rank];
    // Locked house rule: the assumed rank cannot lie strictly between the
    // two actual ranks. Equal to either endpoint is legal.
    if (assumedValue > low && assumedValue < high) continue;

    const candidateCards = [first, second, assumed];
    const value = classifyThreeCardHand(candidateCards);
    if (!best || compareThreeCardHands(value, best.value) > 0) {
      best = { cards: candidateCards.map((card) => ({ ...card })), value, assumed: { ...assumed } };
    }
  }

  if (!best) throw new Error('No legal assumed third card exists.');
  return best;
}

/**
 * Return every legal pair of physical card indexes that may be marked as
 * discarded under the locked 5-card rule. Rank determines what must go; suit
 * never breaks a rank tie, so equal-ranked physical cards remain a player's
 * choice. The indexes are intentionally opaque enough to send to a blind
 * client without revealing card identities.
 */
export function legalTeenPattiDiscardSelections(cards: Card[], rule: TeenPattiDiscardRule): number[][] {
  if (cards.length !== 5) throw new Error('A Teen Patti discard round requires exactly five dealt cards.');
  const rankValues = cards.map((card) => RANK_VALUE[card.rank]);
  const targetValues = [...rankValues].sort((a, b) => a - b);
  const expected = rule === 'TWO_LOWEST'
    ? targetValues.slice(0, 2)
    : rule === 'TWO_HIGHEST'
      ? targetValues.slice(-2)
      : [targetValues[0], targetValues[targetValues.length - 1]];
  expected.sort((a, b) => a - b);

  const legal: number[][] = [];
  for (let a = 0; a < cards.length; a++) {
    for (let b = a + 1; b < cards.length; b++) {
      const pair = [rankValues[a], rankValues[b]].sort((x, y) => x - y);
      if (pair[0] === expected[0] && pair[1] === expected[1]) legal.push([a, b]);
    }
  }
  if (legal.length === 0) throw new Error('Unable to determine a legal five-card discard selection.');
  return legal;
}

function sameIndexSelection(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((value, index) => value === right[index]);
}

function targetDigitOptions(card: Card): number[] {
  if (card.rank === 'A') return [0, 1];
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return [0];
  return [Number(card.rank)];
}

function permutationsOfThree(cards: Card[]): Card[][] {
  return [
    [cards[0], cards[1], cards[2]],
    [cards[0], cards[2], cards[1]],
    [cards[1], cards[0], cards[2]],
    [cards[1], cards[2], cards[0]],
    [cards[2], cards[0], cards[1]],
    [cards[2], cards[1], cards[0]],
  ];
}

function evaluateClosestToTarget(cards: Card[], config: TeenPattiRoundVariantConfig): { orderedCards: Card[]; result: TeenPattiTargetResult } {
  const target = config.targetNumber;
  if (!Number.isInteger(target) || target! < 100 || target! > 999 || typeof config.reorderTargetCards !== 'boolean') {
    throw new Error('Closest to N is missing its dealer-configured target or reorder rule.');
  }

  const orders = config.reorderTargetCards ? permutationsOfThree(cards) : [[...cards]];
  let best: { orderedCards: Card[]; result: TeenPattiTargetResult } | null = null;

  for (const orderedCards of orders) {
    const digitOptions = orderedCards.map(targetDigitOptions);
    for (const a of digitOptions[0]) {
      for (const b of digitOptions[1]) {
        for (const c of digitOptions[2]) {
          const formedNumber = a * 100 + b * 10 + c;
          const distance = Math.abs(target! - formedNumber);
          if (!best || distance < best.result.distance || (distance === best.result.distance && formedNumber < best.result.formedNumber)) {
            best = { orderedCards: [...orderedCards], result: { formedNumber, distance } };
          }
        }
      }
    }
  }

  if (!best) throw new Error('Unable to evaluate Closest to N.');
  return best;
}

/**
 * Compare two already-classified hands under the configured round ranking.
 * Positive means a wins, negative means b wins, zero means an exact tie.
 */
export function compareTeenPattiValues(
  a: ThreeCardHandValue,
  b: ThreeCardHandValue,
  config: TeenPattiRoundVariantConfig
): number {
  const descriptor = getTeenPattiVariant(config.variantId);
  const normal = compareThreeCardHands(a, b);
  if (descriptor.ranking === 'NORMAL') return normal;
  if (descriptor.ranking === 'LOWBALL') return -normal;
  throw new Error(`${descriptor.name} uses a non-hand-ranking evaluation that is not runtime-implemented yet.`);
}

/**
 * Evaluate a player's dealt cards for the exact round variant. This is kept
 * separate from the shared 3-card evaluator so Kitti's rules cannot drift when
 * Teen Patti adds variant-specific selection/ranking behaviour.
 */
export function evaluateTeenPattiHand(
  cards: Card[],
  config: TeenPattiRoundVariantConfig,
  referenceCards: Card[] = [],
  twoReferenceAssignment?: TeenPattiTwoReferenceAssignment | null,
  discardedCardIndices?: number[] | null
): TeenPattiEvaluatedHand {
  const descriptor = getTeenPattiVariant(config.variantId);
  if (!descriptor.runtimeImplemented) {
    throw new Error(`${descriptor.name} is not runtime-implemented yet.`);
  }
  if (cards.length !== descriptor.dealCount) {
    throw new Error(`${descriptor.name} expects ${descriptor.dealCount} dealt cards, got ${cards.length}.`);
  }

  if (descriptor.selection === 'DEALT_THREE') {
    const selectedCards = [...cards];
    const wild = wildIndexes(selectedCards, config, referenceCards, twoReferenceAssignment);
    const substituted = bestWildcardSubstitution(selectedCards, wild);
    const jokerSuffix = wild.length > 0 ? ` · ${wild.length} joker${wild.length === 1 ? '' : 's'}` : '';
    return {
      dealtCards: [...cards],
      selectedCards,
      effectiveCards: substituted.cards,
      wildCardIds: wild.map((index) => selectedCards[index].id),
      value: substituted.value,
      description: `${describeThreeCardHand(substituted.cards)}${jokerSuffix}`,
    };
  }

  if (descriptor.selection === 'DISCARD_TO_THREE') {
    if (!descriptor.discardRule) throw new Error(`${descriptor.name} is missing its discard rule.`);
    if (!discardedCardIndices || discardedCardIndices.length !== 2) {
      throw new Error(`${descriptor.name} needs the player's two locked discard choices before comparison.`);
    }
    const legalSelections = legalTeenPattiDiscardSelections(cards, descriptor.discardRule);
    if (!legalSelections.some((legal) => sameIndexSelection(legal, discardedCardIndices))) {
      throw new Error('Those cards do not satisfy this round’s mandatory discard rule.');
    }
    const discarded = new Set(discardedCardIndices);
    const selectedCards = cards.filter((_, index) => !discarded.has(index));
    if (selectedCards.length !== 3) throw new Error(`${descriptor.name} must leave exactly three active cards.`);
    const wild = wildIndexes(selectedCards, config, referenceCards, twoReferenceAssignment);
    const substituted = bestWildcardSubstitution(selectedCards, wild);
    const jokerSuffix = wild.length > 0 ? ` · ${wild.length} joker${wild.length === 1 ? '' : 's'}` : '';
    return {
      dealtCards: [...cards],
      selectedCards,
      effectiveCards: substituted.cards,
      wildCardIds: wild.map((index) => selectedCards[index].id),
      discardedCardIds: discardedCardIndices.map((index) => cards[index].id),
      value: substituted.value,
      description: `${describeThreeCardHand(substituted.cards)}${jokerSuffix} · 2 discarded`,
    };
  }

  if (descriptor.selection === 'TARGET_THREE') {
    const closest = evaluateClosestToTarget(cards, config);
    return {
      dealtCards: [...cards],
      selectedCards: [...closest.orderedCards],
      effectiveCards: [...closest.orderedCards],
      wildCardIds: [],
      value: classifyThreeCardHand(closest.orderedCards),
      targetResult: { ...closest.result },
      description: `Closest: ${String(closest.result.formedNumber).padStart(3, '0')} · target ${config.targetNumber} · distance ${closest.result.distance}`,
    };
  }

  if (descriptor.selection === 'ASSUMED_THIRD') {
    const best = bestAssumedThird(cards);
    return {
      dealtCards: [...cards],
      selectedCards: [...best.cards],
      effectiveCards: [...best.cards],
      wildCardIds: [],
      value: best.value,
      description: `Assume ${best.assumed.rank}${best.assumed.suit === 'SPADES' ? '♠' : best.assumed.suit === 'HEARTS' ? '♥' : best.assumed.suit === 'DIAMONDS' ? '♦' : '♣'} · ${describeThreeCardHand(best.cards)}`,
    };
  }

  if (descriptor.selection === 'BEST_THREE') {
    const candidates = combinationsOfThree(cards).map((selectedCards) => ({
      selectedCards,
      value: classifyThreeCardHand(selectedCards),
    }));
    if (candidates.length === 0) throw new Error(`${descriptor.name} cannot form a three-card hand.`);

    let best = candidates[0];
    for (const candidate of candidates.slice(1)) {
      if (compareTeenPattiValues(candidate.value, best.value, config) > 0) best = candidate;
    }

    return {
      dealtCards: [...cards],
      selectedCards: [...best.selectedCards],
      effectiveCards: [...best.selectedCards],
      wildCardIds: [],
      value: best.value,
      description: `Best 3: ${describeThreeCardHand(best.selectedCards)}`,
    };
  }

  throw new Error(`${descriptor.name} selection mode ${descriptor.selection} is not runtime-implemented yet.`);
}

export function compareTeenPattiEvaluatedHands(
  a: TeenPattiEvaluatedHand,
  b: TeenPattiEvaluatedHand,
  config: TeenPattiRoundVariantConfig
): number {
  const descriptor = getTeenPattiVariant(config.variantId);
  if (descriptor.ranking === 'CLOSEST_TO_N') {
    if (!a.targetResult || !b.targetResult) throw new Error('Closest to N comparison requires target results.');
    // Positive means A is better. Equal distance is an exact tie, so the
    // existing Teen Patti tie rules (sideshow initiator packs / final split)
    // apply without inventing a secondary numerical tiebreak.
    return b.targetResult.distance - a.targetResult.distance;
  }
  return compareTeenPattiValues(a.value, b.value, config);
}
