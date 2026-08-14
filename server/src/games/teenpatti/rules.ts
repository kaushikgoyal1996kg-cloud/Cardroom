// ============================================================================
// TEEN PATTI - Rules configuration
//
// NO REAL MONEY. All chips are virtual counters shared between friends.
// There is no deposit, withdrawal, purchase or payment path anywhere in this
// codebase, by design.
//
// UNIVERSAL rules (no meaningful variation - implemented directly):
//   - 3 cards per player, dealt one at a time clockwise
//   - hand ranking: Trail > Pure Sequence > Sequence > Colour > Pair > High Card
//   - A-K-Q is the highest sequence; A-2-3 is the second highest
//   - a player may play blind (without looking) or seen (after looking)
//   - a seen player's stake is double a blind player's stake
//   - packing (folding) forfeits the pot contribution
//   - when one player remains unpacked, they win the pot
//
// VARIANT settings live in TEEN_PATTI_VARIANTS below. Each has a mainstream
// default so the game is playable immediately, but every one is DISCLOSED in
// TEEN PATTI RULE QUESTIONS rather than silently chosen. Change them in this
// one file - nothing else reads these values directly.
// ============================================================================

export interface TeenPattiVariantConfig {
  /** Compulsory ante every player posts before the deal. */
  BOOT_AMOUNT: number;
  /** Virtual chips each player starts a session with. */
  STARTING_CHIPS: number;
  /** Blind players may bet 1x or 2x the current stake. */
  BLIND_MULTIPLIERS: [number, number];
  /** Seen players bet double a blind player: 2x or 4x the current stake. */
  SEEN_MULTIPLIERS: [number, number];
  /** Max blind turns a player may take before being forced to look. 0 = unlimited. */
  MAX_BLIND_ROUNDS: number;
  /** Pot cap; play forces a show once reached. 0 = no cap. */
  POT_LIMIT: number;
  /** Whether a seen player may request a side show with the previous seen player. */
  SIDE_SHOW_ENABLED: boolean;
  /** Cost of a show relative to the current stake. */
  SHOW_COST_MULTIPLIER: number;
  /** How an exact tie at showdown resolves. */
  TIE_RESOLUTION: 'SPLIT_POT' | 'DEALER_CLOSEST_WINS';
}

/**
 * Mainstream defaults. Every value here is listed under TEEN PATTI RULE
 * QUESTIONS - confirm or change them and nothing else needs touching.
 *
 * WHY MAX_BLIND_ROUNDS AND POT_LIMIT ARE NOT ZERO:
 * A blind player cannot call for a show (that is a universal rule, not a
 * variant). So with both limits disabled, a table where everyone keeps
 * playing blind has no forced ending - the round only stops when somebody
 * physically runs out of chips. Measured on a 6-player table at the default
 * boot: 599 betting turns for a single round. That is unplayable, so both
 * limits are enabled by default purely to guarantee a round terminates.
 * The specific numbers are house choices and are listed as owner questions.
 */
export const TEEN_PATTI_VARIANTS: TeenPattiVariantConfig = {
  BOOT_AMOUNT: 10,
  STARTING_CHIPS: 1000,
  BLIND_MULTIPLIERS: [1, 2],
  SEEN_MULTIPLIERS: [2, 4],
  /** Forced to look after this many blind turns. Guarantees a show is reachable. */
  MAX_BLIND_ROUNDS: 4,
  /** Forces a showdown once the pot reaches this. 0 = no cap (see warning above). */
  POT_LIMIT: 1000,
  SIDE_SHOW_ENABLED: false,
  SHOW_COST_MULTIPLIER: 2,
  TIE_RESOLUTION: 'SPLIT_POT',
};

export interface TeenPattiRulesConfig {
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  CARDS_PER_PLAYER: number;
  DEAL_DIRECTION: 'CLOCKWISE';
  DEALER_ROTATION: 'CLOCKWISE';
  /** Never anything but false. No real-money play is supported. */
  REAL_MONEY: false;
}

export const TEEN_PATTI_RULES: TeenPattiRulesConfig = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 9,
  CARDS_PER_PLAYER: 3,
  DEAL_DIRECTION: 'CLOCKWISE',
  DEALER_ROTATION: 'CLOCKWISE',
  REAL_MONEY: false,
};
