// ============================================================================
// KITTI - Authoritative house rules
//
// Source of truth: RULES_KITTI.md. These are the owner's agreed rules.
// Do not change game behaviour here without changing that specification.
// ============================================================================

export interface KittiRulesConfig {
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  CARDS_PER_PLAYER: number;
  GROUP_COUNT: number;
  GROUP_SIZE: number;
  MATCH_ROUNDS: number;
  HANDS_TO_WIN_ROUND: number;
  /** Owner confirmed explicitly: 2-3-5 is NOT a special hand. */
  TWO_THREE_FIVE_IS_SPECIAL: false;
  DEAL_DIRECTION: 'CLOCKWISE';
  /** Cards are dealt one at a time starting AT the dealer. */
  DEAL_STARTS_AT_DEALER: true;
  DEALER_ROTATION: 'CLOCKWISE';
  /** First hand is led by the player immediately clockwise/left of dealer. */
  FIRST_LEAD: 'AFTER_DEALER';
  /** Exact equal hands are won by the later thrower. */
  EXACT_TIE: 'LATER_THROWER_WINS';
  /** If all three hands have different winners, a one-hand decider is played. */
  THREE_WINNER_DECIDER: true;
}

export const KITTI_RULES: KittiRulesConfig = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 5,
  CARDS_PER_PLAYER: 9,
  GROUP_COUNT: 3,
  GROUP_SIZE: 3,
  MATCH_ROUNDS: 10,
  HANDS_TO_WIN_ROUND: 2,
  TWO_THREE_FIVE_IS_SPECIAL: false,
  DEAL_DIRECTION: 'CLOCKWISE',
  DEAL_STARTS_AT_DEALER: true,
  DEALER_ROTATION: 'CLOCKWISE',
  FIRST_LEAD: 'AFTER_DEALER',
  EXACT_TIE: 'LATER_THROWER_WINS',
  THREE_WINNER_DECIDER: true,
};

/**
 * The previously unresolved questions have all been answered in
 * RULES_KITTI.md. Keep the export for compatibility with older tests/docs,
 * but it must stay empty unless a genuinely new rule question is introduced.
 */
export const UNRESOLVED_RULES = [] as const;
export type UnresolvedRule = never;

/** Kitti's round/match rules are now fully specified and implemented. */
export const KITTI_SCORING_CONFIRMED = true;
