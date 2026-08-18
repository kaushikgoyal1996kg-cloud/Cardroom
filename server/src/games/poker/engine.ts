// ============================================================================
// POKER - Authoritative private-table engine
//
// Shared runtime for Texas Hold'em, PLO4, PLO5, PLO6 and 6+ Short Deck.
// Play money only. Variant-table changes are allowed only BETWEEN hands.
// Hidden hole cards are exposed only through getPrivateState().
// ============================================================================

import type { Card } from '../../platform/cards/index.js';
import { createDeck, shuffleDeck } from '../../platform/cards/index.js';
import { bestPokerHand, comparePokerHandValues, type PokerHandValue } from './handEvaluator.js';
import {
  DEFAULT_POKER_TABLE_CONFIG,
  getPokerVariant,
  maxPlayersForPokerTable,
  validatePokerTableConfig,
  variantsForPokerTable,
  type PokerBettingStructure,
  type PokerTableConfig,
  type PokerVariantDescriptor,
  type PokerVariantId,
} from './rules.js';

export type PokerPlayerId = string;
export type PokerStreet = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
export type PokerState = 'READY' | 'AWAITING_VARIANT' | PokerStreet | 'SHOWDOWN' | 'HAND_COMPLETE';

export interface PokerPlayerState {
  playerId: PokerPlayerId;
  stack: number;
  folded: boolean;
  allIn: boolean;
  streetCommitted: number;
  handCommitted: number;
  actedThisStreet: boolean;
  /** Additional virtual chips added between hands. */
  topUps: number;
  /** Cumulative hands won at this open-ended table session. */
  handsWon: number;
}

export type PokerAction =
  | { type: 'FOLD' }
  | { type: 'CHECK' }
  | { type: 'CALL' }
  | { type: 'RAISE_TO'; amount: number };

export interface PokerActionResult {
  ok: boolean;
  error?: string;
}

export interface PokerPlayerSettlement {
  playerId: PokerPlayerId;
  stack: number;
  totalFunding: number;
  topUps: number;
  profitLoss: number;
}

export interface PokerLeaveResult {
  settlement: PokerPlayerSettlement;
  handEnded: boolean;
  remainingPlayerIds: PokerPlayerId[];
}

export interface PokerPotAward {
  amount: number;
  eligiblePlayerIds: PokerPlayerId[];
  winnerIds: PokerPlayerId[];
}

export interface PokerShowdownEntry {
  playerId: PokerPlayerId;
  holeCards: Card[];
  hand: PokerHandValue;
}

export interface PokerHandOutcome {
  handNumber: number;
  variantId: PokerVariantId;
  /** Server-authored label captured at hand completion for reconnect/history stability. */
  variantName: string;
  dealerId: PokerPlayerId;
  board: Card[];
  pots: PokerPotAward[];
  showdown: PokerShowdownEntry[] | null;
  winnerIds: PokerPlayerId[];
  reason: 'LAST_STANDING' | 'SHOWDOWN';
}

export interface PokerPublicVariant {
  id: PokerVariantId;
  name: string;
  shortName: string;
  holeCards: number;
  betting: PokerBettingStructure;
  minPlayers: number;
  maxPlayers: number;
  howToPlay: string;
}

export interface PokerPublicState {
  state: PokerState;
  sequence: number;
  handNumber: number;
  variantId: PokerVariantId;
  /** Server-authored live variant metadata; client gameplay must render this rather than a preview catalogue. */
  variant: PokerPublicVariant;
  /** Public private-table stakes/configuration. All values are virtual play money. */
  tableConfig: PokerTableConfig;
  dealerId: PokerPlayerId;
  nextVariantChooserId: PokerPlayerId | null;
  approvedVariantIds: PokerVariantId[];
  approvedVariants: PokerPublicVariant[];
  currentTurn: PokerPlayerId | null;
  board: Card[];
  pot: number;
  currentBet: number;
  minRaiseTo: number | null;
  maxRaiseTo: number | null;
  players: PokerPlayerState[];
  /** Recent reconnect-safe completed hands. Fold-down outcomes never reveal private cards. */
  handHistory: PokerHandOutcome[];
  outcome: Omit<PokerHandOutcome, 'showdown'> & {
    showdown: Array<Omit<PokerShowdownEntry, 'holeCards'> & { holeCards: Card[] }> | null;
  } | null;
}

export interface PokerPrivateState {
  /** Snapshot identity: clients must never pair private actions/cards with a different public hand/sequence. */
  handNumber: number;
  sequence: number;
  holeCards: Card[];
  toCall: number;
  legalActions: {
    fold: boolean;
    check: boolean;
    call: boolean;
    raise: boolean;
    minRaiseTo: number | null;
    maxRaiseTo: number | null;
  };
}


