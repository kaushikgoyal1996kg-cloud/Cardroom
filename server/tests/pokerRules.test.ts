import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VARIANT_TABLE_CONFIG,
  POKER_VARIANTS,
  maxPlayersForPokerTable,
  validatePokerTableConfig,
} from '../src/games/poker/rules.js';

describe('Poker variant catalog', () => {
  it('models Omaha 4/5/6 with the exact two hole + three board rule', () => {
    for (const id of ['PLO4', 'PLO5', 'PLO6'] as const) {
      expect(POKER_VARIANTS[id].exactHoleCardsToUse).toBe(2);
      expect(POKER_VARIANTS[id].exactBoardCardsToUse).toBe(3);
      expect(POKER_VARIANTS[id].betting).toBe('POT_LIMIT');
    }
    expect(POKER_VARIANTS.PLO4.holeCards).toBe(4);
    expect(POKER_VARIANTS.PLO5.holeCards).toBe(5);
    expect(POKER_VARIANTS.PLO6.holeCards).toBe(6);
  });

  it('caps PLO5 at 8 seats and PLO6 at 7 so the deck cannot run out', () => {
    expect(POKER_VARIANTS.PLO5.maxPlayers).toBe(8);
    expect(POKER_VARIANTS.PLO6.maxPlayers).toBe(7);
  });

  it('models the Short Deck ranking/deck differences', () => {
    expect(POKER_VARIANTS.SHORT_DECK.deck).toBe('SHORT_36');
    expect(POKER_VARIANTS.SHORT_DECK.flushBeatsFullHouse).toBe(true);
    expect(POKER_VARIANTS.SHORT_DECK.lowStraight).toBe('A6789');
    expect(POKER_VARIANTS.SHORT_DECK.maxPlayers).toBe(6);
  });

  it('uses the strictest seat cap in a mixed variant table', () => {
    expect(maxPlayersForPokerTable(DEFAULT_VARIANT_TABLE_CONFIG)).toBe(7);
  });

  it('requires an ante when Short Deck is part of a table', () => {
    expect(() => validatePokerTableConfig({
      ...DEFAULT_VARIANT_TABLE_CONFIG,
      variants: ['TEXAS_HOLDEM', 'SHORT_DECK'],
      ante: 0,
    })).toThrow(/ante/i);
    expect(() => validatePokerTableConfig({
      ...DEFAULT_VARIANT_TABLE_CONFIG,
      variants: ['TEXAS_HOLDEM', 'SHORT_DECK'],
      ante: 10,
    })).not.toThrow();
  });
});
