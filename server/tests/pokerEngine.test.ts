import { describe, expect, it } from 'vitest';
import { createDeck } from '../src/platform/cards/index.js';
import { PokerGame } from '../src/games/poker/engine.js';
import type { PokerTableConfig } from '../src/games/poker/rules.js';

const deck = createDeck();
const texas: PokerTableConfig = {
  mode: 'FIXED', fixedVariant: 'TEXAS_HOLDEM', startingStack: 1000,
  smallBlind: 10, bigBlind: 20, ante: 0, actionTimerSeconds: 0,
};
const mixed: PokerTableConfig = {
  mode: 'VARIANT_TABLE', variants: ['TEXAS_HOLDEM', 'PLO4', 'PLO5', 'PLO6'],
  rotation: 'FIXED_ROTATION', startingStack: 1000, smallBlind: 10, bigBlind: 20,
  ante: 0, actionTimerSeconds: 0,
};

describe('PokerGame', () => {
  it('folds an inactive seat and restores it only before a later hand', () => {
    const game = new PokerGame('INACTIVE', ['A', 'B', 'C'], texas, 'A');
    game.dealHand(deck);
    const inactiveId = game.currentTurn!;
    expect(game.setInactiveSittingOut(inactiveId)).toEqual({ ok: true });
    expect(game.getPublicState().players.find((player) => player.playerId === inactiveId)).toMatchObject({
      sittingOut: true, folded: true,
    });

    while (game.state !== 'HAND_COMPLETE') {
      const turn = game.currentTurn;
      if (!turn) throw new Error('Expected Poker turn while finishing inactivity fixture');
      expect(game.act(turn, { type: 'FOLD' }, game.sequence).ok).toBe(true);
    }
    expect(game.resumePlayerNextHand(inactiveId)).toEqual({ ok: true });
    game.dealHand(deck);
    expect(game.getPublicState().players.find((player) => player.playerId === inactiveId)?.sittingOut).toBe(false);
    expect(game.getPrivateState(inactiveId).holeCards).toHaveLength(2);
  });

  it('deals Texas hole cards privately, posts blinds and starts after the big blind', () => {
    const game = new PokerGame('P1', ['A', 'B', 'C'], texas, 'A');
    game.dealHand(deck);
    expect(game.getPrivateState('A').holeCards).toHaveLength(2);
    expect(game.getPrivateState('B').holeCards).toHaveLength(2);
    expect(game.getPublicState().board).toHaveLength(0);
    expect(game.getPublicState().pot).toBe(30);
    expect(game.getPublicState().currentTurn).toBe('A');
  });

  it('rejects a stale betting action after the authoritative sequence advances', () => {
    const game = new PokerGame('SEQ', ['A', 'B', 'C'], texas, 'A');
    game.dealHand(deck);
    const seq = game.sequence;
    expect(game.act('A', { type: 'FOLD' }, seq).ok).toBe(true);
    expect(game.sequence).toBe(seq + 1);
    expect(game.act('B', { type: 'FOLD' }, seq)).toEqual({
      ok: false,
      error: 'That poker action is stale. Wait for the latest table state.',
    });
  });

  it('uses heads-up button = small blind and button acts first pre-flop', () => {
    const game = new PokerGame('HU', ['A', 'B'], texas, 'A');
    game.dealHand(deck);
    expect(game.getPlayer('A').streetCommitted).toBe(10);
    expect(game.getPlayer('B').streetCommitted).toBe(20);
    expect(game.currentTurn).toBe('A');
  });

  it('uses Short Deck antes plus one live button blind and starts action left of the button', () => {
    const shortDeck: PokerTableConfig = {
      ...texas,
      fixedVariant: 'SHORT_DECK',
      ante: 5,
    };
    const game = new PokerGame('SD', ['A', 'B', 'C'], shortDeck, 'A');
    game.dealHand(deck.filter((card) => !['2', '3', '4', '5'].includes(card.rank)));
    expect(game.getPublicState().pot).toBe(35); // 3×5 ante + 20 button blind
    expect(game.getPlayer('A').streetCommitted).toBe(20);
    expect(game.getPlayer('B').streetCommitted).toBe(0);
    expect(game.getPrivateState('B').toCall).toBe(20);
    expect(game.currentTurn).toBe('B');
  });

  it('resolves a fold-down hand and conserves chips', () => {
    const game = new PokerGame('P2', ['A', 'B', 'C'], texas, 'A');
    game.dealHand(deck);
    expect(game.act('A', { type: 'FOLD' }).ok).toBe(true);
    expect(game.act('B', { type: 'FOLD' }).ok).toBe(true);
    expect(game.state).toBe('HAND_COMPLETE');
    const total = ['A', 'B', 'C'].reduce((sum, id) => sum + game.getPlayer(id).stack, 0);
    expect(total).toBe(3000);
    expect(game.lastOutcome?.reason).toBe('LAST_STANDING');
  });

  it('does not reopen a prior bettor after an insufficient all-in raise, then auto-runs when only one player can still act', () => {
    const short: PokerTableConfig = { ...texas, startingStack: 100 };
    const game = new PokerGame('SHORT-RAISE', ['A', 'B', 'C'], short, 'A');
    game.topUp('A', 200); // Keep the original raiser deep enough to re-raise if action were open.
    game.dealHand(deck);

    expect(game.act('A', { type: 'RAISE_TO', amount: 80 }).ok).toBe(true); // full raise: +60
    expect(game.act('B', { type: 'RAISE_TO', amount: 100 }).ok).toBe(true); // all-in, only +20
    expect(game.act('C', { type: 'CALL' }).ok).toBe(true); // all-in call to 100

    const legal = game.getPrivateState('A').legalActions;
    expect(legal.call).toBe(true);
    expect(legal.raise).toBe(false);
    expect(legal.minRaiseTo).toBeNull();
    expect(game.act('A', { type: 'RAISE_TO', amount: 160 })).toEqual({
      ok: false,
      error: 'Betting has not been reopened for another raise.',
    });

    // Once A calls, B and C are all-in. There is nobody left who can answer
    // a bet, so the engine must run flop/turn/river rather than asking A to
    // click CHECK three times.
    expect(game.act('A', { type: 'CALL' }).ok).toBe(true);
    expect(game.state).toBe('HAND_COMPLETE');
    expect(game.getPublicState().board).toHaveLength(5);
  });

  it('reopens a prior bettor when multiple short all-ins cumulatively reach a full raise', () => {
    const short: PokerTableConfig = { ...texas, startingStack: 100 };
    const game = new PokerGame('CUMULATIVE-RAISE', ['A', 'B', 'C', 'D'], short, 'A');
    game.topUp('A', 200);
    game.topUp('C', 40); // BB can reach 140 exactly for the second short all-in.
    game.dealHand(deck);

    expect(game.act('D', { type: 'FOLD' }).ok).toBe(true);
    expect(game.act('A', { type: 'RAISE_TO', amount: 80 }).ok).toBe(true); // last full raise size = 60
    expect(game.act('B', { type: 'RAISE_TO', amount: 100 }).ok).toBe(true); // +20 short
    expect(game.act('C', { type: 'RAISE_TO', amount: 140 }).ok).toBe(true); // +40 short; +60 total facing A

    const legal = game.getPrivateState('A').legalActions;
    expect(legal.raise).toBe(true);
    expect(legal.minRaiseTo).toBe(200); // last full raise size remains 60
  });

  it('publishes server-authored live variant metadata for the client table', () => {
    const plo: PokerTableConfig = { ...texas, fixedVariant: 'PLO5' };
    const game = new PokerGame('META', ['A', 'B', 'C'], plo, 'A');
    game.dealHand(deck);
    const state = game.getPublicState();
    expect(state.variant).toMatchObject({
      id: 'PLO5',
      name: 'Pot-Limit Omaha 5',
      shortName: 'PLO5',
      holeCards: 5,
      betting: 'POT_LIMIT',
      maxPlayers: 8,
    });
    expect(state.variant.howToPlay).toMatch(/exactly two hole/i);
    expect(state.tableConfig).toMatchObject(plo);
    expect(state.approvedVariants.map((variant) => variant.id)).toEqual(['PLO5']);
  });

  it('enforces a PLO pot-limit maximum raise', () => {
    const plo: PokerTableConfig = { ...texas, fixedVariant: 'PLO4' };
    const game = new PokerGame('P3', ['A', 'B', 'C'], plo, 'A');
    game.dealHand(deck);
    const legal = game.getPrivateState('A').legalActions;
    expect(legal.maxRaiseTo).toBe(70); // 10/20 blinds: pot raise from UTG is to 70
    expect(game.act('A', { type: 'RAISE_TO', amount: 80 }).ok).toBe(false);
    expect(game.act('A', { type: 'RAISE_TO', amount: 70 }).ok).toBe(true);
  });

  it('builds main and side pots for unequal all-in stacks and conserves funded chips', () => {
    const game = new PokerGame('SIDE', ['A', 'B', 'C'], texas, 'A');
    game.topUp('B', 500);
    game.topUp('C', 500);
    game.dealHand(deck);
    expect(game.act('A', { type: 'RAISE_TO', amount: 1000 }).ok).toBe(true);
    expect(game.act('B', { type: 'CALL' }).ok).toBe(true);
    expect(game.act('C', { type: 'RAISE_TO', amount: 1500 }).ok).toBe(true); // short all-in raise
    expect(game.act('B', { type: 'CALL' }).ok).toBe(true);
    expect(game.state).toBe('HAND_COMPLETE');
    expect(game.lastOutcome?.pots.map((pot) => pot.amount).reduce((a, b) => a + b, 0)).toBe(4000);
    expect(game.lastOutcome?.pots).toHaveLength(2);
    const total = ['A', 'B', 'C'].reduce((sum, id) => sum + game.getPlayer(id).stack, 0);
    expect(total).toBe(4000);
  });

  it('rotates selected variants only between hands', () => {
    const game = new PokerGame('P4', ['A', 'B'], mixed, 'A');
    game.dealHand(deck);
    expect(game.currentVariantId).toBe('TEXAS_HOLDEM');
    expect(() => game.chooseNextVariant('A', 'PLO6', game.sequence)).toThrow();
    game.act('A', { type: 'FOLD' });
    game.dealHand(deck);
    expect(game.currentVariantId).toBe('PLO4');
  });

  it('waits for Dealer Choice without posting blinds or dealing cards, then deals atomically', () => {
    const config: PokerTableConfig = { ...mixed, rotation: 'DEALER_CHOICE' };
    const game = new PokerGame('DC', ['A', 'B', 'C'], config, 'A');

    game.dealHand(deck);
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.nextVariantChooserId).toBe('A');
    expect(game.getPublicState().pot).toBe(0);
    expect(game.getPrivateState('A').holeCards).toHaveLength(0);
    expect(game.getPlayer('A').stack).toBe(1000);
    expect(game.getPlayer('B').stack).toBe(1000);
    expect(game.getPlayer('C').stack).toBe(1000);

    const staleChoiceSeq = game.sequence - 1;
    expect(() => game.chooseNextVariant('A', 'PLO5', staleChoiceSeq, deck)).toThrow(/stale/i);
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.getPublicState().pot).toBe(0);
    expect(game.getPrivateState('A').holeCards).toHaveLength(0);

    expect(() => game.chooseNextVariant('B', 'PLO5', game.sequence, deck)).toThrow(/only the dealer/i);
    game.chooseNextVariant('A', 'PLO5', game.sequence, deck);
    expect(game.state).toBe('PREFLOP');
    expect(game.currentVariantId).toBe('PLO5');
    expect(game.getPrivateState('A').holeCards).toHaveLength(5);

    game.act('A', { type: 'FOLD' });
    game.act('B', { type: 'FOLD' });

    game.dealHand(deck);
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.dealerId).toBe('B');
    expect(game.nextVariantChooserId).toBe('B');
    expect(game.getPublicState().pot).toBe(0);
    expect(() => game.chooseNextVariant('A', 'PLO6', game.sequence, deck)).toThrow(/only the dealer/i);
    game.chooseNextVariant('B', 'PLO6', game.sequence, deck);
    expect(game.dealerId).toBe('B');
    expect(game.currentVariantId).toBe('PLO6');
    expect(game.getPrivateState('B').holeCards).toHaveLength(6);
  });

  it('keeps a departing player’s committed chips in the live pot and removes the public seat', () => {
    const game = new PokerGame('LEAVE', ['A', 'B', 'C'], texas, 'A');
    game.dealHand(deck);
    const potBefore = game.getPublicState().pot;

    const result = game.leaveTable('B'); // small blind leaves out of turn
    expect(result.settlement).toEqual({ playerId: 'B', stack: 990, totalFunding: 1000, topUps: 0, profitLoss: -10 });
    expect(result.remainingPlayerIds).toEqual(['A', 'C']);
    expect(game.getPublicState().players.map((player) => player.playerId)).toEqual(['A', 'C']);
    expect(game.getPublicState().pot).toBe(potBefore);

    expect(game.act('A', { type: 'FOLD' }, game.sequence).ok).toBe(true);
    expect(game.state).toBe('HAND_COMPLETE');
    expect(game.getPlayer('C').stack).toBe(1010);
  });

  it('transfers Dealer Choice authority when the upcoming dealer leaves before cards are dealt', () => {
    const config: PokerTableConfig = { ...mixed, rotation: 'DEALER_CHOICE' };
    const game = new PokerGame('LEAVE-DC', ['A', 'B', 'C'], config, 'A');
    game.dealHand(deck);
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.nextVariantChooserId).toBe('A');

    const result = game.leaveTable('A');
    expect(result.remainingPlayerIds).toEqual(['B', 'C']);
    expect(game.dealerId).toBe('B');
    expect(game.nextVariantChooserId).toBe('B');
    expect(game.getPublicState().pot).toBe(0);
    expect(() => game.chooseNextVariant('A', 'PLO4', game.sequence, deck)).toThrow(/only the dealer|not seated/i);

    game.chooseNextVariant('B', 'PLO4', game.sequence, deck);
    expect(game.state).toBe('PREFLOP');
    expect(game.currentVariantId).toBe('PLO4');
    expect(game.getPrivateState('B').holeCards).toHaveLength(4);
  });

  it('restricts top-ups to between hands and reports virtual P/L', () => {
    const game = new PokerGame('TOP', ['A', 'B'], texas, 'A');
    const seqBeforeTopUp = game.sequence;
    game.topUp('A', 250);
    expect(game.sequence).toBe(seqBeforeTopUp + 1);
    expect(game.getSettlement('A')).toEqual({ playerId: 'A', stack: 1250, totalFunding: 1250, topUps: 250, profitLoss: 0 });
    game.dealHand(deck);
    expect(() => game.topUp('A', 100)).toThrow(/between hands/);
  });

  it('uses the strictest seat cap for a mixed PLO6 table', () => {
    expect(() => new PokerGame('P5', ['1','2','3','4','5','6','7','8'], mixed)).toThrow(/2-7/);
  });
});


describe('authoritative Poker hand history', () => {
  it('keeps completed hand history while the next hand is live and never reveals fold-down hole cards', () => {
    const game = new PokerGame('PHIST', ['A', 'B', 'C'], texas, 'A');
    game.dealHand(deck);
    expect(game.act('A', { type: 'FOLD' }, game.sequence).ok).toBe(true);
    expect(game.act('B', { type: 'FOLD' }, game.sequence).ok).toBe(true);

    const completed = game.getPublicState();
    expect(completed.handHistory).toHaveLength(1);
    expect(completed.handHistory[0].showdown).toBeNull();
    expect(completed.handHistory[0].winnerIds).toEqual(['C']);
    expect(completed.players.find((player) => player.playerId === 'C')?.handsWon).toBe(1);

    game.dealHand(deck);
    expect(game.getPublicState().handHistory).toHaveLength(1);
  });
});
