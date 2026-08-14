// ============================================================================
// HAZARI - Arrangement assistance eligibility (client mirror)
//
// Mirrors server/src/games/hazari/arrangementAssist.ts. The SERVER is the
// authority: both suggestion endpoints re-derive this from its own room state
// and refuse to compute anything when it is false, so emitting the socket
// event by hand from a console cannot bypass the rule.
//
// This copy exists so the UI can decide what to render. It must never be the
// only thing standing between a player and a suggestion.
//
// The rule: a player competing against ANY real human opponent gets no
// automatic arrangement assistance. Only bot-only tables permit it.
// ============================================================================

export interface SeatOccupant {
  playerId: string;
  isBot: boolean;
}

export interface AssistEligibility {
  allowed: boolean;
  humanOpponents: number;
  reason?: string;
}

export const ASSIST_BLOCKED_MESSAGE =
  'Arrangement help is only available when you are playing against the computer.';

/**
 * Deliberately NOT based on player count: a four-seat table with three bots
 * permits assistance, while one with a single human opponent and two bots
 * does not. Only opponents are counted, so the requesting player's own seat
 * never blocks them.
 */
export function getArrangementAssistEligibility(
  occupants: SeatOccupant[],
  playerId: string | null
): AssistEligibility {
  if (!playerId) return { allowed: false, humanOpponents: 0, reason: ASSIST_BLOCKED_MESSAGE };

  const humanOpponents = occupants.filter((o) => o.playerId !== playerId && !o.isBot).length;
  if (humanOpponents > 0) {
    return { allowed: false, humanOpponents, reason: ASSIST_BLOCKED_MESSAGE };
  }
  return { allowed: true, humanOpponents: 0 };
}

export function canUseArrangementAssist(
  occupants: SeatOccupant[],
  playerId: string | null
): boolean {
  return getArrangementAssistEligibility(occupants, playerId).allowed;
}
