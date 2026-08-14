import { io, Socket } from 'socket.io-client';
import type { Card, ChatMessage, DismissalReason, GameId, HaazariPublicStatePayload, PlayerId, PublicRoomInfo, RoundResult, TableSummary } from '../game/types';

export interface RoomAck {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: PlayerId;
  token?: string;
  room?: PublicRoomInfo;
}

interface ClientToServerEvents {
  'room:create': (payload: { playerName: string; avatar?: string; gameId: GameId }, ack: (res: RoomAck) => void) => void;
  'room:join': (payload: { roomCode: string; playerName: string; avatar?: string }, ack: (res: RoomAck) => void) => void;
  'room:quickMatch': (payload: { playerName: string; avatar?: string; gameId: GameId }, ack: (res: RoomAck) => void) => void;
  'room:reconnect': (payload: { token: string }, ack: (res: RoomAck) => void) => void;
  'room:ready': (payload: { ready: boolean }) => void;
  'room:start': () => void;
  'room:listTables': (payload: { gameId?: GameId } | undefined, ack: (res: TablesAck) => void) => void;
  'room:addBot': () => void;
  'room:playAgain': () => void;
  'room:chat': (payload: { message: string; kind: 'text' | 'emoji' | 'voice'; durationSec?: number }) => void;
  'hazari:confirmArrangement': (payload: { cardIdSets: [string[], string[], string[], string[]] }) => void;
  'hazari:requestSuggestion': (ack: (res: SuggestionAck) => void) => void;
  'hazari:requestSuggestionOptions': (ack: (res: SuggestionOptionsAck) => void) => void;
  'hazari:playSet': () => void;
  'hazari:requestDismissal': (payload: {
    reason: DismissalReason;
    proposedCardIdSets?: [string[], string[], string[], string[]];
  }) => void;
  'hazari:startNextRound': () => void;
  'room:leaveTable': () => void;

  'voice:join': () => void;
  'voice:leave': () => void;
  'voice:signal': (payload: { toPlayerId: PlayerId; data: unknown }) => void;
  'voice:mute': (payload: { muted: boolean }) => void;
}

/** One server-computed arrangement option. Cards arrive as ids; the client
 *  resolves them against its own hand, so no card data is duplicated. */
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

export interface SuggestionAck {
  ok: boolean;
  error?: string;
  cardIdSets?: [string[], string[], string[], string[]];
}

export interface TablesAck {
  ok: boolean;
  error?: string;
  tables?: TableSummary[];
}

interface ServerToClientEvents {
  'room:update': (room: PublicRoomInfo) => void;
  'room:error': (payload: { message: string }) => void;
  'room:chatMessage': (payload: ChatMessage) => void;
  'hazari:yourHand': (payload: { hand: Card[] }) => void;
  'hazari:yourArrangement': (payload: { sets: [Card[], Card[], Card[], Card[]] }) => void;
  'hazari:state': (publicState: HaazariPublicStatePayload) => void;
  'game:error': (payload: { message: string }) => void;
  'hazari:roundComplete': (payload: { result: RoundResult }) => void;
  'hazari:over': (payload: { winnerId: PlayerId; finalScores: Record<PlayerId, number> }) => void;

  'voice:participants': (payload: { playerIds: PlayerId[] }) => void;
  'voice:peerJoined': (payload: { playerId: PlayerId }) => void;
  'voice:peerLeft': (payload: { playerId: PlayerId }) => void;
  'voice:signal': (payload: { fromPlayerId: PlayerId; data: unknown }) => void;
  'voice:muteChanged': (payload: { playerId: PlayerId; muted: boolean }) => void;
}

export type HaazariSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Server address comes from platform/lib/config, which refuses to fall back
// to localhost in a production build. See that file for why.
import { SERVER_CONFIG } from '../platform/lib/config';

const SERVER_URL = SERVER_CONFIG.url;

let socketInstance: HaazariSocket | null = null;

export function getSocket(): HaazariSocket {
  if (!SERVER_CONFIG.ok) {
    // Fail loudly instead of opening a connection that can never succeed and
    // leaving players staring at "Connecting..." forever.
    throw new Error(SERVER_CONFIG.error);
  }
  if (!socketInstance) {
    socketInstance = io(SERVER_URL, {
      autoConnect: true,
      // Mobile players change networks and lock phones constantly, so keep
      // retrying with backoff rather than giving up after a few attempts.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 6000,
      timeout: 12000,
    }) as unknown as HaazariSocket;
  }
  return socketInstance;
}
