import type { Card, DismissalReason, PlayerId, RoundResult, SubRoundResult } from '../../games/hazari/types.js';
import type { Card as PlatformCard } from '../cards/index.js';
import type { KittiRoundResult } from '../../games/kitti/engine.js';
import type { PlayerSettlement as TeenPattiPlayerSettlement, RoundOutcome as TeenPattiRoundOutcome, TeenPattiAction, TeenPattiFriendlyAssistPrivateState, TeenPattiFriendlySuggestion } from '../../games/teenpatti/engine.js';
import type { TeenPattiLobbySetupPublic } from '../../games/teenpatti/lobbySetup.js';
import type { TeenPattiRoundVariantConfig, TeenPattiTableConfig, TeenPattiTwoReferenceAssignment, TeenPattiVariantTablePolicy } from '../../games/teenpatti/rules.js';
import type { PokerAction, PokerHandOutcome, PokerPlayerSettlement, PokerPrivateState, PokerPublicState } from '../../games/poker/engine.js';
import type { PokerLobbySetupPublic } from '../../games/poker/lobbySetup.js';
import type { PokerTableConfig, PokerVariantId } from '../../games/poker/rules.js';
import type { PublicRoomInfo, TableSummary } from '../rooms/types.js';
import type { GameId } from '../games/registry.js';

// ============================================================================
// CLIENT -> SERVER events
// ============================================================================
export interface ClientToServerEvents {
  'room:create': (payload: { playerName: string; avatar?: string; gameId?: GameId }, ack: (res: RoomAck) => void) => void;
  'room:join': (payload: { roomCode: string; playerName: string; avatar?: string }, ack: (res: RoomAck) => void) => void;
  'room:quickMatch': (payload: { playerName: string; avatar?: string; gameId?: GameId }, ack: (res: RoomAck) => void) => void;
  'room:reconnect': (payload: { token: string }, ack: (res: RoomAck) => void) => void;
  'room:ready': (payload: { ready: boolean }) => void;
  'room:start': () => void;
  'room:listTables': (payload: { gameId?: GameId } | undefined, ack: (res: TablesAck) => void) => void;
  'room:addBot': () => void;
  'room:removeBot': (payload: { playerId: PlayerId }) => void;
  'room:playAgain': () => void;
  'room:playMoneyPropose': (payload: { amount: number }) => void;
  'room:playMoneyAccept': () => void;
  'room:playMoneyDecline': () => void;
  'room:playMoneyCancel': () => void;
  'room:chat': (payload: { message: string; kind: 'text' | 'emoji' | 'voice'; durationSec?: number }) => void;
  'room:leave': (ack: (res: RoomLeaveAck) => void) => void;
  'room:leaveTable': () => void;

  // Hazari
  'hazari:confirmArrangement': (payload: { cardIdSets: [string[], string[], string[], string[]] }) => void;
  'hazari:requestSuggestion': (ack: (res: SuggestionAck) => void) => void;
  'hazari:requestSuggestionOptions': (ack: (res: SuggestionOptionsAck) => void) => void;
  'hazari:playSet': () => void;
  'hazari:requestDismissal': (payload: {
    reason: DismissalReason;
    proposedCardIdSets?: [string[], string[], string[], string[]];
  }) => void;
  'hazari:startNextRound': () => void;

  // Kitti
  'kitti:confirmArrangement': (payload: { cardIdGroups: [string[], string[], string[]] }) => void;
  'kitti:requestSuggestion': (ack: (res: KittiSuggestionAck) => void) => void;
  'kitti:playHand': () => void;
  'kitti:playDecider': () => void;
  'kitti:startNextRound': () => void;

  // Teen Patti
  'teenpatti:proposeSetup': (payload: { tableConfig: TeenPattiTableConfig; roundVariant: TeenPattiRoundVariantConfig; variantPolicy: TeenPattiVariantTablePolicy }, ack: (res: TeenPattiSetupAck) => void) => void;
  'teenpatti:acceptSetup': (payload: { revision: number }, ack: (res: TeenPattiSetupAck) => void) => void;
  'teenpatti:chooseRoundVariant': (payload: { roundVariant: TeenPattiRoundVariantConfig; expectedSeq: number }) => void;
  'teenpatti:chooseSurpriseRound': (payload: { expectedSeq: number }) => void;
  'teenpatti:assignTwoReference': (payload: { upDownReferenceIndex: 0 | 1; expectedSeq: number }) => void;
  'teenpatti:chooseDiscards': (payload: { discardedSlots: number[]; expectedSeq: number }) => void;
  'teenpatti:friendlyAssistRequest': (payload: { targetPlayerId: PlayerId; expectedRoundNumber: number }) => void;
  'teenpatti:friendlyAssistRespond': (payload: { requestId: string; accept: boolean }) => void;
  'teenpatti:friendlyAssistRevoke': (payload: { requestId: string }) => void;
  'teenpatti:friendlyAssistSuggest': (payload: { requestId: string; suggestion: TeenPattiFriendlySuggestion }) => void;
  'teenpatti:action': (payload: { action: TeenPattiAction; expectedSeq: number }) => void;
  'teenpatti:topUp': (payload: { amount: number; expectedSeq: number }) => void;
  'teenpatti:startNextRound': (payload: { expectedSeq: number }) => void;
  'teenpatti:leaveTable': (ack: (res: TeenPattiLeaveAck) => void) => void;

