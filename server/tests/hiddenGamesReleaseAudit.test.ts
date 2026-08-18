import { describe, expect, it } from 'vitest';
import { TeenPattiGame } from '../src/games/teenpatti/engine.js';
import {
  DEFAULT_TEEN_PATTI_TABLE_CONFIG,
  runtimeTeenPattiVariantIds,
  type TeenPattiRoundVariantConfig,
} from '../src/games/teenpatti/rules.js';
import { PokerGame } from '../src/games/poker/engine.js';
import { DEFAULT_POKER_TABLE_CONFIG, POKER_VARIANTS, type PokerVariantId } from '../src/games/poker/rules.js';

function finishTeenRound(game: TeenPattiGame): void {
  let guard = 0;
  while (game.state !== 'ROUND_COMPLETE' && guard++ < 200) {
    const state = game.getPublicState();
    if (state.state === 'AWAITING_DISCARD') {
      for (const player of state.players) {
        const discard = game.getPrivateState(player.playerId)?.discardState;
        if (discard && !discard.complete) {
          expect(game.chooseDiscards(player.playerId, discard.legalSelections[0], game.sequence).ok).toBe(true);
        }
      }
      continue;
    }
    if (state.state === 'AWAITING_REFERENCE_ASSIGNMENT') {
      const sharedGateSequence = game.sequence;
      for (const playerId of state.referenceAssignmentRequiredPlayerIds) {
        if (!game.getPrivateState(playerId)?.twoReferenceAssignment) {
          expect(game.assignTwoReference(playerId, 0, sharedGateSequence).ok).toBe(true);
        }
      }
      continue;
    }
    if (state.state === 'BETTING') {
      expect(state.currentTurn).toBeTruthy();
      expect(game.act(state.currentTurn!, { type: 'PACK' }, state.sequence).ok).toBe(true);
      continue;
    }
    throw new Error(`Unexpected Teen Patti audit state ${state.state}`);
  }
  expect(game.state).toBe('ROUND_COMPLETE');
}

