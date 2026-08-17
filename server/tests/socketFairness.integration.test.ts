// ============================================================================
// SOCKET INTEGRATION - arrangement assistance fairness
//
// This test does NOT reproduce handler logic. It starts a real HTTP server,
// a real Socket.IO server with the production `registerSocketHandlers`, and
// connects real socket.io-client sockets over a real TCP port.
//
// Everything travels the production path: the event is emitted by a client,
// routed by Socket.IO, handled by the real handler, and the acknowledgement
// comes back over the wire. If the gate were removed from the handler, this
// test would fail.
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'node:net';
import { RoomManager } from '../src/platform/rooms/roomManager.js';
import { registerSocketHandlers } from '../src/platform/net/socketHandlers.js';
import { asHazari } from '../src/platform/games/sessions.js';

let httpServer: HttpServer;
let ioServer: IOServer;
let rooms: RoomManager;
let port: number;
const openClients: ClientSocket[] = [];

beforeAll(async () => {
  httpServer = createServer();
  ioServer = new IOServer(httpServer, { cors: { origin: '*' } });
  rooms = new RoomManager();
  // The real production handler registration - nothing stubbed.
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

/** Opens a real client socket to the real server. */
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

/** Waits for one emission of `event`. */
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

interface SuggestionOptionsAck {
  ok: boolean;
  error?: string;
  options?: { label: string; description: string; cardIdSets: [string[], string[], string[], string[]] }[];
}

interface KittiSuggestionAck {
  ok: boolean;
  error?: string;
  cardIdGroups?: [string[], string[], string[]];
}

/**
 * Builds a started Kitti table over real sockets. `humanOpponents` real
 * opponents join normally; `botOpponents` are added through room:addBot.
 * This deliberately exercises the same production room/controller path the
 * Android/web clients use.
 */
async function startKittiGameOverSockets(humanOpponents: number, botOpponents: number) {
  const host = await connect();
  const created = await emitWithAck<RoomAck>(host, 'room:create', {
    playerName: 'KittiHost',
    gameId: 'KITTI',
  });
  expect(created.ok).toBe(true);
  const roomCode = created.roomCode!;

  const humans: ClientSocket[] = [];
  for (let i = 0; i < humanOpponents; i++) {
    const guest = await connect();
    const joined = await emitWithAck<RoomAck>(guest, 'room:join', {
      roomCode,
      playerName: `KittiGuest${i + 1}`,
    });
    expect(joined.ok).toBe(true);
    humans.push(guest);
  }

  for (let i = 0; i < botOpponents; i++) {
    const update = once(host, 'room:update');
    host.emit('room:addBot');
    await update;
  }

  host.emit('room:ready', { ready: true });
  for (const guest of humans) guest.emit('room:ready', { ready: true });
  await new Promise((resolve) => setTimeout(resolve, 120));

  const dealt = once(host, 'kitti:yourHand');
  host.emit('room:start');
  await dealt;

  return { host, humans, roomCode, playerId: created.playerId! };
}

/**
 * Builds a started 4-seat Hazari game over real sockets.
 * `humanOpponents` is how many of the three opponents are real connected
 * clients; the remainder are bots added through the real `room:addBot` event.
 */
async function startGameOverSockets(humanOpponents: number) {
  const host = await connect();
  const created = await emitWithAck<RoomAck>(host, 'room:create', {
    playerName: 'Host',
    gameId: 'HAZARI',
  });
  expect(created.ok).toBe(true);
  const roomCode = created.roomCode!;

  const humans: ClientSocket[] = [];
  for (let i = 0; i < humanOpponents; i++) {
    const guest = await connect();
    const joined = await emitWithAck<RoomAck>(guest, 'room:join', {
      roomCode,
      playerName: `Guest${i + 1}`,
    });
    expect(joined.ok).toBe(true);
    humans.push(guest);
  }

  // Fill the rest with bots via the real event.
  for (let i = 0; i < 3 - humanOpponents; i++) {
    host.emit('room:addBot');
    // Each addBot broadcasts a room:update; wait for it so the next emit
    // sees the updated seat count.
    await once(host, 'room:update');
  }

  // Everyone declares ready, then the host starts.
  host.emit('room:ready', { ready: true });
  for (const g of humans) g.emit('room:ready', { ready: true });
  await new Promise((r) => setTimeout(r, 120));

  const dealt = once(host, 'hazari:yourHand');
  host.emit('room:start');
  await dealt;

  return { host, humans, roomCode, playerId: created.playerId! };
}

describe('hazari:requestSuggestionOptions over a real socket', () => {
  it('REFUSES a player who has three real human opponents', async () => {
    const { host } = await startGameOverSockets(3);

    const res = await emitWithAck<SuggestionOptionsAck>(
      host,
      'hazari:requestSuggestionOptions'
    );

    expect(res.ok).toBe(false);
    expect(res.options).toBeUndefined();
    expect(res.error).toMatch(/only available when you are playing against the computer/i);
  }, 20000);

  it('REFUSES a mixed room - one human opponent and two bots', async () => {
    const { host } = await startGameOverSockets(1);

    const res = await emitWithAck<SuggestionOptionsAck>(
      host,
      'hazari:requestSuggestionOptions'
    );

    expect(res.ok).toBe(false);
    expect(res.options).toBeUndefined();
  }, 20000);

  it('REFUSES the human opponent too, not just the host', async () => {
    const { humans } = await startGameOverSockets(2);

    const res = await emitWithAck<SuggestionOptionsAck>(
      humans[0],
      'hazari:requestSuggestionOptions'
    );

    expect(res.ok).toBe(false);
    expect(res.options).toBeUndefined();
  }, 20000);

  it('SUCCEEDS in a bot-only room and returns valid options', async () => {
    const { host } = await startGameOverSockets(0);

    const res = await emitWithAck<SuggestionOptionsAck>(
      host,
      'hazari:requestSuggestionOptions'
    );

    expect(res.ok).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.options!.length).toBeGreaterThan(0);

    for (const opt of res.options!) {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);
      // 3 + 3 + 3 + 4, all distinct.
      expect(opt.cardIdSets.map((s) => s.length)).toEqual([3, 3, 3, 4]);
      const flat = opt.cardIdSets.flat();
      expect(flat).toHaveLength(13);
      expect(new Set(flat).size).toBe(13);
    }
  }, 20000);

  it('returns only cards from the requesting player\'s own hand', async () => {
    const { host, roomCode, playerId } = await startGameOverSockets(0);

    const res = await emitWithAck<SuggestionOptionsAck>(
      host,
      'hazari:requestSuggestionOptions'
    );
    expect(res.ok).toBe(true);

    // Cross-check against the server's own record of this player's hand.
    const room = rooms.getRoomOrThrow(roomCode);
    const engine = asHazari(room.game)!;
    const myHandIds = new Set(engine.getPlayerHand(playerId).map((c) => c.id));

    for (const opt of res.options!) {
      for (const id of opt.cardIdSets.flat()) {
        expect(myHandIds.has(id), `${id} is not in the requesting player's hand`).toBe(true);
      }
    }
  }, 20000);

  it('the sibling hazari:requestSuggestion endpoint is gated identically', async () => {
    const { host } = await startGameOverSockets(2);

    const res = await emitWithAck<{ ok: boolean; error?: string; cardIdSets?: unknown }>(
      host,
      'hazari:requestSuggestion'
    );

    expect(res.ok).toBe(false);
    expect(res.cardIdSets).toBeUndefined();
  }, 20000);
});


