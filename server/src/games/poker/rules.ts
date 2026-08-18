// ============================================================================
// POKER - Card Room variant catalog and private-table rules
//
// Play money only. This module intentionally models the variants before the
// network engine is enabled so lobby, seat-cap and hand-evaluation work can be
// implemented against one source of truth instead of scattering variant
// assumptions through the UI.
// ============================================================================

export type PokerVariantId =
  | 'TEXAS_HOLDEM'
  | 'PLO4'
  | 'PLO5'
  | 'PLO6'
  | 'SHORT_DECK';

export type PokerBettingStructure = 'NO_LIMIT' | 'POT_LIMIT' | 'ANTE_NO_LIMIT';
export type PokerTableMode = 'FIXED' | 'VARIANT_TABLE';
export type PokerVariantRotation = 'DEALER_CHOICE' | 'FIXED_ROTATION';

export interface PokerVariantDescriptor {
  id: PokerVariantId;
  name: string;
  shortName: string;
  holeCards: number;
  communityCards: 5;
  betting: PokerBettingStructure;
  /** Omaha-family variants must use exactly this many private cards. */
  exactHoleCardsToUse?: 2;
  exactBoardCardsToUse?: 3;
  minPlayers: 2;
  maxPlayers: number;
  deck: 'STANDARD_52' | 'SHORT_36';
  flushBeatsFullHouse: boolean;
  lowStraight: 'A2345' | 'A6789';
  howToPlay: string;
}

export const POKER_VARIANTS: Record<PokerVariantId, PokerVariantDescriptor> = {
  TEXAS_HOLDEM: {
    id: 'TEXAS_HOLDEM',
    name: 'Texas Hold’em',
    shortName: 'Texas',
    holeCards: 2,
    communityCards: 5,
    betting: 'NO_LIMIT',
    minPlayers: 2,
    maxPlayers: 9,
    deck: 'STANDARD_52',
    flushBeatsFullHouse: false,
    lowStraight: 'A2345',
    howToPlay: 'Two private cards, five community cards and four betting streets. Use any combination of hole and board cards to make the best five-card hand.',
  },
  PLO4: {
    id: 'PLO4',
    name: 'Pot-Limit Omaha 4',
    shortName: 'PLO4',
    holeCards: 4,
    communityCards: 5,
    betting: 'POT_LIMIT',
    exactHoleCardsToUse: 2,
    exactBoardCardsToUse: 3,
    minPlayers: 2,
    maxPlayers: 9,
    deck: 'STANDARD_52',
    flushBeatsFullHouse: false,
    lowStraight: 'A2345',
    howToPlay: 'Four private cards. At showdown use exactly two hole cards and exactly three community cards to make the best five-card hand.',
  },
  PLO5: {
    id: 'PLO5',
    name: 'Pot-Limit Omaha 5',
    shortName: 'PLO5',
    holeCards: 5,
    communityCards: 5,
    betting: 'POT_LIMIT',
    exactHoleCardsToUse: 2,
    exactBoardCardsToUse: 3,
    minPlayers: 2,
    // 8*5 private + 5 board + 3 burns = 48 cards.
    maxPlayers: 8,
    deck: 'STANDARD_52',
    flushBeatsFullHouse: false,
    lowStraight: 'A2345',
    howToPlay: 'Five private cards. At showdown use exactly two hole cards and exactly three community cards, just like other Omaha variants.',
  },
  PLO6: {
    id: 'PLO6',
    name: 'Pot-Limit Omaha 6',
    shortName: 'PLO6',
    holeCards: 6,
    communityCards: 5,
    betting: 'POT_LIMIT',
    exactHoleCardsToUse: 2,
    exactBoardCardsToUse: 3,
    minPlayers: 2,
    // 7*6 private + 5 board + 3 burns = 50 cards. Eight seats would require 56.
    maxPlayers: 7,
    deck: 'STANDARD_52',
    flushBeatsFullHouse: false,
    lowStraight: 'A2345',
    howToPlay: 'Six private cards create fifteen possible two-card combinations. Use exactly two hole cards and three board cards; betting is pot-limit.',
  },
  SHORT_DECK: {
    id: 'SHORT_DECK',
    name: '6+ Short Deck',
    shortName: '6+',
    holeCards: 2,
    communityCards: 5,
    betting: 'ANTE_NO_LIMIT',
    minPlayers: 2,
    maxPlayers: 6,
    deck: 'SHORT_36',
    flushBeatsFullHouse: true,
    lowStraight: 'A6789',
    howToPlay: 'Cards 2 through 5 are removed. Everyone posts an ante, the dealer/button alone posts the live button blind, and action starts to the left of the button. A-6-7-8-9 is the lowest straight and a flush ranks above a full house.',
  },
};

