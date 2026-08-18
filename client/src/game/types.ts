export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';
export type Rank = 'A' | 'K' | 'Q' | 'J' | '10' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export type PlayerId = string;
export type DismissalReason = 'NO_SEQUENCE' | 'SIX_PAIRS';

export interface PublicPlayerInfo {
  playerId: PlayerId;
  name: string;
  avatar: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
}

/** Mirrors the server's platform/games/registry GameId. */
export type GameId = 'HAZARI' | 'KITTI' | 'TEEN_PATTI' | 'POKER';

export interface PublicPlayMoneyState {
  proposal: {
    amount: number;
    proposedBy: PlayerId;
    acceptedBy: PlayerId[];
  } | null;
  activeMatch: {
    amount: number;
    pot: number;
    participantIds: PlayerId[];
    settled: boolean;
    winnerId?: PlayerId;
  } | null;
  tableProfitLoss: Record<PlayerId, number>;
}

export interface PublicRoomInfo {
  roomCode: string;
  gameId: GameId;
  status: 'LOBBY' | 'IN_GAME';
  players: PublicPlayerInfo[];
  /** Public-safe identity archive for readable history after a player leaves. */
  playerDirectory?: Record<PlayerId, { name: string; avatar: string }>;
  maxPlayers: number;
  hostId: PlayerId;
  gameState?: string;
  playMoney: PublicPlayMoneyState;
}

export interface TableSummary {
  roomCode: string;
  gameId: GameId;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: 'LOBBY' | 'IN_GAME';
}

export interface ChatMessage {
  playerId: PlayerId;
  name: string;
  avatar: string;
  message: string;
  kind: 'text' | 'emoji' | 'voice';
  durationSec?: number;
  timestamp: number;
}

export interface HaazariPublicStatePayload {
  roomCode: string;
  state: string;
  dealerId: PlayerId;
  roundNumber: number;
  cumulativeScores: Record<PlayerId, number>;
  /** Server-authored completed rounds. Optional only for rolling compatibility with older staging servers. */
  roundHistory?: RoundResult[];
  currentSetIndex: number;
  currentLeader: PlayerId | null;
  currentPlayOrder: PlayerId[] | null;
  playersPlayedThisSubRound: PlayerId[];
  playersConfirmedArrangement: PlayerId[];
  /** Actual cards played so far in the current sub-round - visible as soon
   *  as each player throws their set, not just after all 4 have played. */
  playedSetsThisSubRound: { playerId: PlayerId; cards: Card[] }[];
  subRoundResultsThisRound: SubRoundResult[];
  /** Public one-card dealer draw ceremony for the first round only. */
  initialDealerDraws?: {
    contenders: PlayerId[];
    draws: { playerId: PlayerId; card: Card }[];
  }[];
  winnerId: PlayerId | null;
}

export interface PlayedSet {
  playerId: PlayerId;
  cards: Card[];
  throwOrder: number;
}

export interface SubRoundResult {
  setIndex: number;
  playedSets: PlayedSet[];
  winnerId: PlayerId;
  pointsAwarded: number;
  wasTie: boolean;
  tiedPlayerIds: PlayerId[];
}

export interface RoundResult {
  roundNumber: number;
  dealerId: PlayerId;
  subRounds: SubRoundResult[];
  pointsThisRound: Record<PlayerId, number>;
  cumulativeScores: Record<PlayerId, number>;
  dismissed: boolean;
  dismissalReason?: DismissalReason;
}

export type FourSets = [Card[], Card[], Card[], Card[]];

// ============================================================================
// Kitti
// ============================================================================
export type KittiGroups = [Card[], Card[], Card[]];
export type KittiHandIndex = 0 | 1 | 2;

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

