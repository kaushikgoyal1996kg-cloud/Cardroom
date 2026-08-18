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
  compareTeenPattiEvaluatedHands,
  evaluateTeenPattiHand,
  legalTeenPattiDiscardSelections,
} from './handEvaluation.js';
import {
  DEFAULT_TEEN_PATTI_TABLE_CONFIG,
  TEEN_PATTI_RULES,
  describeTeenPattiRoundVariant,
  getTeenPattiVariant,
  nextBlindAmount,
  teenPattiRoundJokerMode,
  teenPattiVariantNeedsDealerConfig,
  teenPattiVariantsForTable,
  validateTeenPattiRoundVariantConfig,
  validateTeenPattiTableConfig,
  validateTeenPattiVariantPolicy,
  type TeenPattiRoundVariantConfig,
  type TeenPattiTableConfig,
  type TeenPattiVariantId,
  type TeenPattiTwoReferenceAssignment,
  type TeenPattiVariantTablePolicy,
} from './rules.js';
import { selectTeenPattiRoundVariant, selectTeenPattiSurpriseVariant } from './variantTable.js';

export type PlayerId = string;

export type TeenPattiState = 'READY' | 'AWAITING_VARIANT' | 'DEALING' | 'AWAITING_DISCARD' | 'AWAITING_REFERENCE_ASSIGNMENT' | 'BETTING' | 'ROUND_COMPLETE';
export type TeenPattiVariantDecision = 'CHOOSE_VARIANT' | 'CONFIGURE_VARIANT';

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
  /** Cumulative rounds won at this open-ended table session. Split-pot winners each receive one round win. */
  roundsWon: number;
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

export type TeenPattiFriendlySuggestion = 'PLAY' | 'PACK' | 'SIDESHOW' | 'SHOW';
export type TeenPattiFriendlyAssistStatus = 'PENDING' | 'ACCEPTED';

export interface TeenPattiFriendlyAssistRequestState {
  requestId: string;
  coachPlayerId: PlayerId;
  targetPlayerId: PlayerId;
  status: TeenPattiFriendlyAssistStatus;
  lastSuggestion: TeenPattiFriendlySuggestion | null;
}

export interface TeenPattiFriendlyAssistPrivateState {
  enabled: boolean;
  /** Once a coach has seen one friend’s cards, they cannot switch to another active player that hand. */
  coachLockedTargetPlayerId: PlayerId | null;
  outgoing: (TeenPattiFriendlyAssistRequestState & {
    /** Populated only after the target explicitly accepts. */
    targetCards: Card[];
    targetDiscardedCardIds: string[];
    targetTwoReferenceAssignment: TeenPattiTwoReferenceAssignment | null;
  }) | null;
  incoming: TeenPattiFriendlyAssistRequestState[];
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
  /** In retained-discard rounds, sideshow reveals every physical card the two compared players were dealt. */
  revealedHands?: ShowdownEntry[];
}

export interface ShowdownEntry {
  playerId: PlayerId;
  /** All physical cards originally dealt; retained discards remain visible here. */
  cards: Card[];
  /** Retained cards that were marked discarded in a 5-card round. */
  discardedCardIds?: string[];
  description: string;
}

export interface RoundOutcome {
  roundNumber: number;
  variantId: TeenPattiVariantId;
  variantName: string;
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
  readonly variantPolicy: TeenPattiVariantTablePolicy;
  roundVariant: TeenPattiRoundVariantConfig;

  state: TeenPattiState = 'READY';
  dealerId: PlayerId;
  roundNumber = 1;
  pot = 0;
  currentBlind: number;
  currentTurn: PlayerId | null = null;
  lastOutcome: RoundOutcome | null = null;
  /** Recent reconnect-safe round history. Kept bounded; cumulative counters live on player state. */
  readonly roundHistory: RoundOutcome[] = [];
  lastSideshow: SideshowResult | null = null;
  openShowRequestFrom: PlayerId | null = null;
  /** Unanimous no-cost Mutual Show vote. Requester is accepted automatically. */
  openShowAcceptedBy = new Set<PlayerId>();
  initialDealerDraws: DealerDrawRound[] = [];
  /** Public reference card(s) for joker variants. Always server-selected. */
  variantReferenceCards: Card[] = [];
  /** Two-Reference Joker role choice is private to each player. */
  private twoReferenceAssignments = new Map<PlayerId, TeenPattiTwoReferenceAssignment>();
  /** Locked retained-card discard indexes for 5-card variants. */
  private discardSelections = new Map<PlayerId, number[]>();
  /** Every legal discard pair for each player; indexes never reveal card identities to a blind client. */
  private discardLegalSelections = new Map<PlayerId, number[][]>();
  /** Per-hand Friendly Assist grants. Cards are exposed only through private state after target consent. */
  private friendlyAssistRequests = new Map<string, TeenPattiFriendlyAssistRequestState>();
  private friendlyAssistCoachLocks = new Map<PlayerId, PlayerId>();
  private friendlyAssistRequestCounter = 0;
  private pendingBettingTurn: PlayerId | null = null;

  private players = new Map<PlayerId, TeenPattiPlayer>();
  private hands: Record<PlayerId, Card[]> = {};
  private actionSeq = 0;
  private readonly randomSource: () => number;
  private dealerChosen: boolean;
  private pendingNextDealerId: PlayerId | null = null;
  /** Physical-seat fallback used only if the current/designated dealer leaves. */
  private departedDealerFallbackId: PlayerId | null = null;
  private currentRoundDealerId: PlayerId;
  private variantRotationIndex = -1;
  nextVariantChooserId: PlayerId | null = null;
  variantDecision: TeenPattiVariantDecision | null = null;
  /** True when this round's actual variant was randomly selected by the server. */
  variantWasSurprise = false;

