// ============================================================================
// KITTI - Engine
//
// Implements only what the owner has confirmed:
//   - 2-5 players, 9 cards each
//   - cards arranged into three groups of three
//   - 2-3-5 is not special
//   - the confirmed sequence hierarchy (via platform/cards/threeCardHand)
//
// Deliberately NOT implemented (see rules.ts UNRESOLVED_RULES):
//   group ordering constraint, scoring, win condition, tie resolution,
//   starting player. Calling scoreRound() throws until those are confirmed.
// ============================================================================

import type { Card } from '../../platform/cards/index.js';
import {
  createDeck,
  shuffleDeck,
  dealCards,
  seatingOrderFromDealer,
  rotateClockwise,
} from '../../platform/cards/index.js';
import {
  classifyThreeCardHand,
  compareThreeCardHands,
  describeThreeCardHand,
  type ThreeCardHandValue,
} from '../../platform/cards/threeCardHand.js';
import {
  KITTI_RULES,
  KITTI_SCORING_CONFIRMED,
  KittiRuleUnresolvedError,
} from './rules.js';

export type PlayerId = string;

export type KittiGroups = [Card[], Card[], Card[]];

export type KittiState =
  | 'WAITING_FOR_PLAYERS'
  | 'DEALING'
  | 'ARRANGING'
  | 'WAITING_FOR_ARRANGEMENTS'
  | 'REVEALING'
  | 'ROUND_COMPLETE'
  | 'BLOCKED_UNRESOLVED_RULES';

export interface KittiArrangement {
  playerId: PlayerId;
  groups: KittiGroups;
  confirmed: boolean;
}

