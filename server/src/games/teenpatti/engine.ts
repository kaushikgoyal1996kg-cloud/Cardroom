// ============================================================================
// TEEN PATTI - Engine
//
// Server-authoritative betting state machine. Virtual chips only.
// Hand ranking is delegated to platform/cards/threeCardHand.ts, which uses
// the owner-confirmed sequence hierarchy (A-K-Q > A-2-3 > K-Q-J > ...).
//
// Fully isolated from Hazari and Kitti - imports nothing from either.
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
} from '../../platform/cards/threeCardHand.js';
import { TEEN_PATTI_RULES, TEEN_PATTI_VARIANTS } from './rules.js';

export type PlayerId = string;

export type TeenPattiState =
  | 'WAITING_FOR_PLAYERS'
  | 'DEALING'
  | 'BETTING'
  | 'SHOWDOWN'
  | 'ROUND_COMPLETE';

export interface TeenPattiPlayer {
  playerId: PlayerId;
  chips: number;
  /** Has looked at their cards. Seen players stake double. */
  seen: boolean;
  /** Has folded out of this round. */
  packed: boolean;
  /** Total chips committed to the pot this round. */
  committed: number;
  /** Turns taken while still blind - used for MAX_BLIND_ROUNDS. */
  blindTurns: number;
}

export type BetAction =
  | { type: 'BLIND'; multiplier: number }
  | { type: 'CHAAL'; multiplier: number }
  | { type: 'PACK' }
  | { type: 'SHOW' }
  | { type: 'SEE' };

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface ShowdownEntry {
  playerId: PlayerId;
  cards: Card[];
  description: string;
}

export interface RoundOutcome {
  winnerIds: PlayerId[];
  potAwarded: number;
  /** Populated only when the round ended in an actual show. */
  showdown: ShowdownEntry[] | null;
  /** True when the pot was split between exactly-tied hands. */
  split: boolean;
}

export class TeenPattiGame {
  readonly roomCode: string;
  readonly playersClockwise: PlayerId[];

  state: TeenPattiState = 'WAITING_FOR_PLAYERS';
  dealerId: PlayerId;
  roundNumber = 1;
  pot = 0;
  /** Current per-player stake unit. Blind bets 1-2x, seen bets 2-4x. */
  currentStake = 0;
  currentTurn: PlayerId | null = null;
  lastOutcome: RoundOutcome | null = null;

  private players = new Map<PlayerId, TeenPattiPlayer>();
  private hands: Record<PlayerId, Card[]> = {};
  /** Monotonic counter - every accepted action bumps it. Used to reject stale actions. */
  private actionSeq = 0;

  constructor(roomCode: string, playersClockwise: PlayerId[], initialDealerId?: PlayerId) {
    const n = playersClockwise.length;
    if (n < TEEN_PATTI_RULES.MIN_PLAYERS || n > TEEN_PATTI_RULES.MAX_PLAYERS) {
      throw new Error(
        `Teen Patti requires ${TEEN_PATTI_RULES.MIN_PLAYERS}-${TEEN_PATTI_RULES.MAX_PLAYERS} players, got ${n}`
      );
    }
    this.roomCode = roomCode;
    this.playersClockwise = [...playersClockwise];
    this.dealerId = initialDealerId ?? playersClockwise[0];
    for (const pid of playersClockwise) {
      this.players.set(pid, {
        playerId: pid,
        chips: TEEN_PATTI_VARIANTS.STARTING_CHIPS,
        seen: false,
        packed: false,
        committed: 0,
        blindTurns: 0,
      });
    }
  }

  get sequence(): number {
    return this.actionSeq;
  }

  // ------------------------------------------------------------------
  // DEALING
  // ------------------------------------------------------------------

