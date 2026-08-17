// ============================================================================
// PLATFORM - Session factory and per-game adapters
// ============================================================================

import { HaazariGame } from '../../games/hazari/gameEngine.js';
import { KittiGame } from '../../games/kitti/engine.js';
import { TeenPattiGame } from '../../games/teenpatti/engine.js';
import type { TeenPattiRoundVariantConfig, TeenPattiTableConfig } from '../../games/teenpatti/rules.js';
import type { GameSession } from './session.js';
import { getGame, type GameId } from './registry.js';

export class HazariSession implements GameSession {
  readonly gameId = 'HAZARI' as const;
  readonly engine: HaazariGame;

  constructor(roomCode: string, playersClockwise: string[], initialDealerId?: string) {
    this.engine = new HaazariGame(roomCode, playersClockwise, initialDealerId);
  }

  get state(): string {
    return this.engine.state;
  }

  isComplete(): boolean {
    return this.engine.state === 'GAME_COMPLETE';
  }

  getPublicState() {
    return this.engine.getPublicState();
  }

  getPrivateState(playerId: string) {
    return {
      hand: this.engine.getPlayerHand(playerId),
      arrangement: this.engine.getPlayerArrangement(playerId),
    };
  }
}

export class KittiSession implements GameSession {
  readonly gameId = 'KITTI' as const;
  readonly engine: KittiGame;

  constructor(roomCode: string, playersClockwise: string[]) {
    this.engine = new KittiGame(roomCode, playersClockwise);
  }

  get state(): string {
    return this.engine.state;
  }

  isComplete(): boolean {
    return this.engine.isComplete();
  }

  getPublicState() {
    return this.engine.getPublicState();
  }

  getPrivateState(playerId: string) {
    return this.engine.getPrivateState(playerId);
  }
}


export class TeenPattiSession implements GameSession {
  readonly gameId = 'TEEN_PATTI' as const;
  readonly engine: TeenPattiGame;

  constructor(
    roomCode: string,
    playersClockwise: string[],
    tableConfig: TeenPattiTableConfig,
    roundVariant: TeenPattiRoundVariantConfig
  ) {
    this.engine = new TeenPattiGame(roomCode, playersClockwise, { tableConfig, roundVariant });
  }

  get state(): string {
    return this.engine.state;
  }

  // Teen Patti is an open-ended table session. A round finishing does not
  // finish the table itself; players explicitly leave/stop instead.
  isComplete(): boolean {
    return false;
  }

  getPublicState() {
    return this.engine.getPublicState();
  }

  getPrivateState(playerId: string) {
    return this.engine.getPrivateState(playerId);
  }
}

export interface GameSessionOptions {
  teenPatti?: {
    tableConfig: TeenPattiTableConfig;
    roundVariant: TeenPattiRoundVariantConfig;
  };
}

export class GameNotAvailableError extends Error {
  constructor(gameId: GameId, reason?: string) {
    super(reason ?? `${gameId} is not available to play online yet.`);
    this.name = 'GameNotAvailableError';
  }
}

export function createGameSession(
  gameId: GameId,
  roomCode: string,
  playersClockwise: string[],
  options: GameSessionOptions = {}
): GameSession {
  const def = getGame(gameId);
  if (!def.networkPlayable) {
    throw new GameNotAvailableError(gameId, def.unavailableReason);
  }

  switch (gameId) {
    case 'HAZARI':
      return new HazariSession(roomCode, playersClockwise);
    case 'KITTI':
      return new KittiSession(roomCode, playersClockwise);
    case 'TEEN_PATTI': {
      const setup = options.teenPatti;
      if (!setup) throw new GameNotAvailableError(gameId, `${def.name} needs an approved table setup.`);
      return new TeenPattiSession(roomCode, playersClockwise, setup.tableConfig, setup.roundVariant);
    }
  }
}

/** Exactly one narrowing point per concrete game. */
export function asHazari(session: GameSession | undefined): HaazariGame | null {
  if (!session || session.gameId !== 'HAZARI') return null;
  return (session as HazariSession).engine;
}

export function asKitti(session: GameSession | undefined): KittiGame | null {
  if (!session || session.gameId !== 'KITTI') return null;
  return (session as KittiSession).engine;
}

export function asTeenPatti(session: GameSession | undefined): TeenPattiGame | null {
  if (!session || session.gameId !== 'TEEN_PATTI') return null;
  return (session as TeenPattiSession).engine;
}
