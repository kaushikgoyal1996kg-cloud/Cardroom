import type { GameId } from '../games/registry.js';

/** A seated player. Opaque to the platform - games never reinterpret it. */
export type PlayerId = string;

import type { GameSession } from '../games/session.js';

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
  createdAt: number;
  /** PlayerIds currently in the live voice call for this room (WebRTC
   *  mesh) - the server never touches audio itself, this is purely so it
   *  can tell everyone who's in the call and relay signaling messages. */
  voiceCallParticipants: Set<PlayerId>;
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
