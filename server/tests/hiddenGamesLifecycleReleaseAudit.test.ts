import { describe, expect, it } from 'vitest';
import { TeenPattiGame } from '../src/games/teenpatti/engine.js';
import {
  DEFAULT_TEEN_PATTI_TABLE_CONFIG,
  type TeenPattiRoundVariantConfig,
} from '../src/games/teenpatti/rules.js';
import { PokerGame } from '../src/games/poker/engine.js';
import {
  DEFAULT_POKER_TABLE_CONFIG,
  DEFAULT_VARIANT_TABLE_CONFIG,
} from '../src/games/poker/rules.js';

function finishTeenPattiRound(game: TeenPattiGame): void {
  let guard = 0;
  while (game.state !== 'ROUND_COMPLETE' && guard++ < 250) {
    const state = game.getPublicState();
    if (state.state === 'AWAITING_VARIANT') {
      const requested: TeenPattiRoundVariantConfig = { ...state.variant };
      if (requested.variantId === 'CLOSEST_TO_N') {
        requested.targetNumber = 786;
        requested.reorderTargetCards = false;
      }
      if (requested.variantId.startsWith('DISCARD_')) requested.fiveCardJoker = 'NONE';
      expect(state.nextVariantChooserId).toBeTruthy();
      expect(game.chooseRoundVariant(state.nextVariantChooserId!, requested, state.sequence).ok).toBe(true);
      continue;
    }
    if (state.state === 'AWAITING_DISCARD') {
      const sharedSequence = state.sequence;
      for (const player of state.players) {
        const discard = game.getPrivateState(player.playerId)?.discardState;
        if (discard && !discard.complete) {
          expect(game.chooseDiscards(player.playerId, discard.legalSelections[0], sharedSequence).ok).toBe(true);
        }
      }
      continue;
    }
    if (state.state === 'AWAITING_REFERENCE_ASSIGNMENT') {
      const sharedSequence = state.sequence;
      for (const playerId of state.referenceAssignmentRequiredPlayerIds) {
        if (!game.getPrivateState(playerId)?.twoReferenceAssignment) {
          expect(game.assignTwoReference(playerId, 0, sharedSequence).ok).toBe(true);
        }
      }
      continue;
    }
    expect(state.state).toBe('BETTING');
    expect(state.currentTurn).toBeTruthy();
    expect(game.act(state.currentTurn!, { type: 'PACK' }, state.sequence).ok).toBe(true);
  }
  expect(game.state).toBe('ROUND_COMPLETE');
}

