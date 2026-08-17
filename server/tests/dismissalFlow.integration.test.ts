// ============================================================================
// SOCKET INTEGRATION - Hazari dismissal must NEVER eject the player/room
//
// Bug 6: a valid dismissed hand could surface "This room does not exist"
// instead of simply voiding the round and continuing. Engine unit tests prove
// the zero-point rule; this test proves the entire real Socket.IO lifecycle:
// valid dismissal -> same room/seat -> zero-point result -> next deal works.
// ============================================================================

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { Server as IOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../src/platform/rooms/roomManager.js';
import { registerSocketHandlers } from '../src/platform/net/socketHandlers.js';
import { asHazari } from '../src/platform/games/sessions.js';
import type { Card, RoundResult } from '../src/games/hazari/types.js';

let httpServer: HttpServer;
let ioServer: IOServer;
let rooms: RoomManager;
let port: number;
const openClients: ClientSocket[] = [];

beforeAll(async () => {
  httpServer = createServer();
  ioServer = new IOServer(httpServer, { cors: { origin: '*' } });
  rooms = new RoomManager();
  registerSocketHandlers(ioServer as never, rooms);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  for (const client of openClients) client.disconnect();
  await new Promise<void>((resolve) => ioServer.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function connect(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    openClients.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('socket connect timed out')), 5000);
  });
}

function emitWithAck<T>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} ack timed out`)), 5000);
    socket.emit(event, ...args, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

function once<T>(socket: ClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} never arrived`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

interface RoomAck {
  ok: boolean;
  roomCode?: string;
  playerId?: string;
}

const sixPairHand: Card[] = [
  { rank: 'A', suit: 'SPADES', id: 'SPADES_A' },
  { rank: 'A', suit: 'HEARTS', id: 'HEARTS_A' },
  { rank: 'K', suit: 'SPADES', id: 'SPADES_K' },
  { rank: 'K', suit: 'HEARTS', id: 'HEARTS_K' },
  { rank: 'Q', suit: 'SPADES', id: 'SPADES_Q' },
  { rank: 'Q', suit: 'HEARTS', id: 'HEARTS_Q' },
  { rank: 'J', suit: 'SPADES', id: 'SPADES_J' },
  { rank: 'J', suit: 'HEARTS', id: 'HEARTS_J' },
  { rank: '10', suit: 'SPADES', id: 'SPADES_10' },
  { rank: '10', suit: 'HEARTS', id: 'HEARTS_10' },
  { rank: '9', suit: 'SPADES', id: 'SPADES_9' },
  { rank: '9', suit: 'HEARTS', id: 'HEARTS_9' },
  { rank: '8', suit: 'SPADES', id: 'SPADES_8' },
];

describe('Bug 6 - dismissal over a real socket', () => {
  it('voids the round but keeps the same player/socket/room alive for the next deal', async () => {
    const host = await connect();
    const created = await emitWithAck<RoomAck>(host, 'room:create', {
      playerName: 'Host',
      gameId: 'HAZARI',
    });
    expect(created.ok).toBe(true);
    const roomCode = created.roomCode!;
    const playerId = created.playerId!;

    // Fill the table with real production bot events so the normal start path
    // is used. This does not alter dismissal rules or production randomness.
    for (let i = 0; i < 3; i++) {
      const updated = once(host, 'room:update');
      host.emit('room:addBot');
      await updated;
    }
    host.emit('room:ready', { ready: true });
    await new Promise((resolve) => setTimeout(resolve, 80));

    const firstHand = once<{ hand: Card[] }>(host, 'hazari:yourHand');
    host.emit('room:start');
    await firstHand;

    // Test-only deterministic setup: replace the host's in-memory dealt hand
    // with a known valid six-pair hand. The socket handler, eligibility check,
    // room lifecycle and next-round deal remain the real production code.
    const roomBefore = rooms.getRoomOrThrow(roomCode);
    const engine = asHazari(roomBefore.game)!;
    (engine as unknown as { hands: Record<string, Card[]> }).hands[playerId] = sixPairHand;

    const dismissedState = once<{ state: string; roundNumber: number }>(host, 'hazari:state');
    const resultEvent = once<{ result: RoundResult }>(host, 'hazari:roundComplete');
    host.emit('hazari:requestDismissal', { reason: 'SIX_PAIRS' });

    const [state, { result }] = await Promise.all([dismissedState, resultEvent]);
    expect(state.state).toBe('DISMISSED_ROUND');
    expect(result.dismissed).toBe(true);
    expect(result.dismissalReason).toBe('SIX_PAIRS');
    expect(Object.values(result.pointsThisRound)).toEqual([0, 0, 0, 0]);

    // The bug's key invariant: dismissal is NOT a leave/disconnect action.
    const roomAfterDismissal = rooms.getRoomOrThrow(roomCode);
    expect(roomAfterDismissal.players.has(playerId)).toBe(true);
    expect(roomAfterDismissal.players.get(playerId)?.isBot).toBe(false);
    expect(roomAfterDismissal.players.get(playerId)?.connected).toBe(true);
    const roomSockets = await ioServer.in(roomCode).fetchSockets();
    expect(roomSockets.some((socket) => socket.id === host.id)).toBe(true);

    // Same host, same room, same socket can immediately start the next round.
    const nextHand = once<{ hand: Card[] }>(host, 'hazari:yourHand');
    const nextState = once<{ state: string }>(host, 'hazari:state');
    host.emit('hazari:startNextRound');
    const [newHand, freshState] = await Promise.all([nextHand, nextState]);
    expect(newHand.hand).toHaveLength(13);
    expect(freshState.state).toBe('ARRANGING_HANDS');
    expect(rooms.getRoomOrThrow(roomCode).players.has(playerId)).toBe(true);
  }, 20000);
});