  // Poker (network remains gated until the controller is fully verified)
  'poker:proposeSetup': (payload: { config: PokerTableConfig }, ack: (res: PokerSetupAck) => void) => void;
  'poker:acceptSetup': (payload: { revision: number }, ack: (res: PokerSetupAck) => void) => void;
  'poker:chooseVariant': (payload: { variantId: PokerVariantId; expectedSeq: number }) => void;
  'poker:action': (payload: { action: PokerAction; expectedSeq: number }) => void;
  'poker:topUp': (payload: { amount: number; expectedSeq: number }) => void;
  'poker:startNextHand': (payload: { expectedSeq: number }) => void;
  'poker:leaveTable': (ack: (res: PokerLeaveAck) => void) => void;

  // Voice/WebRTC signaling
  'voice:getIceServers': (ack: (res: VoiceIceServersAck) => void) => void;
  'voice:join': () => void;
  'voice:leave': () => void;
  'voice:signal': (payload: { toPlayerId: PlayerId; data: unknown }) => void;
  'voice:mute': (payload: { muted: boolean }) => void;
}

export interface VoiceIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface VoiceIceServersAck {
  ok: boolean;
  iceServers: VoiceIceServerConfig[];
  relayAvailable: boolean;
  error?: string;
}

export interface RoomLeaveAck {
  ok: boolean;
  error?: string;
}

export interface RoomAck {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: PlayerId;
  token?: string;
  room?: PublicRoomInfo;
}

export interface SuggestionAck {
  ok: boolean;
  error?: string;
  cardIdSets?: [string[], string[], string[], string[]];
}

export interface SuggestionOptionAck {
  label: string;
  description: string;
  cardIdSets: [string[], string[], string[], string[]];
}

export interface SuggestionOptionsAck {
  ok: boolean;
  error?: string;
  options?: SuggestionOptionAck[];
}

export interface KittiSuggestionAck {
  ok: boolean;
  error?: string;
  cardIdGroups?: [string[], string[], string[]];
}

export interface TablesAck {
  ok: boolean;
  error?: string;
  tables?: TableSummary[];
}

export interface TeenPattiSetupAck {
  ok: boolean;
  error?: string;
  setup?: TeenPattiLobbySetupPublic;
}

export interface TeenPattiLeaveAck {
  ok: boolean;
  error?: string;
  settlement?: TeenPattiPlayerSettlement;
  tableEnded?: boolean;
}

export interface PokerSetupAck {
  ok: boolean;
  error?: string;
  setup?: PokerLobbySetupPublic;
}

export interface PokerLeaveAck {
  ok: boolean;
  error?: string;
  settlement?: PokerPlayerSettlement;
  tableEnded?: boolean;
}

// ============================================================================
// SERVER -> CLIENT events
// ============================================================================
export interface ServerToClientEvents {
  'room:update': (room: PublicRoomInfo) => void;
  'room:error': (payload: { message: string }) => void;
  'room:chatMessage': (payload: ChatMessage) => void;
  'game:error': (payload: { message: string }) => void;

  // Hazari private/public state
  'hazari:yourHand': (payload: { hand: Card[] }) => void;
  'hazari:yourArrangement': (payload: { sets: [Card[], Card[], Card[], Card[]] }) => void;
  'hazari:state': (publicState: HaazariPublicStatePayload) => void;
  'hazari:roundComplete': (payload: { result: RoundResult }) => void;
  'hazari:over': (payload: { winnerId: PlayerId; finalScores: Record<PlayerId, number> }) => void;

  // Kitti private/public state
  'kitti:yourHand': (payload: { hand: PlatformCard[] }) => void;
  'kitti:yourArrangement': (payload: { groups: [PlatformCard[], PlatformCard[], PlatformCard[]] }) => void;
  'kitti:yourDeciderHand': (payload: { hand: PlatformCard[] }) => void;
  'kitti:state': (publicState: KittiPublicStatePayload) => void;
  'kitti:roundComplete': (payload: { result: KittiRoundResult }) => void;
  'kitti:over': (payload: { winnerId: PlayerId; roundsWon: Record<PlayerId, number> }) => void;

