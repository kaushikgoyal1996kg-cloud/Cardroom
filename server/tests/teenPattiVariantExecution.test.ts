import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../src/platform/cards/index.js';
import { createDeck } from '../src/platform/cards/index.js';
import { ThreeCardCategory } from '../src/platform/cards/threeCardHand.js';
import { TeenPattiGame } from '../src/games/teenpatti/engine.js';
import {
  compareTeenPattiEvaluatedHands,
  evaluateTeenPattiHand,
  legalTeenPattiDiscardSelections,
} from '../src/games/teenpatti/handEvaluation.js';
import { selectTeenPattiRoundVariant } from '../src/games/teenpatti/variantTable.js';
import type { TeenPattiVariantTablePolicy } from '../src/games/teenpatti/rules.js';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${suit}_${rank}` });

function deckBeginningWith(cards: Card[]): Card[] {
  const used = new Set(cards.map((card) => card.id));
  return [...cards, ...createDeck().filter((card) => !used.has(card.id))];
}

function deckForHands(order: string[], hands: Record<string, Card[]>): Card[] {
  const count = hands[order[0]].length;
  const beginning: Card[] = [];
  for (let round = 0; round < count; round++) {
    for (const playerId of order) beginning.push(hands[playerId][round]);
  }
  return deckBeginningWith(beginning);
}

const tableConfig = {
  startingBalance: 1000,
  bootAmount: 10,
  baseBlind: 20,
  maxBlind: 60,
};

describe('Teen Patti runtime variant evaluation', () => {
  it('reverses both category and tiebreak strength for Muflis', () => {
    const weak = evaluateTeenPattiHand(
      [c('7', 'SPADES'), c('4', 'HEARTS'), c('2', 'CLUBS')],
      { variantId: 'MUFLIS' }
    );
    const strongerNormal = evaluateTeenPattiHand(
      [c('2', 'SPADES'), c('2', 'HEARTS'), c('A', 'CLUBS')],
      { variantId: 'MUFLIS' }
    );
    expect(compareTeenPattiEvaluatedHands(weak, strongerNormal, { variantId: 'MUFLIS' })).toBeGreaterThan(0);

    const lowerPair = evaluateTeenPattiHand(
      [c('3', 'SPADES'), c('3', 'HEARTS'), c('A', 'CLUBS')],
      { variantId: 'MUFLIS' }
    );
    const higherPair = evaluateTeenPattiHand(
      [c('4', 'SPADES'), c('4', 'HEARTS'), c('2', 'CLUBS')],
      { variantId: 'MUFLIS' }
    );
    expect(compareTeenPattiEvaluatedHands(lowerPair, higherPair, { variantId: 'MUFLIS' })).toBeGreaterThan(0);
  });

  it('runs a complete Muflis showdown using the reversed ranking', () => {
    const deck = deckForHands(['p2', 'p1'], {
      p2: [c('7', 'SPADES'), c('4', 'HEARTS'), c('2', 'CLUBS')],
      p1: [c('2', 'SPADES'), c('2', 'HEARTS'), c('A', 'CLUBS')],
    });
    const game = new TeenPattiGame('TPM', ['p1', 'p2'], {
      initialDealerId: 'p1', tableConfig, roundVariant: { variantId: 'MUFLIS' },
    });
    game.dealNewRound(deck);
    expect(game.getPublicState().variantName).toBe('Muflis / Lowball');
    expect(game.act('p2', { type: 'SHOWDOWN' }).ok).toBe(true);
    expect(game.lastOutcome?.winnerIds).toEqual(['p2']);
  });

  it('evaluates the strongest three of four automatically', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('A', 'SPADES'), c('A', 'HEARTS'), c('4', 'CLUBS'), c('A', 'DIAMONDS')],
      { variantId: 'BEST_OF_FOUR' }
    );
    expect(evaluated.selectedCards.map((card) => card.rank)).toEqual(['A', 'A', 'A']);
    expect(evaluated.description).toContain('Best 3: Trail');
  });

  it('deals four private cards and uses best-three strength at showdown', () => {
    const deck = deckForHands(['p2', 'p1'], {
      p2: [c('A', 'SPADES'), c('A', 'HEARTS'), c('4', 'CLUBS'), c('A', 'DIAMONDS')],
      p1: [c('K', 'SPADES'), c('K', 'HEARTS'), c('2', 'CLUBS'), c('K', 'DIAMONDS')],
    });
    const game = new TeenPattiGame('TP4', ['p1', 'p2'], {
      initialDealerId: 'p1', tableConfig, roundVariant: { variantId: 'BEST_OF_FOUR' },
    });
    game.dealNewRound(deck);
    expect(game.getPrivateState('p2')).toMatchObject({ cardCount: 4, cards: [] });
    expect(game.act('p2', { type: 'SHOWDOWN' }).ok).toBe(true);
    expect(game.lastOutcome?.winnerIds).toEqual(['p2']);
    expect(game.lastOutcome?.showdown?.find((entry) => entry.playerId === 'p2')?.cards).toHaveLength(4);
    expect(game.lastOutcome?.showdown?.find((entry) => entry.playerId === 'p2')?.description).toContain('Best 3: Trail');
  });

  it('allows the newly implemented variants through runtime-readiness enforcement', () => {
    const policy: TeenPattiVariantTablePolicy = {
      mode: 'VARIANT_TABLE',
      variants: ['CLASSIC', 'MUFLIS', 'BEST_OF_FOUR'],
      rotation: 'DEALER_CHOICE',
    };
    expect(selectTeenPattiRoundVariant(policy, {
      dealerId: 'D', chooserId: 'D', requested: { variantId: 'MUFLIS' }, requireRuntime: true,
    }).roundVariant.variantId).toBe('MUFLIS');
    expect(selectTeenPattiRoundVariant(policy, {
      dealerId: 'D', chooserId: 'D', requested: { variantId: 'BEST_OF_FOUR' }, requireRuntime: true,
    }).roundVariant.variantId).toBe('BEST_OF_FOUR');
  });

  it('reveals an undealt Standard Joker reference and uses that rank as wild', () => {
    const hands = {
      p2: [c('A', 'SPADES'), c('A', 'HEARTS'), c('5', 'CLUBS')],
      p1: [c('K', 'SPADES'), c('Q', 'HEARTS'), c('J', 'CLUBS')],
    };
    const dealt = deckForHands(['p2', 'p1'], hands);
    // Put a 5 as the first undealt card, keeping every card unique.
    const withoutFiveDiamond = dealt.filter((card) => card.id !== 'DIAMONDS_5');
    const deck = [...withoutFiveDiamond.slice(0, 6), c('5', 'DIAMONDS'), ...withoutFiveDiamond.slice(6)];
    const game = new TeenPattiGame('TPJ', ['p1', 'p2'], {
      initialDealerId: 'p1', tableConfig, roundVariant: { variantId: 'STANDARD_JOKER' },
    });
    game.dealNewRound(deck);
    expect(game.getPublicState().variantReferenceCards).toEqual([c('5', 'DIAMONDS')]);
    expect(game.act('p2', { type: 'SHOWDOWN' }).ok).toBe(true);
    expect(game.lastOutcome?.winnerIds).toEqual(['p2']);
    expect(game.lastOutcome?.showdown?.find((entry) => entry.playerId === 'p2')?.description).toContain('Trail');
  });

  it('makes both cards wild when Lowest Card Joker lowest rank is a pair', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('2', 'SPADES'), c('2', 'HEARTS'), c('K', 'CLUBS')],
      { variantId: 'LOWEST_CARD_JOKER' }
    );
    expect(evaluated.wildCardIds).toHaveLength(2);
    expect(evaluated.description).toContain('Trail');
    expect(evaluated.effectiveCards.every((card) => card.rank === 'K')).toBe(true);
  });

  it('combines K with the player’s lowest non-K rank for K Little', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('2', 'SPADES'), c('2', 'HEARTS'), c('K', 'CLUBS')],
      { variantId: 'K_LITTLE' }
    );
    expect(evaluated.wildCardIds).toEqual(['SPADES_2', 'HEARTS_2', 'CLUBS_K']);
    expect(evaluated.value.category).toBe(ThreeCardCategory.TRAIL);
  });

  it('makes every card of a duplicated Little rank wild even when the K rank is absent', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('4', 'SPADES'), c('4', 'HEARTS'), c('Q', 'CLUBS')],
      { variantId: 'K_LITTLE' }
    );
    expect(evaluated.wildCardIds).toEqual(['SPADES_4', 'HEARTS_4']);
    expect(evaluated.description).toContain('Trail');
  });

  it('chooses Little from the lowest non-J rank in J Little', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('J', 'SPADES'), c('K', 'HEARTS'), c('A', 'CLUBS')],
      { variantId: 'J_LITTLE' }
    );
    expect(evaluated.wildCardIds).toEqual(['SPADES_J', 'HEARTS_K']);
  });

  it('uses Q as the fixed named joker in Q Little', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('Q', 'SPADES'), c('7', 'HEARTS'), c('9', 'CLUBS')],
      { variantId: 'Q_LITTLE' }
    );
    expect(evaluated.wildCardIds).toEqual(['SPADES_Q', 'HEARTS_7']);
  });

  it('does not invent a second Little rank when every card is the fixed named rank', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('K', 'SPADES'), c('K', 'HEARTS'), c('K', 'CLUBS')],
      { variantId: 'K_LITTLE' }
    );
    expect(evaluated.wildCardIds).toEqual(['SPADES_K', 'HEARTS_K', 'CLUBS_K']);
  });

  it('keeps jokers fully wild across both rank and suit', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('2', 'CLUBS'), c('3', 'SPADES'), c('4', 'SPADES')],
      { variantId: 'LOWEST_CARD_JOKER' }
    );
    expect(evaluated.wildCardIds).toEqual(['CLUBS_2']);
    expect(evaluated.value.category).toBe(ThreeCardCategory.PURE_SEQUENCE);
    expect(evaluated.effectiveCards.some((card) => card.suit === 'SPADES' && (card.rank === '2' || card.rank === '5'))).toBe(true);
  });

  it('supports AK47 and Pairs Are Jokers without any public reference card', () => {
    const ak47 = evaluateTeenPattiHand(
      [c('A', 'SPADES'), c('K', 'HEARTS'), c('2', 'CLUBS')],
      { variantId: 'AK47' }
    );
    expect(ak47.wildCardIds).toHaveLength(2);
    expect(ak47.description).toContain('Trail');

    const pairJokers = evaluateTeenPattiHand(
      [c('4', 'SPADES'), c('4', 'HEARTS'), c('K', 'CLUBS')],
      { variantId: 'PAIRS_ARE_JOKERS' }
    );
    expect(pairJokers.wildCardIds).toHaveLength(2);
    expect(pairJokers.effectiveCards.every((card) => card.rank === 'K')).toBe(true);
  });

  it('replaces Revolving Joker board references with the latest packed hand', () => {
    const hands = {
      p2: [c('5', 'SPADES'), c('9', 'HEARTS'), c('Q', 'CLUBS')],
      p3: [c('5', 'HEARTS'), c('K', 'SPADES'), c('2', 'CLUBS')],
      p1: [c('7', 'SPADES'), c('8', 'HEARTS'), c('J', 'CLUBS')],
    };
    const dealt = deckForHands(['p2', 'p3', 'p1'], hands);
    const initialRefs = [c('3', 'DIAMONDS'), c('4', 'DIAMONDS'), c('6', 'DIAMONDS')];
    const dealtIds = new Set(Object.values(hands).flat().map((card) => card.id));
    const refs = initialRefs.filter((card) => !dealtIds.has(card.id));
    const used = new Set([...dealtIds, ...refs.map((card) => card.id)]);
    const firstNine = dealt.slice(0, 9);
    const fullDeck = [...firstNine, ...refs, ...createDeck().filter((card) => !used.has(card.id))];

    const game = new TeenPattiGame('TPRJ', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1', tableConfig, roundVariant: { variantId: 'REVOLVING_JOKER' },
    });
    game.dealNewRound(fullDeck);
    expect(game.getPublicState().variantReferenceCards).toEqual(refs);

    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    expect(game.getPublicState().variantReferenceCards).toEqual(hands.p2);

    const evaluated = evaluateTeenPattiHand(hands.p3, { variantId: 'REVOLVING_JOKER' }, game.getPublicState().variantReferenceCards);
    expect(evaluated.wildCardIds).toContain('HEARTS_5');
  });

  it('uses the same Revolving Joker replacement for leave-as-pack and sideshow packs', () => {
    const hands = {
      p2: [c('5', 'SPADES'), c('9', 'HEARTS'), c('Q', 'CLUBS')],
      p3: [c('5', 'HEARTS'), c('K', 'SPADES'), c('2', 'CLUBS')],
      p1: [c('7', 'SPADES'), c('8', 'HEARTS'), c('J', 'CLUBS')],
    };
    const dealt = deckForHands(['p2', 'p3', 'p1'], hands);
    const refs = [c('3', 'DIAMONDS'), c('4', 'DIAMONDS'), c('6', 'DIAMONDS')];
    const used = new Set([...Object.values(hands).flat(), ...refs].map((card) => card.id));
    const deck = [...dealt.slice(0, 9), ...refs, ...createDeck().filter((card) => !used.has(card.id))];

    const leaving = new TeenPattiGame('TPRJL', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1', tableConfig, roundVariant: { variantId: 'REVOLVING_JOKER' },
    });
    leaving.dealNewRound(deck);
    leaving.leaveTable('p2');
    expect(leaving.getPublicState().variantReferenceCards).toEqual(hands.p2);

    const sideshow = new TeenPattiGame('TPRJS', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1', tableConfig, roundVariant: { variantId: 'REVOLVING_JOKER' },
    });
    sideshow.dealNewRound(deck);
    for (const playerId of ['p2', 'p3']) {
      expect(sideshow.act(playerId, { type: 'SEE' }).ok).toBe(true);
      expect(sideshow.act(playerId, { type: 'CHAAL' }).ok).toBe(true);
    }
    expect(sideshow.act('p1', { type: 'SEE' }).ok).toBe(true);
    expect(sideshow.act('p1', { type: 'SIDESHOW' }).ok).toBe(true);
    const packedPlayerId = sideshow.getPublicState().lastSideshow?.packedPlayerId;
    expect(packedPlayerId).toBeTruthy();
    expect(sideshow.getPublicState().variantReferenceCards).toEqual(hands[packedPlayerId as keyof typeof hands]);
  });

  it('evaluates Closest to N with Ace 0/1 and dealer-declared reordering', () => {
    const acePerfect = evaluateTeenPattiHand(
      [c('A', 'SPADES'), c('Q', 'HEARTS'), c('5', 'CLUBS')],
      { variantId: 'CLOSEST_TO_N', targetNumber: 105, reorderTargetCards: false }
    );
    expect(acePerfect.targetResult).toEqual({ formedNumber: 105, distance: 0 });

    const cards = [c('7', 'SPADES'), c('8', 'HEARTS'), c('6', 'CLUBS')];
    expect(evaluateTeenPattiHand(cards, { variantId: 'CLOSEST_TO_N', targetNumber: 678, reorderTargetCards: true }).targetResult)
      .toEqual({ formedNumber: 678, distance: 0 });
    expect(evaluateTeenPattiHand(cards, { variantId: 'CLOSEST_TO_N', targetNumber: 678, reorderTargetCards: false }).targetResult?.formedNumber)
      .toBe(786);

    const below = evaluateTeenPattiHand(
      [c('5', 'SPADES'), c('5', 'HEARTS'), c('4', 'CLUBS')],
      { variantId: 'CLOSEST_TO_N', targetNumber: 555, reorderTargetCards: false }
    );
    const above = evaluateTeenPattiHand(
      [c('5', 'DIAMONDS'), c('5', 'CLUBS'), c('6', 'SPADES')],
      { variantId: 'CLOSEST_TO_N', targetNumber: 555, reorderTargetCards: false }
    );
    expect(compareTeenPattiEvaluatedHands(below, above, { variantId: 'CLOSEST_TO_N', targetNumber: 555, reorderTargetCards: false })).toBe(0);
  });

  it('applies Up/Down wraparound exactly around Ace and Two', () => {
    const referenceAce = [c('A', 'DIAMONDS')];
    const upDownSame = evaluateTeenPattiHand(
      [c('K', 'SPADES'), c('2', 'HEARTS'), c('Q', 'CLUBS')],
      { variantId: 'UP_DOWN_SAME' },
      referenceAce
    );
    expect(upDownSame.wildCardIds.sort()).toEqual(['HEARTS_2', 'SPADES_K'].sort());
    expect(upDownSame.description).toContain('Trail');

    const downFromTwo = evaluateTeenPattiHand(
      [c('A', 'SPADES'), c('9', 'HEARTS'), c('8', 'CLUBS')],
      { variantId: 'DOWN_ONLY' },
      [c('2', 'DIAMONDS')]
    );
    expect(downFromTwo.wildCardIds).toEqual(['SPADES_A']);
  });
});

describe('Teen Patti dealer-choice Variant Table lifecycle', () => {
  const dealerChoicePolicy: TeenPattiVariantTablePolicy = {
    mode: 'VARIANT_TABLE',
    variants: ['CLASSIC', 'MUFLIS', 'BEST_OF_FOUR'],
    rotation: 'DEALER_CHOICE',
  };

  it('waits for the actual dealer before charging boot or dealing any card', () => {
    const game = new TeenPattiGame('TPVC', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'CLASSIC' },
      variantPolicy: dealerChoicePolicy,
    });

    game.startSession();
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.nextVariantChooserId).toBe('p1');
    expect(game.getPlayer('p1')?.chips).toBe(tableConfig.startingBalance);
    expect(game.getPlayer('p2')?.chips).toBe(tableConfig.startingBalance);
    expect(game.getPrivateState('p1')?.cardCount).toBe(0);
    expect(game.getPublicState().variantDealCount).toBe(0);
  });

  it('rejects a stale dealer round decision sequence before applying any choice', () => {
    const game = new TeenPattiGame('TPVCSEQ', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'CLASSIC' },
      variantPolicy: dealerChoicePolicy,
    });
    game.startSession();

    const currentSeq = game.getPublicState().sequence;
    expect(currentSeq).toBeGreaterThan(0);
    const stale = game.chooseRoundVariant('p1', { variantId: 'MUFLIS' }, currentSeq - 1);
    expect(stale.ok).toBe(false);
    expect(stale.error).toContain('stale');
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.getPrivateState('p1')?.cardCount).toBe(0);
    expect(game.getPlayer('p1')?.chips).toBe(tableConfig.startingBalance);

    expect(game.chooseRoundVariant('p1', { variantId: 'MUFLIS' }, currentSeq).ok).toBe(true);
    expect(game.state).toBe('BETTING');
  });

  it('rejects a non-dealer and deals the selected approved runtime variant atomically', () => {
    const game = new TeenPattiGame('TPVC2', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'CLASSIC' },
      variantPolicy: dealerChoicePolicy,
    });
    game.startSession();

    expect(game.chooseRoundVariant('p2', { variantId: 'MUFLIS' }).ok).toBe(false);
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.chooseRoundVariant('p1', { variantId: 'MUFLIS' }).ok).toBe(true);
    expect(game.state).toBe('BETTING');
    expect(game.getPublicState().variantName).toBe('Muflis / Lowball');
    expect(game.getPrivateState('p1')?.cardCount).toBe(3);
    expect(game.getPlayer('p1')?.chips).toBe(tableConfig.startingBalance - tableConfig.bootAmount);
  });

  it('lets the dealer choose Surprise Me while the server selects only from the host-approved pool', () => {
    const game = new TeenPattiGame('TPVCS', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'CLASSIC' },
      variantPolicy: {
        mode: 'VARIANT_TABLE',
        variants: ['CLASSIC', 'AK47', 'REVOLVING_JOKER'],
        rotation: 'DEALER_CHOICE',
      },
      randomSource: () => 0.6,
    });
    game.startSession();
    const seq = game.getPublicState().sequence;

    expect(game.chooseSurpriseRoundVariant('p2', seq).ok).toBe(false);
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.chooseSurpriseRoundVariant('p1', seq).ok).toBe(true);
    expect(game.state).toBe('BETTING');
    expect(game.getPublicState().variant.variantId).toBe('AK47');
    expect(game.getPublicState().variantWasSurprise).toBe(true);
    expect(game.pot).toBe(tableConfig.bootAmount * 2);
  });

  it('runs a dedicated Surprise Me table from the host-approved pool every hand', () => {
    const samples = [0, 0.999999];
    let sampleIndex = 0;
    const game = new TeenPattiGame('TPSUR', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'CLASSIC' },
      variantPolicy: {
        mode: 'VARIANT_TABLE',
        variants: ['CLASSIC', 'AK47'],
        rotation: 'SURPRISE_ME',
      },
      randomSource: () => samples[Math.min(sampleIndex++, samples.length - 1)],
    });

    game.startSession();
    expect(game.getPublicState().variant.variantId).toBe('CLASSIC');
    expect(game.getPublicState().variantWasSurprise).toBe(true);
    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    expect(game.state).toBe('ROUND_COMPLETE');

    game.dealNewRound();
    expect(game.state).toBe('BETTING');
    expect(game.getPublicState().variant.variantId).toBe('AK47');
    expect(game.getPublicState().variantWasSurprise).toBe(true);
  });

  it('makes the previous unique winner the next dealer and variant chooser', () => {
    const game = new TeenPattiGame('TPVC3', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'CLASSIC' },
      variantPolicy: dealerChoicePolicy,
    });
    game.startSession();
    expect(game.chooseRoundVariant('p1', { variantId: 'CLASSIC' }).ok).toBe(true);

    // p2 is first to act (clockwise after dealer p1). Packing leaves p1 as
    // the unique winner, so the locked rule makes p1 dealer again next round.
    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.lastOutcome?.winnerIds).toEqual(['p1']);

    game.dealNewRound();
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.roundNumber).toBe(2);
    expect(game.dealerId).toBe('p1');
    expect(game.nextVariantChooserId).toBe('p1');
  });

  it('waits for the dealer to configure a fixed Closest to N round before charging boot', () => {
    const game = new TeenPattiGame('TPCN', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'CLOSEST_TO_N' },
      variantPolicy: { mode: 'FIXED', fixedVariant: 'CLOSEST_TO_N' },
    });
    game.startSession();
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.getPublicState().variantDecision).toBe('CONFIGURE_VARIANT');
    expect(game.nextVariantChooserId).toBe('p1');
    expect(game.getPlayer('p1')?.chips).toBe(tableConfig.startingBalance);
    expect(game.chooseRoundVariant('p2', { variantId: 'CLOSEST_TO_N', targetNumber: 555, reorderTargetCards: true }).ok).toBe(false);
    expect(game.chooseRoundVariant('p1', { variantId: 'CLOSEST_TO_N', targetNumber: 555, reorderTargetCards: true }).ok).toBe(true);
    expect(game.state).toBe('BETTING');
    expect(game.getPublicState().variantHelp).toContain('Target: 555.');
    expect(game.getPlayer('p1')?.chips).toBe(tableConfig.startingBalance - tableConfig.bootAmount);
  });

  it('rotates approved variants automatically on a fixed-rotation table', () => {
    const game = new TeenPattiGame('TPFR', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'CLASSIC' },
      variantPolicy: {
        mode: 'VARIANT_TABLE',
        variants: ['CLASSIC', 'MUFLIS'],
        rotation: 'FIXED_ROTATION',
      },
    });
    game.startSession();
    expect(game.getPublicState().variant.variantId).toBe('CLASSIC');
    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    game.dealNewRound();
    expect(game.state).toBe('BETTING');
    expect(game.getPublicState().variant.variantId).toBe('MUFLIS');
  });
});

describe('Two-Reference Joker runtime', () => {
  it('applies each player\'s private Up/Down vs Same assignment independently', () => {
    const cards = [c('4', 'SPADES'), c('9', 'HEARTS'), c('K', 'CLUBS')];
    const refs = [c('5', 'DIAMONDS'), c('9', 'SPADES')];

    const firstUpDown = evaluateTeenPattiHand(
      cards,
      { variantId: 'TWO_REFERENCE_JOKER' },
      refs,
      { upDownReferenceIndex: 0 },
    );
    expect(new Set(firstUpDown.wildCardIds)).toEqual(new Set(['SPADES_4', 'HEARTS_9']));
    expect(firstUpDown.description).toContain('Trail');

    const secondUpDown = evaluateTeenPattiHand(
      cards,
      { variantId: 'TWO_REFERENCE_JOKER' },
      refs,
      { upDownReferenceIndex: 1 },
    );
    expect(secondUpDown.wildCardIds).toEqual([]);
  });

  it('reveals two board references, waits for every private assignment, then starts betting', () => {
    const hands = {
      p2: [c('4', 'SPADES'), c('9', 'HEARTS'), c('K', 'CLUBS')],
      p1: [c('8', 'CLUBS'), c('5', 'HEARTS'), c('Q', 'DIAMONDS')],
    };
    const dealt = deckForHands(['p2', 'p1'], hands);
    const refs = [c('5', 'DIAMONDS'), c('9', 'SPADES')];
    const used = new Set([...Object.values(hands).flat(), ...refs].map((card) => card.id));
    const deck = [...dealt.slice(0, 6), ...refs, ...createDeck().filter((card) => !used.has(card.id))];
    const game = new TeenPattiGame('TP2R', ['p1', 'p2'], {
      initialDealerId: 'p1', tableConfig, roundVariant: { variantId: 'TWO_REFERENCE_JOKER' },
    });

    game.dealNewRound(deck);
    const gateSeq = game.sequence;
    expect(game.getPublicState()).toMatchObject({
      state: 'AWAITING_REFERENCE_ASSIGNMENT',
      pot: 20,
      currentTurn: null,
      twoReferenceAssignmentsComplete: 0,
      variantReferenceCards: refs,
    });
    expect(JSON.stringify(game.getPublicState())).not.toContain('upDownReferenceIndex');

    expect(game.assignTwoReference('p2', 0, gateSeq).ok).toBe(true);
    expect(game.sequence).toBe(gateSeq);
    expect(game.getPrivateState('p2')?.twoReferenceAssignment).toEqual({ upDownReferenceIndex: 0 });
    expect(game.getPrivateState('p1')?.twoReferenceAssignment).toBeNull();
    expect(game.getPublicState().twoReferenceAssignmentsComplete).toBe(1);

    expect(game.assignTwoReference('p1', 1, gateSeq).ok).toBe(true);
    expect(game.getPublicState()).toMatchObject({ state: 'BETTING', currentTurn: 'p2', twoReferenceAssignmentsComplete: 2 });
    expect(game.sequence).toBe(gateSeq + 1);
    expect(game.assignTwoReference('p1', 0, gateSeq).ok).toBe(false);
  });

  it('keeps completed Two-Reference choices through a player leave and resumes with the remaining seats', () => {
    const hands = {
      p2: [c('4', 'SPADES'), c('9', 'HEARTS'), c('K', 'CLUBS')],
      p3: [c('6', 'CLUBS'), c('3', 'HEARTS'), c('Q', 'SPADES')],
      p1: [c('8', 'CLUBS'), c('5', 'HEARTS'), c('Q', 'DIAMONDS')],
    };
    const dealt = deckForHands(['p2', 'p3', 'p1'], hands);
    const refs = [c('5', 'DIAMONDS'), c('9', 'SPADES')];
    const used = new Set([...Object.values(hands).flat(), ...refs].map((card) => card.id));
    const deck = [...dealt.slice(0, 9), ...refs, ...createDeck().filter((card) => !used.has(card.id))];
    const game = new TeenPattiGame('TP2RL', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1', tableConfig, roundVariant: { variantId: 'TWO_REFERENCE_JOKER' },
    });

    game.dealNewRound(deck);
    const firstGate = game.sequence;
    expect(game.assignTwoReference('p2', 0, firstGate).ok).toBe(true);
    game.leaveTable('p3');
    const refreshedGate = game.sequence;
    expect(refreshedGate).toBeGreaterThan(firstGate);
    expect(game.getPrivateState('p2')?.twoReferenceAssignment).toEqual({ upDownReferenceIndex: 0 });
    expect(game.assignTwoReference('p1', 1, refreshedGate).ok).toBe(true);
    expect(game.getPublicState()).toMatchObject({ state: 'BETTING', currentTurn: 'p2', twoReferenceAssignmentsComplete: 2 });
  });
});


describe('Assume the Third and authoritative Teen Patti history', () => {
  it('never assumes a rank strictly between the two real ranks', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('2', 'SPADES'), c('4', 'HEARTS')],
      { variantId: 'ASSUMED_THIRD' },
    );
    expect(evaluated.dealtCards).toHaveLength(2);
    expect(evaluated.selectedCards).toHaveLength(3);
    expect(evaluated.selectedCards[2].rank).not.toBe('3');
  });

  it('may assume an endpoint rank and make a legal trail', () => {
    const evaluated = evaluateTeenPattiHand(
      [c('A', 'SPADES'), c('A', 'HEARTS')],
      { variantId: 'ASSUMED_THIRD' },
    );
    expect(evaluated.description).toContain('Trail');
    expect(evaluated.selectedCards.every((card) => card.rank === 'A')).toBe(true);
  });

  it('keeps authoritative completed-round history while the next round is live', () => {
    const game = new TeenPattiGame('TPHIST', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'CLASSIC' },
    });
    game.dealNewRound();
    expect(game.act('p2', { type: 'PACK' }, game.sequence).ok).toBe(true);

    const completed = game.getPublicState();
    expect(completed.roundHistory).toHaveLength(1);
    expect(completed.roundHistory[0]).toMatchObject({
      roundNumber: 1,
      variantId: 'CLASSIC',
      variantName: 'Classic',
      winnerIds: ['p1'],
    });
    expect(completed.players.find((player) => player.playerId === 'p1')?.roundsWon).toBe(1);

    game.dealNewRound();
    expect(game.getPublicState().roundHistory).toHaveLength(1);
  });
});

describe('Teen Patti retained-discard sideshow reveal', () => {
  it('reveals all five physical cards at sideshow while comparing only the active three', () => {
    const hands = {
      p2: [c('2', 'CLUBS'), c('5', 'CLUBS'), c('7', 'DIAMONDS'), c('9', 'SPADES'), c('K', 'HEARTS')],
      p3: [c('3', 'HEARTS'), c('5', 'HEARTS'), c('7', 'HEARTS'), c('9', 'HEARTS'), c('Q', 'HEARTS')],
      p1: [c('2', 'SPADES'), c('3', 'SPADES'), c('4', 'SPADES'), c('5', 'DIAMONDS'), c('A', 'HEARTS')],
    };
    const deck = deckForHands(['p2', 'p3', 'p1'], hands);
    const game = new TeenPattiGame('TP5SS', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'DISCARD_LOW_HIGH', fiveCardJoker: 'NONE' },
    });

    game.dealNewRound();
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.chooseRoundVariant(
      'p1',
      { variantId: 'DISCARD_LOW_HIGH', fiveCardJoker: 'NONE' },
      game.sequence,
      deck,
    ).ok).toBe(true);
    expect(game.state).toBe('BETTING');

    for (const playerId of ['p2', 'p3']) {
      expect(game.act(playerId, { type: 'SEE' }).ok).toBe(true);
      expect(game.act(playerId, { type: 'CHAAL' }).ok).toBe(true);
    }
    expect(game.act('p1', { type: 'SEE' }).ok).toBe(true);
    expect(game.act('p1', { type: 'SIDESHOW' }).ok).toBe(true);

    const sideshow = game.getPublicState().lastSideshow;
    expect(sideshow?.packedPlayerId).toBe('p3');
    expect(sideshow?.revealedHands).toHaveLength(2);
    expect(sideshow?.revealedHands?.map((entry) => entry.playerId)).toEqual(['p1', 'p3']);

    for (const entry of sideshow?.revealedHands ?? []) {
      expect(entry.cards).toHaveLength(5);
      expect(entry.discardedCardIds).toHaveLength(2);
      for (const discardedId of entry.discardedCardIds ?? []) {
        expect(entry.cards.some((card) => card.id === discardedId)).toBe(true);
      }
    }

    const p1Reveal = sideshow?.revealedHands?.find((entry) => entry.playerId === 'p1');
    const p3Reveal = sideshow?.revealedHands?.find((entry) => entry.playerId === 'p3');
    expect(p1Reveal?.description).toContain('Sequence');
    expect(p3Reveal?.description).toContain('Colour');
  });
});


describe('Teen Patti retained-discard player choice', () => {
  it('lets the player choose the physical equal-ranked discard when suit changes the active hand', () => {
    const cards = [
      c('2', 'CLUBS'),
      c('2', 'SPADES'),
      c('3', 'SPADES'),
      c('4', 'SPADES'),
      c('8', 'HEARTS'),
    ];
    const legal = legalTeenPattiDiscardSelections(cards, 'LOWEST_AND_HIGHEST');
    expect(legal).toEqual([[0, 4], [1, 4]]);

    const discardClubTwo = evaluateTeenPattiHand(
      cards,
      { variantId: 'DISCARD_LOW_HIGH', fiveCardJoker: 'NONE' },
      [],
      undefined,
      [0, 4],
    );
    const discardSpadeTwo = evaluateTeenPattiHand(
      cards,
      { variantId: 'DISCARD_LOW_HIGH', fiveCardJoker: 'NONE' },
      [],
      undefined,
      [1, 4],
    );

    expect(discardClubTwo.description).toContain('Pure Sequence');
    expect(discardSpadeTwo.description).toContain('Sequence');
    expect(discardSpadeTwo.description).not.toContain('Pure Sequence');
    expect(compareTeenPattiEvaluatedHands(
      discardClubTwo,
      discardSpadeTwo,
      { variantId: 'DISCARD_LOW_HIGH', fiveCardJoker: 'NONE' },
    )).toBeGreaterThan(0);
  });

  it('reveals all five retained cards and discard marks at a paid showdown', () => {
    const hands = {
      p2: [c('2', 'CLUBS'), c('5', 'DIAMONDS'), c('7', 'HEARTS'), c('9', 'CLUBS'), c('K', 'DIAMONDS')],
      p1: [c('3', 'CLUBS'), c('4', 'SPADES'), c('5', 'SPADES'), c('6', 'SPADES'), c('Q', 'HEARTS')],
    };
    const game = new TeenPattiGame('TP5SHOW', ['p1', 'p2'], {
      initialDealerId: 'p1',
      tableConfig,
      roundVariant: { variantId: 'DISCARD_LOW_HIGH', fiveCardJoker: 'NONE' },
    });
    game.dealNewRound();
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.chooseRoundVariant(
      'p1',
      { variantId: 'DISCARD_LOW_HIGH', fiveCardJoker: 'NONE' },
      game.sequence,
      deckForHands(['p2', 'p1'], hands),
    ).ok).toBe(true);
    expect(game.state).toBe('BETTING');

    expect(game.act('p2', { type: 'SEE' }, game.sequence).ok).toBe(true);
    expect(game.act('p2', { type: 'SHOWDOWN' }, game.sequence).ok).toBe(true);

    expect(game.lastOutcome?.showdown).toHaveLength(2);
    for (const entry of game.lastOutcome?.showdown ?? []) {
      expect(entry.cards).toHaveLength(5);
      expect(entry.discardedCardIds).toHaveLength(2);
      for (const discardedId of entry.discardedCardIds ?? []) {
        expect(entry.cards.some((card) => card.id === discardedId)).toBe(true);
      }
    }
    expect(game.lastOutcome?.winnerIds).toEqual(['p1']);
  });
});
