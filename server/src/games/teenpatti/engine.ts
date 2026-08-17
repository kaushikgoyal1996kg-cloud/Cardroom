// ============================================================================
// TEEN PATTI - Authoritative Classic engine
//
// Implements the agreed Classic Teen Patti rules from RULES_TEEN_PATTI.md.
// Virtual/play money only. The server owns cards, turn order, bets, sideshow,
// showdown and balances. Variant descriptors live in rules.ts; variants that
// are not runtimeImplemented are deliberately refused rather than silently
// falling back to Classic.
// ============================================================================

import type { Card } from '../../platform/cards/index.js';
import {
  createDeck,
  shuffleDeck,
  dealCards,
  seatingOrderFromDealer,
  rotateClockwise,
  RANK_VALUE,
} from '../../platform/cards/index.js';
import {
  classifyThreeCardHand,
  compareThreeCardHands,
  describeThreeCardHand,
} from '../../platform/cards/threeCardHand.js';
import {
  DEFAULT_TEEN_PATTI_TABLE_CONFIG,
  TEEN_PATTI_RULES,
  getTeenPattiVariant,
  nextBlindAmount,
  validateTeenPattiTableConfig,
  type TeenPattiRoundVariantConfig,
  type TeenPattiTableConfig,
} from './rules.js';

export type PlayerId = string;

export type TeenPattiState = 'READY' | 'DEALING' | 'BETTING' | 'ROUND_COMPLETE';

export interface TeenPattiPlayer {
  playerId: PlayerId;
  chips: number;
  /** Betting status. A forced-seen player may still have cardsViewed=false. */
  seen: boolean;
  /** Whether this player explicitly chose to reveal their own cards to themself. */
  cardsViewed: boolean;
  packed: boolean;
  committed: number;
  blindTurns: number;
  /** Total play-money added after the configured starting balance. */
  topUps: number;
}

export type TeenPattiAction =
  | { type: 'SEE' }
  | { type: 'BLIND' }
  | { type: 'CHAAL' }
  | { type: 'PACK' }
  | { type: 'SIDESHOW' }
  | { type: 'SHOWDOWN' }
  | { type: 'REQUEST_OPEN_SHOW' }
  | { type: 'ACCEPT_OPEN_SHOW' }
  | { type: 'DECLINE_OPEN_SHOW' };

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface DealerDrawRound {
  contenders: PlayerId[];
  draws: { playerId: PlayerId; card: Card }[];
}

export interface SideshowResult {
  initiatorId: PlayerId;
  opponentId: PlayerId;
  packedPlayerId: PlayerId;
  tied: boolean;
}

export interface ShowdownEntry {
  playerId: PlayerId;
  cards: Card[];
  description: string;
}

export interface RoundOutcome {
  roundNumber: number;
  dealerId: PlayerId;
  winnerIds: PlayerId[];
  potAwarded: number;
  showdown: ShowdownEntry[] | null;
  split: boolean;
  reason: 'LAST_STANDING' | 'PAID_SHOWDOWN' | 'MUTUAL_OPEN_SHOW';
}

export interface PlayerSettlement {
  playerId: PlayerId;
  currentBalance: number;
  totalFunding: number;
  profitLoss: number;
  topUps: number;
}

export interface TeenPattiLeaveResult {
  settlement: PlayerSettlement;
  /** True when treating the departure as a pack resolved the live round. */
  roundEnded: boolean;
  remainingPlayerIds: PlayerId[];
}

