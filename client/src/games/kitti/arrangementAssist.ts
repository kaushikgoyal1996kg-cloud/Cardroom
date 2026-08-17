// ============================================================================
// KITTI - arrangement assistance eligibility (client mirror)
//
// The server is the authority and re-checks this rule on
// `kitti:requestSuggestion`. This client helper exists only to decide whether
// the Suggest control should be rendered.
//
// Fairness rule: a human may receive arrangement help only when EVERY
// opponent at the table is a computer player. One real human opponent is
// enough to disable assistance.
// ============================================================================

export interface KittiSeatOccupant {
  playerId: string;
  isBot: boolean;
}

export function canUseKittiArrangementAssist(
  occupants: KittiSeatOccupant[],
  playerId: string | null
): boolean {
  if (!playerId) return false;
  return occupants.every((occupant) => occupant.playerId === playerId || occupant.isBot);
}