describe('hidden-game release audit', () => {
  it('runs every runtime Teen Patti variant at the 9-seat release ceiling without leaking live cards publicly', () => {
    const players = Array.from({ length: 9 }, (_, index) => `T${index + 1}`);
    for (const variantId of runtimeTeenPattiVariantIds()) {
      const roundVariant: TeenPattiRoundVariantConfig = { variantId };
      if (variantId === 'CLOSEST_TO_N') {
        roundVariant.targetNumber = 786;
        roundVariant.reorderTargetCards = false;
      }
      if (variantId.startsWith('DISCARD_')) roundVariant.fiveCardJoker = 'NONE';

      const game = new TeenPattiGame(`AUDIT-${variantId}`, players, {
        initialDealerId: players[0],
        tableConfig: { ...DEFAULT_TEEN_PATTI_TABLE_CONFIG, startingBalance: 10_000 },
        roundVariant,
        variantPolicy: { mode: 'FIXED', fixedVariant: variantId },
      });
      game.startSession();
      if (game.state === 'AWAITING_VARIANT') {
        expect(game.chooseRoundVariant(players[0], roundVariant, game.sequence).ok).toBe(true);
      }

      const publicState = game.getPublicState();
      const liveJson = JSON.stringify(publicState);
      for (const playerId of players) {
        const privateState = game.getPrivateState(playerId);
        expect(privateState?.roundNumber).toBe(publicState.roundNumber);
        expect(privateState?.sequence).toBe(publicState.sequence);
        for (const card of game.getPlayerHand(playerId)) expect(liveJson).not.toContain(card.id);
      }
      finishTeenRound(game);
    }
  });

  it('defers Two-Reference choice until comparison and keeps each selected joker option private', () => {
    const game = new TeenPattiGame('AUDIT-REF', ['A', 'B', 'C'], {
      initialDealerId: 'A',
      roundVariant: { variantId: 'TWO_REFERENCE_JOKER' },
    });
    game.startSession();

    expect(game.state).toBe('BETTING');
    expect(game.getPublicState().referenceAssignmentRequiredPlayerIds).toEqual([]);
    expect(game.getPrivateState('A')?.twoReferenceAssignment).toBeNull();

    // Being Seen is not the trigger. Sideshow/showdown comparison is.
    for (const id of ['A', 'B', 'C']) game.getPlayer(id)!.seen = true;
    const initiator = game.currentTurn!;
    expect(game.act(initiator, { type: 'SIDESHOW' }, game.sequence).ok).toBe(true);
    const gate = game.getPublicState();
    expect(gate.state).toBe('AWAITING_REFERENCE_ASSIGNMENT');
    expect(gate.referenceAssignmentReason).toBe('SIDESHOW');
    expect(gate.referenceAssignmentRequiredPlayerIds).toHaveLength(2);

    const [first, second] = gate.referenceAssignmentRequiredPlayerIds;
    const gateSeq = game.sequence;
    expect(game.assignTwoReference(first, 1, gateSeq).ok).toBe(true);
    expect(game.getPrivateState(first)?.twoReferenceAssignment).toEqual({ upDownReferenceIndex: 1 });
    expect(game.getPrivateState(second)?.twoReferenceAssignment).toBeNull();
    expect(JSON.stringify(game.getPublicState())).not.toContain('upDownReferenceIndex');

    expect(game.assignTwoReference(second, 0, gateSeq).ok).toBe(true);
    expect(game.getPrivateState(second)?.twoReferenceAssignment).toEqual({ upDownReferenceIndex: 0 });
  });

  it('runs every Poker variant at its maximum seat cap and keeps hole cards private until showdown', () => {
    for (const [variantId, descriptor] of Object.entries(POKER_VARIANTS) as [PokerVariantId, (typeof POKER_VARIANTS)[PokerVariantId]][]) {
      const players = Array.from({ length: descriptor.maxPlayers }, (_, index) => `P${index + 1}`);
      const game = new PokerGame(`AUDIT-${variantId}`, players, {
        ...DEFAULT_POKER_TABLE_CONFIG,
        mode: 'FIXED',
        fixedVariant: variantId,
        startingStack: 10_000,
        ante: variantId === 'SHORT_DECK' ? 10 : 0,
      });
      game.dealHand();

      const live = game.getPublicState();
      expect(live.players.every((player) => !('holeCards' in player))).toBe(true);
      expect(live.outcome).toBeNull();
      for (const playerId of players) {
        const privateState = game.getPrivateState(playerId);
        expect(privateState.handNumber).toBe(live.handNumber);
        expect(privateState.sequence).toBe(live.sequence);
      }

      let guard = 0;
      while (game.state !== 'HAND_COMPLETE' && guard++ < 300) {
        const state = game.getPublicState();
        expect(state.currentTurn).toBeTruthy();
        const legal = game.getPrivateState(state.currentTurn!).legalActions;
        const action = legal.check
          ? { type: 'CHECK' as const }
          : legal.call
            ? { type: 'CALL' as const }
            : { type: 'FOLD' as const };
        expect(game.act(state.currentTurn!, action, state.sequence).ok).toBe(true);
      }
      expect(game.state).toBe('HAND_COMPLETE');
    }
  });

  it('never reveals Poker hole cards when a hand ends by folds', () => {
    const game = new PokerGame('AUDIT-FOLD', ['A', 'B', 'C'], {
      ...DEFAULT_POKER_TABLE_CONFIG,
      startingStack: 1_000,
    });
    game.dealHand();
    while (game.state !== 'HAND_COMPLETE') {
      const state = game.getPublicState();
      expect(game.act(state.currentTurn!, { type: 'FOLD' }, state.sequence).ok).toBe(true);
    }
    const state = game.getPublicState();
    expect(state.outcome?.reason).toBe('LAST_STANDING');
    expect(state.outcome?.showdown).toBeNull();
    expect(state.handHistory[0]?.showdown).toBeNull();
  });
});
