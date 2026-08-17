// ============================================================================
// KITTI - Authoritative engine
//
// Implements RULES_KITTI.md exactly. Hidden cards never leave this engine
// through getPublicState(); per-player cards are exposed only by
// getPrivateState()/the Kitti session adapter.
// ============================================================================

import type { Card } from '../../platform/cards/index.js';
import { createDeck, shuffleDeck, dealCards, RANK_VALUE } from '../../platform/cards/index.js';
import {
  classifyThreeCardHand,
  compareThreeCardHands,
  describeThreeCardHand,
  type ThreeCardHandValue,
} from '../../platform/cards/threeCardHand.js';
import { KITTI_RULES } from './rules.js';

export type PlayerId = string;
export type KittiGroups = [Card[], Card[], Card[]];
export type KittiHandIndex = 0 | 1 | 2;

export type KittiState =
  | 'READY'
  | 'ARRANGING'
  | 'WAITING_FOR_ARRANGEMENTS'
  | 'PLAYING_HAND_1'
  | 'PLAYING_HAND_2'
  | 'PLAYING_HAND_3'
  | 'PLAYING_DECIDER'
  | 'ROUND_COMPLETE'
  | 'MATCH_COMPLETE';

export interface KittiArrangement {
  playerId: PlayerId;
  groups: KittiGroups;
  confirmed: boolean;
}

export interface KittiThrow {
  playerId: PlayerId;
  cards: Card[];
  throwOrder: number;
}

export interface KittiHandResult {
  handIndex: KittiHandIndex;
  played: KittiThrow[];
  winnerId: PlayerId;
  wasTie: boolean;
  tiedPlayerIds: PlayerId[];
}

export interface KittiDeciderResult {
  played: KittiThrow[];
  winnerId: PlayerId;
  wasTie: boolean;
  tiedPlayerIds: PlayerId[];
}

export interface KittiRoundResult {
  roundNumber: number;
  dealerId: PlayerId;
  participants: PlayerId[];
  suddenDeath: boolean;
  hands: KittiHandResult[];
  decider?: KittiDeciderResult;
  winnerId: PlayerId;
  roundsWon: Record<PlayerId, number>;
}

export interface DealerDrawRound {
  contenders: PlayerId[];
  draws: { playerId: PlayerId; card: Card }[];
}