export interface KittiPublicStatePayload {
  roomCode: string;
  game: 'KITTI';
  state: string;
  dealerId: PlayerId;
  roundDealerId: PlayerId;
  roundNumber: number;
  scheduledRoundsComplete: number;
  suddenDeath: boolean;
  activePlayerIds: PlayerId[];
  spectatorIds: PlayerId[];
  playersConfirmed: PlayerId[];
  currentHandIndex: KittiHandIndex;
  currentLeader: PlayerId | null;
  currentPlayOrder: PlayerId[] | null;
  playersPlayedThisHand: PlayerId[];
  playedThisHand: KittiThrow[];
  handResultsThisRound: KittiHandResult[];
  handWinsThisRound: Record<PlayerId, number>;
  deciderPlayerIds: PlayerId[];
  roundWinnerId: PlayerId | null;
  roundsWon: Record<PlayerId, number>;
  /** Server-authored completed rounds. Optional only for rolling compatibility with older staging servers. */
  roundHistory?: KittiRoundResult[];
  matchWinnerId: PlayerId | null;
  initialDealerDraws: {
    contenders: PlayerId[];
    draws: { playerId: PlayerId; card: Card }[];
  }[];
}

// ============================================================================
// Teen Patti
// ============================================================================
export type TeenPattiVariantId =
  | 'CLASSIC'
  | 'MUFLIS'
  | 'BEST_OF_FOUR'
  | 'STANDARD_JOKER'
  | 'LOWEST_CARD_JOKER'
  | 'HIGHEST_CARD_JOKER'
  | 'AK47'
  | 'PAIRS_ARE_JOKERS'
  | 'K_LITTLE'
  | 'Q_LITTLE'
  | 'J_LITTLE'
  | 'RANDOM_PACK_JOKER'
  | 'REVOLVING_JOKER'
  | 'UP_DOWN_SAME'
  | 'UP_DOWN'
  | 'DOWN_ONLY'
  | 'TWO_REFERENCE_JOKER'
  | 'DISCARD_LOW_HIGH'
  | 'DISCARD_TWO_LOWEST'
  | 'DISCARD_TWO_HIGHEST'
  | 'ASSUMED_THIRD'
  | 'CLOSEST_TO_N';

export type TeenPattiFiveCardJokerId =
  | 'NONE'
  | 'STANDARD_JOKER'
  | 'RANDOM_PACK_JOKER'
  | 'LOWEST_CARD_JOKER'
  | 'HIGHEST_CARD_JOKER'
  | 'AK47'
  | 'PAIRS_ARE_JOKERS'
  | 'UP_DOWN_SAME'
  | 'UP_DOWN'
  | 'DOWN_ONLY'
  | 'TWO_REFERENCE_JOKER';

export interface TeenPattiTableConfig {
  startingBalance: number;
  bootAmount: number;
  baseBlind: number;
  maxBlind: number;
  friendlyAssist?: boolean;
}

export interface TeenPattiRoundVariantConfig {
  variantId: TeenPattiVariantId;
  targetNumber?: number;
  reorderTargetCards?: boolean;
  fiveCardJoker?: TeenPattiFiveCardJokerId;
}

export interface TeenPattiTwoReferenceAssignment {
  upDownReferenceIndex: 0 | 1;
}

export type TeenPattiTableMode = 'FIXED' | 'VARIANT_TABLE';
export type TeenPattiVariantRotation = 'DEALER_CHOICE' | 'FIXED_ROTATION' | 'SURPRISE_ME';

export interface TeenPattiVariantTablePolicy {
  mode: TeenPattiTableMode;
  fixedVariant?: TeenPattiVariantId;
  variants?: TeenPattiVariantId[];
  rotation?: TeenPattiVariantRotation;
}

export interface TeenPattiLobbySetup {
  tableConfig: TeenPattiTableConfig;
  variantPolicy: TeenPattiVariantTablePolicy;
  roundVariant: TeenPattiRoundVariantConfig;
  proposedBy: PlayerId;
  acceptedBy: PlayerId[];
  revision: number;
  howToPlay: string;
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
  coachLockedTargetPlayerId: PlayerId | null;
  outgoing: (TeenPattiFriendlyAssistRequestState & {
    targetCards: Card[];
    targetDiscardedCardIds: string[];
    targetTwoReferenceAssignment: TeenPattiTwoReferenceAssignment | null;
  }) | null;
  incoming: TeenPattiFriendlyAssistRequestState[];
}

