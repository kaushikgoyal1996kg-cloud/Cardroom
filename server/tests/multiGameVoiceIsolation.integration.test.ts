// ============================================================================
// RELEASE 1 INTEGRATION - simultaneous Hazari + Kitti and table-scoped voice
//
// Proves the multi-game promise over real Socket.IO connections:
//   * a Hazari table and a Kitti table can be IN_GAME at the same time;
//   * each client receives only its own game's state/private cards;
//   * voice signalling cannot cross room boundaries;
//   * resetting a completed match to the lobby (Play Again) keeps the same
//     table's voice membership, so players do not have to rejoin the call.
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
  error?: string;
}

async function createRoom(socket: ClientSocket, name: string, gameId: 'HAZARI' | 'KITTI') {
  const ack = await emitWithAck<RoomAck>(socket, 'room:create', { playerName: name, gameId });
  expect(ack.ok, ack.error).toBe(true);
  return { roomCode: ack.roomCode!, playerId: ack.playerId! };
}

async function joinRoom(socket: ClientSocket, roomCode: string, name: string) {
  const ack = await emitWithAck<RoomAck>(socket, 'room:join', { roomCode, playerName: name });
  expect(ack.ok, ack.error).toBe(true);
  return { playerId: ack.playerId! };
}

async function waitBriefly(ms = 150) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('simultaneous games and voice isolation', () => {
  it('runs Hazari and Kitti together, isolates voice by table, and keeps the call through Play Again', async () => {
    const hazA = await connect();
    const hazB = await connect();
    const kitE = await connect();
    const kitF = await connect();

    const haz = await createRoom(hazA, 'A', 'HAZARI');
    const hazBSeat = await joinRoom(hazB, haz.roomCode, 'B');
    // Hazari needs exactly four seats. Its implemented bot controller can
    // safely fill the remaining two. Kitti bots are supported too, but this
    // particular test keeps E/F human so voice isolation is exercised on both tables.
    for (let i = 0; i < 2; i++) {
      const update = once(hazA, 'room:update');
      hazA.emit('room:addBot');
      await update;
    }

    const kit = await createRoom(kitE, 'E', 'KITTI');
    const kitFSeat = await joinRoom(kitF, kit.roomCode, 'F');

    // Each table can independently opt into a different virtual board. The
    // proposal and acceptance broadcasts must remain scoped to that room just
    // like cards/voice. Hazari's two bots auto-accept; Kitti's second human
    // accepts explicitly.
    let update = once<any>(hazA, 'room:update');
    hazA.emit('room:playMoneyPropose', { amount: 100 });
    await update;

    update = once<any>(hazB, 'room:update');
    hazB.emit('room:playMoneyAccept');
    await update;

    update = once<any>(kitE, 'room:update');
    kitE.emit('room:playMoneyPropose', { amount: 50 });
    await update;

    update = once<any>(kitF, 'room:update');
    kitF.emit('room:playMoneyAccept');
    await update;

    expect(rooms.getRoomOrThrow(haz.roomCode).playMoney.proposal?.amount).toBe(100);
    expect(rooms.getRoomOrThrow(kit.roomCode).playMoney.proposal?.amount).toBe(50);

    let hazSawKittiState = false;
    let kittiSawHazariState = false;
    hazA.on('kitti:state', () => { hazSawKittiState = true; });
    kitE.on('hazari:state', () => { kittiSawHazariState = true; });

    hazA.emit('room:ready', { ready: true });
    hazB.emit('room:ready', { ready: true });
    kitE.emit('room:ready', { ready: true });
    kitF.emit('room:ready', { ready: true });
    await waitBriefly();

    const hazHandA = once(hazA, 'hazari:yourHand');
    const hazHandB = once(hazB, 'hazari:yourHand');
    hazA.emit('room:start');
    await Promise.all([hazHandA, hazHandB]);

    const kitHandE = once(kitE, 'kitti:yourHand');
    const kitHandF = once(kitF, 'kitti:yourHand');
    kitE.emit('room:start');
    await Promise.all([kitHandE, kitHandF]);
    await waitBriefly();

    expect(hazSawKittiState).toBe(false);
    expect(kittiSawHazariState).toBe(false);
    expect(rooms.getRoomOrThrow(haz.roomCode)).toMatchObject({ gameId: 'HAZARI', status: 'IN_GAME' });
    expect(rooms.getRoomOrThrow(kit.roomCode)).toMatchObject({ gameId: 'KITTI', status: 'IN_GAME' });
    expect(rooms.getRoomOrThrow(haz.roomCode).game?.gameId).toBe('HAZARI');
    expect(rooms.getRoomOrThrow(kit.roomCode).game?.gameId).toBe('KITTI');
    expect(rooms.getRoomOrThrow(haz.roomCode).playMoney.activeMatch).toMatchObject({
      amount: 100,
      pot: 400,
      participantIds: expect.arrayContaining([haz.playerId, hazBSeat.playerId]),
      settled: false,
    });
    expect(rooms.getRoomOrThrow(kit.roomCode).playMoney.activeMatch).toMatchObject({
      amount: 50,
      pot: 100,
      participantIds: expect.arrayContaining([kit.playerId, kitFSeat.playerId]),
      settled: false,
    });
    // The two ledgers are room-local: Kitti's player ids never appear in the
    // Hazari ledger and vice versa.
    expect(rooms.getRoomOrThrow(haz.roomCode).playMoney.tableProfitLoss[kit.playerId]).toBeUndefined();
    expect(rooms.getRoomOrThrow(kit.roomCode).playMoney.tableProfitLoss[haz.playerId]).toBeUndefined();

    // Four humans join voice, but in two independent table calls.
    hazA.emit('voice:join');
    hazB.emit('voice:join');
    kitE.emit('voice:join');
    kitF.emit('voice:join');
    await waitBriefly();

    expect([...rooms.getRoomOrThrow(haz.roomCode).voiceCallParticipants].sort()).toEqual(
      [haz.playerId, hazBSeat.playerId].sort()
    );
    expect([...rooms.getRoomOrThrow(kit.roomCode).voiceCallParticipants].sort()).toEqual(
      [kit.playerId, kitFSeat.playerId].sort()
    );

    // Same-table signalling is delivered.
    const sameRoomSignal = once<{ fromPlayerId: string; data: unknown }>(hazB, 'voice:signal');
    hazA.emit('voice:signal', { toPlayerId: hazBSeat.playerId, data: { type: 'probe', value: 1 } });
    expect(await sameRoomSignal).toMatchObject({ fromPlayerId: haz.playerId, data: { type: 'probe', value: 1 } });

    // A playerId from another table is never a valid target in this room.
    let crossRoomSignalArrived = false;
    kitE.once('voice:signal', () => { crossRoomSignalArrived = true; });
    hazA.emit('voice:signal', { toPlayerId: kit.playerId, data: { type: 'should-not-cross' } });
    await waitBriefly(250);
    expect(crossRoomSignalArrived).toBe(false);

    // Simulate the authoritative end-of-match board settlement before the
    // Play Again reset. Settlement is idempotent and the room-session ledger
    // must survive even though the just-finished board itself is cleared.
    rooms.settlePlayMoney(haz.roomCode, haz.playerId);
    const settledLedger = { ...rooms.getRoomOrThrow(haz.roomCode).playMoney.tableProfitLoss };
    expect(settledLedger[haz.playerId]).toBe(300);
    expect(settledLedger[hazBSeat.playerId]).toBe(-100);

    // Simulate authoritative match completion, then exercise the REAL socket
    // Play Again handler. Voice membership must remain part of the room.
    const hazRoom = rooms.getRoomOrThrow(haz.roomCode);
    hazRoom.game = {
      gameId: 'HAZARI',
      state: 'GAME_COMPLETE',
      isComplete: () => true,
      getPublicState: () => ({}),
      getPrivateState: () => ({}),
    };
    const lobbyUpdate = once<any>(hazA, 'room:update');
    hazA.emit('room:playAgain');
    await lobbyUpdate;

    expect(rooms.getRoomOrThrow(haz.roomCode).status).toBe('LOBBY');
    expect(rooms.getRoomOrThrow(haz.roomCode).playMoney.activeMatch).toBeUndefined();
    expect(rooms.getRoomOrThrow(haz.roomCode).playMoney.tableProfitLoss).toEqual(settledLedger);
    expect([...rooms.getRoomOrThrow(haz.roomCode).voiceCallParticipants].sort()).toEqual(
      [haz.playerId, hazBSeat.playerId].sort()
    );

    // And the call remains usable after the reset - not merely listed in a Set.
    const afterPlayAgainSignal = once<{ fromPlayerId: string; data: unknown }>(hazB, 'voice:signal');
    hazA.emit('voice:signal', { toPlayerId: hazBSeat.playerId, data: { type: 'still-connected' } });
    expect(await afterPlayAgainSignal).toMatchObject({ fromPlayerId: haz.playerId, data: { type: 'still-connected' } });
  }, 20000);
});
