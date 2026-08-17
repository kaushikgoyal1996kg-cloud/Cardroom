// ============================================================================
// PLATFORM - Client game catalog
//
// Mirrors the server's platform/games/registry. The server is authoritative:
// it will reject a create/quick-match for a game that is not networkPlayable,
// so this list exists only to render the Home screen honestly and to disable
// actions that would fail. If the two ever disagree, the server wins and the
// player sees its error.
// ============================================================================

import type { GameId } from '../../game/types';

export type CatalogGameId = GameId | 'POKER';

export interface GameCatalogEntry {
  id: CatalogGameId;
  name: string;
  /** Seat range, phrased for players. */
  players: string;
  minPlayers: number;
  maxPlayers: number;
  requiredPlayers?: number;
  cards: string;
  blurb: string;
  /** False when the game has no working server controller yet. */
  networkPlayable: boolean;
  /** Shown on the card when networkPlayable is false. */
  unavailableReason?: string;
}

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: 'HAZARI',
    name: 'Hazari',
    players: '4 players',
    minPlayers: 4,
    maxPlayers: 4,
    requiredPlayers: 4,
    cards: '13 cards',
    blurb: 'Split thirteen cards into four sets and race to a thousand.',
    networkPlayable: true,
  },
  {
    id: 'KITTI',
    name: 'Kitti',
    players: '2–5 players',
    minPlayers: 2,
    maxPlayers: 5,
    cards: '9 cards',
    blurb: 'Nine cards, three hands of three, one chance to arrange them well.',
    networkPlayable: true,
  },
  {
    id: 'TEEN_PATTI',
    name: 'Teen Patti',
    players: 'Up to 9 players',
    minPlayers: 2,
    maxPlayers: 9,
    cards: '3 cards',
    blurb: 'Three cards each. Play blind, play seen, or fold and wait.',
    networkPlayable: false,
    unavailableReason: 'Coming Soon',
  },
  {
    id: 'POKER',
    name: 'Poker',
    players: '2–9 players',
    minPlayers: 2,
    maxPlayers: 9,
    cards: 'Community cards',
    blurb: 'A future table for classic poker nights in the same private card room.',
    networkPlayable: false,
    unavailableReason: 'Coming Soon',
  },
];


export function isRuntimeGameId(id: CatalogGameId): id is GameId {
  return id !== 'POKER';
}

export function catalogEntry(id: CatalogGameId): GameCatalogEntry {
  const entry = GAME_CATALOG.find((g) => g.id === id);
  if (!entry) throw new Error(`Unknown game: ${id}`);
  return entry;
}