export interface TeenPattiPrivateStatePayload {
  /** Must match the public snapshot before this private state is rendered. */
  roundNumber: number;
  sequence: number;
  cards: Card[];
  cardCount: number;
  cardsViewed: boolean;
  seen: boolean;
  friendlyAssist: TeenPattiFriendlyAssistPrivateState;
  twoReferenceAssignment: TeenPattiTwoReferenceAssignment | null;
  discardState: {
    complete: boolean;
    selectedSlots: number[];
    legalSelections: number[][];
  } | null;
}

export interface TeenPattiSideshowResult {
  initiatorId: PlayerId;
  opponentId: PlayerId;
  packedPlayerId: PlayerId;
  tied: boolean;
  /** Present for retained-discard rounds so both compared five-card hands can be shown transparently. */
  revealedHands?: TeenPattiShowdownEntry[];
}

export interface TeenPattiShowdownEntry {
  playerId: PlayerId;
  cards: Card[];
  discardedCardIds?: string[];
  description: string;
}

export interface TeenPattiRoundOutcome {
  roundNumber: number;
  variantId: TeenPattiVariantId;
  variantName: string;
  dealerId: PlayerId;
  winnerIds: PlayerId[];
  potAwarded: number;
  showdown: TeenPattiShowdownEntry[] | null;
  split: boolean;
  reason: 'LAST_STANDING' | 'PAID_SHOWDOWN' | 'MUTUAL_OPEN_SHOW';
}

export interface TeenPattiPlayerSettlement {
  playerId: PlayerId;
  currentBalance: number;
  totalFunding: number;
  profitLoss: number;
  topUps: number;
}

export interface TeenPattiPublicStatePayload {
  roomCode: string;
  game: 'TEEN_PATTI';
  state: string;
  dealerId: PlayerId;
  roundNumber: number;
  pot: number;
  currentBlind: number;
  seenAmount: number;
  currentTurn: PlayerId | null;
  sequence: number;
  tableConfig: TeenPattiTableConfig;
  variantPolicy: TeenPattiVariantTablePolicy;
  variant: TeenPattiRoundVariantConfig;
  variantDecision: 'CHOOSE_VARIANT' | 'CONFIGURE_VARIANT' | null;
  variantWasSurprise: boolean;
  variantName: string;
  nextVariantChooserId: PlayerId | null;
  variantDealCount: number;
  variantHelp: string;
  variantReferenceCards: Card[];
  twoReferenceAssignmentsComplete: number;
  referenceAssignmentRequiredPlayerIds: PlayerId[];
  referenceAssignmentReason: 'SIDESHOW' | 'SHOWDOWN' | null;
  discardSelectionsComplete: number;
  initialDealerDraws: {
    contenders: PlayerId[];
    draws: { playerId: PlayerId; card: Card }[];
  }[];
  lastSideshow: TeenPattiSideshowResult | null;
  openShowRequestFrom: PlayerId | null;
  openShowAcceptedBy: PlayerId[];
  players: {
    playerId: PlayerId;
    chips: number;
    seen: boolean;
    cardsViewed: boolean;
    packed: boolean;
    sittingOut: boolean;
    committed: number;
    blindTurns: number;
    topUps: number;
    roundsWon: number;
    profitLoss: number;
    referenceAssigned: boolean;
    discardLocked: boolean;
  }[];
  roundHistory: TeenPattiRoundOutcome[];
  lastOutcome: TeenPattiRoundOutcome | null;
}

// ============================================================================
// Poker (hidden until the network controller is fully enabled)
// ============================================================================
export type PokerVariantId =
  | 'TEXAS_HOLDEM'
  | 'PLO4'
  | 'PLO5'
  | 'PLO6'
  | 'SHORT_DECK';