function publicVariant(descriptor: PokerVariantDescriptor): PokerPublicVariant {
  return {
    id: descriptor.id,
    name: descriptor.name,
    shortName: descriptor.shortName,
    holeCards: descriptor.holeCards,
    betting: descriptor.betting,
    minPlayers: descriptor.minPlayers,
    maxPlayers: descriptor.maxPlayers,
    howToPlay: descriptor.howToPlay,
  };
}

function clockwiseFrom(players: PokerPlayerId[], startId: PokerPlayerId): PokerPlayerId[] {
  const index = players.indexOf(startId);
  if (index < 0) throw new Error(`${startId} not seated`);
  return [...players.slice(index), ...players.slice(0, index)];
}

function nextClockwise(players: PokerPlayerId[], currentId: PokerPlayerId, predicate: (id: PokerPlayerId) => boolean): PokerPlayerId | null {
  const start = players.indexOf(currentId);
  if (start < 0) return null;
  for (let offset = 1; offset <= players.length; offset += 1) {
    const id = players[(start + offset) % players.length];
    if (predicate(id)) return id;
  }
  return null;
}

function shortDeck(): Card[] {
  return createDeck().filter((card) => !['2', '3', '4', '5'].includes(card.rank));
}

function deckForVariant(variantId: PokerVariantId): Card[] {
  return getPokerVariant(variantId).deck === 'SHORT_36' ? shortDeck() : createDeck();
}

function clonePokerOutcome(outcome: PokerHandOutcome): PokerHandOutcome {
  return {
    ...outcome,
    board: outcome.board.map((card) => ({ ...card })),
    pots: outcome.pots.map((pot) => ({
      ...pot,
      eligiblePlayerIds: [...pot.eligiblePlayerIds],
      winnerIds: [...pot.winnerIds],
    })),
    showdown: outcome.showdown?.map((entry) => ({
      playerId: entry.playerId,
      holeCards: entry.holeCards.map((card) => ({ ...card })),
      hand: {
        ...entry.hand,
        tiebreak: [...entry.hand.tiebreak],
        cards: entry.hand.cards.map((card) => ({ ...card })),
      },
    })) ?? null,
    winnerIds: [...outcome.winnerIds],
  };
}

export class PokerGame {
  readonly roomCode: string;
  readonly playersClockwise: PokerPlayerId[];
  readonly tableConfig: PokerTableConfig;

  state: PokerState = 'READY';
  handNumber = 0;
  dealerId: PokerPlayerId;
  currentVariantId: PokerVariantId;
  /** Dealer for the upcoming hand when a Variant Table is waiting for Dealer Choice. */
  nextVariantChooserId: PokerPlayerId | null = null;
  currentTurn: PokerPlayerId | null = null;
  board: Card[] = [];
  currentBet = 0;
  lastFullRaiseSize = 0;
  lastOutcome: PokerHandOutcome | null = null;
  /** Recent reconnect-safe hand history. Cumulative win counts live on player state. */
  readonly handHistory: PokerHandOutcome[] = [];

  private actionSeq = 0;
  private players = new Map<PokerPlayerId, PokerPlayerState>();
  private holeCards: Record<PokerPlayerId, Card[]> = {};
  private deck: Card[] = [];
  private deckCursor = 0;
  private pendingDealerChoice: PokerVariantId | null = null;
  private fixedRotationIndex = -1;
  /** Seats that have permanently left during/after a hand. Mid-hand entries
   * remain internally until the pot is settled so their committed chips still
   * contribute to side pots, but they are hidden from public/seated state. */
  private departedPlayerIds = new Set<PokerPlayerId>();
  /** Current-bet level each player last acted against on this street.
   *  Kept private because it is betting-rights bookkeeping, not table UI.
   *  It lets short all-ins increase the call amount without incorrectly
   *  reopening a raise for a player who has already acted. */
  private lastActedBet = new Map<PokerPlayerId, number | null>();

  constructor(
    roomCode: string,
    playersClockwise: PokerPlayerId[],
    config: PokerTableConfig = DEFAULT_POKER_TABLE_CONFIG,
    initialDealerId?: PokerPlayerId
  ) {
    validatePokerTableConfig(config);
    if (playersClockwise.length < 2 || playersClockwise.length > maxPlayersForPokerTable(config)) {
      throw new Error(`Poker table allows 2-${maxPlayersForPokerTable(config)} players for this variant selection.`);
    }
    if (new Set(playersClockwise).size !== playersClockwise.length) throw new Error('Duplicate poker player id.');
    if (initialDealerId && !playersClockwise.includes(initialDealerId)) throw new Error('Initial poker dealer is not seated.');

    this.roomCode = roomCode;
    this.playersClockwise = [...playersClockwise];
    this.tableConfig = { ...config, variants: config.variants ? [...config.variants] : undefined };
    this.dealerId = initialDealerId ?? playersClockwise[0];
    this.currentVariantId = this.initialVariant();

    for (const playerId of playersClockwise) {
      this.players.set(playerId, {
        playerId,
        stack: config.startingStack,
        folded: false,
        allIn: false,
        streetCommitted: 0,
        handCommitted: 0,
        actedThisStreet: false,
        topUps: 0,
        handsWon: 0,
      });
      this.lastActedBet.set(playerId, null);
    }
  }