function finishPokerHand(game: PokerGame): void {
  let guard = 0;
  while (game.state !== 'HAND_COMPLETE' && guard++ < 500) {
    const state = game.getPublicState();
    expect(state.state).not.toBe('AWAITING_VARIANT');
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

describe('hidden-game lifecycle release audit', () => {
  it('transfers Teen Patti Dealer Choice when the upcoming dealer settles before choosing', () => {
    const players = ['A', 'B', 'C', 'D'];
    const game = new TeenPattiGame('TP-DEALER-LEAVE', players, {
      initialDealerId: 'A',
      tableConfig: { ...DEFAULT_TEEN_PATTI_TABLE_CONFIG, startingBalance: 10_000 },
      roundVariant: { variantId: 'CLASSIC' },
      variantPolicy: { mode: 'VARIANT_TABLE', variants: ['CLASSIC', 'K_LITTLE'], rotation: 'DEALER_CHOICE' },
    });

    game.startSession();
    expect(game.state).toBe('AWAITING_VARIANT');
    const departingDealer = game.getPublicState().nextVariantChooserId!;
    const leave = game.leaveTable(departingDealer);
    expect(leave.remainingPlayerIds).not.toContain(departingDealer);

    const restoredChoice = game.getPublicState();
    expect(restoredChoice.state).toBe('AWAITING_VARIANT');
    expect(restoredChoice.nextVariantChooserId).toBeTruthy();
    expect(restoredChoice.nextVariantChooserId).not.toBe(departingDealer);
    expect(game.chooseRoundVariant(restoredChoice.nextVariantChooserId!, { variantId: 'K_LITTLE' }, restoredChoice.sequence).ok).toBe(true);
    finishTeenPattiRound(game);
  });

  it('restores an accepted Friendly Assist session from private state and clears it at the next hand', () => {
    const game = new TeenPattiGame('TP-ASSIST-RESTORE', ['A', 'B', 'C'], {
      initialDealerId: 'A',
      tableConfig: { ...DEFAULT_TEEN_PATTI_TABLE_CONFIG, startingBalance: 10_000, friendlyAssist: true },
      roundVariant: { variantId: 'CLASSIC' },
      variantPolicy: { mode: 'FIXED', fixedVariant: 'CLASSIC' },
    });
    game.startSession();

    let guard = 0;
    while (!game.getPlayer('A')!.packed && guard++ < 12) {
      const state = game.getPublicState();
      expect(state.currentTurn).toBeTruthy();
      if (state.currentTurn === 'A') {
        expect(game.act('A', { type: 'PACK' }, state.sequence).ok).toBe(true);
      } else {
        const turn = game.getPlayer(state.currentTurn!)!;
        const action = turn.seen ? { type: 'CHAAL' as const } : { type: 'BLIND' as const };
        expect(game.act(state.currentTurn!, action, state.sequence).ok).toBe(true);
      }
    }

    expect(game.requestFriendlyAssist('A', 'B', game.getPublicState().roundNumber).ok).toBe(true);
    const pending = game.getPrivateState('A')!.friendlyAssist.outgoing!;
    expect(pending.targetCards).toHaveLength(0);
    expect(game.respondFriendlyAssist('B', pending.requestId, true).ok).toBe(true);

    // Reconnect restoration sends getPrivateState() again from the same live
    // server session. Consent must therefore survive transport loss without
    // widening card visibility to anybody else.
    expect(game.getPrivateState('A')!.friendlyAssist.outgoing!.targetCards).toHaveLength(3);
    expect(game.getPrivateState('C')!.friendlyAssist.outgoing).toBeNull();

    finishTeenPattiRound(game);
    game.dealNewRound();
    expect(game.getPrivateState('A')!.friendlyAssist.outgoing).toBeNull();
    expect(game.getPrivateState('A')!.friendlyAssist.coachLockedTargetPlayerId).toBeNull();
  });

  it('transfers Poker Dealer Choice when its dealer settles before the hand', () => {
    const game = new PokerGame('POKER-DEALER-LEAVE', ['A', 'B', 'C', 'D'], {
      ...DEFAULT_VARIANT_TABLE_CONFIG,
      variants: ['TEXAS_HOLDEM', 'PLO4'],
      startingStack: 10_000,
    }, 'A');

    game.dealHand();
    expect(game.state).toBe('AWAITING_VARIANT');
    const departingDealer = game.getPublicState().nextVariantChooserId!;
    expect(game.leaveTable(departingDealer).remainingPlayerIds).not.toContain(departingDealer);

    const state = game.getPublicState();
    expect(state.nextVariantChooserId).toBeTruthy();
    expect(state.nextVariantChooserId).not.toBe(departingDealer);
    game.chooseNextVariant(state.nextVariantChooserId!, 'PLO4', state.sequence);
    finishPokerHand(game);
  });

  it('purges a settled Poker dealer exactly once before the next hand', () => {
    const players = ['A', 'B', 'C'];
    const game = new PokerGame('POKER-BUTTON-LEAVE', players, {
      ...DEFAULT_POKER_TABLE_CONFIG,
      startingStack: 10_000,
    }, 'A');

    game.dealHand();
    finishPokerHand(game);
    const departingDealer = game.getPublicState().dealerId;
    const before = [...game.seatedPlayerIds];
    const expectedNextDealer = before[(before.indexOf(departingDealer) + 1) % before.length];

    game.leaveTable(departingDealer);
    game.dealHand();
    expect(game.getPublicState().dealerId).toBe(expectedNextDealer);
    expect(game.seatedPlayerIds).not.toContain(departingDealer);
    finishPokerHand(game);
  });
});
