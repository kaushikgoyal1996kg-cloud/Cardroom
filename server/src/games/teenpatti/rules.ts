// ============================================================================
// TEEN PATTI - Authoritative house rules and variant descriptors
//
// Source of truth: RULES_TEEN_PATTI.md.
// All currency here is PLAY MONEY only. There is no deposit, withdrawal,
// purchase, cash-out or payment path anywhere in this project.
// ============================================================================

import { type Rank } from '../../platform/cards/index.js';

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
  /** Private-table social layer. Never changes hand ranking or betting rules. */
  friendlyAssist?: boolean;
}

export const DEFAULT_TEEN_PATTI_TABLE_CONFIG: TeenPattiTableConfig = {
  startingBalance: 1000,
  bootAmount: 10,
  baseBlind: 10,
  maxBlind: 60,
  friendlyAssist: false,
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
  if (config.friendlyAssist !== undefined && typeof config.friendlyAssist !== 'boolean') {
    throw new Error('friendlyAssist must be true or false.');
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
  | 'K_LITTLE'
  | 'Q_LITTLE'
  | 'J_LITTLE'
  | 'RANDOM_PACK_JOKER'
  | 'REVOLVING_JOKER'
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

/** Joker systems the dealer may combine with an approved 5-card discard round.
 * Revolving Joker is intentionally excluded: the packed-hand replacement rule
 * is defined for a normal 3-card hand and has not been extended to retained
 * 5-card hands. K Little / Q Little / J Little are normal 3-card joker variants;
 * they are intentionally not offered as 5-card add-ons until the discard/joker-order
 * semantics are separately locked.
 */
export type TeenPattiFiveCardJokerId =
  | 'NONE'
  | 'STANDARD_JOKER'
  | 'RANDOM_PACK_JOKER'
  | 'LOWEST_CARD_JOKER'
  | 'HIGHEST_CARD_JOKER'
  | 'AK47'
  | 'PAIRS_ARE_JOKERS'
  | 'UP_DOWN_SAME'
  | 'UP_DOWN'
  | 'DOWN_ONLY'
  | 'TWO_REFERENCE_JOKER';

export const TEEN_PATTI_FIVE_CARD_JOKERS: TeenPattiFiveCardJokerId[] = [
  'NONE',
  'STANDARD_JOKER',
  'RANDOM_PACK_JOKER',
  'LOWEST_CARD_JOKER',
  'HIGHEST_CARD_JOKER',
  'AK47',
  'PAIRS_ARE_JOKERS',
  'UP_DOWN_SAME',
  'UP_DOWN',
  'DOWN_ONLY',
  'TWO_REFERENCE_JOKER',
];
export type SelectionMode = 'DEALT_THREE' | 'BEST_THREE' | 'DISCARD_TO_THREE' | 'ASSUMED_THIRD' | 'TARGET_THREE';
export type TeenPattiDiscardRule = 'LOWEST_AND_HIGHEST' | 'TWO_LOWEST' | 'TWO_HIGHEST';
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
  discardRule?: TeenPattiDiscardRule;
  /** Fixed named joker rank for K/Q/J Little variants; no second dealer configuration step. */
  fixedNamedRank?: Rank;
  requiresTargetNumber?: boolean;
  allowsTargetReorderChoice?: boolean;
  requiresTwoReferenceAssignment?: boolean;
  /** Runtime support is deliberately explicit; never silently fall back to Classic. */
  runtimeImplemented: boolean;
  howToPlay: string;
}

export interface TeenPattiRoundVariantConfig {
  variantId: TeenPattiVariantId;
  targetNumber?: number;
  reorderTargetCards?: boolean;
  /** Explicit dealer choice for 5-card discard rounds. NONE is a deliberate choice. */
  fiveCardJoker?: TeenPattiFiveCardJokerId;
}

/** Per-player private role choice for the Two-Reference Joker. */
export interface TeenPattiTwoReferenceAssignment {
  /** 0 = first board reference supplies Up/Down; 1 = second board reference supplies Up/Down. */
  upDownReferenceIndex: 0 | 1;
}

export const TEEN_PATTI_VARIANTS: Record<TeenPattiVariantId, TeenPattiVariantDescriptor> = {
  CLASSIC: {
    id: 'CLASSIC', name: 'Classic', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'NONE',
    runtimeImplemented: true,
    howToPlay: 'Three cards each. Normal Teen Patti ranking. Blind, seen, pack, compulsory sideshow and final show rules apply.',
  },
  MUFLIS: {
    id: 'MUFLIS', name: 'Muflis / Lowball', dealCount: 3, ranking: 'LOWBALL', selection: 'DEALT_THREE', joker: 'NONE',
    runtimeImplemented: true,
    howToPlay: 'Normal Teen Patti ranking is completely reversed: the weakest normal hand wins. 2-3-5 has no special status.',
  },
  BEST_OF_FOUR: {
    id: 'BEST_OF_FOUR', name: 'Best of Four', dealCount: 4, ranking: 'NORMAL', selection: 'BEST_THREE', joker: 'NONE',
    runtimeImplemented: true,
    howToPlay: 'Four cards are dealt. The strongest three-card combination is evaluated automatically.',
  },
  STANDARD_JOKER: {
    id: 'STANDARD_JOKER', name: 'Standard Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'PACK_RANK',
    runtimeImplemented: true,
    howToPlay: 'One undealt reference card is revealed; every card of that rank is wild.',
  },
  LOWEST_CARD_JOKER: {
    id: 'LOWEST_CARD_JOKER', name: 'Lowest Card Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'LOWEST_RANK',
    runtimeImplemented: true,
    howToPlay: 'Your lowest-ranked card is wild. If your lowest rank is a pair, both cards are wild.',
  },
  HIGHEST_CARD_JOKER: {
    id: 'HIGHEST_CARD_JOKER', name: 'Highest Card Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'HIGHEST_RANK',
    runtimeImplemented: true,
    howToPlay: 'Your highest-ranked card is wild. If your highest rank is a pair, both cards are wild.',
  },
  AK47: {
    id: 'AK47', name: 'AK47', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'AK47',
    runtimeImplemented: true,
    howToPlay: 'Aces, Kings, 4s and 7s are wild.',
  },
  PAIRS_ARE_JOKERS: {
    id: 'PAIRS_ARE_JOKERS', name: 'Pairs Are Jokers', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'PAIRS',
    runtimeImplemented: true,
    howToPlay: 'If the dealt cards contain a pair, both cards of that rank are wild.',
  },
  K_LITTLE: {
    id: 'K_LITTLE', name: 'K Little', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'NAMED_AND_LOWEST',
    fixedNamedRank: 'K', runtimeImplemented: true,
    howToPlay: 'Kings are wild. Each player’s lowest remaining non-K rank is also wild. If that Little rank is duplicated, every card of that rank is wild.',
  },
  Q_LITTLE: {
    id: 'Q_LITTLE', name: 'Q Little', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'NAMED_AND_LOWEST',
    fixedNamedRank: 'Q', runtimeImplemented: true,
    howToPlay: 'Queens are wild. Each player’s lowest remaining non-Q rank is also wild. If that Little rank is duplicated, every card of that rank is wild.',
  },
  J_LITTLE: {
    id: 'J_LITTLE', name: 'J Little', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'NAMED_AND_LOWEST',
    fixedNamedRank: 'J', runtimeImplemented: true,
    howToPlay: 'Jacks are wild. Each player’s lowest remaining non-J rank is also wild. If that Little rank is duplicated, every card of that rank is wild.',
  },
  RANDOM_PACK_JOKER: {
    id: 'RANDOM_PACK_JOKER', name: 'Random-Pack Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'PACK_RANK',
    runtimeImplemented: true,
    howToPlay: 'One undealt card is revealed at random; every card of that rank is wild.',
  },
  REVOLVING_JOKER: {
    id: 'REVOLVING_JOKER', name: 'Revolving Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'PACK_RANK',
    runtimeImplemented: true,
    howToPlay: 'Three undealt reference cards begin as the board jokers. Whenever a player packs, that packed hand replaces the board references; every card matching any of those three ranks is wild for the remaining players.',
  },
  UP_DOWN_SAME: {
    id: 'UP_DOWN_SAME', name: 'Up–Down–Same', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'UP_DOWN_SAME',
    runtimeImplemented: true,
    howToPlay: 'A reference rank, the rank immediately above it and the rank immediately below it are wild, with wraparound.',
  },
  UP_DOWN: {
    id: 'UP_DOWN', name: 'Up–Down', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'UP_DOWN',
    runtimeImplemented: true,
    howToPlay: 'The ranks immediately above and below the revealed reference are wild; the reference rank itself is not.',
  },
  DOWN_ONLY: {
    id: 'DOWN_ONLY', name: 'Down Only', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'DOWN_ONLY',
    runtimeImplemented: true,
    howToPlay: 'Only the rank immediately below the revealed reference is wild, with wraparound.',
  },
  TWO_REFERENCE_JOKER: {
    id: 'TWO_REFERENCE_JOKER', name: 'Two-Reference Joker', dealCount: 3, ranking: 'NORMAL', selection: 'DEALT_THREE', joker: 'TWO_REFERENCE',
    requiresTwoReferenceAssignment: true, runtimeImplemented: true,
    howToPlay: 'Two reference cards are revealed. Before betting, each player privately assigns one reference to Up/Down and the other to Same-rank. The two roles cannot be duplicated.',
  },
  DISCARD_LOW_HIGH: {
    id: 'DISCARD_LOW_HIGH', name: '5 Cards · Discard Low + High', dealCount: 5, ranking: 'NORMAL', selection: 'DISCARD_TO_THREE', joker: 'NONE',
    discardRule: 'LOWEST_AND_HIGHEST', runtimeImplemented: true,
    howToPlay: 'Five cards are dealt and retained. Mark one lowest and one highest card as discarded; only the remaining three are ranked. If equal-ranked physical cards create a choice, the player chooses which one to discard. All five are revealed at sideshow/showdown, but discarded cards have no comparison or tie-break value.',
  },
  DISCARD_TWO_LOWEST: {
    id: 'DISCARD_TWO_LOWEST', name: '5 Cards · Discard Two Lowest', dealCount: 5, ranking: 'NORMAL', selection: 'DISCARD_TO_THREE', joker: 'NONE',
    discardRule: 'TWO_LOWEST', runtimeImplemented: true,
    howToPlay: 'Five cards are dealt and retained. Mark the two lowest cards as discarded; only the remaining three are ranked. Equal-ranked boundary cards are chosen by the player. All five are revealed at sideshow/showdown, while discarded cards have no comparison or tie-break value.',
  },
  DISCARD_TWO_HIGHEST: {
    id: 'DISCARD_TWO_HIGHEST', name: '5 Cards · Discard Two Highest', dealCount: 5, ranking: 'NORMAL', selection: 'DISCARD_TO_THREE', joker: 'NONE',
    discardRule: 'TWO_HIGHEST', runtimeImplemented: true,
    howToPlay: 'Five cards are dealt and retained. Mark the two highest cards as discarded; only the remaining three are ranked. Equal-ranked boundary cards are chosen by the player. All five are revealed at sideshow/showdown, while discarded cards have no comparison or tie-break value.',
  },
  ASSUMED_THIRD: {
    id: 'ASSUMED_THIRD', name: '2 Cards · Assume the Third', dealCount: 2, ranking: 'NORMAL', selection: 'ASSUMED_THIRD', joker: 'NONE',
    runtimeImplemented: true,
    howToPlay: 'Two real cards are dealt. Assume any third rank and suit except a rank strictly between the two actual ranks.',
  },
  CLOSEST_TO_N: {
    id: 'CLOSEST_TO_N', name: 'Closest to N', dealCount: 3, ranking: 'CLOSEST_TO_N', selection: 'TARGET_THREE', joker: 'NONE',
    requiresTargetNumber: true, allowsTargetReorderChoice: true, runtimeImplemented: true,
    howToPlay: 'Form a three-digit number closest to the dealer’s target. 2–9 keep face value; 10/J/Q/K are 0; Ace is 0 or 1. Reordering is declared before the deal.',
  },
};

export function getTeenPattiVariant(id: TeenPattiVariantId): TeenPattiVariantDescriptor {
  return TEEN_PATTI_VARIANTS[id];
}

export function runtimeTeenPattiVariantIds(): TeenPattiVariantId[] {
  return Object.values(TEEN_PATTI_VARIANTS)
    .filter((variant) => variant.runtimeImplemented)
    .map((variant) => variant.id);
}

export function teenPattiVariantNeedsDealerConfig(id: TeenPattiVariantId): boolean {
  const descriptor = getTeenPattiVariant(id);
  return !!(descriptor.requiresTargetNumber || descriptor.selection === 'DISCARD_TO_THREE');
}

export function teenPattiFiveCardJokerName(id: TeenPattiFiveCardJokerId): string {
  if (id === 'NONE') return 'No Joker';
  return getTeenPattiVariant(id).name;
}

/** Resolve the joker mode for the exact configured round. For a 5-card round,
 * joker rules apply only to the three non-discarded cards. */
export function teenPattiRoundJokerMode(config: TeenPattiRoundVariantConfig): JokerMode {
  const descriptor = getTeenPattiVariant(config.variantId);
  if (descriptor.selection !== 'DISCARD_TO_THREE') return descriptor.joker;
  if (!config.fiveCardJoker) throw new Error(`${descriptor.name} requires the dealer to choose its joker rule.`);
  if (config.fiveCardJoker === 'NONE') return 'NONE';
  return getTeenPattiVariant(config.fiveCardJoker).joker;
}

/**
 * Player-facing explanation for the exact configured round, not merely the
 * generic variant family. This is safe to broadcast before/after the deal and
 * can be reconstructed on reconnect from the authoritative round config.
 */
export function describeTeenPattiRoundVariant(config: TeenPattiRoundVariantConfig): string {
  const descriptor = getTeenPattiVariant(config.variantId);
  const details: string[] = [descriptor.howToPlay];

  if (descriptor.requiresTargetNumber && Number.isInteger(config.targetNumber)) {
    details.push(`Target: ${config.targetNumber}.`);
    details.push(`Reordering the dealt cards is ${config.reorderTargetCards ? 'allowed' : 'not allowed'} this round.`);
  }
  if (descriptor.selection === 'DISCARD_TO_THREE' && config.fiveCardJoker) {
    details.push(`Joker rule: ${teenPattiFiveCardJokerName(config.fiveCardJoker)}.`);
    details.push('All five cards stay with the player. Only the three non-discarded cards are ranked; discarded cards are shown at sideshow/showdown but never break a tie.');
  }

  return details.join(' ');
}

// ---------------------------------------------------------------------------
// Variant-table policy (which variants are allowed at this private table)
// ---------------------------------------------------------------------------

export type TeenPattiTableMode = 'FIXED' | 'VARIANT_TABLE';
export type TeenPattiVariantRotation = 'DEALER_CHOICE' | 'FIXED_ROTATION' | 'SURPRISE_ME';

export interface TeenPattiVariantTablePolicy {
  mode: TeenPattiTableMode;
  fixedVariant?: TeenPattiVariantId;
  variants?: TeenPattiVariantId[];
  rotation?: TeenPattiVariantRotation;
}

export const DEFAULT_TEEN_PATTI_VARIANT_POLICY: TeenPattiVariantTablePolicy = {
  mode: 'FIXED',
  fixedVariant: 'CLASSIC',
};

export function teenPattiVariantsForTable(policy: TeenPattiVariantTablePolicy): TeenPattiVariantDescriptor[] {
  if (policy.mode === 'FIXED') {
    if (!policy.fixedVariant) throw new Error('A fixed Teen Patti table needs a variant.');
    return [getTeenPattiVariant(policy.fixedVariant)];
  }
  const ids = policy.variants ?? [];
  if (ids.length < 2) throw new Error('A Teen Patti Variant Table needs at least two approved variants.');
  if (new Set(ids).size !== ids.length) throw new Error('A Teen Patti Variant Table cannot contain the same variant twice.');
  if (!policy.rotation) throw new Error('A Teen Patti Variant Table needs Dealer Choice, Fixed Rotation or Surprise Me.');
  return ids.map(getTeenPattiVariant);
}

/** Validate the table-level variant pool before a live network session is created. */
export function validateTeenPattiVariantPolicy(
  policy: TeenPattiVariantTablePolicy,
  options: { requireRuntime?: boolean } = {}
): void {
  const variants = teenPattiVariantsForTable(policy);
  if (options.requireRuntime) {
    const unavailable = variants.find((variant) => !variant.runtimeImplemented);
    if (unavailable) throw new Error(`${unavailable.name} is not available to play yet.`);
  }
}

export function validateTeenPattiRoundVariantConfig(
  config: TeenPattiRoundVariantConfig,
  options: { requireRuntime?: boolean; allowMissingDealerConfig?: boolean } = {}
): void {
  const descriptor = getTeenPattiVariant(config.variantId);
  if (!descriptor) throw new Error('Unknown Teen Patti variant.');
  if (options.requireRuntime && !descriptor.runtimeImplemented) {
    throw new Error(`${descriptor.name} is not available to play yet.`);
  }
  if (descriptor.requiresTargetNumber) {
    const targetMissing = config.targetNumber === undefined;
    const reorderMissing = config.reorderTargetCards === undefined;
    if (options.allowMissingDealerConfig && targetMissing && reorderMissing) {
      // Valid pre-deal placeholder. The actual round dealer must configure it
      // before any boot is charged or card is dealt.
    } else {
      const target = config.targetNumber;
      if (!Number.isInteger(target) || target! < 100 || target! > 999) {
        throw new Error('Closest to N requires a three-digit target from 100 to 999.');
      }
      if (typeof config.reorderTargetCards !== 'boolean') {
        throw new Error('Closest to N requires the dealer to declare whether card reordering is allowed.');
      }
    }
  }
  if (descriptor.selection === 'DISCARD_TO_THREE') {
    const jokerMissing = config.fiveCardJoker === undefined;
    if (!(options.allowMissingDealerConfig && jokerMissing)) {
      if (!config.fiveCardJoker || !TEEN_PATTI_FIVE_CARD_JOKERS.includes(config.fiveCardJoker)) {
        throw new Error(`${descriptor.name} requires a supported dealer-selected joker rule (or explicit No Joker).`);
      }
    }
  } else if (config.fiveCardJoker !== undefined) {
    throw new Error(`${descriptor.name} does not use the 5-card joker option.`);
  }
  if (!descriptor.allowsTargetReorderChoice && config.reorderTargetCards !== undefined) {
    throw new Error(`${descriptor.name} does not use the target-card reorder option.`);
  }
}