describe('kitti:requestSuggestion over a real socket', () => {
  it('SUCCEEDS when every opponent is a bot and returns only the player\'s nine cards', async () => {
    const { host, roomCode, playerId } = await startKittiGameOverSockets(0, 2);

    const res = await emitWithAck<KittiSuggestionAck>(host, 'kitti:requestSuggestion');
    expect(res.ok, res.error).toBe(true);
    expect(res.cardIdGroups?.map((group) => group.length)).toEqual([3, 3, 3]);

    const flat = res.cardIdGroups!.flat();
    expect(flat).toHaveLength(9);
    expect(new Set(flat).size).toBe(9);

    const room = rooms.getRoomOrThrow(roomCode);
    const session = room.game;
    expect(session?.gameId).toBe('KITTI');
    const privateState = session!.getPrivateState(playerId) as { hand: { id: string }[] };
    const ownIds = new Set(privateState.hand.map((card) => card.id));
    for (const id of flat) expect(ownIds.has(id), `${id} is not in the requesting player's hand`).toBe(true);
  }, 20000);

  it('REFUSES a Kitti player when even one real human opponent is seated', async () => {
    const { host } = await startKittiGameOverSockets(1, 1);

    const res = await emitWithAck<KittiSuggestionAck>(host, 'kitti:requestSuggestion');
    expect(res.ok).toBe(false);
    expect(res.cardIdGroups).toBeUndefined();
    expect(res.error).toMatch(/only available when you are playing against the computer/i);
  }, 20000);

  it('REFUSES the human guest too in a mixed Kitti room', async () => {
    const { humans } = await startKittiGameOverSockets(1, 1);

    const res = await emitWithAck<KittiSuggestionAck>(humans[0], 'kitti:requestSuggestion');
    expect(res.ok).toBe(false);
    expect(res.cardIdGroups).toBeUndefined();
  }, 20000);
});
