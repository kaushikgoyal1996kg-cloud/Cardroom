import type { GuideGameId } from '../platform/games/gameGuides';

const GUIDE_SEEN_PREFIX = 'cardroom_game_guide_seen_v2';

function keyFor(gameId: GuideGameId): string {
  return `${GUIDE_SEEN_PREFIX}:${gameId}`;
}

/**
 * Guides are remembered independently per game. Seeing Hazari must never
 * suppress Kitti's guide (or vice versa) in a multi-game card room.
 */
export function hasSeenTutorial(gameId: GuideGameId): boolean {
  try {
    return localStorage.getItem(keyFor(gameId)) === 'true';
  } catch {
    return true; // if storage is unavailable, don't trap the player in a modal
  }
}

export function markTutorialSeen(gameId: GuideGameId): void {
  try {
    localStorage.setItem(keyFor(gameId), 'true');
  } catch {
    /* ignore storage failures */
  }
}