  get sequence(): number {
    return this.actionSeq;
  }

  get seatedPlayerIds(): PokerPlayerId[] {
    return this.playersClockwise.filter((id) => !this.departedPlayerIds.has(id));
  }

  private initialVariant(): PokerVariantId {
    if (this.tableConfig.mode === 'FIXED') return this.tableConfig.fixedVariant!;
    return variantsForPokerTable(this.tableConfig)[0].id;
  }

  private prepareUpcomingDealer(): void {
    if (this.handNumber === 0) return;
    const nextDealer = nextClockwise(this.playersClockwise, this.dealerId, (id) => !this.departedPlayerIds.has(id) && this.players.get(id)!.stack > 0);
    if (!nextDealer) throw new Error('No funded dealer seat available.');
    this.dealerId = nextDealer;
  }

  /** Remove permanently departed seats once no live pot still needs them.
   * Returns true when a departed dealer was already advanced to the correct
   * next funded seat, so dealHand must not rotate the button a second time. */
  private purgeDepartedBeforeDeal(): boolean {
    if (this.departedPlayerIds.size === 0) return false;
    const dealerDeparted = this.departedPlayerIds.has(this.dealerId);
    const fallback = dealerDeparted
      ? nextClockwise(this.playersClockwise, this.dealerId, (id) => !this.departedPlayerIds.has(id) && this.players.get(id)!.stack > 0)
      : null;

    for (const id of [...this.departedPlayerIds]) {
      const index = this.playersClockwise.indexOf(id);
      if (index >= 0) this.playersClockwise.splice(index, 1);
      this.players.delete(id);
      delete this.holeCards[id];
      this.lastActedBet.delete(id);
      this.departedPlayerIds.delete(id);
    }
    if (dealerDeparted && fallback) this.dealerId = fallback;
    return dealerDeparted && !!fallback && this.handNumber > 0;
  }

  private removeDepartedSeatImmediately(id: PokerPlayerId): void {
    const index = this.playersClockwise.indexOf(id);
    if (index >= 0) this.playersClockwise.splice(index, 1);
    this.players.delete(id);
    delete this.holeCards[id];
    this.lastActedBet.delete(id);
    this.departedPlayerIds.delete(id);
  }

  /**
   * Dealer Choice is authoritative and atomic: the engine must already be in
   * AWAITING_VARIANT, only the upcoming dealer may choose, and the successful
   * choice immediately deals that hand. No blind, ante or private card exists
   * before this method succeeds. Test decks are accepted only by direct engine
   * tests; network callers never supply one.
   */
  chooseNextVariant(playerId: PokerPlayerId, variantId: PokerVariantId, expectedSeq: number, testDeck?: Card[]): void {
    if (!Number.isSafeInteger(expectedSeq) || expectedSeq !== this.actionSeq) {
      throw new Error('That Poker variant choice is stale. Wait for the latest table state.');
    }
    if (this.tableConfig.mode !== 'VARIANT_TABLE' || this.tableConfig.rotation !== 'DEALER_CHOICE') {
      throw new Error('This poker table is not using Dealer Choice.');
    }
    if (this.state !== 'AWAITING_VARIANT') {
      throw new Error('Poker Dealer Choice is available only while the next hand is waiting for a variant.');
    }
    if (playerId !== this.nextVariantChooserId) {
      throw new Error('Only the dealer for the upcoming hand may choose the next poker variant.');
    }
    const allowed = new Set((this.tableConfig.variants ?? []));
    if (!allowed.has(variantId)) throw new Error('That poker variant is not enabled at this table.');
    this.pendingDealerChoice = variantId;
    this.dealPreparedHand(testDeck);
  }

  private resolveVariantForNextHand(): PokerVariantId {
    if (this.tableConfig.mode === 'FIXED') return this.tableConfig.fixedVariant!;
    const variants = variantsForPokerTable(this.tableConfig).map((variant) => variant.id);
    if (this.tableConfig.rotation === 'DEALER_CHOICE') {
      if (!this.pendingDealerChoice) throw new Error('The upcoming dealer must choose a poker variant before the hand is dealt.');
      const chosen = this.pendingDealerChoice;
      this.pendingDealerChoice = null;
      return chosen;
    }
    this.fixedRotationIndex = (this.fixedRotationIndex + 1) % variants.length;
    return variants[this.fixedRotationIndex];
  }

