import type { GameId } from '../games/registry.js';

/** A seated player. Opaque to the platform - games never reinterpret it. */
export type PlayerId = string;

import type { GameSession } from '../games/session.js';

export interface PlayMoneyProposal {
  amount: number;
  proposedBy: PlayerId;
  /** Host acceptance is implicit in proposing; bots are auto-accepted. */
  acceptedBy: Set<PlayerId>;
}

export interface ActivePlayMoneyMatch {
  amount: number;
  pot: number;
  participantIds: PlayerId[];
  settled: boolean;
  winnerId?: PlayerId;
}

export interface RoomPlayMoneyState {
  proposal?: PlayMoneyProposal;
  activeMatch?: ActivePlayMoneyMatch;
  /** Cumulative virtual P/L for this room session only. No cash value. */
  tableProfitLoss: Record<PlayerId, number>;
}

export interface PlayerSlot {
  playerId: PlayerId;
  /** Secret token the client stores (e.g. in localStorage) and presents to
   *  reconnect - never sent to other players. Bots have no real token. */
  token: string;
  name: string;
  avatar: string;
  connected: boolean;
  ready: boolean;
  socketId?: string;
  disconnectedAt?: number;
  /** True if this seat is (or has become, via "Leave Table") computer-controlled. */
  isBot: boolean;
}

export interface RoomState {
  roomCode: string;
  /**
   * Which game this table plays. Fixed when the room is created and never
   * changed afterwards - a player who wants a different game makes a
   * different table. That rule is what keeps the room layer from ever having
   * to migrate a half-played game between engines.
   */
  gameId: GameId;
  hostId: PlayerId;
  players: Map<PlayerId, PlayerSlot>;
  status: 'LOBBY' | 'IN_GAME';
  /** The running game, once started. Typed as the shared session boundary,
   *  never as any one game's engine. */
  game?: GameSession;
  /** Opaque, game-owned lobby setup. The room layer stores but never interprets it. */
  gameSetup?: unknown;
  createdAt: number;
  /** PlayerIds currently in the live voice call for this room (WebRTC
   *  mesh) - the server never touches audio itself, this is purely so it
   *  can tell everyone who's in the call and relay signaling messages. */
  voiceCallParticipants: Set<PlayerId>;
  /** Optional Hazari/Kitti virtual board. This is room-session play money only;
   *  there are no deposits, withdrawals or real-money conversion. */
  playMoney: RoomPlayMoneyState;
}

/** Safe-to-broadcast player info - never includes the token. */
export interface PublicPlayerInfo {
  playerId: PlayerId;
  name: string;
  avatar: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
}

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
  status: RoomState['status'];
  players: PublicPlayerInfo[];
  maxPlayers: number;
  hostId: PlayerId;
  /** Engine state name of the running game, if any. Deliberately a plain
   *  string: the values differ per game, and no client should assume
   *  Hazari's state machine. */
  gameState?: string;
  /** Optional room-session virtual board/pot for Hazari and Kitti. */
  playMoney: PublicPlayMoneyState;
}

/** Summary shown in the "Browse Tables" list. */
export interface TableSummary {
  roomCode: string;
  gameId: GameId;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomState['status'];
}