/** One-card initial dealer draw, Ace high; tied leaders redraw until unique. */
export function drawInitialTeenPattiDealer(
  playersClockwise: PlayerId[],
  deck: Card[]
): { dealerId: PlayerId; rounds: DealerDrawRound[]; remaining: Card[] } {
  let contenders = [...playersClockwise];
  let cursor = 0;
  const rounds: DealerDrawRound[] = [];

  while (contenders.length > 1) {
    if (cursor + contenders.length > deck.length) {
      throw new Error('Not enough cards to finish the Teen Patti dealer draw');
    }
    const draws = contenders.map((playerId) => ({ playerId, card: deck[cursor++] }));
    rounds.push({ contenders: [...contenders], draws });
    const highest = Math.max(...draws.map(({ card }) => RANK_VALUE[card.rank]));
    contenders = draws.filter(({ card }) => RANK_VALUE[card.rank] === highest).map(({ playerId }) => playerId);
  }

  return { dealerId: contenders[0], rounds, remaining: deck.slice(cursor) };
}

export class TeenPattiGame {
  readonly roomCode: string;
  readonly playersClockwise: PlayerId[];
  readonly tableConfig: TeenPattiTableConfig;
  readonly roundVariant: TeenPattiRoundVariantConfig;

  state: TeenPattiState = 'READY';
  dealerId: PlayerId;
  roundNumber = 1;
  pot = 0;
  currentBlind: number;
  currentTurn: PlayerId | null = null;
  lastOutcome: RoundOutcome | null = null;
  lastSideshow: SideshowResult | null = null;
  openShowRequestFrom: PlayerId | null = null;
  initialDealerDraws: DealerDrawRound[] = [];

  private players = new Map<PlayerId, TeenPattiPlayer>();
  private hands: Record<PlayerId, Card[]> = {};
  private actionSeq = 0;
  private dealerChosen: boolean;
  private pendingNextDealerId: PlayerId | null = null;
  /** Physical-seat fallback used only if the current/designated dealer leaves. */
  private departedDealerFallbackId: PlayerId | null = null;
  private currentRoundDealerId: PlayerId;

  constructor(
    roomCode: string,
    playersClockwise: PlayerId[],
    options: {
      initialDealerId?: PlayerId;
      tableConfig?: TeenPattiTableConfig;
      roundVariant?: TeenPattiRoundVariantConfig;
    } = {}
  ) {
    const n = playersClockwise.length;
    if (n < TEEN_PATTI_RULES.MIN_PLAYERS || n > TEEN_PATTI_RULES.MAX_PLAYERS) {
      throw new Error(`Teen Patti requires ${TEEN_PATTI_RULES.MIN_PLAYERS}-${TEEN_PATTI_RULES.MAX_PLAYERS} players, got ${n}`);
    }
    if (new Set(playersClockwise).size !== playersClockwise.length) {
      throw new Error('Duplicate Teen Patti player id');
    }

    this.roomCode = roomCode;
    this.playersClockwise = [...playersClockwise];
    this.tableConfig = { ...(options.tableConfig ?? DEFAULT_TEEN_PATTI_TABLE_CONFIG) };
    validateTeenPattiTableConfig(this.tableConfig);
    this.roundVariant = { variantId: 'CLASSIC', ...(options.roundVariant ?? {}) };
    const variant = getTeenPattiVariant(this.roundVariant.variantId);
    if (!variant.runtimeImplemented) {
      throw new Error(`${variant.name} is configured but is not runtime-implemented yet.`);
    }

    if (options.initialDealerId && !playersClockwise.includes(options.initialDealerId)) {
      throw new Error(`Initial dealer ${options.initialDealerId} is not seated`);
    }
    this.dealerId = options.initialDealerId ?? playersClockwise[0];
    this.currentRoundDealerId = this.dealerId;
    this.dealerChosen = options.initialDealerId !== undefined;
    this.currentBlind = this.tableConfig.baseBlind;

    for (const playerId of playersClockwise) {
      this.players.set(playerId, {
        playerId,
        chips: this.tableConfig.startingBalance,
        seen: false,
        cardsViewed: false,
        packed: false,
        committed: 0,
        blindTurns: 0,
        topUps: 0,
      });
    }
  }

  get sequence(): number {
    return this.actionSeq;
  }