  dealNewRound(testDeck?: Card[]): void {
    this.state = 'DEALING';
    this.pot = 0;
    this.lastOutcome = null;

    const active: PlayerId[] = [];
    for (const pid of this.playersClockwise) {
      const p = this.players.get(pid)!;
      p.seen = false;
      p.packed = false;
      p.committed = 0;
      p.blindTurns = 0;
      // A player with fewer chips than the boot sits the round out.
      if (p.chips >= TEEN_PATTI_VARIANTS.BOOT_AMOUNT) {
        active.push(pid);
      } else {
        p.packed = true;
      }
    }

    if (active.length < TEEN_PATTI_RULES.MIN_PLAYERS) {
      throw new Error('Not enough players with chips to start a round.');
    }

    // Every active player posts the boot.
    for (const pid of active) {
      const p = this.players.get(pid)!;
      p.chips -= TEEN_PATTI_VARIANTS.BOOT_AMOUNT;
      p.committed += TEEN_PATTI_VARIANTS.BOOT_AMOUNT;
      this.pot += TEEN_PATTI_VARIANTS.BOOT_AMOUNT;
    }
    this.currentStake = TEEN_PATTI_VARIANTS.BOOT_AMOUNT;

    const deck = testDeck ?? shuffleDeck(createDeck());
    const seating = seatingOrderFromDealer(this.playersClockwise, this.dealerId).filter((p) =>
      active.includes(p)
    );
    const { hands } = dealCards(deck, seating, TEEN_PATTI_RULES.CARDS_PER_PLAYER);
    this.hands = hands;

    this.currentTurn = seating[0];
    this.state = 'BETTING';
    this.actionSeq++;
  }

  /** A player's own three cards. Never send to anyone else. */
  getPlayerHand(playerId: PlayerId): Card[] {
    return [...(this.hands[playerId] ?? [])];
  }

  getPlayer(playerId: PlayerId): TeenPattiPlayer | undefined {
    return this.players.get(playerId);
  }

  /** Players still in the round. */
  activePlayers(): PlayerId[] {
    return this.playersClockwise.filter((p) => !this.players.get(p)!.packed);
  }

  // ------------------------------------------------------------------
  // BETTING
  // ------------------------------------------------------------------

  /**
   * Applies a betting action. Every guard here is authoritative - the client
   * is never trusted about whose turn it is, how many chips it has, whether
   * it has seen its cards, or what the stake is.
   *
   * `expectedSeq`, when supplied, rejects an action computed against an older
   * game state. That is what actually stops a double-tap or a lagging client
   * from acting twice; client-side disabling alone is never relied on.
   */
  act(playerId: PlayerId, action: BetAction, expectedSeq?: number): ActionResult {
    if (this.state !== 'BETTING') {
      return { ok: false, error: 'No betting is in progress.' };
    }
    if (expectedSeq !== undefined && expectedSeq !== this.actionSeq) {
      return { ok: false, error: 'That action was already applied.' };
    }
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'You are not seated at this table.' };
    if (player.packed) return { ok: false, error: 'You have packed this round.' };
    if (this.currentTurn !== playerId) return { ok: false, error: 'It is not your turn.' };

