import type { Card, Rank } from '../../platform/cards/index.js';
import { getPokerVariant, type PokerVariantId } from './rules.js';

export type PokerHandCategory =
  | 'HIGH_CARD'
  | 'PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_FLUSH';

export interface PokerHandValue {
  category: PokerHandCategory;
  /** Variant-aware category strength; larger is stronger. */
  categoryStrength: number;
  /** Lexicographic tie breakers, highest significance first. */
  tiebreak: number[];
  cards: Card[];
}

const RANK: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

function categoryOrder(variantId: PokerVariantId): Record<PokerHandCategory, number> {
  const short = getPokerVariant(variantId).flushBeatsFullHouse;
  return short
    ? {
        HIGH_CARD: 0,
        PAIR: 1,
        TWO_PAIR: 2,
        THREE_OF_A_KIND: 3,
        STRAIGHT: 4,
        FULL_HOUSE: 5,
        FLUSH: 6,
        FOUR_OF_A_KIND: 7,
        STRAIGHT_FLUSH: 8,
      }
    : {
        HIGH_CARD: 0,
        PAIR: 1,
        TWO_PAIR: 2,
        THREE_OF_A_KIND: 3,
        STRAIGHT: 4,
        FLUSH: 5,
        FULL_HOUSE: 6,
        FOUR_OF_A_KIND: 7,
        STRAIGHT_FLUSH: 8,
      };
}

function straightHigh(values: number[], variantId: PokerVariantId): number | null {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length !== 5) return null;
  if (unique.every((value, index) => index === 0 || unique[index - 1] - value === 1)) return unique[0];
  if (getPokerVariant(variantId).lowStraight === 'A6789') {
    return unique.join(',') === '14,9,8,7,6' ? 9 : null;
  }
  return unique.join(',') === '14,5,4,3,2' ? 5 : null;
}

export function classifyFiveCardHand(cards: Card[], variantId: PokerVariantId): PokerHandValue {
  if (cards.length !== 5) throw new Error(`Poker hand evaluation needs exactly 5 cards, got ${cards.length}.`);
  const values = cards.map((card) => RANK[card.rank]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straight = straightHigh(values, variantId);
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const order = categoryOrder(variantId);

  let category: PokerHandCategory;
  let tiebreak: number[];

  if (flush && straight !== null) {
    category = 'STRAIGHT_FLUSH';
    tiebreak = [straight];
  } else if (groups[0][1] === 4) {
    category = 'FOUR_OF_A_KIND';
    tiebreak = [groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    category = 'FULL_HOUSE';
    tiebreak = [groups[0][0], groups[1][0]];
  } else if (flush) {
    category = 'FLUSH';
    tiebreak = [...values].sort((a, b) => b - a);
  } else if (straight !== null) {
    category = 'STRAIGHT';
    tiebreak = [straight];
  } else if (groups[0][1] === 3) {
    category = 'THREE_OF_A_KIND';
    tiebreak = [groups[0][0], ...groups.slice(1).map(([value]) => value).sort((a, b) => b - a)];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    category = 'TWO_PAIR';
    tiebreak = [...pairs, groups[2][0]];
  } else if (groups[0][1] === 2) {
    category = 'PAIR';
    tiebreak = [groups[0][0], ...groups.slice(1).map(([value]) => value).sort((a, b) => b - a)];
  } else {
    category = 'HIGH_CARD';
    tiebreak = [...values].sort((a, b) => b - a);
  }

  return { category, categoryStrength: order[category], tiebreak, cards: [...cards] };
}

export function comparePokerHandValues(a: PokerHandValue, b: PokerHandValue): number {
  if (a.categoryStrength !== b.categoryStrength) return a.categoryStrength > b.categoryStrength ? 1 : -1;
  const n = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < n; i += 1) {
    const av = a.tiebreak[i] ?? -1;
    const bv = b.tiebreak[i] ?? -1;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

function combinations<T>(items: T[], choose: number): T[][] {
  const out: T[][] = [];
  function visit(start: number, picked: T[]) {
    if (picked.length === choose) {
      out.push([...picked]);
      return;
    }
    for (let i = start; i <= items.length - (choose - picked.length); i += 1) {
      picked.push(items[i]);
      visit(i + 1, picked);
      picked.pop();
    }
  }
  visit(0, []);
  return out;
}

export function bestPokerHand(hole: Card[], board: Card[], variantId: PokerVariantId): PokerHandValue {
  const variant = getPokerVariant(variantId);
  if (hole.length !== variant.holeCards) throw new Error(`${variant.name} needs ${variant.holeCards} hole cards.`);
  if (board.length !== 5) throw new Error('Showdown evaluation needs all 5 community cards.');

  let candidates: Card[][];
  if (variant.exactHoleCardsToUse === 2) {
    candidates = combinations(hole, 2).flatMap((holePart) => combinations(board, 3).map((boardPart) => [...holePart, ...boardPart]));
  } else {
    candidates = combinations([...hole, ...board], 5);
  }

  let best: PokerHandValue | null = null;
  for (const cards of candidates) {
    const value = classifyFiveCardHand(cards, variantId);
    if (!best || comparePokerHandValues(value, best) > 0) best = value;
  }
  if (!best) throw new Error('No legal poker hand could be evaluated.');
  return best;
}
