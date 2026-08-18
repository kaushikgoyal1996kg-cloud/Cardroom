import type { Card, DismissalReason, PlayerId } from './types.js';
import { GAME_RULES } from './rules.js';
import { hasSixPairs, handHasNoPossibleSequence } from './hands.js';

// ============================================================================
// DISMISSAL - a player-elected action, NOT automatic (per Section 24: "not
// compulsory"). Meeting a dismissal condition only makes a player ELIGIBLE
// to invoke dismissal; they may still choose to play on instead.
//
// IMPORTANT: when a dismissal IS invoked, it voids the round for ALL FOUR
// players, not just the one who dismissed - nobody can fold mid-round, so
// every player always plays every set in a round that isn't dismissed. A
// dismissed round awards 0 points to everyone, and the dealer still rotates
// clockwise before the next dealer deals a fresh round.
//
// This module is the single source of truth for dismissal. UI components
// must call getDismissalEligibility() to decide whether to show a "Dismiss
// Hand" button, and the server must call processDismissalRequest() again to
// authoritatively verify eligibility before honoring any dismiss request -
// never trust a client's claim that it's eligible.
// ============================================================================

export interface DismissalEligibility {
  eligible: boolean;
  reasons: DismissalReason[];
}

/**
 * Checks whether a player's hand currently qualifies them to dismiss.
 * - Condition 1 (NO_SEQUENCE): evaluated on the raw 13-card deal. If no
 *   3-card subset can form a Sequence or Pure Sequence, the hand is eligible.
 *   Trial/Trail is NOT a sequence and does not block dismissal.
 * - Condition 2 (SIX_PAIRS): evaluated on the raw 13-card hand.
 * A player is eligible if EITHER enabled condition is met.
 */
export function getDismissalEligibility(
  rawHand: Card[],
  _confirmedSets?: [Card[], Card[], Card[], Card[]]
): DismissalEligibility {
  const reasons: DismissalReason[] = [];

  if (GAME_RULES.SIX_PAIRS_DISMISSAL && hasSixPairs(rawHand)) {
    reasons.push('SIX_PAIRS');
  }

  if (GAME_RULES.NO_SEQUENCE_DISMISSAL && handHasNoPossibleSequence(rawHand)) {
    reasons.push('NO_SEQUENCE');
  }

  return { eligible: reasons.length > 0, reasons };
}

export interface DismissalRequest {
  playerId: PlayerId;
  claimedReason: DismissalReason;
}

export interface DismissalOutcome {
  accepted: boolean;
  error?: string;
  action: 'VOID_ROUND_ROTATE_DEALER' | 'NONE';
}

/**
 * Server-side authoritative handler for a dismiss request. Re-derives
 * eligibility from server-held state (never trusts the client) and, if
 * valid, signals that the WHOLE round must be voided for all four players:
 * - no sub-rounds are scored
 * - every player receives 0 points for this round
 * - the dealer rotates clockwise as normal
 * - the next dealer deals a fresh round
 */
export function processDismissalRequest(
  request: DismissalRequest,
  rawHand: Card[],
  confirmedSets: [Card[], Card[], Card[], Card[]] | undefined
): DismissalOutcome {
  const eligibility = getDismissalEligibility(rawHand, confirmedSets);
  if (!eligibility.eligible) {
    return { accepted: false, error: 'You are not eligible to dismiss this hand.', action: 'NONE' };
  }
  if (!eligibility.reasons.includes(request.claimedReason)) {
    return {
      accepted: false,
      error: `Dismissal reason ${request.claimedReason} does not apply to your hand.`,
      action: 'NONE',
    };
  }
  return { accepted: true, action: GAME_RULES.DISMISSED_ROUND_ACTION };
}
