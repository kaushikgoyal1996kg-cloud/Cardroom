// ============================================================================
// KITTI - Rules configuration
//
// Everything in CONFIRMED_RULES was explicitly supplied by the owner.
// Everything in UNRESOLVED_RULES is NOT implemented and must not be guessed.
// The engine refuses to score a round while any required rule is unresolved,
// rather than silently inventing behaviour. See KITTI RULE QUESTIONS in the
// project README.
// ============================================================================

export interface KittiRulesConfig {
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  CARDS_PER_PLAYER: number;
  GROUP_COUNT: number;
  GROUP_SIZE: number;
  /** Owner confirmed explicitly: 2-3-5 is NOT a special hand in this house. */
  TWO_THREE_FIVE_IS_SPECIAL: false;
  DEAL_DIRECTION: 'CLOCKWISE';
  DEALER_ROTATION: 'CLOCKWISE';
}

export const KITTI_RULES: KittiRulesConfig = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 5,
  CARDS_PER_PLAYER: 9,
  GROUP_COUNT: 3,
  GROUP_SIZE: 3,
  TWO_THREE_FIVE_IS_SPECIAL: false,
  DEAL_DIRECTION: 'CLOCKWISE',
  DEALER_ROTATION: 'CLOCKWISE',
};

/**
 * Rules that are genuinely required to finish a game of Kitti but which the
 * owner has NOT yet confirmed. Each is a hard blocker on scoring.
 *
 * The engine exposes everything that does NOT depend on these (dealing,
 * arrangement, per-group comparison), so the table, animations and UI can be
 * built and tested now, and scoring drops in once the answers arrive.
 */
export const UNRESOLVED_RULES = [
  'GROUP_ORDERING',   // must the three groups be ordered strongest -> weakest?
  'SCORING',          // what points does winning a group award?
  'WIN_CONDITION',    // what ends the game - target score, fixed rounds, other?
  'TIE_RESOLUTION',   // how is an exact tie between two equal groups resolved?
  'STARTING_PLAYER',  // who leads - dealer, or left of dealer?
] as const;

export type UnresolvedRule = (typeof UNRESOLVED_RULES)[number];

/**
 * Set to true ONLY once every entry in UNRESOLVED_RULES has been answered by
 * the owner and implemented. Guards scoring so an unconfirmed rule can never
 * silently reach a real game.
 */
export const KITTI_SCORING_CONFIRMED = false;

export class KittiRuleUnresolvedError extends Error {
  constructor(rule: UnresolvedRule | 'SCORING_SET') {
    super(
      `Kitti rule "${rule}" has not been confirmed by the owner. ` +
        `Kitti scoring is intentionally disabled until it is - see KITTI RULE QUESTIONS.`
    );
    this.name = 'KittiRuleUnresolvedError';
  }
}
