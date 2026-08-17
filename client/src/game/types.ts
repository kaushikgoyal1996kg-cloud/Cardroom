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
export type GameId = 'HAZARI' | 'KITTI' | 'TEEN_PATTI';

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
  | 'NAMED_RANK_LITTLE'
  | 'RANDOM_PACK_JOKER'
  | 'UP_DOWN_SAME'
  | 'UP_DOWN'
  | 'DOWN_ONLY'
  | 'TWO_REFERENCE_JOKER'
  | 'DISCARD_LOW_HIGH'
  | 'DISCARD_TWO_LOWEST'
  | 'DISCARD_TWO_HIGHEST'
  | 'ASSUMED_THIRD'
  | 'CLOSEST_TO_N';

export interface TeenPattiTableConfig {
  startingBalance: number;
  bootAmount: number;
  baseBlind: number;
  maxBlind: number;
}

export interface TeenPattiRoundVariantConfig {
  variantId: TeenPattiVariantId;
  namedRank?: Rank;
  targetNumber?: number;
  reorderTargetCards?: boolean;
}

export interface TeenPattiLobbySetup {
  tableConfig: TeenPattiTableConfig;
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

export interface TeenPattiPrivateStatePayload {
  cards: Card[];
  cardCount: number;
  cardsViewed: boolean;
  seen: boolean;
}

export interface TeenPattiSideshowResult {
  initiatorId: PlayerId;
  opponentId: PlayerId;
  packedPlayerId: PlayerId;
  tied: boolean;
}

export interface TeenPattiShowdownEntry {
  playerId: PlayerId;
  cards: Card[];
  description: string;
}

export interface TeenPattiRoundOutcome {
  roundNumber: number;
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
  variant: TeenPattiRoundVariantConfig;
  variantHelp: string;
  initialDealerDraws: {
    contenders: PlayerId[];
    draws: { playerId: PlayerId; card: Card }[];
  }[];
  lastSideshow: TeenPattiSideshowResult | null;
  openShowRequestFrom: PlayerId | null;
  players: {
    playerId: PlayerId;
    chips: number;
    seen: boolean;
    cardsViewed: boolean;
    packed: boolean;
    committed: number;
    blindTurns: number;
    topUps: number;
    profitLoss: number;
  }[];
  lastOutcome: TeenPattiRoundOutcome | null;
}
