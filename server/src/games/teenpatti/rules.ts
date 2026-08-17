// ============================================================================
// TEEN PATTI - Authoritative house rules and variant descriptors
//
// Source of truth: RULES_TEEN_PATTI.md.
// All currency here is PLAY MONEY only. There is no deposit, withdrawal,
// purchase, cash-out or payment path anywhere in this project.
// ============================================================================

import type { Rank } from '../../platform/cards/index.js';

export interface TeenPattiRulesConfig {
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  CLASSIC_CARDS_PER_PLAYER: number;
  DEAL_DIRECTION: 'CLOCKWISE';
  INITIAL_DEALER: 'HIGH_CARD_ACE_HIGH_REDRAW_TIES';
  NEXT_DEALER: 'PREVIOUS_ROUND_WINNER';
  MAX_BLIND_TURNS: 3;
  SEEN_MULTIPLIER: 2;
  COMPULSORY_SIDESHOW: true;
  SIDESHOW_DIRECTION: 'ANTICLOCKWISE';
  SIDESHOW_TIE: 'INITIATOR_PACKS';
  FINAL_EQUAL_HANDS: 'SPLIT_POT';
  REAL_MONEY: false;
}

export const TEEN_PATTI_RULES: TeenPattiRulesConfig = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 9,
  CLASSIC_CARDS_PER_PLAYER: 3,
  DEAL_DIRECTION: 'CLOCKWISE',
  INITIAL_DEALER: 'HIGH_CARD_ACE_HIGH_REDRAW_TIES',
  NEXT_DEALER: 'PREVIOUS_ROUND_WINNER',
  MAX_BLIND_TURNS: 3,
  SEEN_MULTIPLIER: 2,
  COMPULSORY_SIDESHOW: true,
  SIDESHOW_DIRECTION: 'ANTICLOCKWISE',
  SIDESHOW_TIE: 'INITIATOR_PACKS',
  FINAL_EQUAL_HANDS: 'SPLIT_POT',
  REAL_MONEY: false,
};

/** Host-configured PLAY-MONEY table settings. Values are defaults only. */
export interface TeenPattiTableConfig {
  startingBalance: number;
  bootAmount: number;
  baseBlind: number;
  maxBlind: number;
}

export const DEFAULT_TEEN_PATTI_TABLE_CONFIG: TeenPattiTableConfig = {
  startingBalance: 1000,
  bootAmount: 10,
  baseBlind: 10,
  maxBlind: 60,
};

export function validateTeenPattiTableConfig(config: TeenPattiTableConfig): void {
  const fields: [keyof TeenPattiTableConfig, number][] = [
    ['startingBalance', config.startingBalance],
    ['bootAmount', config.bootAmount],
    ['baseBlind', config.baseBlind],
    ['maxBlind', config.maxBlind],
  ];
  for (const [name, value] of fields) {
    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
      throw new Error(`${name} must be a positive whole-number play-money amount.`);
    }
  }
  if (config.maxBlind < config.baseBlind) {
    throw new Error('maxBlind cannot be lower than baseBlind.');
  }
  if (config.startingBalance < config.bootAmount) {
    throw new Error('startingBalance must cover at least the first boot.');
  }
}

/** Fixed doubling progression, capped at the host-defined maximum. */
export function nextBlindAmount(currentBlind: number, maxBlind: number): number {
  return Math.min(maxBlind, currentBlind * 2);
}

// ---------------------------------------------------------------------------
// Data-driven variant framework
// ---------------------------------------------------------------------------

export type TeenPattiVariantId =
  | 'CLASSIC'
  | 'MUFLIS'
  | 'BEST_OF_FOUR'
  | 'STANDARD_JOKER'
  | 'LOWEST_CARD_JOKER'
  | 'HIGHEST_CARD_JOKER'
  | 'AK47'
  | 'PAIRS_ARE_JOKERS'
  | 'NAMED_RANK_LITTLE'
  | 'RANDOM_PACK_JOKER'
  | 'UP_DOWN_SAME'
  | 'UP_DOWN'
  | 'DOWN_ONLY'
  | 'TWO_REFERENCE_JOKER'
  | 'DISCARD_LOW_HIGH'
  | 'DISCARD_TWO_LOWEST'
  | 'DISCARD_TWO_HIGHEST'
  | 'ASSUMED_THIRD'
  | 'CLOSEST_TO_N';