  /**
   * Starts a fresh hand shell. Fixed/fixed-rotation tables deal immediately.
   * Dealer-Choice Variant Tables stop before any forced bet/card and wait for
   * the dealer's explicit choice.
   */
  dealHand(testDeck?: Card[]): void {
    if (this.state !== 'READY' && this.state !== 'HAND_COMPLETE') throw new Error(`Cannot deal poker from ${this.state}.`);
    const dealerAlreadyAdvanced = this.purgeDepartedBeforeDeal();
    const funded = this.playersClockwise.filter((id) => this.players.get(id)!.stack > 0);
    if (funded.length < 2) throw new Error('At least two funded players are required to deal poker.');

    if (!dealerAlreadyAdvanced) this.prepareUpcomingDealer();

    if (this.tableConfig.mode === 'VARIANT_TABLE' && this.tableConfig.rotation === 'DEALER_CHOICE') {
      this.pendingDealerChoice = null;
      this.nextVariantChooserId = this.dealerId;
      this.currentTurn = null;
      this.board = [];
      this.currentBet = 0;
      this.lastFullRaiseSize = 0;
      this.lastOutcome = null;
      this.holeCards = {};
      for (const id of this.playersClockwise) {
        const player = this.players.get(id)!;
        player.folded = player.stack <= 0;
        player.allIn = false;
        player.streetCommitted = 0;
        player.handCommitted = 0;
        player.actedThisStreet = false;
        this.lastActedBet.set(id, null);
        this.holeCards[id] = [];
      }
      this.state = 'AWAITING_VARIANT';
      this.actionSeq += 1;
      return;
    }

    this.dealPreparedHand(testDeck);
  }

  private dealPreparedHand(testDeck?: Card[]): void {
    this.currentVariantId = this.resolveVariantForNextHand();
    this.nextVariantChooserId = null;
    const variant = getPokerVariant(this.currentVariantId);
    const active = this.playersClockwise.filter((id) => !this.departedPlayerIds.has(id) && this.players.get(id)!.stack > 0);
    if (active.length > variant.maxPlayers) throw new Error(`${variant.name} allows at most ${variant.maxPlayers} funded seats.`);

    this.handNumber += 1;
    this.state = 'PREFLOP';
    this.currentTurn = null;
    this.board = [];
    this.currentBet = 0;
    this.lastFullRaiseSize = 0;
    this.lastOutcome = null;
    this.holeCards = {};
    for (const id of this.playersClockwise) {
      const player = this.players.get(id)!;
      player.folded = player.stack <= 0;
      player.allIn = false;
      player.streetCommitted = 0;
      player.handCommitted = 0;
      player.actedThisStreet = false;
      this.lastActedBet.set(id, null);
      this.holeCards[id] = [];
    }

    this.deck = testDeck ? [...testDeck] : shuffleDeck(deckForVariant(this.currentVariantId));
    this.deckCursor = 0;
    const needed = active.length * variant.holeCards + 8; // five board + three burns
    if (this.deck.length < needed) throw new Error(`Not enough cards to deal ${variant.name}.`);

    const firstRecipient = nextClockwise(this.playersClockwise, this.dealerId, (id) => active.includes(id))!;
    const dealOrder = clockwiseFrom(this.playersClockwise, firstRecipient).filter((id) => active.includes(id));
    for (let round = 0; round < variant.holeCards; round += 1) {
      for (const id of dealOrder) this.holeCards[id].push(this.drawCard());
    }

    this.postForcedBets(active);
    this.beginPreflopTurn(active);
    this.maybeAutoAdvance();
    this.actionSeq += 1;
  }

  private drawCard(): Card {
    const card = this.deck[this.deckCursor++];
    if (!card) throw new Error('Poker deck exhausted.');
    return card;
  }

  private commit(id: PokerPlayerId, amount: number): number {
    const player = this.players.get(id)!;
    const paid = Math.max(0, Math.min(amount, player.stack));
    player.stack -= paid;
    player.streetCommitted += paid;
    player.handCommitted += paid;
    if (player.stack === 0) player.allIn = true;
    return paid;
  }

  private postForcedBets(active: PokerPlayerId[]): void {
    const variant = getPokerVariant(this.currentVariantId);
    if (this.tableConfig.ante > 0) {
      for (const id of active) this.commit(id, this.tableConfig.ante);
      // Antes are dead money, not part of the street bet to call.
      for (const id of active) this.players.get(id)!.streetCommitted = 0;
    }

    if (variant.betting === 'ANTE_NO_LIMIT') {
      // 6+ Short Deck uses a button-blind structure: every funded seat posts
      // the ante, then the dealer/button alone posts the live blind. The table
      // reuses bigBlind as that configurable button blind; smallBlind is not
      // used for this variant. Action begins left of the button below.
      this.commit(this.dealerId, this.tableConfig.bigBlind);
      this.currentBet = this.players.get(this.dealerId)!.streetCommitted;
      this.lastFullRaiseSize = this.tableConfig.bigBlind;
      return;
    }

    const headsUp = active.length === 2;
    const sb = headsUp
      ? this.dealerId
      : nextClockwise(this.playersClockwise, this.dealerId, (id) => active.includes(id))!;
    const bb = nextClockwise(this.playersClockwise, sb, (id) => active.includes(id))!;
    this.commit(sb, this.tableConfig.smallBlind);
    this.commit(bb, this.tableConfig.bigBlind);
    this.currentBet = Math.max(this.players.get(sb)!.streetCommitted, this.players.get(bb)!.streetCommitted);
    this.lastFullRaiseSize = this.tableConfig.bigBlind;
  }

