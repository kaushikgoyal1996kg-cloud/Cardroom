// ============================================================================
// PLATFORM - Game session boundary
//
// A deliberately small interface. The room layer needs to know only four
// things about a running game: which game it is, whether it has finished,
// what is safe to broadcast, and what belongs privately to one player.
//
// Everything else - dealing, turn order, betting, scoring - stays inside the
// game's own engine and its own socket handlers. This is not a framework and
// should not grow into one.
// ============================================================================

import type { GameId } from './registry.js';

export interface GameSession {
  readonly gameId: GameId;
  /** Engine state name, for display and for room bookkeeping. */
  readonly state: string;
  /** True once the game has run to completion and Play Again is allowed. */
  isComplete(): boolean;
  /** Safe to send to every client in the room. Must never contain hidden cards. */
  getPublicState(): unknown;
  /**
   * State belonging to one player alone - their own cards, their own
   * arrangement. Sent only down that player's private channel.
   */
  getPrivateState(playerId: string): unknown;
}
