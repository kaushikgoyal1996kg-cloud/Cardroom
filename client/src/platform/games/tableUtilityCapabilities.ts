import type { GameId } from '../../game/types';

export interface TableUtilityCapabilities {
  stats: boolean;
  statsLabel: 'Your Stats' | 'Table Stats';
  history: boolean;
  historyLabel: 'Round History' | 'Hand History';
}

/**
 * Shared Settings must never fall through to another game's data shape.
 * Hazari/Kitti use completed-match device stats; Teen Patti/Poker are
 * open-ended tables and expose authoritative current-table virtual-chip stats.
 */
export function tableUtilityCapabilities(gameId: GameId): TableUtilityCapabilities {
  switch (gameId) {
    case 'HAZARI':
    case 'KITTI':
      return { stats: true, statsLabel: 'Your Stats', history: true, historyLabel: 'Round History' };
    case 'TEEN_PATTI':
      return { stats: true, statsLabel: 'Table Stats', history: true, historyLabel: 'Round History' };
    case 'POKER':
      return { stats: true, statsLabel: 'Table Stats', history: true, historyLabel: 'Hand History' };
  }
}
