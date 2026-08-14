// ============================================================================
// HAZARI - Arrangement assistance eligibility
//
// GAME-INTEGRITY RULE (product decision, not a card rule):
// A player competing against ANY real human opponent gets no automatic
// arrangement assistance. They must arrange their own thirteen cards.
//
// Assistance is permitted only when every opponent is a bot - i.e. practice
// against the computer, where there is nobody to be unfair to.
//
// This lives on the server and is the authority. The client mirrors it to
// decide what to render, but the client is never trusted: the suggestion
// endpoints re-check this before generating anything, so emitting the socket
// event by hand from a browser console cannot bypass it.
//
// NOTE ON SCOPE: this gates *assistance* only. It does not touch arrangement
// validation, hand classification, ranking, scoring or dismissal - all of
// which behave identically whether or not assistance is available.
// ============================================================================

/** The minimum a caller must know about a seated player to apply the rule. */
export interface SeatOccupant {
  playerId: string;
  isBot: boolean;
}

export interface AssistEligibility {
  allowed: boolean;
  /** Number of real human opponents found. Zero means assistance is allowed. */
  humanOpponents: number;
  /** Player-facing explanation when assistance is refused. */
  reason?: string;
}

export const ASSIST_BLOCKED_MESSAGE =
  'Arrangement help is only available when you are playing against the computer.';

/**
 * Decides whether `playerId` may receive arrangement assistance.
 *
 * Deliberately NOT based on player count. A table of four where three seats
 * are bots permits assistance; a table of four with one human opponent and
 * two bots does not.
 *
 * A seat that a human abandoned via "Leave Table" has been converted to a bot
 * (roomManager.convertToBot sets isBot), so it correctly stops counting as a
 * human opponent from that point on - there is no longer a person to
 * disadvantage.
 *
 * The requesting player's own isBot flag is irrelevant: only OPPONENTS are
 * counted, so a player is never blocked by their own seat.
 */
export function getArrangementAssistEligibility(
  occupants: SeatOccupant[],
  playerId: string
): AssistEligibility {
  const humanOpponents = occupants.filter((o) => o.playerId !== playerId && !o.isBot).length;

  if (humanOpponents > 0) {
    return { allowed: false, humanOpponents, reason: ASSIST_BLOCKED_MESSAGE };
  }
  return { allowed: true, humanOpponents: 0 };
}

/** Convenience wrapper for call sites that only need the boolean. */
export function canUseArrangementAssist(
  occupants: SeatOccupant[],
  playerId: string
): boolean {
  return getArrangementAssistEligibility(occupants, playerId).allowed;
}