  // Teen Patti private/public state
  'teenpatti:setup': (payload: { setup: TeenPattiLobbySetupPublic | null }) => void;
  'teenpatti:private': (payload: TeenPattiPrivateStatePayload) => void;
  'teenpatti:state': (publicState: TeenPattiPublicStatePayload) => void;
  'teenpatti:roundComplete': (payload: { result: TeenPattiRoundOutcome }) => void;
  'teenpatti:tableEnded': (payload: {
    reason: 'NOT_ENOUGH_PLAYERS';
    settlements: TeenPattiPlayerSettlement[];
  }) => void;

  // Poker private/public state. These events are typed before Poker is
  // network-enabled so reconnect/action plumbing can be verified behind the gate.
  'poker:setup': (payload: { setup: PokerLobbySetupPublic | null }) => void;
  'poker:private': (payload: PokerPrivateState) => void;
  'poker:state': (publicState: PokerPublicState) => void;
  'poker:handComplete': (payload: { result: PokerHandOutcome }) => void;
  'poker:tableEnded': (payload: { reason: 'NOT_ENOUGH_PLAYERS'; settlements: PokerPlayerSettlement[] }) => void;

  // Voice
  'voice:participants': (payload: { playerIds: PlayerId[] }) => void;
  'voice:peerJoined': (payload: { playerId: PlayerId }) => void;
  'voice:peerLeft': (payload: { playerId: PlayerId }) => void;
  'voice:signal': (payload: { fromPlayerId: PlayerId; data: unknown }) => void;
  'voice:muteChanged': (payload: { playerId: PlayerId; muted: boolean }) => void;
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
  /** Completed rounds to date. Public and reconnect-safe so in-game Round History
   *  is authoritative instead of depending on one-off client events. */
  roundHistory: RoundResult[];
  currentSetIndex: number;
  currentLeader: PlayerId | null;
  currentPlayOrder: PlayerId[] | null;
  playersPlayedThisSubRound: PlayerId[];
  playersConfirmedArrangement: PlayerId[];
  playedSetsThisSubRound: { playerId: PlayerId; cards: Card[] }[];
  subRoundResultsThisRound: SubRoundResult[];
  initialDealerDraws: {
    contenders: PlayerId[];
    draws: { playerId: PlayerId; card: Card }[];
  }[];
  winnerId: PlayerId | null;
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
  currentHandIndex: 0 | 1 | 2;
  currentLeader: PlayerId | null;
  currentPlayOrder: PlayerId[] | null;
  playersPlayedThisHand: PlayerId[];
  playedThisHand: { playerId: PlayerId; cards: PlatformCard[]; throwOrder: number }[];
  handResultsThisRound: {
    handIndex: 0 | 1 | 2;
    played: { playerId: PlayerId; cards: PlatformCard[]; throwOrder: number }[];
    winnerId: PlayerId;
    wasTie: boolean;
    tiedPlayerIds: PlayerId[];
  }[];
  handWinsThisRound: Record<PlayerId, number>;
  deciderPlayerIds: PlayerId[];
  roundWinnerId: PlayerId | null;
  roundsWon: Record<PlayerId, number>;
  /** Completed rounds to date. Public and reconnect-safe for the in-game history sheet. */
  roundHistory: KittiRoundResult[];
  matchWinnerId: PlayerId | null;
  initialDealerDraws: {
    contenders: PlayerId[];
    draws: { playerId: PlayerId; card: PlatformCard }[];
  }[];
}


export interface TeenPattiPrivateStatePayload {
  roundNumber: number;
  sequence: number;
  cards: PlatformCard[];
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
  variantReferenceCards: PlatformCard[];
  twoReferenceAssignmentsComplete: number;
  referenceAssignmentRequiredPlayerIds: PlayerId[];
  referenceAssignmentReason: 'SIDESHOW' | 'SHOWDOWN' | null;
  discardSelectionsComplete: number;
  initialDealerDraws: { contenders: PlayerId[]; draws: { playerId: PlayerId; card: PlatformCard }[] }[];
  lastSideshow: {
    initiatorId: PlayerId;
    opponentId: PlayerId;
    packedPlayerId: PlayerId;
    tied: boolean;
    revealedHands?: { playerId: PlayerId; cards: PlatformCard[]; discardedCardIds?: string[]; description: string }[];
  } | null;
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
