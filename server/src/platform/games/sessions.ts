// ============================================================================
// PLATFORM - Session factory and per-game adapters
//
// Each adapter is a thin wrapper around a game's existing engine. The engines
// themselves are never modified to fit this interface - that is the whole
// point of the wrapper.
// ============================================================================

import { HaazariGame } from '../../games/hazari/gameEngine.js';
import type { GameSession } from './session.js';
import { getGame, type GameId } from './registry.js';

/**
 * Hazari adapter.
 *
 * Wraps the existing, tested HaazariGame without altering a line of it. The
 * engine is exposed as `engine` so the Hazari socket handlers can reach the
 * full API they already use; the room layer only ever touches the GameSession
 * methods above it.
 */
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

export class GameNotAvailableError extends Error {
  constructor(gameId: GameId, reason?: string) {
    super(reason ?? `${gameId} is not available to play online yet.`);
    this.name = 'GameNotAvailableError';
  }
}

/**
 * Creates the session for a room's chosen game.
 *
 * A game with no working controller throws rather than falling back to
 * anything. In particular there is no path by which a Kitti or Teen Patti
 * room can end up running a HaazariGame - the switch has no default case that
 * could do so, and both non-Hazari branches throw.
 */
export function createGameSession(
  gameId: GameId,
  roomCode: string,
  playersClockwise: string[]
): GameSession {
  const def = getGame(gameId);

  if (!def.networkPlayable) {
    throw new GameNotAvailableError(gameId, def.unavailableReason);
  }

  switch (gameId) {
    case 'HAZARI':
      return new HazariSession(roomCode, playersClockwise);
    case 'KITTI':
    case 'TEEN_PATTI':
      // Engines exist and are tested, but neither has a network controller
      // yet. Reaching here means the registry was flipped to networkPlayable
      // before the controller was written.
      throw new GameNotAvailableError(gameId, `${def.name} has no server controller yet.`);
  }
}

/**
 * Narrows a session to Hazari. Every Hazari socket handler goes through this
 * one function, so there is exactly one place where the type is narrowed
 * rather than a cast at each call site.
 */
export function asHazari(session: GameSession | undefined): HaazariGame | null {
  if (!session || session.gameId !== 'HAZARI') return null;
  return (session as HazariSession).engine;
}
