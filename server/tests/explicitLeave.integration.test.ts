// ============================================================================
// STAGING REGRESSION — explicit lobby Leave must be permanent
//
// Real-device staging bug: a player tapped Leave, but cousins still saw that
// player in the lobby. A transient disconnect is allowed a reconnect grace
// period; an explicit Leave is not. This real Socket.IO test proves the seat,
// reconnect token and room subscription all disappear before the leave ack.
// ============================================================================

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { Server as IOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
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
  for (const client of openClients) client.disconnect();
  await new Promise<void>((resolve) => ioServer.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function connect(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'], forceNew: true, reconnection: false,
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

type RoomAck = {
  ok: boolean;
  roomCode?: string;
  playerId?: string;
  token?: string;
};

type PublicRoom = {
  players: Array<{ playerId: string; name: string }>;
};

describe('explicit room:leave over a real socket', () => {
  it('removes the lobby seat/token/subscription before acknowledging success', async () => {
    const host = await connect();
    const guest = await connect();

    const created = await emitWithAck<RoomAck>(host, 'room:create', {
      playerName: 'Host', gameId: 'HAZARI',
    });
    expect(created.ok).toBe(true);

    const joinedUpdate = once<PublicRoom>(host, 'room:update');
    const joined = await emitWithAck<RoomAck>(guest, 'room:join', {
      roomCode: created.roomCode!, playerName: 'Guest',
    });
    expect(joined.ok).toBe(true);
    await joinedUpdate;

    const leaveUpdate = once<PublicRoom>(host, 'room:update');
    const leave = await emitWithAck<{ ok: boolean; error?: string }>(guest, 'room:leave');
    expect(leave).toEqual({ ok: true });

    const publicAfterLeave = await leaveUpdate;
    expect(publicAfterLeave.players.map((player) => player.playerId)).not.toContain(joined.playerId);
    expect(publicAfterLeave.players.map((player) => player.name)).not.toContain('Guest');

    const authoritative = rooms.getRoomOrThrow(created.roomCode!);
    expect(authoritative.players.has(joined.playerId!)).toBe(false);
    expect(() => rooms.reconnect(joined.token!, 'replacement-socket')).toThrow(/invalid|expired/i);

    const socketMembers = await ioServer.in(created.roomCode!).fetchSockets();
    expect(socketMembers.some((member) => member.id === guest.id)).toBe(false);
  }, 20000);
});
