const RETURN_TO_CARDROOM_KEY = 'cardroom_return_once_v1';

/**
 * Marks a deliberate table/room exit. The next HomeScreen mount consumes
 * this one-shot flag and returns the player to THE CARD ROOM selector rather
 * than replaying the cold-launch Welcome threshold.
 */
export function requestReturnToCardRoom(): void {
  try {
    sessionStorage.setItem(RETURN_TO_CARDROOM_KEY, '1');
  } catch {
    /* sessionStorage may be unavailable in hardened/private contexts. */
  }
}

/** Consumes the deliberate-return flag exactly once. */
export function consumeReturnToCardRoom(): boolean {
  try {
    const requested = sessionStorage.getItem(RETURN_TO_CARDROOM_KEY) === '1';
    if (requested) sessionStorage.removeItem(RETURN_TO_CARDROOM_KEY);
    return requested;
  } catch {
    return false;
  }
}
