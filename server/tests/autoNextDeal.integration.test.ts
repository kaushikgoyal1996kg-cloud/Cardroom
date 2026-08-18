// ============================================================================
// STAGING REGRESSION — ongoing deals advance without a host button
//
// Real multiplayer QA found that the host had to press a Next/Deal control
// after each deal. That is not table flow: Hazari/Kitti/Teen Patti/Poker all
// advance automatically between ordinary rounds/hands. New matches remain
// explicit; required dealer-choice/top-up gates remain explicit.
// ============================================================================

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { Server as IOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../src/platform/rooms/roomManager.js';
import { registerSocketHandlers } from '../src/platform/net/socketHandlers.js';
import { HazariSession, KittiSession, PokerSession, TeenPattiSession } from '../src/platform/games/sessions.js';
import { suggestKittiArrangement } from '../src/games/kitti/arrangement.js';
import { suggestArrangement } from '../src/games/hazari/arrangement.js';
import { DEFAULT_TEEN_PATTI_TABLE_CONFIG } from '../src/games/teenpatti/rules.js';
import { DEFAULT_POKER_TABLE_CONFIG } from '../src/games/poker/rules.js';

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
      transports: ['websocket'], forceNew: true, reconnection: false,
    });
    clients.push(socket);
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

function waitFor<T>(socket: ClientSocket, event: string, predicate: (payload: T) => boolean, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`${event} matching state never arrived`));
    }, timeoutMs);
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

type RoomAck = { ok: boolean; roomCode?: string; playerId?: string };

async function makeTwoSeatRoom(gameId: 'KITTI' | 'TEEN_PATTI' | 'POKER') {
  const host = await connect();
  const guest = await connect();
  const created = await emitWithAck<RoomAck>(host, 'room:create', { playerName: 'Host', gameId });
  expect(created.ok).toBe(true);
  const joined = await emitWithAck<RoomAck>(guest, 'room:join', { roomCode: created.roomCode!, playerName: 'Guest' });
  expect(joined.ok).toBe(true);
  const room = rooms.getRoomOrThrow(created.roomCode!);
  room.status = 'IN_GAME';
  return {
    host, guest, room,
    hostId: created.playerId!, guestId: joined.playerId!,
    socketFor: (playerId: string) => playerId === created.playerId ? host : guest,
  };
}


async function makeHazariRoom() {
  const sockets = await Promise.all([connect(), connect(), connect(), connect()]);
  const created = await emitWithAck<RoomAck>(sockets[0], 'room:create', { playerName: 'P1', gameId: 'HAZARI' });
  expect(created.ok).toBe(true);
  const playerIds = [created.playerId!];
  for (let i = 1; i < sockets.length; i++) {
    const joined = await emitWithAck<RoomAck>(sockets[i], 'room:join', { roomCode: created.roomCode!, playerName: `P${i + 1}` });
    expect(joined.ok).toBe(true);
    playerIds.push(joined.playerId!);
  }
  const room = rooms.getRoomOrThrow(created.roomCode!);
  room.status = 'IN_GAME';
  const socketFor = (playerId: string) => sockets[playerIds.indexOf(playerId)];
  return { sockets, room, playerIds, socketFor };
}