  chooseInitialDealer(testDeck?: Card[]): PlayerId {
    if (this.dealerChosen) return this.dealerId;
    const result = drawInitialTeenPattiDealer(this.playersClockwise, testDeck ?? shuffleDeck(createDeck()));
    this.dealerId = result.dealerId;
    this.currentRoundDealerId = result.dealerId;
    this.initialDealerDraws = result.rounds;
    this.dealerChosen = true;
    return this.dealerId;
  }

  startSession(testDealerDeck?: Card[], testRoundDeck?: Card[]): void {
    if (this.state !== 'READY') throw new Error(`Cannot start Teen Patti from state ${this.state}`);
    this.chooseInitialDealer(testDealerDeck);
    this.dealNewRound(testRoundDeck);
  }

  /**
   * Starts the next Classic round. A completed round remains visually stable
   * until this call; only then do roundNumber and dealer advance.
   */
  dealNewRound(testDeck?: Card[]): void {
    if (!this.dealerChosen) this.chooseInitialDealer();
    if (this.state !== 'READY' && this.state !== 'ROUND_COMPLETE') {
      throw new Error(`Cannot deal Teen Patti from state ${this.state}`);
    }
    if (this.playersClockwise.length < TEEN_PATTI_RULES.MIN_PLAYERS) {
      throw new Error(`Teen Patti needs at least ${TEEN_PATTI_RULES.MIN_PLAYERS} seated players to deal.`);
    }

    // Validate the next boot BEFORE mutating dealer/round state. This must be
    // transactional: a host can legitimately try to deal, learn that one
    // player needs a top-up, then retry after funding. A rejected attempt
    // must not consume a round number or apply the pending next dealer.
    const underfunded = this.playersClockwise.filter(
      (playerId) => this.players.get(playerId)!.chips < this.tableConfig.bootAmount
    );
    if (underfunded.length > 0) {
      throw new Error(`Top-up required before the next boot: ${underfunded.join(', ')}`);
    }

    if (this.state === 'ROUND_COMPLETE') {
      // Agreed rule: previous round winner deals next. An exact split has no
      // single winner, so there is no invented "winner" to rotate to; dealer
      // remains unchanged for that exceptional tied result.
      if (this.pendingNextDealerId && this.players.has(this.pendingNextDealerId)) {
        this.dealerId = this.pendingNextDealerId;
      }
      this.roundNumber += 1;
    }
    // A dealer can leave between rounds (or during a round that later ends
    // in a split). Never let a departed id poison the next seating order.
    if (!this.players.has(this.dealerId)) {
      this.dealerId = this.departedDealerFallbackId && this.players.has(this.departedDealerFallbackId)
        ? this.departedDealerFallbackId
        : this.playersClockwise[0];
    }
    this.departedDealerFallbackId = null;

    this.state = 'DEALING';
    this.currentRoundDealerId = this.dealerId;
    this.pendingNextDealerId = null;
    this.pot = 0;
    this.currentBlind = this.tableConfig.baseBlind;
    this.currentTurn = null;
    this.lastOutcome = null;
    this.lastSideshow = null;
    this.openShowRequestFrom = null;
    this.hands = {};

    for (const playerId of this.playersClockwise) {
      const player = this.players.get(playerId)!;
      player.seen = false;
      player.cardsViewed = false;
      player.packed = false;
      player.committed = 0;
      player.blindTurns = 0;
      this.takeFromPlayer(player, this.tableConfig.bootAmount, 'boot');
    }

    const order = seatingOrderFromDealer(this.playersClockwise, this.dealerId);
    const variant = getTeenPattiVariant(this.roundVariant.variantId);
    const { hands } = dealCards(testDeck ?? shuffleDeck(createDeck()), order, variant.dealCount);
    this.hands = hands;
    this.currentTurn = order[0];
    this.state = 'BETTING';
    this.applyForcedSeenIfNeeded();
    this.actionSeq += 1;
  }

  getPlayer(playerId: PlayerId): TeenPattiPlayer | undefined {
    return this.players.get(playerId);
  }