  private beginPreflopTurn(active: PokerPlayerId[]): void {
    const variant = getPokerVariant(this.currentVariantId);
    if (variant.betting === 'ANTE_NO_LIMIT') {
      this.currentTurn = nextClockwise(this.playersClockwise, this.dealerId, (id) => active.includes(id) && !this.players.get(id)!.allIn);
      return;
    }
    const headsUp = active.length === 2;
    if (headsUp) {
      this.currentTurn = !this.players.get(this.dealerId)!.allIn ? this.dealerId : nextClockwise(this.playersClockwise, this.dealerId, (id) => active.includes(id) && !this.players.get(id)!.allIn);
      return;
    }
    const sb = nextClockwise(this.playersClockwise, this.dealerId, (id) => active.includes(id))!;
    const bb = nextClockwise(this.playersClockwise, sb, (id) => active.includes(id))!;
    this.currentTurn = nextClockwise(this.playersClockwise, bb, (id) => active.includes(id) && !this.players.get(id)!.allIn);
  }

  private liveIds(): PokerPlayerId[] {
    return this.playersClockwise.filter((id) => {
      const p = this.players.get(id)!;
      return p.handCommitted > 0 || (!p.folded && p.stack > 0);
    }).filter((id) => !this.players.get(id)!.folded);
  }

  private actionableIds(): PokerPlayerId[] {
    return this.liveIds().filter((id) => !this.players.get(id)!.allIn);
  }

  private toCall(id: PokerPlayerId): number {
    return Math.max(0, this.currentBet - this.players.get(id)!.streetCommitted);
  }

  private totalPot(): number {
    return [...this.players.values()].reduce((sum, player) => sum + player.handCommitted, 0);
  }

  private raiseReopenedFor(id: PokerPlayerId): boolean {
    const p = this.players.get(id)!;
    if (!p.actedThisStreet) return true;
    const lastActedAt = this.lastActedBet.get(id);
    if (lastActedAt === null || lastActedAt === undefined) return true;
    // A short all-in can increase currentBet while leaving the prior action
    // closed. Multiple short all-ins reopen action only once their cumulative
    // increase reaches at least one full raise.
    return this.currentBet - lastActedAt >= this.lastFullRaiseSize;
  }

  private minRaiseToFor(id: PokerPlayerId): number | null {
    const p = this.players.get(id)!;
    if (p.folded || p.allIn || p.stack <= this.toCall(id) || !this.raiseReopenedFor(id)) return null;
    if (this.currentBet === 0) return Math.min(p.streetCommitted + p.stack, Math.max(this.tableConfig.bigBlind, this.lastFullRaiseSize));
    return Math.min(p.streetCommitted + p.stack, this.currentBet + this.lastFullRaiseSize);
  }

  private maxRaiseToFor(id: PokerPlayerId): number | null {
    const p = this.players.get(id)!;
    if (p.folded || p.allIn) return null;
    const allInTo = p.streetCommitted + p.stack;
    const variant = getPokerVariant(this.currentVariantId);
    if (variant.betting !== 'POT_LIMIT') return allInTo;
    const call = this.toCall(id);
    const potAfterCall = this.totalPot() + call;
    return Math.min(allInTo, p.streetCommitted + call + potAfterCall);
  }

  getLegalActions(id: PokerPlayerId): PokerPrivateState['legalActions'] {
    const p = this.players.get(id);
    const isTurn = !!p && id === this.currentTurn && ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(this.state);
    if (!p || !isTurn || p.folded || p.allIn) {
      return { fold: false, check: false, call: false, raise: false, minRaiseTo: null, maxRaiseTo: null };
    }
    const call = this.toCall(id);
    const min = this.minRaiseToFor(id);
    const max = this.maxRaiseToFor(id);
    return {
      fold: true,
      check: call === 0,
      call: call > 0 && p.stack > 0,
      raise: min !== null && max !== null && max > this.currentBet,
      minRaiseTo: min,
      maxRaiseTo: max,
    };
  }