describe('automatic ongoing deal flow', () => {
  it('Hazari deals the next round automatically after ROUND_COMPLETE', async () => {
    const ctx = await makeHazariRoom();
    const session = new HazariSession(ctx.room.roomCode, ctx.playerIds, ctx.playerIds[0]);
    ctx.room.game = session;
    const game = session.engine;
    game.dealNewRound();

    for (const playerId of ctx.playerIds) {
      const sets = suggestArrangement(game.getPlayerHand(playerId), game.cumulativeScores[playerId] ?? 0);
      ctx.socketFor(playerId).emit('hazari:confirmArrangement', {
        cardIdSets: sets.map((set) => set.map((card) => card.id)),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    let guard = 0;
    while (game.state !== 'ROUND_COMPLETE' && guard++ < 40) {
      const state = game.getPublicState();
      expect(state.currentPlayOrder).toBeTruthy();
      const played = new Set(state.playersPlayedThisSubRound);
      const next = state.currentPlayOrder!.find((playerId) => !played.has(playerId));
      expect(next).toBeTruthy();
      ctx.socketFor(next!).emit('hazari:playSet');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(game.state).toBe('ROUND_COMPLETE');

    const nextRound = await waitFor<{ roundNumber: number; state: string }>(
      ctx.sockets[0], 'hazari:state', (state) => state.roundNumber === 2 && state.state !== 'ROUND_COMPLETE',
    );
    expect(nextRound.roundNumber).toBe(2);
  }, 25000);

  it('Kitti deals the next scheduled round automatically after ROUND_COMPLETE', async () => {
    const ctx = await makeTwoSeatRoom('KITTI');
    const session = new KittiSession(ctx.room.roomCode, [ctx.hostId, ctx.guestId]);
    ctx.room.game = session;
    const game = session.engine;
    game.startMatch();

    for (const playerId of [ctx.hostId, ctx.guestId]) {
      expect(game.confirmArrangement(playerId, suggestKittiArrangement(game.getPlayerHand(playerId))).ok).toBe(true);
    }

    let guard = 0;
    while (game.state !== 'ROUND_COMPLETE' && guard++ < 12) {
      const state = game.getPublicState();
      expect(state.currentPlayOrder).toBeTruthy();
      const already = new Set(state.playersPlayedThisHand);
      const next = state.currentPlayOrder!.find((playerId) => !already.has(playerId));
      expect(next).toBeTruthy();
      ctx.socketFor(next!).emit('kitti:playHand');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(game.state).toBe('ROUND_COMPLETE');

    const nextRound = await waitFor<{ roundNumber: number; state: string }>(
      ctx.host, 'kitti:state', (state) => state.roundNumber === 2 && state.state !== 'ROUND_COMPLETE',
    );
    expect(nextRound.roundNumber).toBe(2);
  }, 20000);

  it('Teen Patti deals the next ordinary round automatically after the result', async () => {
    const ctx = await makeTwoSeatRoom('TEEN_PATTI');
    const session = new TeenPattiSession(
      ctx.room.roomCode,
      [ctx.hostId, ctx.guestId],
      DEFAULT_TEEN_PATTI_TABLE_CONFIG,
      { variantId: 'CLASSIC' },
      { mode: 'FIXED', fixedVariant: 'CLASSIC' },
    );
    ctx.room.game = session;
    const game = session.engine;
    game.startSession();

    const turn = game.currentTurn!;
    const completed = waitFor<{ state: string }>(ctx.host, 'teenpatti:state', (state) => state.state === 'ROUND_COMPLETE');
    ctx.socketFor(turn).emit('teenpatti:action', { action: { type: 'PACK' }, expectedSeq: game.sequence });
    await completed;

    const nextRound = await waitFor<{ roundNumber: number; state: string }>(
      ctx.host, 'teenpatti:state', (state) => state.roundNumber === 2 && state.state === 'BETTING',
    );
    expect(nextRound.roundNumber).toBe(2);
  }, 20000);

  it('Poker deals the next fixed-variant hand automatically after HAND_COMPLETE', async () => {
    const ctx = await makeTwoSeatRoom('POKER');
    const session = new PokerSession(ctx.room.roomCode, [ctx.hostId, ctx.guestId], DEFAULT_POKER_TABLE_CONFIG);
    ctx.room.game = session;
    const game = session.engine;
    game.dealHand();

    const turn = game.getPublicState().currentTurn!;
    const completed = waitFor<{ state: string }>(ctx.host, 'poker:state', (state) => state.state === 'HAND_COMPLETE');
    ctx.socketFor(turn).emit('poker:action', { action: { type: 'FOLD' }, expectedSeq: game.sequence });
    await completed;

    const nextHand = await waitFor<{ handNumber: number; state: string }>(
      ctx.host, 'poker:state', (state) => state.handNumber === 2 && state.state !== 'HAND_COMPLETE',
    );
    expect(nextHand.handNumber).toBe(2);
  }, 20000);
});