export type RankingMode = 'NORMAL' | 'LOWBALL' | 'CLOSEST_TO_N';
export type SelectionMode = 'DEALT_THREE' | 'BEST_THREE' | 'DISCARD_TO_THREE' | 'ASSUMED_THIRD' | 'TARGET_THREE';
export type JokerMode =
  | 'NONE'
  | 'PACK_RANK'
  | 'LOWEST_RANK'
  | 'HIGHEST_RANK'
  | 'AK47'
  | 'PAIRS'
  | 'NAMED_AND_LOWEST'
  | 'UP_DOWN_SAME'
  | 'UP_DOWN'
  | 'DOWN_ONLY'
  | 'TWO_REFERENCE';

export interface TeenPattiVariantDescriptor {
  id: TeenPattiVariantId;
  name: string;
  dealCount: number;
  ranking: RankingMode;
  selection: SelectionMode;
  joker: JokerMode;
  discardRule?: 'LOWEST_AND_HIGHEST' | 'TWO_LOWEST' | 'TWO_HIGHEST';
  requiresNamedRank?: boolean;
  requiresTargetNumber?: boolean;
  allowsTargetReorderChoice?: boolean;
  requiresTwoReferenceAssignment?: boolean;
  /** Runtime support is deliberately explicit; never silently fall back to Classic. */
  runtimeImplemented: boolean;
  howToPlay: string;
}

export interface TeenPattiRoundVariantConfig {
  variantId: TeenPattiVariantId;
  namedRank?: Rank;
  targetNumber?: number;
  reorderTargetCards?: boolean;
}

