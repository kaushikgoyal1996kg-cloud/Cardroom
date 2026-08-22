import { describe, expect, it } from 'vitest';
import { TeenPattiGame } from '../src/games/teenpatti/engine.js';
import { PokerGame } from '../src/games/poker/engine.js';
import type { PokerTableConfig } from '../src/games/poker/rules.js';
import {
  hasPendingPokerBotAction,
  hasPendingTeenPattiBotAction,
  performOnePokerBotAction,
  performOneTeenPattiBotAction,
} from '../src/platform/net/socketHandlers.js';

function botRoom(gameId: 'TEEN_PATTI' | 'POKER', engine: TeenPattiGame | PokerGame, ids: string[]) {
  return {
    roomCode: 'BOTS',
    gameId,
    players: new Map(ids.map((playerId) => [playerId, {
      playerId, token: `token-${playerId}`, name: playerId, avatar: 'avatar',
      connected: true, ready: true, isBot: true,
    }])),
    game: { gameId, engine },
  } as any;
}

describe('Teen Patti and Poker table bots', () => {
  it('drives a bots-only Classic Teen Patti round to completion', () => {
    const ids = ['p1', 'p2', 'p3'];
    const game = new TeenPattiGame('TP-BOTS', ids, { initialDealerId: 'p1' });
    const room = botRoom('TEEN_PATTI', game, ids);
    game.dealNewRound();
    let actions = 0;
    while (game.state !== 'ROUND_COMPLETE' && actions < 100) {
      expect(hasPendingTeenPattiBotAction(room)).toBe(true);
      expect(performOneTeenPattiBotAction(room, game)).toBe(true);
      actions += 1;
    }
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(actions).toBeLessThan(100);
  });

  it('supplies required dealer configuration for a bot-chosen Teen Patti variant', () => {
    const ids = ['p1', 'p2'];
    const game = new TeenPattiGame('TP-CONFIG-BOT', ids, {
      initialDealerId: 'p1',
      roundVariant: { variantId: 'CLOSEST_TO_N', targetNumber: 500, reorderTargetCards: true },
      variantPolicy: { mode: 'VARIANT_TABLE', variants: ['CLOSEST_TO_N', 'CLASSIC'], rotation: 'DEALER_CHOICE' },
    });
    const room = botRoom('TEEN_PATTI', game, ids);
    game.dealNewRound();
    expect(game.state).toBe('AWAITING_VARIANT');
    expect(performOneTeenPattiBotAction(room, game)).toBe(true);
    expect(game.state).not.toBe('AWAITING_VARIANT');
    expect(game.getPublicState().variant).toMatchObject({
      variantId: 'CLOSEST_TO_N', targetNumber: 500, reorderTargetCards: true,
    });
  });

  it('drives a bots-only Poker hand through legal check/call/fold actions', () => {
    const ids = ['A', 'B', 'C'];
    const config: PokerTableConfig = {
      mode: 'FIXED', fixedVariant: 'TEXAS_HOLDEM', startingStack: 1000,
      smallBlind: 10, bigBlind: 20, ante: 0, actionTimerSeconds: 0,
    };
    const game = new PokerGame('PK-BOTS', ids, config, 'A');
    const room = botRoom('POKER', game, ids);
    game.dealHand();
    let actions = 0;
    while (game.state !== 'HAND_COMPLETE' && actions < 100) {
      expect(hasPendingPokerBotAction(room)).toBe(true);
      expect(performOnePokerBotAction(room, game)).toBe(true);
      actions += 1;
    }
    expect(game.state).toBe('HAND_COMPLETE');
    expect(actions).toBeLessThan(100);
  });
});
