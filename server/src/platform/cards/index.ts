// ============================================================================
// PLATFORM - Shared card model
//
// ISOLATION NOTE (important - read before editing):
// Hazari deliberately does NOT import from this module. Hazari keeps its own
// private copy of the card model and 3-card evaluator in games/hazari/, which
// is frozen and covered by 152 pre-existing tests. That duplication is
// intentional: it makes it structurally impossible for a change made for
// Kitti or Teen Patti to alter Hazari's scoring or hand comparison.
//
// Kitti and Teen Patti DO share this module, because both were written
// against the same owner-confirmed sequence hierarchy and there is no tested
// legacy behaviour to protect.
// ============================================================================

export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';

export type Rank =
  | 'A' | 'K' | 'Q' | 'J' | '10'
  | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  suit: Suit;
  rank: Rank;
  /** Stable unique id, e.g. "SPADES_A" */
  id: string;
}

export const SUITS: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];

export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

export const RANK_VALUE: Record<Rank, number> = {
  A: 14, K: 13, Q: 12, J: 11, '10': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${suit}_${rank}` });
    }
  }
  if (deck.length !== 52) {
    throw new Error(`Deck invariant failed: expected 52 cards, got ${deck.length}`);
  }
  return deck;
}

function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 4294967296;
}

/** Fisher-Yates using a cryptographically secure source. Server-side only. */
export function shuffleDeck(deck: Card[], rng: () => number = secureRandom): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deals `cardsEach` to each player in the supplied seating order, one card at
 * a time round the table (not in blocks) - matching how a real dealer deals,
 * which also makes the client dealing animation honest.
 */
export function dealCards(
  deck: Card[],
  seatingOrder: string[],
  cardsEach: number
): { hands: Record<string, Card[]>; remaining: Card[] } {
  const needed = seatingOrder.length * cardsEach;
  if (deck.length < needed) {
    throw new Error(`Not enough cards: need ${needed}, deck has ${deck.length}`);
  }
  const hands: Record<string, Card[]> = {};
  for (const pid of seatingOrder) hands[pid] = [];
  let idx = 0;
  for (let round = 0; round < cardsEach; round++) {
    for (const pid of seatingOrder) {
      hands[pid].push(deck[idx++]);
    }
  }
  return { hands, remaining: deck.slice(idx) };
}

/** Clockwise seating order starting from the player immediately after the dealer. */
export function seatingOrderFromDealer(playersClockwise: string[], dealerId: string): string[] {
  const idx = playersClockwise.indexOf(dealerId);
  if (idx === -1) throw new Error(`Dealer ${dealerId} not found in player list`);
  return [
    ...playersClockwise.slice(idx + 1),
    ...playersClockwise.slice(0, idx + 1),
  ];
}

export function rotateClockwise(playersClockwise: string[], currentId: string): string {
  const idx = playersClockwise.indexOf(currentId);
  if (idx === -1) throw new Error(`${currentId} not found in player list`);
  return playersClockwise[(idx + 1) % playersClockwise.length];
}