export interface GroupComparison {
  groupIndex: KittiHandIndex;
  ranked: { playerId: PlayerId; value: ThreeCardHandValue; description: string }[];
  topPlayerIds: PlayerId[];
  tied: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function clockwiseOrderFrom(playersClockwise: PlayerId[], startId: PlayerId): PlayerId[] {
  const idx = playersClockwise.indexOf(startId);
  if (idx < 0) throw new Error(`${startId} not found in active player list`);
  return [...playersClockwise.slice(idx), ...playersClockwise.slice(0, idx)];
}

function nextClockwiseActive(
  allPlayersClockwise: PlayerId[],
  currentId: PlayerId,
  activeIds: PlayerId[]
): PlayerId {
  const active = new Set(activeIds);
  const start = allPlayersClockwise.indexOf(currentId);
  if (start < 0) throw new Error(`${currentId} not found in player list`);
  for (let offset = 1; offset <= allPlayersClockwise.length; offset++) {
    const id = allPlayersClockwise[(start + offset) % allPlayersClockwise.length];
    if (active.has(id)) return id;
  }
  throw new Error('No active Kitti player found');
}

function activeClockwise(allPlayersClockwise: PlayerId[], activeIds: PlayerId[]): PlayerId[] {
  const active = new Set(activeIds);
  return allPlayersClockwise.filter((id) => active.has(id));
}

/** Kitti deals one card at a time clockwise STARTING AT the dealer. */
export function kittiDealOrder(playersClockwise: PlayerId[], dealerId: PlayerId): PlayerId[] {
  return clockwiseOrderFrom(playersClockwise, dealerId);
}

/**
 * Initial dealer: one-card high draw, Ace high; tied highest players redraw
 * until one dealer remains. The caller should use a freshly shuffled draw
 * deck; the match deal itself uses a separate fresh deck afterwards.
 */
export function drawInitialDealer(
  playersClockwise: PlayerId[],
  deck: Card[]
): { dealerId: PlayerId; rounds: DealerDrawRound[]; remaining: Card[] } {
  let cursor = 0;
  let contenders = [...playersClockwise];
  const rounds: DealerDrawRound[] = [];

  while (contenders.length > 1) {
    if (cursor + contenders.length > deck.length) {
      throw new Error('Not enough cards to finish the initial dealer draw');
    }
    const draws = contenders.map((playerId) => ({ playerId, card: deck[cursor++] }));
    rounds.push({ contenders: [...contenders], draws });
    const high = Math.max(...draws.map((d) => RANK_VALUE[d.card.rank]));
    contenders = draws.filter((d) => RANK_VALUE[d.card.rank] === high).map((d) => d.playerId);
  }

  return { dealerId: contenders[0], rounds, remaining: deck.slice(cursor) };
}

/**
 * Validates ownership/partition AND the agreed strictly strongest->weakest
 * ordering: Group 1 > Group 2 > Group 3. Exact equal-strength adjacent
 * groups are not strictly descending and are therefore invalid.
 */
export function validateKittiArrangement(originalHand: Card[], groups: KittiGroups): ValidationResult {
  const errors: string[] = [];
  const all = groups.flat();

  if (all.length !== KITTI_RULES.CARDS_PER_PLAYER) {
    errors.push(`All ${KITTI_RULES.CARDS_PER_PLAYER} cards must be used (found ${all.length}).`);
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

  // Only evaluate strength once shape/ownership are valid enough to avoid
  // throwing from the 3-card evaluator on malformed input.
  if (errors.length === 0) {
    const values = groups.map((g) => classifyThreeCardHand(g));
    if (compareThreeCardHands(values[0], values[1]) <= 0) {
      errors.push('Group 1 must be strictly stronger than Group 2.');
    }
    if (compareThreeCardHands(values[1], values[2]) <= 0) {
      errors.push('Group 2 must be strictly stronger than Group 3.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Pure comparison helper retained for UI/tests. It does not choose a tied winner. */
export function compareGroup(groupIndex: KittiHandIndex, arrangements: KittiArrangement[]): GroupComparison {
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
  return { groupIndex, ranked, topPlayerIds, tied: topPlayerIds.length > 1 };
}

function resolveThrows(played: KittiThrow[]): { winnerId: PlayerId; wasTie: boolean; tiedPlayerIds: PlayerId[] } {
  if (played.length < KITTI_RULES.MIN_PLAYERS) throw new Error('Not enough throws to resolve a Kitti hand');
  const values = played.map((p) => ({ ...p, value: classifyThreeCardHand(p.cards) }));
  let best = values[0].value;
  for (const entry of values.slice(1)) {
    if (compareThreeCardHands(entry.value, best) > 0) best = entry.value;
  }
  const tied = values.filter((entry) => compareThreeCardHands(entry.value, best) === 0);
  // Owner rule: exact tie -> LATER thrower wins.
  const winner = tied.reduce((latest, entry) => (entry.throwOrder > latest.throwOrder ? entry : latest));
  return {
    winnerId: winner.playerId,
    wasTie: tied.length > 1,
    tiedPlayerIds: tied.map((entry) => entry.playerId),
  };
}

export class KittiGame {
  readonly roomCode: string;
  readonly playersClockwise: PlayerId[];

  state: KittiState = 'READY';
  dealerId: PlayerId;
  roundNumber = 1;
  scheduledRoundsComplete = 0;
  suddenDeath = false;
  matchWinnerId: PlayerId | null = null;
  roundWinnerId: PlayerId | null = null;
  readonly roundsWon: Record<PlayerId, number>;
  readonly roundHistory: KittiRoundResult[] = [];
  initialDealerDraws: DealerDrawRound[] = [];

  private dealerChosen: boolean;
  private activePlayerIds: PlayerId[];
  private hands: Record<PlayerId, Card[]> = {};
  private arrangements: Record<PlayerId, KittiArrangement | undefined> = {};
  private currentHandIndex: KittiHandIndex = 0;
  private currentLeader: PlayerId | null = null;
  private currentPlayOrder: PlayerId[] | null = null;
  private playedThisHand: KittiThrow[] = [];
  private handResultsThisRound: KittiHandResult[] = [];
  private handWinsThisRound: Record<PlayerId, number> = {};
  private deciderPlayerIds: PlayerId[] = [];
  private deciderHands: Record<PlayerId, Card[]> = {};
  private deciderPlayed: KittiThrow[] = [];
  private deciderResult: KittiDeciderResult | undefined;
  private currentRoundDealerId: PlayerId;

  constructor(roomCode: string, playersClockwise: PlayerId[], initialDealerId?: PlayerId) {
    const n = playersClockwise.length;
    if (n < KITTI_RULES.MIN_PLAYERS || n > KITTI_RULES.MAX_PLAYERS) {
      throw new Error(`Kitti requires ${KITTI_RULES.MIN_PLAYERS}-${KITTI_RULES.MAX_PLAYERS} players, got ${n}`);
    }
    if (new Set(playersClockwise).size !== playersClockwise.length) throw new Error('Duplicate Kitti player id');
    this.roomCode = roomCode;
    this.playersClockwise = [...playersClockwise];
    this.activePlayerIds = [...playersClockwise];
    this.roundsWon = Object.fromEntries(playersClockwise.map((p) => [p, 0]));
    this.handWinsThisRound = Object.fromEntries(playersClockwise.map((p) => [p, 0]));
    this.dealerId = initialDealerId ?? playersClockwise[0];
    this.currentRoundDealerId = this.dealerId;
    this.dealerChosen = initialDealerId !== undefined;
    if (initialDealerId && !playersClockwise.includes(initialDealerId)) {
      throw new Error(`Initial dealer ${initialDealerId} is not seated`);
    }
  }

  /** Performs the required initial high-card draw once. */
  chooseInitialDealer(testDeck?: Card[]): PlayerId {
    if (this.dealerChosen) return this.dealerId;
    const result = drawInitialDealer(this.playersClockwise, testDeck ?? shuffleDeck(createDeck()));
    this.dealerId = result.dealerId;
    this.currentRoundDealerId = result.dealerId;
    this.initialDealerDraws = result.rounds;
    this.dealerChosen = true;
    return this.dealerId;
  }

  /** Start the match: choose dealer, then deal Round 1. */
  startMatch(testDealerDeck?: Card[], testRoundDeck?: Card[]): void {
    if (this.state !== 'READY') throw new Error(`Cannot start Kitti match from state ${this.state}`);
    this.chooseInitialDealer(testDealerDeck);
    this.dealNewRound(testRoundDeck);
  }

  /** Deal a normal/sudden-death 9-card round to current active participants. */
  dealNewRound(testDeck?: Card[]): void {
    if (!this.dealerChosen) this.chooseInitialDealer();
    if (this.state !== 'READY' && this.state !== 'ROUND_COMPLETE') {
      throw new Error(`Cannot deal a Kitti round from state ${this.state}`);
    }
    if (this.matchWinnerId) throw new Error('Kitti match is already complete');

    // Keep the just-finished round number/dealer stable while its result screen
    // is visible. Advance only when the next deal actually begins. This avoids
    // showing "Round 2" during Round 1's final reveal and makes reconnects on
    // the result screen deterministic.
    if (this.state === 'ROUND_COMPLETE') {
      this.dealerId = nextClockwiseActive(this.playersClockwise, this.dealerId, this.activePlayerIds);
      this.roundNumber += 1;
    }

    this.currentRoundDealerId = this.dealerId;
    this.roundWinnerId = null;
    this.hands = {};
    this.arrangements = {};
    this.currentHandIndex = 0;
    this.currentLeader = null;
    this.currentPlayOrder = null;
    this.playedThisHand = [];
    this.handResultsThisRound = [];
    this.handWinsThisRound = Object.fromEntries(this.playersClockwise.map((p) => [p, 0]));
    this.deciderPlayerIds = [];
    this.deciderHands = {};
    this.deciderPlayed = [];
    this.deciderResult = undefined;

    const active = activeClockwise(this.playersClockwise, this.activePlayerIds);
    if (!active.includes(this.dealerId)) {
      this.dealerId = nextClockwiseActive(this.playersClockwise, this.dealerId, active);
      this.currentRoundDealerId = this.dealerId;
    }
    const order = kittiDealOrder(active, this.dealerId);
    const { hands } = dealCards(testDeck ?? shuffleDeck(createDeck()), order, KITTI_RULES.CARDS_PER_PLAYER);
    this.hands = hands;
    this.state = 'ARRANGING';
  }

  getActivePlayerIds(): PlayerId[] {
    return [...this.activePlayerIds];
  }

  getSpectatorIds(): PlayerId[] {
    const active = new Set(this.activePlayerIds);
    return this.playersClockwise.filter((id) => !active.has(id));
  }

  getPlayerHand(playerId: PlayerId): Card[] {
    return [...(this.hands[playerId] ?? [])];
  }

  getPlayerGroups(playerId: PlayerId): KittiGroups | null {
    const a = this.arrangements[playerId];
    if (!a?.confirmed) return null;
    return a.groups.map((g) => [...g]) as KittiGroups;
  }

  getDeciderHand(playerId: PlayerId): Card[] {
    return [...(this.deciderHands[playerId] ?? [])];
  }

  confirmArrangement(playerId: PlayerId, groups: KittiGroups): { ok: boolean; errors?: string[] } {
    if (this.state !== 'ARRANGING' && this.state !== 'WAITING_FOR_ARRANGEMENTS') {
      throw new Error(`Cannot confirm arrangement from state ${this.state}`);
    }
    if (!this.activePlayerIds.includes(playerId)) throw new Error(`${playerId} is not active this round`);
    const hand = this.hands[playerId];
    if (!hand) throw new Error(`Unknown player ${playerId}`);

    const result = validateKittiArrangement(hand, groups);
    if (!result.valid) return { ok: false, errors: result.errors };
    this.arrangements[playerId] = {
      playerId,
      groups: groups.map((g) => [...g]) as KittiGroups,
      confirmed: true,
    };

    const allConfirmed = this.activePlayerIds.every((p) => this.arrangements[p]?.confirmed);
    if (allConfirmed) this.beginHand(0, nextClockwiseActive(this.playersClockwise, this.dealerId, this.activePlayerIds));
    else this.state = 'WAITING_FOR_ARRANGEMENTS';
    return { ok: true };
  }

  private beginHand(index: KittiHandIndex, leader: PlayerId): void {
    this.currentHandIndex = index;
    this.currentLeader = leader;
    const active = activeClockwise(this.playersClockwise, this.activePlayerIds);
    this.currentPlayOrder = clockwiseOrderFrom(active, leader);
    this.playedThisHand = [];
    this.state = index === 0 ? 'PLAYING_HAND_1' : index === 1 ? 'PLAYING_HAND_2' : 'PLAYING_HAND_3';
  }

  /** Current player throws their pre-arranged group for this hand. */
  playCurrentHand(playerId: PlayerId): void {
    if (!['PLAYING_HAND_1', 'PLAYING_HAND_2', 'PLAYING_HAND_3'].includes(this.state)) {
      throw new Error(`Cannot play a Kitti hand from state ${this.state}`);
    }
    if (!this.currentPlayOrder) throw new Error('No Kitti play order');
    const expected = this.currentPlayOrder[this.playedThisHand.length];
    if (playerId !== expected) throw new Error(`It is ${expected}'s turn, not ${playerId}'s`);
    const arrangement = this.arrangements[playerId];
    if (!arrangement?.confirmed) throw new Error(`${playerId} has no confirmed arrangement`);

    this.playedThisHand.push({
      playerId,
      cards: [...arrangement.groups[this.currentHandIndex]],
      throwOrder: this.playedThisHand.length,
    });

    if (this.playedThisHand.length < this.activePlayerIds.length) return;

    const resolved = resolveThrows(this.playedThisHand);
    const result: KittiHandResult = {
      handIndex: this.currentHandIndex,
      played: this.playedThisHand.map((p) => ({ ...p, cards: [...p.cards] })),
      ...resolved,
    };
    this.handResultsThisRound.push(result);
    this.handWinsThisRound[result.winnerId] = (this.handWinsThisRound[result.winnerId] ?? 0) + 1;

    // Owner rule: the FIRST player to win two hands wins the round. Do not
    // force a meaningless third competitive hand after somebody has already
    // taken Hands 1 and 2. The client may still reveal the unused third group
    // cosmetically, but it has no effect on the result.
    if (this.handWinsThisRound[result.winnerId] >= KITTI_RULES.HANDS_TO_WIN_ROUND) {
      this.finishRound(result.winnerId);
      return;
    }

    if (this.currentHandIndex < 2) {
      this.beginHand((this.currentHandIndex + 1) as KittiHandIndex, result.winnerId);
      return;
    }

    const threeWinners = new Set(this.handResultsThisRound.map((h) => h.winnerId));
    if (threeWinners.size === 3) {
      this.startDecider(result.winnerId, [...threeWinners]);
      return;
    }

    const winner = Object.entries(this.handWinsThisRound)
      .filter(([, wins]) => wins >= KITTI_RULES.HANDS_TO_WIN_ROUND)
      .map(([id]) => id)[0];
    if (!winner) throw new Error('Kitti round resolved without a two-hand winner or three-way decider');
    this.finishRound(winner);
  }

  private startDecider(handThreeWinner: PlayerId, winners: PlayerId[], testDeck?: Card[]): void {
    this.deciderPlayerIds = activeClockwise(this.playersClockwise, winners);
    const order = clockwiseOrderFrom(this.deciderPlayerIds, handThreeWinner);
    const { hands } = dealCards(testDeck ?? shuffleDeck(createDeck()), order, 3);
    this.deciderHands = hands;
    this.deciderPlayed = [];
    this.currentLeader = handThreeWinner;
    this.currentPlayOrder = order;
    this.state = 'PLAYING_DECIDER';
  }

  /** Current decider participant throws their fresh 3-card hand. */
  playDecider(playerId: PlayerId): void {
    if (this.state !== 'PLAYING_DECIDER') throw new Error(`Cannot play Kitti decider from state ${this.state}`);
    if (!this.currentPlayOrder) throw new Error('No decider play order');
    const expected = this.currentPlayOrder[this.deciderPlayed.length];
    if (playerId !== expected) throw new Error(`It is ${expected}'s turn, not ${playerId}'s`);
    const cards = this.deciderHands[playerId];
    if (!cards?.length) throw new Error(`${playerId} has no decider hand`);
    this.deciderPlayed.push({ playerId, cards: [...cards], throwOrder: this.deciderPlayed.length });
    if (this.deciderPlayed.length < this.deciderPlayerIds.length) return;

    const resolved = resolveThrows(this.deciderPlayed);
    this.deciderResult = {
      played: this.deciderPlayed.map((p) => ({ ...p, cards: [...p.cards] })),
      ...resolved,
    };
    this.finishRound(resolved.winnerId);
  }

  private finishRound(winnerId: PlayerId): void {
    this.roundWinnerId = winnerId;
    this.roundsWon[winnerId] = (this.roundsWon[winnerId] ?? 0) + 1;
    const finishedRoundNumber = this.roundNumber;
    const finishedDealerId = this.currentRoundDealerId;
    const wasSuddenDeath = this.suddenDeath;

    this.roundHistory.push({
      roundNumber: finishedRoundNumber,
      dealerId: finishedDealerId,
      participants: [...this.activePlayerIds],
      suddenDeath: wasSuddenDeath,
      hands: this.handResultsThisRound.map((h) => ({
        ...h,
        played: h.played.map((p) => ({ ...p, cards: [...p.cards] })),
        tiedPlayerIds: [...h.tiedPlayerIds],
      })),
      decider: this.deciderResult
        ? {
            ...this.deciderResult,
            played: this.deciderResult.played.map((p) => ({ ...p, cards: [...p.cards] })),
            tiedPlayerIds: [...this.deciderResult.tiedPlayerIds],
          }
        : undefined,
      winnerId,
      roundsWon: { ...this.roundsWon },
    });

    if (!wasSuddenDeath) this.scheduledRoundsComplete += 1;

    if (this.scheduledRoundsComplete >= KITTI_RULES.MATCH_ROUNDS) {
      const maxWins = Math.max(...Object.values(this.roundsWon));
      const leaders = this.playersClockwise.filter((p) => this.roundsWon[p] === maxWins);
      if (leaders.length === 1) {
        this.matchWinnerId = leaders[0];
        this.state = 'MATCH_COMPLETE';
        return;
      }
      // Tied leaders only; everyone else watches the full normal sudden-death round.
      this.suddenDeath = true;
      this.activePlayerIds = leaders;
    }

    if (wasSuddenDeath) {
      const maxWins = Math.max(...Object.values(this.roundsWon));
      const leaders = this.playersClockwise.filter((p) => this.roundsWon[p] === maxWins);
      if (leaders.length === 1) {
        this.matchWinnerId = leaders[0];
        this.state = 'MATCH_COMPLETE';
        return;
      }
      this.activePlayerIds = leaders;
    }

    // Dealer/round advance happens when the next deal starts, not while this
    // round's result is still on screen.
    this.state = 'ROUND_COMPLETE';
  }

  /** Compatibility helper: a Kitti "score" is round wins, not points. */
  scoreRound(): Record<PlayerId, number> {
    if (this.state !== 'ROUND_COMPLETE' && this.state !== 'MATCH_COMPLETE') {
      throw new Error(`Cannot score Kitti round from state ${this.state}`);
    }
    return { ...this.roundsWon };
  }

  /** Retained for older callers/tests; normal flow rotates when the next deal begins. */
  rotateDealer(): void {
    this.dealerId = nextClockwiseActive(this.playersClockwise, this.dealerId, this.activePlayerIds);
  }

  isComplete(): boolean {
    return this.state === 'MATCH_COMPLETE';
  }

  getPrivateState(playerId: PlayerId) {
    return {
      hand: this.getPlayerHand(playerId),
      arrangement: this.getPlayerGroups(playerId),
      deciderHand: this.getDeciderHand(playerId),
    };
  }

  getPublicState() {
    return {
      roomCode: this.roomCode,
      game: 'KITTI' as const,
      state: this.state,
      dealerId: this.dealerId,
      roundDealerId: this.currentRoundDealerId,
      roundNumber: this.roundNumber,
      scheduledRoundsComplete: this.scheduledRoundsComplete,
      suddenDeath: this.suddenDeath,
      activePlayerIds: [...this.activePlayerIds],
      spectatorIds: this.getSpectatorIds(),
      playersConfirmed: this.activePlayerIds.filter((p) => this.arrangements[p]?.confirmed),
      currentHandIndex: this.currentHandIndex,
      currentLeader: this.currentLeader,
      currentPlayOrder: this.currentPlayOrder ? [...this.currentPlayOrder] : null,
      // Keep the completed decider visible for the brief result hold after
      // the engine advances to ROUND_COMPLETE/MATCH_COMPLETE. Otherwise the
      // final three cards would disappear from the felt in the same tick the
      // winner is decided.
      playersPlayedThisHand: (this.state === 'PLAYING_DECIDER' || (!!this.deciderResult && (this.state === 'ROUND_COMPLETE' || this.state === 'MATCH_COMPLETE')))
        ? this.deciderPlayed.map((p) => p.playerId)
        : this.playedThisHand.map((p) => p.playerId),
      playedThisHand: (this.state === 'PLAYING_DECIDER' || (!!this.deciderResult && (this.state === 'ROUND_COMPLETE' || this.state === 'MATCH_COMPLETE')))
        ? this.deciderPlayed.map((p) => ({ ...p, cards: [...p.cards] }))
        : this.playedThisHand.map((p) => ({ ...p, cards: [...p.cards] })),
      handResultsThisRound: this.handResultsThisRound.map((h) => ({
        ...h,
        played: h.played.map((p) => ({ ...p, cards: [...p.cards] })),
        tiedPlayerIds: [...h.tiedPlayerIds],
      })),
      handWinsThisRound: { ...this.handWinsThisRound },
      deciderPlayerIds: [...this.deciderPlayerIds],
      roundWinnerId: this.roundWinnerId,
      roundsWon: { ...this.roundsWon },
      matchWinnerId: this.matchWinnerId,
      initialDealerDraws: this.initialDealerDraws.map((round) => ({
        contenders: [...round.contenders],
        draws: round.draws.map((d) => ({ ...d, card: { ...d.card } })),
      })),
    };
  }

  /** Test hook for deterministic decider cards; never used by the controller. */
  _setDeciderForTest(handThreeWinner: PlayerId, winners: PlayerId[], deck: Card[]): void {
    this.startDecider(handThreeWinner, winners, deck);
  }
}
