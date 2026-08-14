// ============================================================================
// PLATFORM - Session/reconnection configuration
//
// Reconnection is a platform concern, not a game rule: a player who loses
// Wi-Fi mid-hand should get the same grace period whichever game they are
// playing. This used to be read from Hazari's GAME_RULES, which meant the
// room layer imported a game's rules module purely to learn a network
// timeout. The value is unchanged.
// ============================================================================

/** How long a disconnected player keeps their seat before it can be swept. */
export const RECONNECT_WINDOW_MS = 3 * 60 * 1000;