  act(id: PokerPlayerId, action: PokerAction, expectedSeq?: number): PokerActionResult {
    if (expectedSeq !== undefined && expectedSeq !== this.actionSeq) {
      return { ok: false, error: 'That poker action is stale. Wait for the latest table state.' };
    }
    if (id !== this.currentTurn) return { ok: false, error: 'It is not your turn.' };
    const p = this.players.get(id);
    if (!p || p.folded || p.allIn) return { ok: false, error: 'That seat cannot act.' };
    const call = this.toCall(id);

    if (action.type === 'FOLD') {
      p.folded = true;
      p.actedThisStreet = true;
    } else if (action.type === 'CHECK') {
      if (call !== 0) return { ok: false, error: 'You cannot check while facing a bet.' };
      p.actedThisStreet = true;
    } else if (action.type === 'CALL') {
      if (call <= 0) return { ok: false, error: 'There is nothing to call.' };
      this.commit(id, call);
      p.actedThisStreet = true;
    } else {
      if (!this.raiseReopenedFor(id)) return { ok: false, error: 'Betting has not been reopened for another raise.' };
      if (!Number.isSafeInteger(action.amount) || action.amount <= this.currentBet) return { ok: false, error: 'Raise-to amount must exceed the current bet.' };
      const max = this.maxRaiseToFor(id);
      if (max === null || action.amount > max) return { ok: false, error: 'Raise exceeds the maximum legal amount.' };
      const allInTo = p.streetCommitted + p.stack;
      const minimum = this.currentBet === 0 ? Math.max(this.tableConfig.bigBlind, this.lastFullRaiseSize) : this.currentBet + this.lastFullRaiseSize;
      const isShortAllIn = action.amount === allInTo && action.amount < minimum;
      if (action.amount < minimum && !isShortAllIn) return { ok: false, error: `Minimum raise-to is ${minimum}.` };

      const priorBet = this.currentBet;
      this.commit(id, action.amount - p.streetCommitted);
      this.currentBet = p.streetCommitted;
      p.actedThisStreet = true;
      const raiseSize = this.currentBet - priorBet;
      if (!isShortAllIn) {
        this.lastFullRaiseSize = Math.max(this.lastFullRaiseSize, raiseSize);
        for (const otherId of this.actionableIds()) {
          if (otherId !== id) this.players.get(otherId)!.actedThisStreet = false;
        }
      }
    }

    this.lastActedBet.set(id, this.currentBet);
    this.afterAction(id);
    this.actionSeq += 1;
    return { ok: true };
  }

  private afterAction(actorId: PokerPlayerId): void {
    const live = this.liveIds();
    if (live.length === 1) {
      this.finishLastStanding(live[0]);
      return;
    }
    this.maybeAutoAdvance(actorId);
  }

  private streetComplete(): boolean {
    const actionables = this.actionableIds();
    if (actionables.length === 0) return true;
    // If every opponent is all-in, a lone player with nothing left to call
    // has no meaningful betting decision. Run the remaining board instead of
    // forcing artificial CHECK clicks on flop/turn/river.
    if (actionables.length === 1 && this.toCall(actionables[0]) === 0) return true;
    return actionables.every((id) => {
      const p = this.players.get(id)!;
      return p.actedThisStreet && p.streetCommitted === this.currentBet;
    });
  }