    switch (action.type) {
      case 'SEE':
        return this.applySee(player);
      case 'PACK':
        return this.applyPack(player);
      case 'BLIND':
        return this.applyBet(player, action.multiplier, false);
      case 'CHAAL':
        return this.applyBet(player, action.multiplier, true);
      case 'SHOW':
        return this.applyShow(player);
      default:
        return { ok: false, error: 'Unknown action.' };
    }
  }

  /** Looking at your cards does not pass the turn - you still must act. */
  private applySee(player: TeenPattiPlayer): ActionResult {
    if (player.seen) return { ok: false, error: 'You have already seen your cards.' };
    player.seen = true;
    this.actionSeq++;
    return { ok: true };
  }

  private applyPack(player: TeenPattiPlayer): ActionResult {
    player.packed = true;
    this.actionSeq++;
    this.advanceOrResolve();
    return { ok: true };
  }

  private applyBet(player: TeenPattiPlayer, multiplier: number, asSeen: boolean): ActionResult {
    if (asSeen && !player.seen) {
      return { ok: false, error: 'You must look at your cards before playing chaal.' };
    }
    if (!asSeen && player.seen) {
      return { ok: false, error: 'You have seen your cards - you must play chaal.' };
    }

    const allowed = asSeen
      ? TEEN_PATTI_VARIANTS.SEEN_MULTIPLIERS
      : TEEN_PATTI_VARIANTS.BLIND_MULTIPLIERS;
    if (!allowed.includes(multiplier)) {
      return { ok: false, error: `Bet must be ${allowed.join('x or ')}x the current stake.` };
    }

    if (
      !asSeen &&
      TEEN_PATTI_VARIANTS.MAX_BLIND_ROUNDS > 0 &&
      player.blindTurns >= TEEN_PATTI_VARIANTS.MAX_BLIND_ROUNDS
    ) {
      return { ok: false, error: 'You must look at your cards now.' };
    }

    const amount = this.currentStake * multiplier;
    if (player.chips < amount) {
      return { ok: false, error: 'You do not have enough chips for that bet.' };
    }

    player.chips -= amount;
    player.committed += amount;
    this.pot += amount;
    if (!asSeen) player.blindTurns++;

    // The stake unit tracks the blind-equivalent amount, so a seen player
    // paying 2x does not double the unit for the blind player behind them.
    this.currentStake = asSeen ? amount / 2 : amount;

    this.actionSeq++;
    this.advanceOrResolve();
    return { ok: true };
  }

  private applyShow(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    if (active.length !== 2) {
      return { ok: false, error: 'A show is only possible when two players remain.' };
    }
    const cost = this.currentStake * TEEN_PATTI_VARIANTS.SHOW_COST_MULTIPLIER;
    if (player.chips < cost) {
      return { ok: false, error: 'You do not have enough chips to call for a show.' };
    }
    player.chips -= cost;
    player.committed += cost;
    this.pot += cost;
    this.actionSeq++;
    this.resolveShowdown(active);
    return { ok: true };
  }

  private advanceOrResolve(): void {
    const active = this.activePlayers();
    if (active.length === 1) {
      this.awardPot(active, null, false);
      return;
    }
    // Pot cap reached - every remaining player shows, however many there are.
    // This is what guarantees a round always terminates.
    if (TEEN_PATTI_VARIANTS.POT_LIMIT > 0 && this.pot >= TEEN_PATTI_VARIANTS.POT_LIMIT) {
      this.resolveShowdown(active);
      return;
    }
    this.currentTurn = this.nextActiveAfter(this.currentTurn!);
  }

  private nextActiveAfter(playerId: PlayerId): PlayerId {
    let cursor = playerId;
    for (let i = 0; i < this.playersClockwise.length; i++) {
      cursor = rotateClockwise(this.playersClockwise, cursor);
      if (!this.players.get(cursor)!.packed) return cursor;
    }
    return playerId;
  }

  private resolveShowdown(active: PlayerId[]): void {
    this.state = 'SHOWDOWN';
    const scored = active.map((pid) => ({
      playerId: pid,
      cards: this.hands[pid],
      value: classifyThreeCardHand(this.hands[pid]),
    }));

    let best = scored[0];
    for (const s of scored.slice(1)) {
      if (compareThreeCardHands(s.value, best.value) > 0) best = s;
    }
    const winners = scored.filter((s) => compareThreeCardHands(s.value, best.value) === 0);

    const showdown: ShowdownEntry[] = scored.map((s) => ({
      playerId: s.playerId,
      cards: s.cards,
      description: describeThreeCardHand(s.cards),
    }));

    this.awardPot(
      winners.map((w) => w.playerId),
      showdown,
      winners.length > 1
    );
  }

  private awardPot(winnerIds: PlayerId[], showdown: ShowdownEntry[] | null, split: boolean): void {
    const share = Math.floor(this.pot / winnerIds.length);
    for (const pid of winnerIds) {
      this.players.get(pid)!.chips += share;
    }
    this.lastOutcome = {
      winnerIds,
      potAwarded: this.pot,
      showdown,
      split,
    };
    this.pot = 0;
    this.currentTurn = null;
    this.state = 'ROUND_COMPLETE';
    this.actionSeq++;
  }

  rotateDealer(): void {
    this.dealerId = rotateClockwise(this.playersClockwise, this.dealerId);
    this.roundNumber += 1;
  }

  /** Broadcast-safe. Never contains anyone's cards while betting is live. */
  getPublicState() {
    return {
      roomCode: this.roomCode,
      game: 'TEEN_PATTI' as const,
      state: this.state,
      dealerId: this.dealerId,
      roundNumber: this.roundNumber,
      pot: this.pot,
      currentStake: this.currentStake,
      currentTurn: this.currentTurn,
      sequence: this.actionSeq,
      players: this.playersClockwise.map((pid) => {
        const p = this.players.get(pid)!;
        return {
          playerId: pid,
          chips: p.chips,
          seen: p.seen,
          packed: p.packed,
          committed: p.committed,
        };
      }),
      lastOutcome: this.lastOutcome,
    };
  }
}
