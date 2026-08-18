import { describe, expect, it } from 'vitest';
import { createDeck } from '../src/platform/cards/index.js';
import { TeenPattiGame } from '../src/games/teenpatti/engine.js';

const baseConfig = {
  startingBalance: 1000,
  bootAmount: 10,
  baseBlind: 10,
  maxBlind: 60,
};

describe('Teen Patti Friendly Assist', () => {
  it('is host-configurable and cannot expose cards when disabled', () => {
    const game = new TeenPattiGame('FA0', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1',
      tableConfig: { ...baseConfig, friendlyAssist: false },
    });
    game.dealNewRound(createDeck());
    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    expect(game.requestFriendlyAssist('p2', 'p3').error).toMatch(/disabled/i);
    expect(JSON.stringify(game.getPrivateState('p2'))).not.toContain(game.getPlayerHand('p3')[0].id);
  });

  it('requires pack + target consent, reveals privately, and converts a blind target to seen betting', () => {
    const game = new TeenPattiGame('FA1', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1',
      tableConfig: { ...baseConfig, friendlyAssist: true },
    });
    game.dealNewRound(createDeck());

    expect(game.requestFriendlyAssist('p1', 'p3').error).toMatch(/after you have packed/i);
    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    expect(game.requestFriendlyAssist('p2', 'p3').ok).toBe(true);

    const pending = game.getPrivateState('p3')!.friendlyAssist.incoming[0];
    expect(pending.status).toBe('PENDING');
    expect(game.getPrivateState('p2')!.friendlyAssist.outgoing?.targetCards).toEqual([]);

    const seqBeforeAccept = game.sequence;
    expect(game.respondFriendlyAssist('p3', pending.requestId, true).ok).toBe(true);
    expect(game.sequence).toBeGreaterThan(seqBeforeAccept);
    expect(game.getPlayer('p3')!.seen).toBe(true);
    expect(game.getPlayer('p3')!.cardsViewed).toBe(false);
    expect(game.getPrivateState('p3')!.cards).toEqual([]);

    const targetHand = game.getPlayerHand('p3');
    expect(game.getPrivateState('p2')!.friendlyAssist.outgoing?.targetCards).toEqual(targetHand);
    const publicJson = JSON.stringify(game.getPublicState());
    for (const card of targetHand) expect(publicJson).not.toContain(card.id);
    const unrelatedPrivateJson = JSON.stringify(game.getPrivateState('p1'));
    for (const card of targetHand) expect(unrelatedPrivateJson).not.toContain(card.id);
  });

  it('keeps suggestions advisory/private and prevents a coach switching hands after seeing one player', () => {
    const game = new TeenPattiGame('FA2', ['p1', 'p2', 'p3', 'p4'], {
      initialDealerId: 'p1',
      tableConfig: { ...baseConfig, friendlyAssist: true },
    });
    game.dealNewRound(createDeck());
    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    expect(game.requestFriendlyAssist('p2', 'p3').ok).toBe(true);
    const requestId = game.getPrivateState('p3')!.friendlyAssist.incoming[0].requestId;
    expect(game.respondFriendlyAssist('p3', requestId, true).ok).toBe(true);

    const targetChipsBefore = game.getPlayer('p3')!.chips;
    expect(game.suggestFriendlyAssist('p2', requestId, 'PACK').ok).toBe(true);
    expect(game.getPlayer('p3')!.packed).toBe(false);
    expect(game.getPlayer('p3')!.chips).toBe(targetChipsBefore);
    expect(game.getPrivateState('p3')!.friendlyAssist.incoming[0].lastSuggestion).toBe('PACK');
    expect(game.getPrivateState('p1')!.friendlyAssist.incoming).toEqual([]);

    expect(game.revokeFriendlyAssist('p3', requestId).ok).toBe(true);
    expect(game.getPrivateState('p2')!.friendlyAssist.coachLockedTargetPlayerId).toBe('p3');
    expect(game.requestFriendlyAssist('p2', 'p4').error).toMatch(/cannot switch/i);
  });

  it('shares all five retained cards plus discard marks with an accepted coach', () => {
    const game = new TeenPattiGame('FA5', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1',
      tableConfig: { ...baseConfig, friendlyAssist: true },
      roundVariant: { variantId: 'DISCARD_LOW_HIGH', fiveCardJoker: 'NONE' },
    });
    game.dealNewRound();
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(game.chooseRoundVariant('p1', { variantId: 'DISCARD_LOW_HIGH', fiveCardJoker: 'NONE' }, game.sequence, createDeck()).ok).toBe(true);

    // The canonical deck gives unique high/low boundaries here, so the server
    // can lock both discards without showing cards and move straight to betting.
    expect(game.state).toBe('BETTING');
    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    expect(game.requestFriendlyAssist('p2', 'p3').ok).toBe(true);
    const requestId = game.getPrivateState('p3')!.friendlyAssist.incoming[0].requestId;
    expect(game.respondFriendlyAssist('p3', requestId, true).ok).toBe(true);

    const outgoing = game.getPrivateState('p2')!.friendlyAssist.outgoing!;
    expect(outgoing.targetCards).toHaveLength(5);
    expect(outgoing.targetDiscardedCardIds).toHaveLength(2);
    for (const id of outgoing.targetDiscardedCardIds) {
      expect(outgoing.targetCards.some((card) => card.id === id)).toBe(true);
    }
  });

  it('rejects a delayed watch request that belongs to a previous hand', () => {
    const game = new TeenPattiGame('FA-ROUND', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1',
      tableConfig: { ...baseConfig, friendlyAssist: true },
    });
    game.dealNewRound(createDeck());
    expect(game.roundNumber).toBe(1);
    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    expect(game.act('p3', { type: 'PACK' }).ok).toBe(true);
    expect(game.state).toBe('ROUND_COMPLETE');

    game.dealNewRound(createDeck());
    expect(game.roundNumber).toBe(2);
    expect(game.act('p2', { type: 'PACK' }).ok).toBe(true);
    expect(game.requestFriendlyAssist('p2', 'p3', 1).error).toMatch(/older hand/i);
    expect(game.requestFriendlyAssist('p2', 'p3', 2).ok).toBe(true);
  });

});