  private maybeAutoAdvance(afterId?: PokerPlayerId): void {
    let cursor = afterId;
    while (['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(this.state)) {
      if (this.streetComplete()) {
        if (this.state === 'RIVER') {
          this.finishShowdown();
          return;
        }
        this.advanceStreet();
        // advanceStreet() deliberately selects the first actor on the new
        // street. Do not advance past that seat before it has acted.
        cursor = undefined;
        continue;
      }

      const needsAction = (id: PokerPlayerId) => {
        const p = this.players.get(id)!;
        return !p.folded && !p.allIn && (!p.actedThisStreet || p.streetCommitted !== this.currentBet);
      };

      // On initial deal / immediately after a street transition, currentTurn
      // already points at the correct first actor. Preserve it.
      if (cursor === undefined && this.currentTurn && needsAction(this.currentTurn)) return;

      const from = cursor ?? this.currentTurn ?? this.dealerId;
      this.currentTurn = nextClockwise(this.playersClockwise, from, needsAction);
      return;
    }
  }

  private advanceStreet(): void {
    for (const player of this.players.values()) {
      player.streetCommitted = 0;
      player.actedThisStreet = false;
      this.lastActedBet.set(player.playerId, null);
    }
    this.currentBet = 0;
    this.lastFullRaiseSize = this.tableConfig.bigBlind;

    this.drawCard(); // burn
    if (this.state === 'PREFLOP') {
      this.board.push(this.drawCard(), this.drawCard(), this.drawCard());
      this.state = 'FLOP';
    } else if (this.state === 'FLOP') {
      this.board.push(this.drawCard());
      this.state = 'TURN';
    } else if (this.state === 'TURN') {
      this.board.push(this.drawCard());
      this.state = 'RIVER';
    }

    this.currentTurn = nextClockwise(this.playersClockwise, this.dealerId, (id) => {
      const p = this.players.get(id)!;
      return !p.folded && !p.allIn;
    });
  }

  private buildSidePots(): Array<{ amount: number; eligible: PokerPlayerId[] }> {
    const contributors = this.playersClockwise.filter((id) => this.players.get(id)!.handCommitted > 0);
    const levels = [...new Set(contributors.map((id) => this.players.get(id)!.handCommitted))].sort((a, b) => a - b);
    const pots: Array<{ amount: number; eligible: PokerPlayerId[] }> = [];
    let previous = 0;
    for (const level of levels) {
      const covering = contributors.filter((id) => this.players.get(id)!.handCommitted >= level);
      const amount = (level - previous) * covering.length;
      const eligible = covering.filter((id) => !this.players.get(id)!.folded);
      if (amount > 0) pots.push({ amount, eligible });
      previous = level;
    }
    return pots;
  }

  private awardSplit(amount: number, winners: PokerPlayerId[]): void {
    const share = Math.floor(amount / winners.length);
    let remainder = amount - share * winners.length;
    for (const id of winners) this.players.get(id)!.stack += share;
    // Odd chips move clockwise starting left of dealer, among tied winners.
    const order = clockwiseFrom(this.playersClockwise, nextClockwise(this.playersClockwise, this.dealerId, () => true)!);
    for (const id of order) {
      if (remainder <= 0) break;
      if (winners.includes(id)) {
        this.players.get(id)!.stack += 1;
        remainder -= 1;
      }
    }
  }

  private finishLastStanding(winnerId: PokerPlayerId): void {
    const amount = this.totalPot();
    this.players.get(winnerId)!.stack += amount;
    this.state = 'HAND_COMPLETE';
    this.currentTurn = null;
    this.players.get(winnerId)!.handsWon += 1;
    const outcome: PokerHandOutcome = {
      handNumber: this.handNumber,
      variantId: this.currentVariantId,
      variantName: getPokerVariant(this.currentVariantId).name,
      dealerId: this.dealerId,
      board: [...this.board],
      pots: [{ amount, eligiblePlayerIds: [winnerId], winnerIds: [winnerId] }],
      showdown: null,
      winnerIds: [winnerId],
      reason: 'LAST_STANDING',
    };
    this.lastOutcome = outcome;
    this.handHistory.push(clonePokerOutcome(outcome));
    if (this.handHistory.length > 100) this.handHistory.splice(0, this.handHistory.length - 100);
  }

  private finishShowdown(): void {
    this.state = 'SHOWDOWN';
    // If everyone remaining is all-in before river, deal the rest of the board.
    while (this.board.length < 5) {
      this.drawCard();
      if (this.board.length === 0) this.board.push(this.drawCard(), this.drawCard(), this.drawCard());
      else this.board.push(this.drawCard());
    }

    const live = this.liveIds();
    const values = new Map<PokerPlayerId, PokerHandValue>();
    const showdown: PokerShowdownEntry[] = live.map((id) => {
      const hand = bestPokerHand(this.holeCards[id], this.board, this.currentVariantId);
      values.set(id, hand);
      return { playerId: id, holeCards: [...this.holeCards[id]], hand };
    });

    const awards: PokerPotAward[] = [];
    const overallWinners = new Set<PokerPlayerId>();
    for (const pot of this.buildSidePots()) {
      if (pot.eligible.length === 0) continue;
      let best = values.get(pot.eligible[0])!;
      for (const id of pot.eligible.slice(1)) {
        const value = values.get(id)!;
        if (comparePokerHandValues(value, best) > 0) best = value;
      }
      const winners = pot.eligible.filter((id) => comparePokerHandValues(values.get(id)!, best) === 0);
      this.awardSplit(pot.amount, winners);
      winners.forEach((id) => overallWinners.add(id));
      awards.push({ amount: pot.amount, eligiblePlayerIds: [...pot.eligible], winnerIds: winners });
    }

    this.state = 'HAND_COMPLETE';
    this.currentTurn = null;
    for (const id of overallWinners) this.players.get(id)!.handsWon += 1;
    const outcome: PokerHandOutcome = {
      handNumber: this.handNumber,
      variantId: this.currentVariantId,
      variantName: getPokerVariant(this.currentVariantId).name,
      dealerId: this.dealerId,
      board: [...this.board],
      pots: awards,
      showdown,
      winnerIds: [...overallWinners],
      reason: 'SHOWDOWN',
    };
    this.lastOutcome = outcome;
    this.handHistory.push(clonePokerOutcome(outcome));
    if (this.handHistory.length > 100) this.handHistory.splice(0, this.handHistory.length - 100);
  }

  /** Virtual chips only. Top-ups are deliberately restricted to between hands. */
  topUp(id: PokerPlayerId, amount: number): void {
    if (this.state !== 'READY' && this.state !== 'HAND_COMPLETE' && this.state !== 'AWAITING_VARIANT') {
      throw new Error('Poker top-ups are available only between hands.');
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Poker top-up must be a positive whole-number play-money amount.');
    const player = this.players.get(id);
    if (!player || this.departedPlayerIds.has(id)) throw new Error('Poker player not found.');
    player.stack += amount;
    player.topUps += amount;
    this.actionSeq += 1;
  }

  getSettlement(id: PokerPlayerId): PokerPlayerSettlement {
    const player = this.players.get(id);
    if (!player) throw new Error('Poker player not found.');
    const totalFunding = this.tableConfig.startingStack + player.topUps;
    return {
      playerId: id,
      stack: player.stack,
      totalFunding,
      topUps: player.topUps,
      profitLoss: player.stack - totalFunding,
    };
  }

  /**
   * Permanently leaves this open-ended Poker table. Leaving during a betting
   * street is an immediate fold; chips already committed stay in the pot and
   * therefore in side-pot accounting. The room/socket layer may release the
   * human seat only after this method succeeds.
   */
  leaveTable(id: PokerPlayerId): PokerLeaveResult {
    const player = this.players.get(id);
    if (!player || this.departedPlayerIds.has(id)) throw new Error('You are not seated at this Poker table.');
    const settlement = this.getSettlement(id);
    const stateBefore = this.state;
    const activeStreet = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(this.state);

    if (activeStreet && !player.folded) {
      if (this.currentTurn === id) {
        const folded = this.act(id, { type: 'FOLD' }, this.actionSeq);
        if (!folded.ok) throw new Error(folded.error ?? 'Could not fold the departing Poker seat.');
      } else {
        player.folded = true;
        player.actedThisStreet = true;
        this.lastActedBet.set(id, this.currentBet);
        this.actionSeq += 1;
        const live = this.liveIds();
        if (live.length === 1) this.finishLastStanding(live[0]);
      }
    } else {
      this.actionSeq += 1;
    }

    this.departedPlayerIds.add(id);

    // Dealer Choice is between hands and has no forced bet/private card yet,
    // so the departed seat can be removed immediately. If it held the button,
    // transfer both dealer authority and variant choice to the next funded seat.
    if (stateBefore === 'AWAITING_VARIANT') {
      if (this.dealerId === id || this.nextVariantChooserId === id) {
        const next = nextClockwise(this.playersClockwise, id, (candidate) =>
          candidate !== id && !this.departedPlayerIds.has(candidate) && this.players.get(candidate)!.stack > 0
        );
        this.dealerId = next ?? this.dealerId;
        this.nextVariantChooserId = next;
      }
      this.removeDepartedSeatImmediately(id);
    }

    return {
      settlement,
      handEnded: activeStreet && this.state === 'HAND_COMPLETE',
      remainingPlayerIds: this.seatedPlayerIds,
    };
  }

  getPlayer(id: PokerPlayerId): PokerPlayerState {
    const player = this.players.get(id);
    if (!player || this.departedPlayerIds.has(id)) throw new Error('Poker player not found.');
    return { ...player };
  }

  getPublicState(): PokerPublicState {
    const turn = this.currentTurn;
    const legal = turn ? this.getLegalActions(turn) : null;
    const currentDescriptor = getPokerVariant(this.currentVariantId);
    const approvedDescriptors = variantsForPokerTable(this.tableConfig);
    return {
      state: this.state,
      sequence: this.actionSeq,
      handNumber: this.handNumber,
      variantId: this.currentVariantId,
      variant: publicVariant(currentDescriptor),
      tableConfig: { ...this.tableConfig, variants: this.tableConfig.variants ? [...this.tableConfig.variants] : undefined },
      dealerId: this.dealerId,
      nextVariantChooserId: this.nextVariantChooserId,
      approvedVariantIds: approvedDescriptors.map((variant) => variant.id),
      approvedVariants: approvedDescriptors.map(publicVariant),
      currentTurn: this.currentTurn,
      board: [...this.board],
      pot: this.totalPot(),
      currentBet: this.currentBet,
      minRaiseTo: legal?.minRaiseTo ?? null,
      maxRaiseTo: legal?.maxRaiseTo ?? null,
      players: this.playersClockwise.filter((id) => !this.departedPlayerIds.has(id)).map((id) => ({ ...this.players.get(id)! })),
      handHistory: this.handHistory.map(clonePokerOutcome),
      outcome: this.lastOutcome ? {
        ...this.lastOutcome,
        board: [...this.lastOutcome.board],
        pots: this.lastOutcome.pots.map((pot) => ({ ...pot, eligiblePlayerIds: [...pot.eligiblePlayerIds], winnerIds: [...pot.winnerIds] })),
        showdown: this.lastOutcome.showdown?.map((entry) => ({ playerId: entry.playerId, holeCards: [...entry.holeCards], hand: entry.hand })) ?? null,
      } : null,
    };
  }

  getPrivateState(id: PokerPlayerId): PokerPrivateState {
    if (!this.players.has(id) || this.departedPlayerIds.has(id)) throw new Error('Poker player not found.');
    return {
      handNumber: this.handNumber,
      sequence: this.actionSeq,
      holeCards: [...(this.holeCards[id] ?? [])],
      toCall: this.toCall(id),
      legalActions: this.getLegalActions(id),
    };
  }
}