  constructor(
    roomCode: string,
    playersClockwise: PlayerId[],
    options: {
      initialDealerId?: PlayerId;
      tableConfig?: TeenPattiTableConfig;
      roundVariant?: TeenPattiRoundVariantConfig;
      variantPolicy?: TeenPattiVariantTablePolicy;
      /** Server-owned selection source; injectable only for deterministic tests. */
      randomSource?: () => number;
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
    this.randomSource = options.randomSource ?? Math.random;
    this.tableConfig = { ...DEFAULT_TEEN_PATTI_TABLE_CONFIG, ...(options.tableConfig ?? {}) };
    validateTeenPattiTableConfig(this.tableConfig);
    const configuredRound = { variantId: 'CLASSIC', ...(options.roundVariant ?? {}) } as TeenPattiRoundVariantConfig;
    this.variantPolicy = options.variantPolicy
      ? { ...options.variantPolicy, variants: options.variantPolicy.variants ? [...options.variantPolicy.variants] : undefined }
      : { mode: 'FIXED', fixedVariant: configuredRound.variantId };
    validateTeenPattiVariantPolicy(this.variantPolicy, { requireRuntime: true });
    if (this.variantPolicy.mode === 'FIXED' && this.variantPolicy.fixedVariant !== configuredRound.variantId) {
      throw new Error('Teen Patti fixed-table policy does not match the configured round variant.');
    }
    if (this.variantPolicy.mode === 'VARIANT_TABLE') {
      const allowed = teenPattiVariantsForTable(this.variantPolicy).map((variant) => variant.id);
      if (!allowed.includes(configuredRound.variantId)) configuredRound.variantId = allowed[0];
    }
    this.roundVariant = configuredRound;
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
        roundsWon: 0,
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

  private assertNextBootFunded(): void {
    const underfunded = this.playersClockwise.filter(
      (playerId) => this.players.get(playerId)!.chips < this.tableConfig.bootAmount
    );
    if (underfunded.length > 0) {
      throw new Error(`Top-up required before the next boot: ${underfunded.join(', ')}`);
    }
  }

  /**
   * Advances dealer/round counters and clears the previous hand without
   * charging boot. Dealer-choice tables can then wait safely for the new
   * dealer's selection; reconnecting players see the same authoritative
   * chooser and approved pool before any card exists.
   */
  private prepareRoundShell(): void {
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

    this.currentRoundDealerId = this.dealerId;
    this.pendingNextDealerId = null;
    this.pot = 0;
    this.currentBlind = this.tableConfig.baseBlind;
    this.currentTurn = null;
    this.lastOutcome = null;
    this.lastSideshow = null;
    this.clearOpenShowRequest();
    this.hands = {};
    this.variantReferenceCards = [];
    this.twoReferenceAssignments.clear();
    this.discardSelections.clear();
    this.discardLegalSelections.clear();
    this.friendlyAssistRequests.clear();
    this.friendlyAssistCoachLocks.clear();
    this.pendingBettingTurn = null;
    this.variantDecision = null;
    this.variantWasSurprise = false;

    for (const playerId of this.playersClockwise) {
      const player = this.players.get(playerId)!;
      player.seen = false;
      player.cardsViewed = false;
      player.packed = false;
      player.committed = 0;
      player.blindTurns = 0;
    }
  }

  private selectAutomaticRoundVariant(): boolean {
    const selected = selectTeenPattiRoundVariant(this.variantPolicy, {
      dealerId: this.dealerId,
      previousRotationIndex: this.variantRotationIndex,
      random: this.randomSource,
      // Dealer-configured fixed variants must receive fresh parameters every
      // round; never carry a previous target/joker configuration forward silently.
      requested: this.variantPolicy.mode === 'FIXED' ? { variantId: this.variantPolicy.fixedVariant! } : undefined,
      permitPendingDealerConfig: true,
      requireRuntime: true,
    });
    this.roundVariant = { ...selected.roundVariant };
    this.variantRotationIndex = selected.rotationIndex;
    this.variantWasSurprise = this.variantPolicy.mode === 'VARIANT_TABLE' && this.variantPolicy.rotation === 'SURPRISE_ME';

    if (selected.needsDealerConfig) {
      this.state = 'AWAITING_VARIANT';
      this.variantDecision = 'CONFIGURE_VARIANT';
      this.nextVariantChooserId = this.dealerId;
      this.actionSeq += 1;
      return false;
    }
    return true;
  }

  private dealPreparedRound(testDeck?: Card[]): void {
    this.assertNextBootFunded();
    this.state = 'DEALING';
    this.nextVariantChooserId = null;
    this.variantDecision = null;

    for (const playerId of this.playersClockwise) {
      const player = this.players.get(playerId)!;
      this.takeFromPlayer(player, this.tableConfig.bootAmount, 'boot');
    }

    const order = seatingOrderFromDealer(this.playersClockwise, this.dealerId);
    const variant = getTeenPattiVariant(this.roundVariant.variantId);
    const { hands, remaining } = dealCards(testDeck ?? shuffleDeck(createDeck()), order, variant.dealCount);
    this.hands = hands;
    const jokerMode = teenPattiRoundJokerMode(this.roundVariant);
    if (variant.id === 'REVOLVING_JOKER') {
      if (remaining.length < 3) throw new Error('Revolving Joker needs three undealt board reference cards.');
      this.variantReferenceCards = remaining.slice(0, 3).map((card) => ({ ...card }));
    } else if (jokerMode === 'TWO_REFERENCE') {
      if (remaining.length < 2) throw new Error('Two-Reference Joker needs two undealt reference cards.');
      this.variantReferenceCards = remaining.slice(0, 2).map((card) => ({ ...card }));
    } else if (['PACK_RANK', 'UP_DOWN_SAME', 'UP_DOWN', 'DOWN_ONLY'].includes(jokerMode)) {
      if (remaining.length < 1) throw new Error(`${variant.name} needs an undealt reference card.`);
      this.variantReferenceCards = [{ ...remaining[0] }];
    }

    this.pendingBettingTurn = order[0];

    if (variant.selection === 'DISCARD_TO_THREE') {
      if (!variant.discardRule) throw new Error(`${variant.name} is missing its discard rule.`);
      for (const playerId of this.playersClockwise) {
        const legal = legalTeenPattiDiscardSelections(this.hands[playerId], variant.discardRule);
        this.discardLegalSelections.set(playerId, legal.map((selection) => [...selection]));
        // No player decision exists when rank rules identify one unique physical
        // pair. Lock that pair without revealing any card to a blind player.
        if (legal.length === 1) this.discardSelections.set(playerId, [...legal[0]]);
      }
      if (!this.playersClockwise.every((playerId) => this.discardSelections.has(playerId))) {
        this.currentTurn = null;
        this.state = 'AWAITING_DISCARD';
        this.actionSeq += 1;
        return;
      }
    }

    this.continueAfterDiscardGate();
  }

  private continueAfterDiscardGate(): void {
    const jokerMode = teenPattiRoundJokerMode(this.roundVariant);
    if (jokerMode === 'TWO_REFERENCE') {
      // Both references are public, but every player's role assignment remains
      // private. If a 5-card discard phase existed, it must be fully complete
      // before joker roles are chosen.
      this.currentTurn = null;
      this.state = 'AWAITING_REFERENCE_ASSIGNMENT';
      this.actionSeq += 1;
      return;
    }

    this.state = 'BETTING';
    this.currentTurn = this.pendingBettingTurn && this.players.has(this.pendingBettingTurn)
      ? this.pendingBettingTurn
      : seatingOrderFromDealer(this.playersClockwise, this.dealerId)[0];
    this.pendingBettingTurn = null;
    this.applyForcedSeenIfNeeded();
    this.actionSeq += 1;
  }

  /**
   * Lock one player's physical discard choice. Rank decides the required
   * low/high boundary, but suit never resolves equal-ranked cards: the player
   * chooses the actual physical card. All players answer against the same gate
   * sequence so simultaneous choices cannot race one another.
   */
  chooseDiscards(playerId: PlayerId, discardedSlots: number[], expectedSeq?: number): ActionResult {
    if (this.state !== 'AWAITING_DISCARD') {
      return { ok: false, error: 'This table is not waiting for five-card discard choices.' };
    }
    if (expectedSeq !== undefined && expectedSeq !== this.actionSeq) {
      return { ok: false, error: 'That five-card discard choice is stale.' };
    }
    if (!this.players.has(playerId)) return { ok: false, error: 'You are not seated at this table.' };
    if (this.discardSelections.has(playerId)) return { ok: false, error: 'Your discard choice is already locked.' };
    if (!Array.isArray(discardedSlots) || discardedSlots.length !== 2 || new Set(discardedSlots).size !== 2) {
      return { ok: false, error: 'Choose exactly two different cards to discard.' };
    }
    const normalized = [...discardedSlots].sort((a, b) => a - b);
    const legal = this.discardLegalSelections.get(playerId) ?? [];
    const permitted = legal.some((selection) => {
      const candidate = [...selection].sort((a, b) => a - b);
      return candidate[0] === normalized[0] && candidate[1] === normalized[1];
    });
    if (!permitted) return { ok: false, error: 'Those cards do not satisfy this round’s discard rule.' };

    this.discardSelections.set(playerId, normalized);
    if (this.playersClockwise.every((id) => this.discardSelections.has(id))) {
      this.continueAfterDiscardGate();
    }
    // Keep sequence stable while independent players are still choosing.
    return { ok: true };
  }

  /**
   * Starts/advances one round. Fixed tables and fixed-rotation Variant Tables
   * deal immediately. Dealer-choice Variant Tables stop in AWAITING_VARIANT;
   * no boot is charged and no card is dealt until the authoritative dealer
   * chooses from the host-approved runtime-ready pool.
   */
  dealNewRound(testDeck?: Card[]): void {
    if (!this.dealerChosen) this.chooseInitialDealer();
    if (this.state !== 'READY' && this.state !== 'ROUND_COMPLETE') {
      throw new Error(`Cannot deal Teen Patti from state ${this.state}`);
    }
    if (this.playersClockwise.length < TEEN_PATTI_RULES.MIN_PLAYERS) {
      throw new Error(`Teen Patti needs at least ${TEEN_PATTI_RULES.MIN_PLAYERS} seated players to deal.`);
    }

    // Validate before any dealer/round mutation. A rejected host attempt must
    // never consume a round number or move the dealer.
    this.assertNextBootFunded();
    this.prepareRoundShell();

    if (this.variantPolicy.mode === 'VARIANT_TABLE' && this.variantPolicy.rotation === 'DEALER_CHOICE') {
      this.state = 'AWAITING_VARIANT';
      this.variantDecision = 'CHOOSE_VARIANT';
      this.nextVariantChooserId = this.dealerId;
      this.actionSeq += 1;
      return;
    }

    if (!this.selectAutomaticRoundVariant()) return;
    this.dealPreparedRound(testDeck);
  }

  /**
   * Dealer-only network action for a Variant Table. Selection and dealing are
   * one server transaction so another player cannot race a different variant
   * between approval and the deal.
   */
  chooseRoundVariant(
    playerId: PlayerId,
    requested: TeenPattiRoundVariantConfig,
    expectedSeq?: number,
    testDeck?: Card[],
  ): ActionResult {
    if (expectedSeq !== undefined && expectedSeq !== this.actionSeq) {
      return { ok: false, error: 'That Teen Patti round decision is stale.' };
    }
    if (this.state !== 'AWAITING_VARIANT') return { ok: false, error: 'This table is not waiting for a Teen Patti round decision.' };
    if (playerId !== this.nextVariantChooserId || playerId !== this.dealerId) {
      return { ok: false, error: 'Only the dealer for this round may choose or configure the Teen Patti variant.' };
    }

    try {
      if (this.variantDecision === 'CHOOSE_VARIANT') {
        if (this.variantPolicy.mode !== 'VARIANT_TABLE' || this.variantPolicy.rotation !== 'DEALER_CHOICE') {
          return { ok: false, error: 'This Teen Patti table is not waiting for Dealer Choice.' };
        }
        const selected = selectTeenPattiRoundVariant(this.variantPolicy, {
          dealerId: this.dealerId,
          chooserId: playerId,
          requested,
          previousRotationIndex: this.variantRotationIndex,
          requireRuntime: true,
        });
        this.roundVariant = { ...selected.roundVariant };
        this.variantRotationIndex = selected.rotationIndex;
        this.variantWasSurprise = false;
      } else if (this.variantDecision === 'CONFIGURE_VARIANT') {
        if (requested.variantId !== this.roundVariant.variantId) {
          return { ok: false, error: 'The server already selected this round’s variant; only its dealer settings may be changed.' };
        }
        if (!teenPattiVariantNeedsDealerConfig(requested.variantId)) {
          return { ok: false, error: 'This Teen Patti variant has no pending dealer configuration.' };
        }
        validateTeenPattiRoundVariantConfig(requested, { requireRuntime: true });
        this.roundVariant = { ...requested };
      } else {
        return { ok: false, error: 'This Teen Patti round has no pending variant decision.' };
      }

      this.dealPreparedRound(testDeck);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Teen Patti variant selection failed.' };
    }
  }


  /**
   * Dealer Choice convenience action: the dealer chooses "Surprise Me", but
   * the server owns the actual random draw from the host-approved pool. If the
   * selected variant needs dealer parameters (for example Closest to N), the
   * table remains pre-deal until that same dealer configures them.
   */
  chooseSurpriseRoundVariant(
    playerId: PlayerId,
    expectedSeq?: number,
    testDeck?: Card[],
  ): ActionResult {
    if (expectedSeq !== undefined && expectedSeq !== this.actionSeq) {
      return { ok: false, error: 'That Teen Patti round decision is stale.' };
    }
    if (this.state !== 'AWAITING_VARIANT' || this.variantDecision !== 'CHOOSE_VARIANT') {
      return { ok: false, error: 'This table is not waiting for a Teen Patti variant choice.' };
    }
    if (playerId !== this.nextVariantChooserId || playerId !== this.dealerId) {
      return { ok: false, error: 'Only the dealer for this round may choose Surprise Me.' };
    }
    if (this.variantPolicy.mode !== 'VARIANT_TABLE' || this.variantPolicy.rotation !== 'DEALER_CHOICE') {
      return { ok: false, error: 'Surprise Me as a dealer choice is available only on a Dealer Choice Variant Table.' };
    }

    try {
      const selected = selectTeenPattiSurpriseVariant(this.variantPolicy, {
        random: this.randomSource,
        requireRuntime: true,
        permitPendingDealerConfig: true,
      });
      this.roundVariant = { ...selected.roundVariant };
      this.variantRotationIndex = selected.rotationIndex;
      this.variantWasSurprise = true;

      if (selected.needsDealerConfig) {
        this.variantDecision = 'CONFIGURE_VARIANT';
        this.nextVariantChooserId = this.dealerId;
        this.actionSeq += 1;
        return { ok: true };
      }

      this.dealPreparedRound(testDeck);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Teen Patti Surprise Me selection failed.' };
    }
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

  private friendlyAssistEnabled(): boolean {
    return this.tableConfig.friendlyAssist === true;
  }

  private discardedCardIdsFor(playerId: PlayerId): string[] {
    const hand = this.hands[playerId] ?? [];
    const slots = this.discardSelections.get(playerId) ?? [];
    return slots.map((slot) => hand[slot]?.id).filter((id): id is string => !!id);
  }

  private friendlyRequestForCoach(coachPlayerId: PlayerId): TeenPattiFriendlyAssistRequestState | null {
    for (const request of this.friendlyAssistRequests.values()) {
      if (request.coachPlayerId === coachPlayerId) return request;
    }
    return null;
  }

  private clearFriendlyAssistForTarget(targetPlayerId: PlayerId): void {
    for (const [requestId, request] of this.friendlyAssistRequests) {
      if (request.targetPlayerId === targetPlayerId) this.friendlyAssistRequests.delete(requestId);
    }
  }

  private clearFriendlyAssistForPlayer(playerId: PlayerId): void {
    for (const [requestId, request] of this.friendlyAssistRequests) {
      if (request.targetPlayerId === playerId || request.coachPlayerId === playerId) {
        this.friendlyAssistRequests.delete(requestId);
      }
    }
  }

  private getFriendlyAssistPrivateState(playerId: PlayerId): TeenPattiFriendlyAssistPrivateState {
    const outgoingRequest = this.friendlyRequestForCoach(playerId);
    const outgoing = outgoingRequest
      ? {
          ...outgoingRequest,
          targetCards: outgoingRequest.status === 'ACCEPTED'
            ? this.getPlayerHand(outgoingRequest.targetPlayerId)
            : [],
          targetDiscardedCardIds: outgoingRequest.status === 'ACCEPTED'
            ? this.discardedCardIdsFor(outgoingRequest.targetPlayerId)
            : [],
          targetTwoReferenceAssignment: outgoingRequest.status === 'ACCEPTED'
            ? (() => {
                const assignment = this.twoReferenceAssignments.get(outgoingRequest.targetPlayerId);
                return assignment ? { ...assignment } : null;
              })()
            : null,
        }
      : null;

    const incoming = [...this.friendlyAssistRequests.values()]
      .filter((request) => request.targetPlayerId === playerId)
      .map((request) => ({ ...request }));

    return {
      enabled: this.friendlyAssistEnabled(),
      coachLockedTargetPlayerId: this.friendlyAssistCoachLocks.get(playerId) ?? null,
      outgoing,
      incoming,
    };
  }

  /**
   * Friendly private-table social layer. Only a player who has already packed
   * may ask one still-active player for permission to watch and suggest. The
   * request never exposes cards by itself.
   */
  requestFriendlyAssist(
    coachPlayerId: PlayerId,
    targetPlayerId: PlayerId,
    expectedRoundNumber?: number,
  ): ActionResult {
    if (!this.friendlyAssistEnabled()) return { ok: false, error: 'Friendly Assist is disabled for this table.' };
    if (expectedRoundNumber !== undefined && expectedRoundNumber !== this.roundNumber) {
      return { ok: false, error: 'That Friendly Assist request belongs to an older hand.' };
    }
    if (this.state !== 'BETTING') return { ok: false, error: 'Friendly Assist is available only during live betting.' };
    const coach = this.players.get(coachPlayerId);
    const target = this.players.get(targetPlayerId);
    if (!coach || !target) return { ok: false, error: 'Both players must still be seated at this table.' };
    if (!coach.packed) return { ok: false, error: 'You can request Friendly Assist only after you have packed.' };
    if (target.packed) return { ok: false, error: 'You can watch only a player who is still active in this hand.' };
    if (coachPlayerId === targetPlayerId) return { ok: false, error: 'Choose another active player to watch.' };
    if (this.friendlyRequestForCoach(coachPlayerId)) {
      return { ok: false, error: 'You already chose a player to watch this hand.' };
    }
    const lockedTarget = this.friendlyAssistCoachLocks.get(coachPlayerId);
    if (lockedTarget) {
      return { ok: false, error: 'You already watched one player this hand and cannot switch to another hand.' };
    }

    const requestId = `FA-${this.roundNumber}-${++this.friendlyAssistRequestCounter}`;
    this.friendlyAssistRequests.set(requestId, {
      requestId,
      coachPlayerId,
      targetPlayerId,
      status: 'PENDING',
      lastSuggestion: null,
    });
    return { ok: true };
  }

  respondFriendlyAssist(targetPlayerId: PlayerId, requestId: string, accept: boolean): ActionResult {
    if (!this.friendlyAssistEnabled()) return { ok: false, error: 'Friendly Assist is disabled for this table.' };
    const request = this.friendlyAssistRequests.get(requestId);
    if (!request || request.targetPlayerId !== targetPlayerId) {
      return { ok: false, error: 'That Friendly Assist request is no longer available.' };
    }
    if (request.status !== 'PENDING') return { ok: false, error: 'That Friendly Assist request was already answered.' };
    const target = this.players.get(targetPlayerId);
    const coach = this.players.get(request.coachPlayerId);
    if (this.state !== 'BETTING' || !target || target.packed || !coach || !coach.packed) {
      this.friendlyAssistRequests.delete(requestId);
      return { ok: false, error: 'That Friendly Assist request expired.' };
    }

    if (!accept) {
      this.friendlyAssistRequests.delete(requestId);
      return { ok: true };
    }

    request.status = 'ACCEPTED';
    this.friendlyAssistCoachLocks.set(request.coachPlayerId, targetPlayerId);
    // A coach who can see the hand can communicate card strength. Preserve the
    // actual blind/seen betting rules by moving the consenting target to seen
    // betting status, while allowing their own cards to remain visually closed.
    if (!target.seen) target.seen = true;
    this.actionSeq += 1;
    return { ok: true };
  }

  revokeFriendlyAssist(playerId: PlayerId, requestId: string): ActionResult {
    const request = this.friendlyAssistRequests.get(requestId);
    if (!request) return { ok: false, error: 'That Friendly Assist session is no longer active.' };
    if (request.coachPlayerId !== playerId && request.targetPlayerId !== playerId) {
      return { ok: false, error: 'You cannot revoke another pair’s Friendly Assist session.' };
    }
    this.friendlyAssistRequests.delete(requestId);
    return { ok: true };
  }

  suggestFriendlyAssist(
    coachPlayerId: PlayerId,
    requestId: string,
    suggestion: TeenPattiFriendlySuggestion,
  ): ActionResult {
    if (!(['PLAY', 'PACK', 'SIDESHOW', 'SHOW'] as TeenPattiFriendlySuggestion[]).includes(suggestion)) {
      return { ok: false, error: 'Unknown Friendly Assist suggestion.' };
    }
    const request = this.friendlyAssistRequests.get(requestId);
    if (!request || request.coachPlayerId !== coachPlayerId || request.status !== 'ACCEPTED') {
      return { ok: false, error: 'You do not have permission to suggest for that player.' };
    }
    const target = this.players.get(request.targetPlayerId);
    if (this.state !== 'BETTING' || !target || target.packed) {
      this.friendlyAssistRequests.delete(requestId);
      return { ok: false, error: 'That player is no longer active in this hand.' };
    }
    request.lastSuggestion = suggestion;
    return { ok: true };
  }

  /** Cards are private even from their owner until that player presses See. */
  getPrivateState(playerId: PlayerId) {
    const player = this.players.get(playerId);
    if (!player) return null;
    const assignment = this.twoReferenceAssignments.get(playerId);
    const discardSelection = this.discardSelections.get(playerId);
    const discardOptions = this.discardLegalSelections.get(playerId) ?? [];
    return {
      // Tag every private snapshot with the same authoritative identity as the
      // public state. Socket packets can be rendered between one another, so
      // the client must be able to reject a private hand/action model from an
      // older round or sequence rather than pairing it with newer public state.
      roundNumber: this.roundNumber,
      sequence: this.actionSeq,
      cards: player.cardsViewed ? this.getPlayerHand(playerId) : [],
      cardCount: this.hands[playerId]?.length ?? 0,
      cardsViewed: player.cardsViewed,
      seen: player.seen,
      friendlyAssist: this.getFriendlyAssistPrivateState(playerId),
      twoReferenceAssignment: assignment ? { ...assignment } : null,
      discardState: getTeenPattiVariant(this.roundVariant.variantId).selection === 'DISCARD_TO_THREE'
        ? {
            complete: !!discardSelection,
            selectedSlots: discardSelection ? [...discardSelection] : [],
            legalSelections: discardSelection ? [] : discardOptions.map((selection) => [...selection]),
          }
        : null,
    };
  }

  /**
   * Two-Reference Joker pre-betting choice. Both board cards are public; only
   * this player's role choice is private. Everyone who received the same gate
   * sequence may answer against that sequence, so one player's answer cannot
   * make another player's simultaneous choice stale. Betting starts only once
   * every still-seated player has assigned exactly one reference to Up/Down.
   */
  assignTwoReference(
    playerId: PlayerId,
    upDownReferenceIndex: 0 | 1,
    expectedSeq?: number,
  ): ActionResult {
    if (this.state !== 'AWAITING_REFERENCE_ASSIGNMENT' || teenPattiRoundJokerMode(this.roundVariant) !== 'TWO_REFERENCE') {
      return { ok: false, error: 'This table is not waiting for Two-Reference Joker assignments.' };
    }
    if (expectedSeq !== undefined && expectedSeq !== this.actionSeq) {
      return { ok: false, error: 'That Two-Reference Joker assignment is stale.' };
    }
    if (!this.players.has(playerId)) return { ok: false, error: 'You are not seated at this table.' };
    if (upDownReferenceIndex !== 0 && upDownReferenceIndex !== 1) {
      return { ok: false, error: 'Choose exactly one board reference for Up/Down.' };
    }
    if (this.twoReferenceAssignments.has(playerId)) {
      return { ok: false, error: 'Your Two-Reference Joker roles are already locked for this hand.' };
    }

    this.twoReferenceAssignments.set(playerId, { upDownReferenceIndex });
    const everyoneAssigned = this.playersClockwise.every((id) => this.twoReferenceAssignments.has(id));
    if (everyoneAssigned) {
      this.state = 'BETTING';
      this.currentTurn = this.pendingBettingTurn && this.players.has(this.pendingBettingTurn)
        ? this.pendingBettingTurn
        : seatingOrderFromDealer(this.playersClockwise, this.dealerId)[0];
      this.pendingBettingTurn = null;
      this.applyForcedSeenIfNeeded();
      this.actionSeq += 1;
    }
    // Keep the sequence stable while independent players answer the same gate.
    return { ok: true };
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

    if ((this.state === 'BETTING' || this.state === 'AWAITING_DISCARD' || this.state === 'AWAITING_REFERENCE_ASSIGNMENT') && !player.packed) {
      player.packed = true;
      this.revolveJokersToPackedHand(playerId);
      this.clearOpenShowRequest();
      if (this.state === 'BETTING' && this.currentTurn === playerId) {
        this.finishTurn(playerId);
      } else {
        this.actionSeq += 1;
        const active = this.activePlayers();
        if (active.length === 1) {
          this.awardPot(active, null, false, 'LAST_STANDING');
        }
      }
    } else {
      this.clearOpenShowRequest();
      this.actionSeq += 1;
    }

    // If the previous unique winner was due to deal next but has left, there
    // is no longer a previous winner seated to deal. Use the next physical
    // seat as a lifecycle fallback rather than leaving an invalid dealer id.
    if (this.pendingNextDealerId === playerId) this.pendingNextDealerId = nextSeat;
    if (this.departedDealerFallbackId === playerId) this.departedDealerFallbackId = nextSeat;
    if (this.dealerId === playerId) this.departedDealerFallbackId = nextSeat;

    this.clearFriendlyAssistForPlayer(playerId);
    this.friendlyAssistCoachLocks.delete(playerId);
    this.players.delete(playerId);
    delete this.hands[playerId];
    this.twoReferenceAssignments.delete(playerId);
    this.discardSelections.delete(playerId);
    this.discardLegalSelections.delete(playerId);
    if (leavingIndex >= 0) this.playersClockwise.splice(leavingIndex, 1);

    if (this.state === 'AWAITING_DISCARD') {
      if (this.pendingBettingTurn === playerId) this.pendingBettingTurn = nextSeat;
      if (this.playersClockwise.length === 1) {
        this.pendingBettingTurn = null;
        this.awardPot([this.playersClockwise[0]], null, false, 'LAST_STANDING');
      } else if (this.playersClockwise.length >= 2 && this.playersClockwise.every((id) => this.discardSelections.has(id))) {
        this.continueAfterDiscardGate();
      }
    }

    if (this.state === 'AWAITING_REFERENCE_ASSIGNMENT') {
      if (this.pendingBettingTurn === playerId) this.pendingBettingTurn = nextSeat;
      if (this.playersClockwise.length === 1) {
        this.pendingBettingTurn = null;
        this.awardPot([this.playersClockwise[0]], null, false, 'LAST_STANDING');
      } else if (this.playersClockwise.length >= 2 && this.playersClockwise.every((id) => this.twoReferenceAssignments.has(id))) {
        this.state = 'BETTING';
        this.currentTurn = this.pendingBettingTurn && this.players.has(this.pendingBettingTurn)
          ? this.pendingBettingTurn
          : seatingOrderFromDealer(this.playersClockwise, this.dealerId)[0];
        this.pendingBettingTurn = null;
        this.applyForcedSeenIfNeeded();
        this.actionSeq += 1;
      }
    }

    // During a live round dealerId remains historical round information.
    // dealNewRound repairs it before the following deal if that player left.
    if (this.state !== 'BETTING' && this.state !== 'AWAITING_DISCARD' && this.state !== 'AWAITING_REFERENCE_ASSIGNMENT' && this.dealerId === playerId && nextSeat) {
      this.dealerId = nextSeat;
      this.departedDealerFallbackId = null;
      if (this.state === 'AWAITING_VARIANT') {
        this.currentRoundDealerId = nextSeat;
        this.nextVariantChooserId = nextSeat;
      }
    }

    return {
      settlement,
      roundEnded: (stateBefore === 'BETTING' || stateBefore === 'AWAITING_DISCARD' || stateBefore === 'AWAITING_REFERENCE_ASSIGNMENT') && this.state === 'ROUND_COMPLETE',
      remainingPlayerIds: [...this.playersClockwise],
    };
  }

  act(playerId: PlayerId, action: TeenPattiAction, expectedSeq?: number): ActionResult {
    if (expectedSeq !== undefined && expectedSeq !== this.actionSeq) {
      return { ok: false, error: 'That action was already applied.' };
    }

    const player = this.players.get(playerId);
    if (this.state === 'AWAITING_DISCARD') {
      if (!player) return { ok: false, error: 'You are not seated at this table.' };
      if (action.type !== 'SEE') return { ok: false, error: 'Lock the required five-card discards before betting begins.' };
      if (player.cardsViewed) return { ok: false, error: 'You have already seen your cards.' };
      // Seeing during the simultaneous discard gate makes the player seen for
      // the round, but does not advance the shared gate sequence.
      player.cardsViewed = true;
      player.seen = true;
      return { ok: true };
    }
    if (this.state !== 'BETTING') return { ok: false, error: 'No Teen Patti betting is in progress.' };

    if (!player) return { ok: false, error: 'You are not seated at this table.' };
    if (player.packed) return { ok: false, error: 'You have packed this round.' };

    // Mutual Show is a table-wide consent flow, not a betting turn. Any active
    // player may propose it; everyone else may accept/decline out of turn.
    if (action.type === 'REQUEST_OPEN_SHOW') return this.requestOpenShow(player);
    if (action.type === 'ACCEPT_OPEN_SHOW') return this.acceptOpenShow(player);
    if (action.type === 'DECLINE_OPEN_SHOW') return this.declineOpenShow(player);

    // Freeze betting while a Mutual Show vote is pending. If anyone declines,
    // the exact current turn resumes unchanged.
    if (this.openShowRequestFrom) {
      return { ok: false, error: 'A Mutual Show vote is in progress. Accept or decline it first.' };
    }

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
      default: return { ok: false, error: 'Unknown Teen Patti action.' };
    }
  }

  private applySee(player: TeenPattiPlayer): ActionResult {
    if (player.cardsViewed) return { ok: false, error: 'You have already seen your cards.' };
    player.cardsViewed = true;
    player.seen = true;
    this.clearOpenShowRequest();
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

  /**
   * Locked Revolving Joker rule: the most recently packed player's complete
   * three-card hand replaces the current board joker references. The previous
   * reference ranks stop being wild immediately; references never accumulate.
   */
  private revolveJokersToPackedHand(playerId: PlayerId): void {
    if (this.roundVariant.variantId !== 'REVOLVING_JOKER') return;
    const hand = this.hands[playerId];
    if (!hand || hand.length !== 3) throw new Error('Revolving Joker requires the packed player’s complete three-card hand.');
    this.variantReferenceCards = hand.map((card) => ({ ...card }));
  }

  private applyPack(player: TeenPattiPlayer): ActionResult {
    player.packed = true;
    this.clearFriendlyAssistForTarget(player.playerId);
    this.revolveJokersToPackedHand(player.playerId);
    this.finishTurn(player.playerId);
    return { ok: true };
  }

  private applySideshow(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    if (active.length <= 2 || !active.every((id) => this.players.get(id)!.seen)) {
      return { ok: false, error: 'A compulsory sideshow requires at least three active seen players.' };
    }

    const opponentId = this.previousActiveBefore(player.playerId);
    const comparison = compareTeenPattiEvaluatedHands(
      evaluateTeenPattiHand(this.hands[player.playerId], this.roundVariant, this.variantReferenceCards, this.twoReferenceAssignments.get(player.playerId), this.discardSelections.get(player.playerId)),
      evaluateTeenPattiHand(this.hands[opponentId], this.roundVariant, this.variantReferenceCards, this.twoReferenceAssignments.get(opponentId), this.discardSelections.get(opponentId)),
      this.roundVariant
    );
    let packedPlayerId: PlayerId;
    let tied = false;
    if (comparison < 0) packedPlayerId = player.playerId;
    else if (comparison > 0) packedPlayerId = opponentId;
    else {
      tied = true;
      packedPlayerId = player.playerId; // agreed: exact tie -> initiator packs
    }
    const revealFiveCardSideshow = getTeenPattiVariant(this.roundVariant.variantId).selection === 'DISCARD_TO_THREE';
    const revealedHands: ShowdownEntry[] | undefined = revealFiveCardSideshow
      ? [player.playerId, opponentId].map((playerId) => {
          const evaluated = evaluateTeenPattiHand(
            this.hands[playerId],
            this.roundVariant,
            this.variantReferenceCards,
            this.twoReferenceAssignments.get(playerId),
            this.discardSelections.get(playerId),
          );
          return {
            playerId,
            cards: this.hands[playerId].map((card) => ({ ...card })),
            discardedCardIds: evaluated.discardedCardIds ? [...evaluated.discardedCardIds] : undefined,
            description: evaluated.description,
          };
        })
      : undefined;

    this.players.get(packedPlayerId)!.packed = true;
    this.clearFriendlyAssistForTarget(packedPlayerId);
    this.revolveJokersToPackedHand(packedPlayerId);
    this.lastSideshow = {
      initiatorId: player.playerId,
      opponentId,
      packedPlayerId,
      tied,
      revealedHands,
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
    this.clearOpenShowRequest();
    this.actionSeq += 1;
    this.resolveShowdown(active, 'PAID_SHOWDOWN');
    return { ok: true };
  }

  private clearOpenShowRequest(): void {
    this.openShowRequestFrom = null;
    this.openShowAcceptedBy.clear();
  }

  private requestOpenShow(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    if (active.length < 2 || !active.includes(player.playerId)) {
      return { ok: false, error: 'Mutual Show requires at least two active players.' };
    }
    if (this.openShowRequestFrom) {
      return { ok: false, error: 'A Mutual Show vote is already in progress.' };
    }
    this.openShowRequestFrom = player.playerId;
    this.openShowAcceptedBy = new Set([player.playerId]);
    this.actionSeq += 1;
    return { ok: true };
  }

  private acceptOpenShow(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    const requester = this.openShowRequestFrom;
    if (!requester) return { ok: false, error: 'There is no Mutual Show request to accept.' };
    if (!active.includes(player.playerId)) return { ok: false, error: 'Only an active player can vote on Mutual Show.' };
    if (this.openShowAcceptedBy.has(player.playerId)) return { ok: false, error: 'You have already accepted this Mutual Show.' };

    this.openShowAcceptedBy.add(player.playerId);
    const unanimous = active.every((playerId) => this.openShowAcceptedBy.has(playerId));
    if (unanimous) {
      // Do not advance the global action sequence for each intermediate vote.
      // Everyone who saw this exact Mutual Show proposal may accept against the
      // same proposal sequence without racing one another. The completed
      // showdown advances the sequence when the round resolves.
      this.clearOpenShowRequest();
      this.resolveShowdown(active, 'MUTUAL_OPEN_SHOW');
      return { ok: true };
    }

    // Keep the proposal sequence stable while collecting unanimous consent.
    // Duplicate votes are rejected by openShowAcceptedBy instead.
    return { ok: true };
  }

  private declineOpenShow(player: TeenPattiPlayer): ActionResult {
    const active = this.activePlayers();
    const requester = this.openShowRequestFrom;
    if (!requester) return { ok: false, error: 'There is no Mutual Show request to decline.' };
    if (!active.includes(player.playerId)) return { ok: false, error: 'Only an active player can vote on Mutual Show.' };
    if (player.playerId === requester) return { ok: false, error: 'The requester cannot decline their own Mutual Show.' };

    this.clearOpenShowRequest();
    this.actionSeq += 1;
    return { ok: true };
  }

  private finishTurn(actorId: PlayerId): void {
    this.clearOpenShowRequest();
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
      evaluated: evaluateTeenPattiHand(this.hands[playerId], this.roundVariant, this.variantReferenceCards, this.twoReferenceAssignments.get(playerId), this.discardSelections.get(playerId)),
    }));
    let best = scored[0];
    for (const entry of scored.slice(1)) {
      if (compareTeenPattiEvaluatedHands(entry.evaluated, best.evaluated, this.roundVariant) > 0) best = entry;
    }
    const winners = scored.filter(
      (entry) => compareTeenPattiEvaluatedHands(entry.evaluated, best.evaluated, this.roundVariant) === 0
    );
    const showdown: ShowdownEntry[] = scored.map((entry) => ({
      playerId: entry.playerId,
      cards: [...entry.cards],
      discardedCardIds: entry.evaluated.discardedCardIds ? [...entry.evaluated.discardedCardIds] : undefined,
      description: entry.evaluated.description,
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
    for (const playerId of winnerIds) {
      const player = this.players.get(playerId)!;
      player.chips += share;
      player.roundsWon += 1;
    }

    const outcome: RoundOutcome = {
      roundNumber: this.roundNumber,
      variantId: this.roundVariant.variantId,
      variantName: getTeenPattiVariant(this.roundVariant.variantId).name,
      dealerId: this.currentRoundDealerId,
      winnerIds: [...winnerIds],
      potAwarded: awarded,
      showdown,
      split,
      reason,
    };
    this.lastOutcome = outcome;
    this.roundHistory.push({
      ...outcome,
      winnerIds: [...outcome.winnerIds],
      showdown: outcome.showdown?.map((entry) => ({
        ...entry,
        cards: entry.cards.map((card) => ({ ...card })),
      })) ?? null,
    });
    if (this.roundHistory.length > 100) this.roundHistory.splice(0, this.roundHistory.length - 100);
    this.pendingNextDealerId = winnerIds.length === 1 ? winnerIds[0] : null;
    this.friendlyAssistRequests.clear();
    this.friendlyAssistCoachLocks.clear();
    this.pot = 0;
    this.currentTurn = null;
    this.clearOpenShowRequest();
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
      variantPolicy: {
        ...this.variantPolicy,
        variants: this.variantPolicy.variants ? [...this.variantPolicy.variants] : undefined,
      },
      variant: { ...this.roundVariant },
      variantDecision: this.variantDecision,
      variantWasSurprise: this.variantWasSurprise,
      variantName: this.state === 'AWAITING_VARIANT' && this.variantDecision === 'CHOOSE_VARIANT'
        ? 'Dealer choice pending'
        : getTeenPattiVariant(this.roundVariant.variantId).name,
      nextVariantChooserId: this.nextVariantChooserId,
      variantDealCount: this.state === 'AWAITING_VARIANT' ? 0 : getTeenPattiVariant(this.roundVariant.variantId).dealCount,
      variantHelp: this.state === 'AWAITING_VARIANT'
        ? this.variantDecision === 'CONFIGURE_VARIANT'
          ? `${describeTeenPattiRoundVariant(this.roundVariant)} The dealer must set this round’s required options before any boot is charged or card is dealt.`
          : 'The dealer for this round must choose one of the variants approved by the table before any boot is charged or card is dealt.'
        : describeTeenPattiRoundVariant(this.roundVariant),
      variantReferenceCards: this.variantReferenceCards.map((card) => ({ ...card })),
      twoReferenceAssignmentsComplete: this.twoReferenceAssignments.size,
      discardSelectionsComplete: this.discardSelections.size,
      initialDealerDraws: this.initialDealerDraws.map((round) => ({
        contenders: [...round.contenders],
        draws: round.draws.map((draw) => ({ ...draw, card: { ...draw.card } })),
      })),
      lastSideshow: this.lastSideshow
        ? {
            ...this.lastSideshow,
            revealedHands: this.lastSideshow.revealedHands?.map((entry) => ({
              ...entry,
              cards: entry.cards.map((card) => ({ ...card })),
              discardedCardIds: entry.discardedCardIds ? [...entry.discardedCardIds] : undefined,
            })),
          }
        : null,
      openShowRequestFrom: this.openShowRequestFrom,
      openShowAcceptedBy: [...this.openShowAcceptedBy],
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
          roundsWon: player.roundsWon,
          profitLoss: settlement.profitLoss,
          referenceAssigned: this.twoReferenceAssignments.has(playerId),
          discardLocked: this.discardSelections.has(playerId),
        };
      }),
      roundHistory: this.roundHistory.map((outcome) => ({
        ...outcome,
        winnerIds: [...outcome.winnerIds],
        showdown: outcome.showdown?.map((entry) => ({
          ...entry,
          cards: entry.cards.map((card) => ({ ...card })),
        })) ?? null,
      })),
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
