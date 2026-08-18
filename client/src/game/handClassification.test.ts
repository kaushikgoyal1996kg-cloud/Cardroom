import { describe, expect, it } from 'vitest';
import type { Card } from './types';
import { classifyFour, classifyThree, compareHand, handHasNoPossibleSequence } from './handClassification';

function c(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit, id: `${suit}_${rank}` };
}

describe('Hazari Set 4 best-three rule', () => {
  it('ignores the unused fourth card for tiebreaks', () => {
    const withKing = classifyFour([c('5', 'SPADES'), c('5', 'HEARTS'), c('2', 'DIAMONDS'), c('K', 'CLUBS')]);
    const withThree = classifyFour([c('5', 'SPADES'), c('5', 'HEARTS'), c('2', 'DIAMONDS'), c('3', 'CLUBS')]);
    expect(compareHand(withKing, withThree)).toBe(0);
  });

  it('treats the real-device Set 3 / Set 4 example as exactly equal', () => {
    const set3 = classifyThree([c('2', 'SPADES'), c('4', 'HEARTS'), c('3', 'CLUBS')]);
    const set4 = classifyFour([c('K', 'DIAMONDS'), c('4', 'DIAMONDS'), c('2', 'HEARTS'), c('3', 'SPADES')]);
    expect(compareHand(set3, set4)).toBe(0);
  });
});


describe('Hazari no-sequence dismissal', () => {
  it('does not treat a Trial as a Sequence', () => {
    const hand: Card[] = [
      c('A', 'SPADES'), c('A', 'HEARTS'), c('A', 'DIAMONDS'),
      c('5', 'SPADES'), c('5', 'HEARTS'),
      c('8', 'SPADES'), c('8', 'HEARTS'),
      c('J', 'SPADES'), c('J', 'HEARTS'),
      c('3', 'CLUBS'), c('6', 'CLUBS'), c('10', 'DIAMONDS'), c('K', 'CLUBS'),
    ];
    expect(handHasNoPossibleSequence(hand)).toBe(true);
  });

  it('still blocks dismissal when a real Sequence exists anywhere in the raw deal', () => {
    const hand: Card[] = [
      c('A', 'SPADES'), c('A', 'HEARTS'), c('A', 'DIAMONDS'),
      c('5', 'SPADES'), c('6', 'HEARTS'), c('7', 'CLUBS'),
      c('9', 'SPADES'), c('9', 'HEARTS'), c('J', 'SPADES'), c('J', 'HEARTS'),
      c('3', 'CLUBS'), c('10', 'DIAMONDS'), c('K', 'CLUBS'),
    ];
    expect(handHasNoPossibleSequence(hand)).toBe(false);
  });
});
