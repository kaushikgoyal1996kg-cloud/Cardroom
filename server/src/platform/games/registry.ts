// ============================================================================
// PLATFORM - Game registry
//
// The single source of truth for which games exist and what each one needs.
// Player limits live here rather than being read from any one game's rules
// module, so the room layer never has to know that Hazari happens to be a
// four-player game.
//
// Adding a game means adding an entry here and a controller in
// platform/games/controllers.ts. Nothing in platform/rooms should ever need
// to change.
// ============================================================================

export type GameId = 'HAZARI' | 'KITTI' | 'TEEN_PATTI';

export const GAME_IDS: GameId[] = ['HAZARI', 'KITTI', 'TEEN_PATTI'];

export interface GameDefinition {
  id: GameId;
  /** Shown to players. */
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /**
   * Some games need an exact number of players, not a range. Hazari is
   * always four. When set, a game cannot start with any other count.
   */
  requiredPlayers?: number;
  cardsPerPlayer: number;
  /**
   * False when the game has no working network controller yet. A room for a
   * non-playable game can never be created, so nobody can walk into a table
   * that cannot actually run.
   */
  networkPlayable: boolean;
  /** Shown to players when networkPlayable is false. */
  unavailableReason?: string;
}

/**
 * Player limits below are taken from each game's own rules module rather than
 * being retyped here, so they cannot drift apart:
 *   - Hazari:     GAME_RULES.PLAYER_COUNT = 4, CARDS_PER_PLAYER = 13
 *   - Kitti:      KITTI_RULES 2-5 players, 9 cards
 *   - Teen Patti: TEEN_PATTI_RULES 2-9 players, 3 cards
 * A drift test in tests/gameRegistry.test.ts asserts they still match.
 */
export const GAMES: Record<GameId, GameDefinition> = {
  HAZARI: {
    id: 'HAZARI',
    name: 'Hazari',
    minPlayers: 4,
    maxPlayers: 4,
    requiredPlayers: 4,
    cardsPerPlayer: 13,
    networkPlayable: true,
  },
  KITTI: {
    id: 'KITTI',
    name: 'Kitti',
    minPlayers: 2,
    maxPlayers: 5,
    cardsPerPlayer: 9,
    networkPlayable: true,
  },
  TEEN_PATTI: {
    id: 'TEEN_PATTI',
    name: 'Teen Patti',
    minPlayers: 2,
    maxPlayers: 9,
    cardsPerPlayer: 3,
    networkPlayable: false,
    unavailableReason: 'Not yet available online',
  },
};

export function isGameId(value: unknown): value is GameId {
  return typeof value === 'string' && (GAME_IDS as string[]).includes(value);
}

export function getGame(gameId: GameId): GameDefinition {
  const def = GAMES[gameId];
  if (!def) throw new Error(`Unknown game: ${gameId}`);
  return def;
}

/** Maximum seats at a table of this game. */
export function maxPlayersFor(gameId: GameId): number {
  return getGame(gameId).maxPlayers;
}

/**
 * Whether a table of this game can start with this many players.
 * Returns a player-facing message when it cannot.
 */
export function canStartWith(gameId: GameId, playerCount: number): { ok: boolean; error?: string } {
  const def = getGame(gameId);

  if (def.requiredPlayers !== undefined) {
    if (playerCount !== def.requiredPlayers) {
      return {
        ok: false,
        error: `${def.name} needs exactly ${def.requiredPlayers} players to start.`,
      };
    }
    return { ok: true };
  }

  if (playerCount < def.minPlayers) {
    return { ok: false, error: `${def.name} needs at least ${def.minPlayers} players to start.` };
  }
  if (playerCount > def.maxPlayers) {
    return { ok: false, error: `${def.name} allows at most ${def.maxPlayers} players.` };
  }
  return { ok: true };
}
