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

export interface GameCatalogEntry {
  id: GameId;
  name: string;
  /** Seat range, phrased for players. */
  players: string;
  cards: string;
  blurb: string;
  flagship?: boolean;
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
    cards: '13 cards',
    blurb: 'Split thirteen cards into four sets and race to a thousand.',
    flagship: true,
    networkPlayable: true,
  },
  {
    id: 'KITTI',
    name: 'Kitti',
    players: '2–5 players',
    cards: '9 cards',
    blurb: 'Nine cards, three hands of three, one chance to arrange them well.',
    networkPlayable: false,
    unavailableReason: 'Scoring rules still to be confirmed',
  },
  {
    id: 'TEEN_PATTI',
    name: 'Teen Patti',
    players: 'Up to 9 players',
    cards: '3 cards',
    blurb: 'Three cards each. Play blind, play seen, or fold and wait.',
    networkPlayable: false,
    unavailableReason: 'Not playable online yet',
  },
];

export function catalogEntry(id: GameId): GameCatalogEntry {
  const entry = GAME_CATALOG.find((g) => g.id === id);
  if (!entry) throw new Error(`Unknown game: ${id}`);
  return entry;
}
