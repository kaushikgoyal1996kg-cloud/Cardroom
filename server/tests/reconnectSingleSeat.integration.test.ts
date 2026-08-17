// ============================================================================
// SOCKET INTEGRATION - reconnect must reclaim ONE existing seat
//
// Regression: a player could back/reload while their original lobby seat was
// still recoverable, then enter again and create a second row with the same
// display name. The old row remained Waiting/Disconnected.
//
// Required behaviour: the secret session token always reclaims the original
// playerId. The room keeps exactly one PlayerSlot for that person, the new
// socket becomes the seat's current connection, and the public lobby reports
// that one row as connected/online.
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'node:net';
import { RoomManager } from '../src/platform/rooms/roomManager.js';
import { registerSocketHandlers } from '../src/platform/net/socketHandlers.js';

let httpServer: HttpServer;
let ioServer: IOServer;
let rooms: RoomManager;
let port: number;
const clients: ClientSocket[] = [];

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
  for (const client of clients) client.disconnect();
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
    clients.push(socket);
    const timer = setTimeout(() => reject(new Error('socket connect timed out')), 5000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', reject);
  });
}

function emitWithAck<T>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} ack timed out`)), 5000);
    socket.emit(event, ...args, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

interface RoomAck {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  token?: string;
  room?: {
    players: Array<{ playerId: string; name: string; connected: boolean }>;
  };
}

describe('reconnect preserves a single lobby identity', () => {
  it('reclaims the same playerId and shows one online row, never a duplicate Waiting row', async () => {
    const first = await connect();
    const created = await emitWithAck<RoomAck>(first, 'room:create', {
      playerName: 'Kaushik',
      gameId: 'HAZARI',
    });
    expect(created.ok).toBe(true);
    expect(created.token).toBeTruthy();

    const roomCode = created.roomCode!;
    const originalPlayerId = created.playerId!;
    expect(rooms.getRoomOrThrow(roomCode).players.size).toBe(1);

    // Simulates a second app/browser instance restoring the same persisted
    // session while the old transport is still alive (the hardest case).
    const restored = await connect();
    const reconnect = await emitWithAck<RoomAck>(restored, 'room:reconnect', {
      token: created.token!,
    });

    expect(reconnect.ok).toBe(true);
    expect(reconnect.playerId).toBe(originalPlayerId);
    expect(rooms.getRoomOrThrow(roomCode).players.size).toBe(1);
    expect(reconnect.room?.players).toHaveLength(1);
    expect(reconnect.room?.players[0]).toMatchObject({
      playerId: originalPlayerId,
      name: 'Kaushik',
      connected: true,
    });

    // The stale first socket is detached from the room; there is only one
    // live room member for this one seat.
    const roomSockets = await ioServer.in(roomCode).fetchSockets();
    expect(roomSockets.map((s) => s.id)).toEqual([restored.id]);

    // A late disconnect from the old connection must not flip the restored
    // seat back to Waiting/Disconnected.
    first.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    const publicRoom = rooms.toPublic(rooms.getRoomOrThrow(roomCode));
    expect(publicRoom.players).toHaveLength(1);
    expect(publicRoom.players[0]).toMatchObject({
      playerId: originalPlayerId,
      connected: true,
    });
  });

  it('a seated socket cannot create/join a second room without explicitly leaving', async () => {
    const socket = await connect();
    const created = await emitWithAck<RoomAck>(socket, 'room:create', {
      playerName: 'Anchal',
      gameId: 'HAZARI',
    });
    expect(created.ok).toBe(true);

    const secondAttempt = await emitWithAck<RoomAck>(socket, 'room:create', {
      playerName: 'Anchal',
      gameId: 'HAZARI',
    });
    expect(secondAttempt.ok).toBe(false);
    expect(secondAttempt.error).toMatch(/already seated/i);
    expect(rooms.getRoomOrThrow(created.roomCode!).players.size).toBe(1);
  });
});