export interface PokerTableConfig {
  mode: PokerTableMode;
  fixedVariant?: PokerVariantId;
  /** Approved variants at a mixed/variant table. */
  variants?: PokerVariantId[];
  rotation?: PokerVariantRotation;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  /** 0 means no clock for the private family/friends table. */
  actionTimerSeconds: 0 | 15 | 20 | 30 | 45 | 60;
}

export const DEFAULT_POKER_TABLE_CONFIG: PokerTableConfig = {
  mode: 'FIXED',
  fixedVariant: 'TEXAS_HOLDEM',
  startingStack: 2000,
  smallBlind: 10,
  bigBlind: 20,
  ante: 0,
  actionTimerSeconds: 0,
};

export const DEFAULT_VARIANT_TABLE_CONFIG: PokerTableConfig = {
  mode: 'VARIANT_TABLE',
  variants: ['TEXAS_HOLDEM', 'PLO4', 'PLO5', 'PLO6'],
  rotation: 'DEALER_CHOICE',
  startingStack: 2000,
  smallBlind: 10,
  bigBlind: 20,
  ante: 0,
  actionTimerSeconds: 0,
};

export function getPokerVariant(id: PokerVariantId): PokerVariantDescriptor {
  return POKER_VARIANTS[id];
}

export function variantsForPokerTable(config: PokerTableConfig): PokerVariantDescriptor[] {
  if (config.mode === 'FIXED') {
    if (!config.fixedVariant) throw new Error('A fixed poker table needs a variant.');
    return [getPokerVariant(config.fixedVariant)];
  }
  const ids = config.variants ?? [];
  if (ids.length < 2) throw new Error('A Variant Poker Table needs at least two variants.');
  if (new Set(ids).size !== ids.length) throw new Error('A Variant Poker Table cannot contain the same variant twice.');
  return ids.map(getPokerVariant);
}

/** The room may never seat more players than its strictest selected variant. */
export function maxPlayersForPokerTable(config: PokerTableConfig): number {
  return Math.min(...variantsForPokerTable(config).map((variant) => variant.maxPlayers));
}

export function validatePokerTableConfig(config: PokerTableConfig): void {
  const variants = variantsForPokerTable(config);
  const wholePositive = [
    ['startingStack', config.startingStack],
    ['smallBlind', config.smallBlind],
    ['bigBlind', config.bigBlind],
  ] as const;
  for (const [name, value] of wholePositive) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive whole-number play-money amount.`);
  }
  if (!Number.isSafeInteger(config.ante) || config.ante < 0) throw new Error('ante must be a non-negative whole-number play-money amount.');
  if (config.bigBlind < config.smallBlind) throw new Error('bigBlind cannot be lower than smallBlind.');
  if (config.startingStack < config.bigBlind * 2) throw new Error('startingStack is too small for the selected blinds.');
  if (![0, 15, 20, 30, 45, 60].includes(config.actionTimerSeconds)) throw new Error('Unsupported poker action timer.');
  if (config.actionTimerSeconds !== 0) throw new Error('Poker action clock is not enabled in this build.');

  const needsShortDeckAnte = variants.some((variant) => variant.id === 'SHORT_DECK');
  if (needsShortDeckAnte && config.ante <= 0) {
    throw new Error('A table containing 6+ Short Deck needs a positive ante.');
  }
  if (config.mode === 'VARIANT_TABLE' && !config.rotation) {
    throw new Error('A Variant Poker Table needs Dealer Choice or Fixed Rotation.');
  }
}
