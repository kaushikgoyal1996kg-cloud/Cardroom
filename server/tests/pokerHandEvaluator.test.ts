import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../src/platform/cards/index.js';
import { bestPokerHand, classifyFiveCardHand, comparePokerHandValues } from '../src/games/poker/handEvaluator.js';

function c(rank: Rank, suit: Suit, id = `${rank}-${suit}`): Card { return { rank, suit, id }; }

describe('five-card poker evaluator', () => {
  it('ranks standard full house above flush', () => {
    const flush = classifyFiveCardHand([c('A','SPADES'),c('J','SPADES'),c('9','SPADES'),c('7','SPADES'),c('6','SPADES')], 'TEXAS_HOLDEM');
    const full = classifyFiveCardHand([c('K','SPADES'),c('K','HEARTS'),c('K','DIAMONDS'),c('9','CLUBS'),c('9','HEARTS')], 'TEXAS_HOLDEM');
    expect(comparePokerHandValues(full, flush)).toBe(1);
  });

  it('ranks Short Deck flush above full house and recognises A6789', () => {
    const flush = classifyFiveCardHand([c('A','SPADES'),c('J','SPADES'),c('9','SPADES'),c('7','SPADES'),c('6','SPADES')], 'SHORT_DECK');
    const full = classifyFiveCardHand([c('K','SPADES'),c('K','HEARTS'),c('K','DIAMONDS'),c('9','CLUBS'),c('9','HEARTS')], 'SHORT_DECK');
    const wheel = classifyFiveCardHand([c('A','SPADES'),c('9','HEARTS'),c('8','DIAMONDS'),c('7','CLUBS'),c('6','HEARTS')], 'SHORT_DECK');
    expect(comparePokerHandValues(flush, full)).toBe(1);
    expect(wheel.category).toBe('STRAIGHT');
    expect(wheel.tiebreak).toEqual([9]);
  });

  it('Texas can use any five of seven', () => {
    const best = bestPokerHand(
      [c('A','SPADES'), c('K','SPADES')],
      [c('Q','SPADES'), c('J','SPADES'), c('10','SPADES'), c('2','HEARTS'), c('3','CLUBS')],
      'TEXAS_HOLDEM'
    );
    expect(best.category).toBe('STRAIGHT_FLUSH');
    expect(best.tiebreak).toEqual([14]);
  });

  it('Omaha enforces exactly two hole cards and exactly three board cards', () => {
    const best = bestPokerHand(
      [c('A','SPADES','h1'), c('K','SPADES','h2'), c('2','CLUBS','h3'), c('3','DIAMONDS','h4')],
      [c('Q','SPADES','b1'), c('J','SPADES','b2'), c('10','SPADES','b3'), c('9','SPADES','b4'), c('8','SPADES','b5')],
      'PLO4'
    );
    // A-K from the hand plus Q-J-10 from the board is a legal royal flush.
    expect(best.category).toBe('STRAIGHT_FLUSH');
    expect(best.tiebreak).toEqual([14]);
  });

  it('Omaha cannot play the board with only one useful hole card', () => {
    const best = bestPokerHand(
      [c('A','HEARTS','h1'), c('2','CLUBS','h2'), c('3','DIAMONDS','h3'), c('4','HEARTS','h4')],
      [c('K','SPADES','b1'), c('Q','SPADES','b2'), c('J','SPADES','b3'), c('10','SPADES','b4'), c('9','SPADES','b5')],
      'PLO4'
    );
    expect(best.category).not.toBe('STRAIGHT_FLUSH');
  });
});