  /** Server-only/testing accessor. Do not broadcast this. */
  getPlayerHand(playerId: PlayerId): Card[] {
    return [...(this.hands[playerId] ?? [])];
  }

  activePlayers(): PlayerId[] {
    return this.playersClockwise.filter((playerId) => !this.players.get(playerId)!.packed);
  }

  /** Cards are private even from their owner until that player presses See. */
  getPrivateState(playerId: PlayerId) {
    const player = this.players.get(playerId);
    if (!player) return null;
    return {
      cards: player.cardsViewed ? this.getPlayerHand(playerId) : [],
      cardCount: this.hands[playerId]?.length ?? 0,
      cardsViewed: player.cardsViewed,
      seen: player.seen,
    };
  }

  topUp(playerId: PlayerId, amount: number): ActionResult {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'You are not seated at this table.' };
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return { ok: false, error: 'Top-up must be a positive whole-number play-money amount.' };
    }
    player.chips += amount;
    player.topUps += amount;
    this.actionSeq += 1;
    return { ok: true };
  }

  getSettlement(playerId: PlayerId): PlayerSettlement | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    const totalFunding = this.tableConfig.startingBalance + player.topUps;
    return {
      playerId,
      currentBalance: player.chips,
      totalFunding,
      profitLoss: player.chips - totalFunding,
      topUps: player.topUps,
    };
  }

  /**
   * Permanently releases a Teen Patti seat. This is deliberately NOT Hazari's
   * bot-takeover leave path: the player's table account is settled and the
   * seat disappears from all future rounds. If they leave during a live round,
   * leaving is equivalent to packing that round, so money already committed
   * stays in the pot and the remaining players can finish normally.
   */
  leaveTable(playerId: PlayerId): TeenPattiLeaveResult {
    const player = this.players.get(playerId);
    if (!player) throw new Error('You are not seated at this Teen Patti table.');
    const settlement = this.getSettlement(playerId)!;
    const stateBefore = this.state;

    // Capture the next physical seat before mutating the ring. It is used only
    // as an operational dealer fallback if a designated dealer/winner leaves
    // before the following round can start.
    const leavingIndex = this.playersClockwise.indexOf(playerId);
    const nextSeat = this.playersClockwise.length > 1
      ? this.playersClockwise[(leavingIndex + 1) % this.playersClockwise.length]
      : null;

    if (this.state === 'BETTING' && !player.packed) {
      player.packed = true;
      this.openShowRequestFrom = null;
      if (this.currentTurn === playerId) {
        this.finishTurn(playerId);
      } else {
        this.actionSeq += 1;
        const active = this.activePlayers();
        if (active.length === 1) {
          this.awardPot(active, null, false, 'LAST_STANDING');
        }
      }
    } else {
      this.openShowRequestFrom = null;
      this.actionSeq += 1;
    }

    // If the previous unique winner was due to deal next but has left, there
    // is no longer a previous winner seated to deal. Use the next physical
    // seat as a lifecycle fallback rather than leaving an invalid dealer id.
    if (this.pendingNextDealerId === playerId) this.pendingNextDealerId = nextSeat;
    if (this.departedDealerFallbackId === playerId) this.departedDealerFallbackId = nextSeat;
    if (this.dealerId === playerId) this.departedDealerFallbackId = nextSeat;

    this.players.delete(playerId);
    delete this.hands[playerId];
    if (leavingIndex >= 0) this.playersClockwise.splice(leavingIndex, 1);

    // During a live round dealerId remains historical round information.
    // dealNewRound repairs it before the following deal if that player left.
    if (this.state !== 'BETTING' && this.dealerId === playerId && nextSeat) {
      this.dealerId = nextSeat;
      this.departedDealerFallbackId = null;
    }

    return {
      settlement,
      roundEnded: stateBefore === 'BETTING' && this.state === 'ROUND_COMPLETE',
      remainingPlayerIds: [...this.playersClockwise],
    };
  }

  act(playerId: PlayerId, action: TeenPattiAction, expectedSeq?: number): ActionResult {
    if (this.state !== 'BETTING') return { ok: false, error: 'No Teen Patti betting is in progress.' };
    if (expectedSeq !== undefined && expectedSeq !== this.actionSeq) {
      return { ok: false, error: 'That action was already applied.' };
    }

    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'You are not seated at this table.' };
    if (player.packed) return { ok: false, error: 'You have packed this round.' };

    // Acceptance/decline is deliberately allowed from the other final player,
    // who is normally out of turn. The request itself does not consume a turn.
    if (action.type === 'ACCEPT_OPEN_SHOW') return this.acceptOpenShow(player);
    if (action.type === 'DECLINE_OPEN_SHOW') return this.declineOpenShow(player);

    if (this.currentTurn !== playerId) return { ok: false, error: 'It is not your turn.' };

    const active = this.activePlayers();
    const compulsorySideshow = active.length > 2 && active.every((id) => this.players.get(id)!.seen);
    if (compulsorySideshow && action.type !== 'SIDESHOW') {
      return { ok: false, error: 'All remaining players are seen. The sideshow is compulsory.' };
    }
    if (!compulsorySideshow && action.type === 'SIDESHOW') {
      return { ok: false, error: 'Sideshow is available only when all remaining players are seen.' };
    }

    switch (action.type) {
      case 'SEE': return this.applySee(player);
      case 'BLIND': return this.applyBlind(player);
      case 'CHAAL': return this.applyChaal(player);
      case 'PACK': return this.applyPack(player);
      case 'SIDESHOW': return this.applySideshow(player);
      case 'SHOWDOWN': return this.applyPaidShowdown(player);
      case 'REQUEST_OPEN_SHOW': return this.requestOpenShow(player);
      default: return { ok: false, error: 'Unknown Teen Patti action.' };
    }
  }

  private applySee(player: TeenPattiPlayer): ActionResult {
    if (player.cardsViewed) return { ok: false, error: 'You have already seen your cards.' };
    player.cardsViewed = true;
    player.seen = true;
    this.openShowRequestFrom = null;
    this.actionSeq += 1;
    return { ok: true };
  }

  private applyBlind(player: TeenPattiPlayer): ActionResult {
    if (player.seen) return { ok: false, error: 'You are seen and cannot return to blind.' };
    if (player.blindTurns >= TEEN_PATTI_RULES.MAX_BLIND_TURNS) {
      return { ok: false, error: 'Your three blind chances are complete; continue as seen.' };
    }
    const amount = this.currentBlind;
    if (player.chips < amount) return { ok: false, error: 'Top-up required for this blind.' };

    this.takeFromPlayer(player, amount, 'blind');
    player.blindTurns += 1;
    this.currentBlind = nextBlindAmount(this.currentBlind, this.tableConfig.maxBlind);
    this.finishTurn(player.playerId);
    return { ok: true };
  }

  private applyChaal(player: TeenPattiPlayer): ActionResult {
    if (!player.seen) return { ok: false, error: 'Blind players must play blind, see their cards, or pack.' };
    const amount = this.currentBlind * TEEN_PATTI_RULES.SEEN_MULTIPLIER;
    if (player.chips < amount) return { ok: false, error: 'Top-up required for this seen amount.' };
    this.takeFromPlayer(player, amount, 'chaal');
    this.finishTurn(player.playerId);
    return { ok: true };
  }

  private applyPack(player: TeenPattiPlayer): ActionResult {
    player.packed = true;
    this.finishTurn(player.playerId);
    return { ok: true };
  }

  private applySideshow(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    if (active.length <= 2 || !active.every((id) => this.players.get(id)!.seen)) {
      return { ok: false, error: 'A compulsory sideshow requires at least three active seen players.' };
    }

    const opponentId = this.previousActiveBefore(player.playerId);
    const comparison = compareThreeCardHands(
      classifyThreeCardHand(this.hands[player.playerId]),
      classifyThreeCardHand(this.hands[opponentId])
    );
    let packedPlayerId: PlayerId;
    let tied = false;
    if (comparison < 0) packedPlayerId = player.playerId;
    else if (comparison > 0) packedPlayerId = opponentId;
    else {
      tied = true;
      packedPlayerId = player.playerId; // agreed: exact tie -> initiator packs
    }
    this.players.get(packedPlayerId)!.packed = true;
    this.lastSideshow = {
      initiatorId: player.playerId,
      opponentId,
      packedPlayerId,
      tied,
    };
    this.finishTurn(player.playerId);
    return { ok: true };
  }

  private applyPaidShowdown(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    if (active.length !== 2) {
      return { ok: false, error: 'Paid showdown is available only to the final two players.' };
    }
    const amount = this.currentBlind * TEEN_PATTI_RULES.SEEN_MULTIPLIER;
    if (player.chips < amount) return { ok: false, error: 'Top-up required to initiate showdown.' };
    this.takeFromPlayer(player, amount, 'showdown');
    this.openShowRequestFrom = null;
    this.actionSeq += 1;
    this.resolveShowdown(active, 'PAID_SHOWDOWN');
    return { ok: true };
  }

  private requestOpenShow(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    if (active.length !== 2 || !active.includes(player.playerId)) {
      return { ok: false, error: 'Mutual open show is available only to the final two players.' };
    }
    this.openShowRequestFrom = player.playerId;
    this.actionSeq += 1;
    return { ok: true };
  }

  private acceptOpenShow(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    const requester = this.openShowRequestFrom;
    if (active.length !== 2 || !requester) return { ok: false, error: 'There is no open-show request to accept.' };
    if (player.playerId === requester || !active.includes(player.playerId)) {
      return { ok: false, error: 'Only the other final player can accept the open show.' };
    }
    this.openShowRequestFrom = null;
    this.actionSeq += 1;
    this.resolveShowdown(active, 'MUTUAL_OPEN_SHOW');
    return { ok: true };
  }

  private declineOpenShow(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    const requester = this.openShowRequestFrom;
    if (active.length !== 2 || !requester) return { ok: false, error: 'There is no open-show request to decline.' };
    if (player.playerId === requester || !active.includes(player.playerId)) {
      return { ok: false, error: 'Only the other final player can decline the open show.' };
    }
    this.openShowRequestFrom = null;
    this.actionSeq += 1;
    return { ok: true };
  }

  private finishTurn(actorId: PlayerId): void {
    this.openShowRequestFrom = null;
    this.actionSeq += 1;
    const active = this.activePlayers();
    if (active.length === 1) {
      this.awardPot(active, null, false, 'LAST_STANDING');
      return;
    }
    this.currentTurn = this.nextActiveAfter(actorId);
    this.applyForcedSeenIfNeeded();
  }

  private applyForcedSeenIfNeeded(): void {
    if (!this.currentTurn) return;
    const player = this.players.get(this.currentTurn)!;
    if (!player.seen && player.blindTurns >= TEEN_PATTI_RULES.MAX_BLIND_TURNS) {
      // Betting status changes, but cards remain face-down until SEE is chosen.
      player.seen = true;
    }
  }

  private takeFromPlayer(player: TeenPattiPlayer, amount: number, reason: string): void {
    if (player.chips < amount) throw new Error(`Insufficient play money for ${reason}`);
    player.chips -= amount;
    player.committed += amount;
    this.pot += amount;
  }

  private nextActiveAfter(playerId: PlayerId): PlayerId {
    let cursor = playerId;
    for (let i = 0; i < this.playersClockwise.length; i++) {
      cursor = rotateClockwise(this.playersClockwise, cursor);
      if (!this.players.get(cursor)!.packed) return cursor;
    }
    return playerId;
  }

  private previousActiveBefore(playerId: PlayerId): PlayerId {
    const index = this.playersClockwise.indexOf(playerId);
    if (index < 0) throw new Error(`${playerId} is not seated`);
    for (let offset = 1; offset <= this.playersClockwise.length; offset++) {
      const candidate = this.playersClockwise[(index - offset + this.playersClockwise.length) % this.playersClockwise.length];
      if (!this.players.get(candidate)!.packed) return candidate;
    }
    throw new Error('No active player anticlockwise');
  }

  private resolveShowdown(
    active: PlayerId[],
    reason: 'PAID_SHOWDOWN' | 'MUTUAL_OPEN_SHOW'
  ): void {
    const scored = active.map((playerId) => ({
      playerId,
      cards: this.hands[playerId],
      value: classifyThreeCardHand(this.hands[playerId]),
    }));
    let best = scored[0];
    for (const entry of scored.slice(1)) {
      if (compareThreeCardHands(entry.value, best.value) > 0) best = entry;
    }
    const winners = scored.filter((entry) => compareThreeCardHands(entry.value, best.value) === 0);
    const showdown: ShowdownEntry[] = scored.map((entry) => ({
      playerId: entry.playerId,
      cards: [...entry.cards],
      description: describeThreeCardHand(entry.cards),
    }));
    this.awardPot(winners.map((winner) => winner.playerId), showdown, winners.length > 1, reason);
  }

  private awardPot(
    winnerIds: PlayerId[],
    showdown: ShowdownEntry[] | null,
    split: boolean,
    reason: RoundOutcome['reason']
  ): void {
    const awarded = this.pot;
    const share = awarded / winnerIds.length; // exact equal split, including half-unit play money if needed
    for (const playerId of winnerIds) this.players.get(playerId)!.chips += share;

    this.lastOutcome = {
      roundNumber: this.roundNumber,
      dealerId: this.currentRoundDealerId,
      winnerIds: [...winnerIds],
      potAwarded: awarded,
      showdown,
      split,
      reason,
    };
    this.pendingNextDealerId = winnerIds.length === 1 ? winnerIds[0] : null;
    this.pot = 0;
    this.currentTurn = null;
    this.openShowRequestFrom = null;
    this.state = 'ROUND_COMPLETE';
    this.actionSeq += 1;
  }

  getPublicState() {
    return {
      roomCode: this.roomCode,
      game: 'TEEN_PATTI' as const,
      state: this.state,
      dealerId: this.dealerId,
      roundNumber: this.roundNumber,
      pot: this.pot,
      currentBlind: this.currentBlind,
      seenAmount: this.currentBlind * TEEN_PATTI_RULES.SEEN_MULTIPLIER,
      currentTurn: this.currentTurn,
      sequence: this.actionSeq,
      tableConfig: { ...this.tableConfig },
      variant: { ...this.roundVariant },
      variantHelp: getTeenPattiVariant(this.roundVariant.variantId).howToPlay,
      initialDealerDraws: this.initialDealerDraws.map((round) => ({
        contenders: [...round.contenders],
        draws: round.draws.map((draw) => ({ ...draw, card: { ...draw.card } })),
      })),
      lastSideshow: this.lastSideshow ? { ...this.lastSideshow } : null,
      openShowRequestFrom: this.openShowRequestFrom,
      players: this.playersClockwise.map((playerId) => {
        const player = this.players.get(playerId)!;
        const settlement = this.getSettlement(playerId)!;
        return {
          playerId,
          chips: player.chips,
          seen: player.seen,
          cardsViewed: player.cardsViewed,
          packed: player.packed,
          committed: player.committed,
          blindTurns: player.blindTurns,
          topUps: player.topUps,
          profitLoss: settlement.profitLoss,
        };
      }),
      lastOutcome: this.lastOutcome
        ? {
            ...this.lastOutcome,
            winnerIds: [...this.lastOutcome.winnerIds],
            showdown: this.lastOutcome.showdown?.map((entry) => ({
              ...entry,
              cards: entry.cards.map((card) => ({ ...card })),
            })) ?? null,
          }
        : null,
    };
  }
}
