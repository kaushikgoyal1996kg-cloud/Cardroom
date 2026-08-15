// ============================================================================
// SOCKET INTEGRATION - room:leaveTable channel detachment
//
// Bug 2 (confirmed on real Android PWA staging, 2026-08-15 retest): Leave
// Table got stuck on an indefinite branded "Loading…" screen. Root cause:
// `room:leaveTable` converted the player to a bot and broadcast the update,
// but never actually unsubscribed the leaving player's own socket from the
// room's Socket.IO channels or cleared `socket.data` - so the leaving
// player's OWN client kept receiving `room:update`/`hazari:state` for the
// rest of the game (since the bot keeps playing), racing against and
// silently overwriting the `room: null` the client had just set locally.
//
// This is deliberately a real-socket integration test, in the same style as
// socketFairness.integration.test.ts: a real HTTP + Socket.IO server, real
// socket.io-client connections, production `registerSocketHandlers`. A unit
// test around handler logic in isolation cannot prove a socket stopped
// receiving room broadcasts - only a real Socket.IO room membership check
// can.
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
  for (const c of openClients) c.disconnect();
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
    socket.emit(event, ...args, (res: T) => {
      clearTimeout(timer);
      resolve(res);
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
  error?: string;
  roomCode?: string;
  playerId?: string;
}

/** A started 4-seat Hazari game: one real host + three bots, over real sockets. */
async function startBotHeavyGame() {
  const host = await connect();
  const created = await emitWithAck<RoomAck>(host, 'room:create', {
    playerName: 'Host',
    gameId: 'HAZARI',
  });
  expect(created.ok).toBe(true);
  const roomCode = created.roomCode!;

  for (let i = 0; i < 3; i++) {
    host.emit('room:addBot');
    await once(host, 'room:update');
  }

  host.emit('room:ready', { ready: true });
  await new Promise((r) => setTimeout(r, 120));

  const dealt = once(host, 'hazari:yourHand');
  host.emit('room:start');
  await dealt;

  return { host, roomCode, playerId: created.playerId! };
}

describe('room:leaveTable over a real socket', () => {
  it('detaches the leaving socket from the room - it receives no further room:update broadcasts', async () => {
    const { host, roomCode } = await startBotHeavyGame();

    host.emit('room:leaveTable');
    // The leaveTable broadcast itself must not reach the leaving socket -
    // this is the exact broadcast that used to bounce the client's own
    // `room: null` back to a real (bot-takeover) room object.
    let sawOwnLeaveBroadcast = false;
    host.once('room:update', () => {
      sawOwnLeaveBroadcast = true;
    });
    // Bots keep playing after a takeover (scheduleBotActions) - give the
    // game a real window to generate several MORE room:update/hazari:state
    // broadcasts, not just the immediate one, so a subscription that
    // merely missed the first message would still be caught here.
    await new Promise((r) => setTimeout(r, 900));

    expect(sawOwnLeaveBroadcast).toBe(false);

    // Cross-check against the real Socket.IO room membership directly -
    // the actual invariant this bug was about, not just "no event
    // happened to arrive in this window".
    const roomSockets = await ioServer.in(roomCode).fetchSockets();
    const stillMember = roomSockets.some((s) => s.id === host.id);
    expect(stillMember).toBe(false);
  }, 20000);

  it('a further gameplay action from the leaving socket is correctly refused as "not in a room", not stale-accepted', async () => {
    const { host } = await startBotHeavyGame();

    host.emit('room:leaveTable');
    await new Promise((r) => setTimeout(r, 100));

    const errPromise = once<{ message: string }>(host, 'game:error');
    host.emit('hazari:playSet');
    const err = await errPromise;
    expect(err.message).toBe('Not currently in a room.');
  }, 20000);

  it('the room itself keeps going for everyone else - convertToBot still ran, the seat is now a bot', async () => {
    const { host, roomCode, playerId } = await startBotHeavyGame();

    host.emit('room:leaveTable');
    await new Promise((r) => setTimeout(r, 100));

    // Proves the fix only detached the LEAVING socket - the room itself,
    // and this player's seat (now bot-controlled), are untouched.
    const room = rooms.getRoomOrThrow(roomCode);
    expect(room.players.size).toBe(4);
    const seat = room.players.get(playerId);
    expect(seat?.isBot).toBe(true);
  }, 20000);
});