export interface GroupComparison {
  groupIndex: 0 | 1 | 2;
  /** Every player's hand for this group, strongest first. */
  ranked: { playerId: PlayerId; value: ThreeCardHandValue; description: string }[];
  /** Players sharing the top strength. More than one means an exact tie. */
  topPlayerIds: PlayerId[];
  /** True when topPlayerIds.length > 1 - resolution rule is UNCONFIRMED. */
  tied: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a 9-card arrangement into three groups of three.
 *
 * NOTE: this intentionally does NOT enforce a strongest -> weakest ordering
 * across the three groups. Whether Kitti requires that (as Hazari does) is
 * listed in UNRESOLVED_RULES and must not be assumed either way.
 */
export function validateKittiArrangement(
  originalHand: Card[],
  groups: KittiGroups
): ValidationResult {
  const errors: string[] = [];

  const all = groups.flat();
  if (all.length !== KITTI_RULES.CARDS_PER_PLAYER) {
    errors.push(
      `All ${KITTI_RULES.CARDS_PER_PLAYER} cards must be used (found ${all.length}).`
    );
  }

  const ids = new Set(all.map((c) => c.id));
  if (ids.size !== all.length) errors.push('No card can appear twice across your groups.');

  const handIds = new Set(originalHand.map((c) => c.id));
  for (const c of all) {
    if (!handIds.has(c.id)) errors.push(`Card ${c.id} is not part of your dealt hand.`);
  }

  groups.forEach((g, i) => {
    if (g.length !== KITTI_RULES.GROUP_SIZE) {
      errors.push(`Group ${i + 1} must contain exactly ${KITTI_RULES.GROUP_SIZE} cards (found ${g.length}).`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Compares one group index across all players. This is pure, mechanical hand
 * comparison and follows necessarily from the confirmed rules, so it is safe
 * to implement now. It does NOT award points and does NOT resolve ties -
 * both of those are unconfirmed.
 */
export function compareGroup(
  groupIndex: 0 | 1 | 2,
  arrangements: KittiArrangement[]
): GroupComparison {
  if (arrangements.length < KITTI_RULES.MIN_PLAYERS) {
    throw new Error(`compareGroup requires at least ${KITTI_RULES.MIN_PLAYERS} arrangements`);
  }

  const scored = arrangements.map((a) => ({
    playerId: a.playerId,
    value: classifyThreeCardHand(a.groups[groupIndex]),
    description: describeThreeCardHand(a.groups[groupIndex]),
  }));

  const ranked = [...scored].sort((x, y) => compareThreeCardHands(y.value, x.value));
  const best = ranked[0].value;
  const topPlayerIds = ranked
    .filter((r) => compareThreeCardHands(r.value, best) === 0)
    .map((r) => r.playerId);

  return {
    groupIndex,
    ranked,
    topPlayerIds,
    tied: topPlayerIds.length > 1,
  };
}

/**
 * Pure, in-memory Kitti table. Networking lives in the controller.
 */
export class KittiGame {
  readonly roomCode: string;
  readonly playersClockwise: PlayerId[];

  state: KittiState = 'WAITING_FOR_PLAYERS';
  dealerId: PlayerId;
  roundNumber = 1;

  private hands: Record<PlayerId, Card[]> = {};
  private arrangements: Record<PlayerId, KittiArrangement | undefined> = {};

  constructor(roomCode: string, playersClockwise: PlayerId[], initialDealerId?: PlayerId) {
    const n = playersClockwise.length;
    if (n < KITTI_RULES.MIN_PLAYERS || n > KITTI_RULES.MAX_PLAYERS) {
      throw new Error(
        `Kitti requires ${KITTI_RULES.MIN_PLAYERS}-${KITTI_RULES.MAX_PLAYERS} players, got ${n}`
      );
    }
    this.roomCode = roomCode;
    this.playersClockwise = [...playersClockwise];
    this.dealerId = initialDealerId ?? playersClockwise[0];
  }

  dealNewRound(testDeck?: Card[]): void {
    this.state = 'DEALING';
    const deck = testDeck ?? shuffleDeck(createDeck());
    const seating = seatingOrderFromDealer(this.playersClockwise, this.dealerId);
    const { hands } = dealCards(deck, seating, KITTI_RULES.CARDS_PER_PLAYER);
    this.hands = hands;
    this.arrangements = {};
    this.state = 'ARRANGING';
  }

  getPlayerHand(playerId: PlayerId): Card[] {
    return [...(this.hands[playerId] ?? [])];
  }

  getPlayerGroups(playerId: PlayerId): KittiGroups | null {
    const a = this.arrangements[playerId];
    return a?.confirmed ? ([...a.groups] as KittiGroups) : null;
  }

  confirmArrangement(playerId: PlayerId, groups: KittiGroups): { ok: boolean; errors?: string[] } {
    if (this.state !== 'ARRANGING' && this.state !== 'WAITING_FOR_ARRANGEMENTS') {
      throw new Error(`Cannot confirm arrangement from state ${this.state}`);
    }
    const hand = this.hands[playerId];
    if (!hand) throw new Error(`Unknown player ${playerId}`);

    const result = validateKittiArrangement(hand, groups);
    if (!result.valid) return { ok: false, errors: result.errors };

    this.arrangements[playerId] = { playerId, groups, confirmed: true };

    const allConfirmed = this.playersClockwise.every((p) => this.arrangements[p]?.confirmed);
    this.state = allConfirmed ? 'REVEALING' : 'WAITING_FOR_ARRANGEMENTS';
    return { ok: true };
  }

  /**
   * Per-group comparison for the completed round. Safe to call and display -
   * it reveals who held the strongest hand in each group without awarding
   * any points.
   */
  compareAllGroups(): GroupComparison[] {
    if (this.state !== 'REVEALING' && this.state !== 'ROUND_COMPLETE') {
      throw new Error(`Cannot compare groups from state ${this.state}`);
    }
    const confirmed = this.playersClockwise
      .map((p) => this.arrangements[p])
      .filter((a): a is KittiArrangement => !!a?.confirmed);
    return ([0, 1, 2] as const).map((i) => compareGroup(i, confirmed));
  }

  /**
   * BLOCKED until the owner confirms scoring. Throws deliberately rather
   * than guessing a point system.
   */
  scoreRound(): never {
    throw new KittiRuleUnresolvedError('SCORING');
  }

  rotateDealer(): void {
    this.dealerId = rotateClockwise(this.playersClockwise, this.dealerId);
    this.roundNumber += 1;
  }

  getPublicState() {
    return {
      roomCode: this.roomCode,
      game: 'KITTI' as const,
      state: KITTI_SCORING_CONFIRMED ? this.state : this.state,
      scoringAvailable: KITTI_SCORING_CONFIRMED,
      dealerId: this.dealerId,
      roundNumber: this.roundNumber,
      players: this.playersClockwise,
      playersConfirmed: this.playersClockwise.filter((p) => this.arrangements[p]?.confirmed),
    };
  }
}