export const TEEN_PATTI_VARIANTS: Record<TeenPattiVariantId, TeenPattiVariantDescriptor> = {
  CLASSIC: {
    id: 'CLASSIC', name: 'Classic', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'NONE',
    runtimeImplemented: true,
    howToPlay: 'Three cards each. Normal Teen Patti ranking. Blind, seen, pack, compulsory sideshow and final show rules apply.',
  },
  MUFLIS: {
    id: 'MUFLIS', name: 'Muflis / Lowball', dealCount: 3, ranking: 'LOWBALL', selection: 'DEALT_THREE', joker: 'NONE',
    runtimeImplemented: false,
    howToPlay: 'Normal Teen Patti ranking is completely reversed: the weakest normal hand wins. 2-3-5 has no special status.',
  },
  BEST_OF_FOUR: {
    id: 'BEST_OF_FOUR', name: 'Best of Four', dealCount: 4, ranking: 'NORMAL', selection: 'BEST_THREE', joker: 'NONE',
    runtimeImplemented: false,
    howToPlay: 'Four cards are dealt. The strongest three-card combination is evaluated automatically.',
  },
  STANDARD_JOKER: {
    id: 'STANDARD_JOKER', name: 'Standard Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'PACK_RANK',
    runtimeImplemented: false,
    howToPlay: 'One undealt reference card is revealed; every card of that rank is wild.',
  },
  LOWEST_CARD_JOKER: {
    id: 'LOWEST_CARD_JOKER', name: 'Lowest Card Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'LOWEST_RANK',
    runtimeImplemented: false,
    howToPlay: 'Your lowest-ranked card is wild. If your lowest rank is a pair, both cards are wild.',
  },
  HIGHEST_CARD_JOKER: {
    id: 'HIGHEST_CARD_JOKER', name: 'Highest Card Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'HIGHEST_RANK',
    runtimeImplemented: false,
    howToPlay: 'Your highest-ranked card is wild. If your highest rank is a pair, both cards are wild.',
  },
  AK47: {
    id: 'AK47', name: 'AK47', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'AK47',
    runtimeImplemented: false,
    howToPlay: 'Aces, Kings, 4s and 7s are wild.',
  },
  PAIRS_ARE_JOKERS: {
    id: 'PAIRS_ARE_JOKERS', name: 'Pairs Are Jokers', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'PAIRS',
    runtimeImplemented: false,
    howToPlay: 'If the dealt cards contain a pair, both cards of that rank are wild.',
  },
  NAMED_RANK_LITTLE: {
    id: 'NAMED_RANK_LITTLE', name: 'Named Rank + Little', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'NAMED_AND_LOWEST',
    requiresNamedRank: true, runtimeImplemented: false,
    howToPlay: 'The dealer names a rank as wild; each player’s lowest card is also wild.',
  },
  RANDOM_PACK_JOKER: {
    id: 'RANDOM_PACK_JOKER', name: 'Random-Pack Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'PACK_RANK',
    runtimeImplemented: false,
    howToPlay: 'One undealt card is revealed at random; every card of that rank is wild.',
  },
  UP_DOWN_SAME: {
    id: 'UP_DOWN_SAME', name: 'Up–Down–Same', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'UP_DOWN_SAME',
    runtimeImplemented: false,
    howToPlay: 'A reference rank, the rank immediately above it and the rank immediately below it are wild, with wraparound.',
  },
  UP_DOWN: {
    id: 'UP_DOWN', name: 'Up–Down', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'UP_DOWN',
    runtimeImplemented: false,
    howToPlay: 'The ranks immediately above and below the revealed reference are wild; the reference rank itself is not.',
  },
  DOWN_ONLY: {
    id: 'DOWN_ONLY', name: 'Down Only', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'DOWN_ONLY',
    runtimeImplemented: false,
    howToPlay: 'Only the rank immediately below the revealed reference is wild, with wraparound.',
  },
  TWO_REFERENCE_JOKER: {
    id: 'TWO_REFERENCE_JOKER', name: 'Two-Reference Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'TWO_REFERENCE',
    requiresTwoReferenceAssignment: true, runtimeImplemented: false,
    howToPlay: 'Two reference cards are revealed. Each player assigns one to Up/Down and the other to Same-rank; the two roles cannot be duplicated.',
  },
  DISCARD_LOW_HIGH: {
    id: 'DISCARD_LOW_HIGH', name: '5 Cards · Discard Low + High', dealCount: 5, ranking: 'NORMAL', selection: 'DISCARD_TO_THREE', joker: 'NONE',
    discardRule: 'LOWEST_AND_HIGHEST', runtimeImplemented: false,
    howToPlay: 'Five cards are dealt. Discard one lowest and one highest card, then evaluate the remaining three.',
  },
  DISCARD_TWO_LOWEST: {
    id: 'DISCARD_TWO_LOWEST', name: '5 Cards · Discard Two Lowest', dealCount: 5, ranking: 'NORMAL', selection: 'DISCARD_TO_THREE', joker: 'NONE',
    discardRule: 'TWO_LOWEST', runtimeImplemented: false,
    howToPlay: 'Five cards are dealt. Discard the two lowest cards and evaluate the remaining three.',
  },
  DISCARD_TWO_HIGHEST: {
    id: 'DISCARD_TWO_HIGHEST', name: '5 Cards · Discard Two Highest', dealCount: 5, ranking: 'NORMAL', selection: 'DISCARD_TO_THREE', joker: 'NONE',
    discardRule: 'TWO_HIGHEST', runtimeImplemented: false,
    howToPlay: 'Five cards are dealt. Discard the two highest cards and evaluate the remaining three.',
  },
  ASSUMED_THIRD: {
    id: 'ASSUMED_THIRD', name: '2 Cards · Assume the Third', dealCount: 2, ranking: 'NORMAL', selection: 'ASSUMED_THIRD', joker: 'NONE',
    runtimeImplemented: false,
    howToPlay: 'Two real cards are dealt. Assume any third rank and suit except a rank strictly between the two actual ranks.',
  },
  CLOSEST_TO_N: {
    id: 'CLOSEST_TO_N', name: 'Closest to N', dealCount: 3, ranking: 'CLOSEST_TO_N', selection: 'TARGET_THREE', joker: 'NONE',
    requiresTargetNumber: true, allowsTargetReorderChoice: true, runtimeImplemented: false,
    howToPlay: 'Form a three-digit number closest to the dealer’s target. 2–9 keep face value; 10/J/Q/K are 0; Ace is 0 or 1. Reordering is declared before the deal.',
  },
};

export function getTeenPattiVariant(id: TeenPattiVariantId): TeenPattiVariantDescriptor {
  return TEEN_PATTI_VARIANTS[id];
}