export type PokerTableMode = 'FIXED' | 'VARIANT_TABLE';
export type PokerVariantRotation = 'DEALER_CHOICE' | 'FIXED_ROTATION';
export type PokerState = 'READY' | 'AWAITING_VARIANT' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'HAND_COMPLETE';

export interface PokerTableConfig {
  mode: PokerTableMode;
  fixedVariant?: PokerVariantId;
  variants?: PokerVariantId[];
  rotation?: PokerVariantRotation;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  actionTimerSeconds: 0 | 15 | 20 | 30 | 45 | 60;
}

export interface PokerLobbySetup {
  config: PokerTableConfig;
  proposedBy: PlayerId;
  acceptedBy: PlayerId[];
  revision: number;
  seatCap: number;
  variants: Array<{
    id: PokerVariantId;
    name: string;
    shortName: string;
    howToPlay: string;
  }>;
}

export type PokerAction =
  | { type: 'FOLD' }
  | { type: 'CHECK' }
  | { type: 'CALL' }
  | { type: 'RAISE_TO'; amount: number };

export interface PokerPlayerStatePayload {
  playerId: PlayerId;
  stack: number;
  folded: boolean;
  allIn: boolean;
  streetCommitted: number;
  handCommitted: number;
  actedThisStreet: boolean;
  topUps: number;
  handsWon: number;
}

export interface PokerLegalActions {
  fold: boolean;
  check: boolean;
  call: boolean;
  raise: boolean;
  minRaiseTo: number | null;
  maxRaiseTo: number | null;
}

export interface PokerPrivateStatePayload {
  /** Must match the public snapshot before cards/legal actions are rendered. */
  handNumber: number;
  sequence: number;
  holeCards: Card[];
  toCall: number;
  legalActions: PokerLegalActions;
}

export interface PokerPlayerSettlement {
  playerId: PlayerId;
  stack: number;
  totalFunding: number;
  topUps: number;
  profitLoss: number;
}

export interface PokerHandValuePayload {
  category: string;
  categoryStrength: number;
  tiebreak: number[];
  cards: Card[];
}

export interface PokerPotAwardPayload {
  amount: number;
  eligiblePlayerIds: PlayerId[];
  winnerIds: PlayerId[];
}

export interface PokerShowdownEntryPayload {
  playerId: PlayerId;
  holeCards: Card[];
  hand: PokerHandValuePayload;
}

export interface PokerHandOutcomePayload {
  handNumber: number;
  variantId: PokerVariantId;
  /** Server-authored hand label captured with the result/history entry. */
  variantName: string;
  dealerId: PlayerId;
  board: Card[];
  pots: PokerPotAwardPayload[];
  showdown: PokerShowdownEntryPayload[] | null;
  winnerIds: PlayerId[];
  reason: 'LAST_STANDING' | 'SHOWDOWN';
}

export interface PokerPublicVariant {
  id: PokerVariantId;
  name: string;
  shortName: string;
  holeCards: number;
  betting: 'NO_LIMIT' | 'POT_LIMIT' | 'ANTE_NO_LIMIT';
  minPlayers: number;
  maxPlayers: number;
  howToPlay: string;
}

export interface PokerPublicStatePayload {
  state: PokerState;
  sequence: number;
  handNumber: number;
  variantId: PokerVariantId;
  variant: PokerPublicVariant;
  tableConfig: PokerTableConfig;
  dealerId: PlayerId;
  nextVariantChooserId: PlayerId | null;
  approvedVariantIds: PokerVariantId[];
  approvedVariants: PokerPublicVariant[];
  currentTurn: PlayerId | null;
  board: Card[];
  pot: number;
  currentBet: number;
  minRaiseTo: number | null;
  maxRaiseTo: number | null;
  players: PokerPlayerStatePayload[];
  handHistory: PokerHandOutcomePayload[];
  outcome: PokerHandOutcomePayload | null;
}
