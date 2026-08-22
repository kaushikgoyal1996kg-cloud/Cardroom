import { describe, it, expect } from 'vitest';
import { RoomManager } from '../src/platform/rooms/roomManager.js';
import { AVATAR_OPTIONS, DEFAULT_AVATAR } from '../src/platform/rooms/avatars.js';
import { INACTIVITY_THRESHOLD_MS } from '../src/platform/rooms/sessionConfig.js';

/** Minimal stand-in for a running game, satisfying the GameSession boundary. */
function fakeSession(state: string) {
  return {
    gameId: 'HAZARI' as const,
    state,
    isComplete: () => state === 'GAME_COMPLETE',
    getPublicState: () => ({}),
    getPrivateState: () => ({}),
  };
}

describe('RoomManager avatars', () => {
  it('uses the requested avatar when it is a valid preset', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI', AVATAR_OPTIONS[3]);
    expect(room.players.get(playerId)!.avatar).toBe(AVATAR_OPTIONS[3]);
  });

  it('falls back to the default avatar when none is given', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    expect(room.players.get(playerId)!.avatar).toBe(DEFAULT_AVATAR);
  });

  it('falls back to the default avatar when an invalid value is given (never trust client input)', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI', '<script>evil()</script>');
    expect(room.players.get(playerId)!.avatar).toBe(DEFAULT_AVATAR);
  });

  it('applies the same validation on join as on create', () => {
    const rooms = new RoomManager();
    const created = rooms.createRoom('Alice', 'HAZARI', AVATAR_OPTIONS[0]);
    const joined = rooms.joinRoom(created.room.roomCode, 'Bob', 'not-a-real-avatar');
    expect(joined.room.players.get(joined.playerId)!.avatar).toBe(DEFAULT_AVATAR);
  });

  it('includes avatar in the public room broadcast shape', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI', AVATAR_OPTIONS[1]);
    const pub = rooms.toPublic(room);
    expect(pub.players.find((p) => p.playerId === playerId)!.avatar).toBe(AVATAR_OPTIONS[1]);
  });
});


describe('RoomManager reconnect seat identity', () => {
  it('waits the full 90 seconds, transfers an inactive host, and reclaims the same seat at a safe boundary', () => {
    const rooms = new RoomManager();
    const host = rooms.createRoom('Alice', 'KITTI');
    const bob = rooms.joinRoom(host.room.roomCode, 'Bob');
    rooms.bindSocket(host.room.roomCode, host.playerId, 'socket-a');
    rooms.bindSocket(host.room.roomCode, bob.playerId, 'socket-b');
    host.room.status = 'IN_GAME';

    rooms.markDisconnected(host.room.roomCode, host.playerId, 'socket-a');
    const disconnectedAt = host.room.players.get(host.playerId)!.disconnectedAt!;
    expect(rooms.transitionInactive(host.room.roomCode, host.playerId, disconnectedAt, disconnectedAt + INACTIVITY_THRESHOLD_MS - 1)).toBe(false);
    expect(host.room.hostId).toBe(host.playerId);

    expect(rooms.transitionInactive(host.room.roomCode, host.playerId, disconnectedAt, disconnectedAt + INACTIVITY_THRESHOLD_MS)).toBe(true);
    expect(host.room.players.get(host.playerId)).toMatchObject({ isBot: true, inactiveDisposition: 'BOT_SUBSTITUTE' });
    expect(host.room.hostId).toBe(bob.playerId);

    const restored = rooms.reconnect(host.token, 'socket-a-new');
    expect(restored.playerId).toBe(host.playerId);
    expect(host.room.players.get(host.playerId)).toMatchObject({ isBot: true, returnPending: true, connected: true });
    expect(rooms.activatePendingReturns(host.room.roomCode)).toEqual([host.playerId]);
    expect(host.room.players.get(host.playerId)).toMatchObject({ isBot: false, connected: true });
  });

  it('marks Teen Patti/Poker inactivity as sitting out without changing the reconnect identity', () => {
    for (const gameId of ['TEEN_PATTI', 'POKER'] as const) {
      const rooms = new RoomManager();
      const host = rooms.createRoom('Alice', gameId);
      const bob = rooms.joinRoom(host.room.roomCode, 'Bob');
      rooms.bindSocket(host.room.roomCode, bob.playerId, 'socket-b');
      host.room.status = 'IN_GAME';
      rooms.markDisconnected(host.room.roomCode, bob.playerId, 'socket-b');
      const disconnectedAt = host.room.players.get(bob.playerId)!.disconnectedAt!;
      rooms.transitionInactive(host.room.roomCode, bob.playerId, disconnectedAt, disconnectedAt + INACTIVITY_THRESHOLD_MS);
      expect(host.room.players.get(bob.playerId)).toMatchObject({ isBot: false, inactiveDisposition: 'SITTING_OUT' });
      expect(rooms.reconnect(bob.token, 'socket-b-new').playerId).toBe(bob.playerId);
      expect(host.room.players.get(bob.playerId)?.returnPending).toBe(true);
    }
  });

  it('lets the current host permanently convert an inactive Hazari/Kitti claim to an ordinary bot', () => {
    const rooms = new RoomManager();
    const host = rooms.createRoom('Alice', 'KITTI');
    const bob = rooms.joinRoom(host.room.roomCode, 'Bob');
    rooms.bindSocket(host.room.roomCode, bob.playerId, 'socket-b');
    host.room.status = 'IN_GAME';
    rooms.markDisconnected(host.room.roomCode, bob.playerId, 'socket-b');
    const disconnectedAt = host.room.players.get(bob.playerId)!.disconnectedAt!;
    rooms.transitionInactive(host.room.roomCode, bob.playerId, disconnectedAt, disconnectedAt + INACTIVITY_THRESHOLD_MS);
    rooms.removeInactiveBotClaim(host.room.roomCode, host.playerId, bob.playerId);
    expect(host.room.players.get(bob.playerId)).toMatchObject({ isBot: true, connected: false });
    expect(host.room.players.get(bob.playerId)?.inactiveDisposition).toBeUndefined();
    expect(() => rooms.reconnect(bob.token, 'socket-b-new')).toThrow(/invalid|expired/i);
  });

  it('reuses the same PlayerSlot and ignores a stale disconnect from the superseded socket', () => {
    const rooms = new RoomManager();
    const created = rooms.createRoom('Kaushik', 'HAZARI');
    rooms.bindSocket(created.room.roomCode, created.playerId, 'socket-old');

    const restored = rooms.reconnect(created.token, 'socket-new');
    expect(restored.playerId).toBe(created.playerId);
    expect(restored.previousSocketId).toBe('socket-old');
    expect(created.room.players.size).toBe(1);
    expect(created.room.players.get(created.playerId)).toMatchObject({
      name: 'Kaushik',
      connected: true,
      socketId: 'socket-new',
    });

    // An old transport can report disconnect after the new transport has
    // already restored the seat. That stale event must be ignored.
    rooms.markDisconnected(created.room.roomCode, created.playerId, 'socket-old');
    expect(created.room.players.get(created.playerId)).toMatchObject({
      connected: true,
      socketId: 'socket-new',
    });
  });

  it('drops lobby Ready on a real disconnect and will not start a human-only table until that seat is online and ready again', () => {
    const rooms = new RoomManager();
    const host = rooms.createRoom('Alice', 'KITTI');
    const bob = rooms.joinRoom(host.room.roomCode, 'Bob');
    rooms.bindSocket(host.room.roomCode, host.playerId, 'socket-alice');
    rooms.bindSocket(host.room.roomCode, bob.playerId, 'socket-bob');
    rooms.setReady(host.room.roomCode, host.playerId, true);
    rooms.setReady(host.room.roomCode, bob.playerId, true);

    rooms.markDisconnected(host.room.roomCode, bob.playerId, 'socket-bob');
    expect(host.room.players.get(bob.playerId)).toMatchObject({ connected: false, ready: false });
    expect(() => rooms.startGame(host.room.roomCode, host.playerId)).toThrow(/online/i);

    rooms.reconnect(bob.token, 'socket-bob-new');
    expect(host.room.players.get(bob.playerId)).toMatchObject({ connected: true, ready: false });
    expect(() => rooms.startGame(host.room.roomCode, host.playerId)).toThrow(/ready/i);

    rooms.setReady(host.room.roomCode, bob.playerId, true);
    expect(() => rooms.startGame(host.room.roomCode, host.playerId)).not.toThrow();
  });
});

describe('RoomManager.listOpenTables', () => {
  it('lists a freshly created room with an open seat', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Alice', 'HAZARI');
    const tables = rooms.listOpenTables();
    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ roomCode: room.roomCode, hostName: 'Alice', playerCount: 1, maxPlayers: 4 });
  });

  it('excludes a table once it is full', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Alice', 'HAZARI');
    rooms.joinRoom(room.roomCode, 'Bob');
    rooms.joinRoom(room.roomCode, 'Carol');
    rooms.joinRoom(room.roomCode, 'Dave');
    expect(rooms.listOpenTables()).toHaveLength(0);
  });

  it('keeps a live running table discoverable for spectators', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    rooms.joinRoom(room.roomCode, 'Bob');
    rooms.joinRoom(room.roomCode, 'Carol');
    rooms.joinRoom(room.roomCode, 'Dave');
    for (const p of room.players.values()) rooms.setReady(room.roomCode, p.playerId, true);
    rooms.startGame(room.roomCode, playerId);
    expect(rooms.listOpenTables()).toEqual([
      expect.objectContaining({ roomCode: room.roomCode, status: 'IN_GAME', visibility: 'LIVE' }),
    ]);
  });

  it('never lists a private table', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'KITTI');
    rooms.setVisibility(room.roomCode, playerId, 'PRIVATE');
    expect(rooms.listOpenTables()).toHaveLength(0);
  });

  it('lists multiple open tables, most recent first', async () => {
    const rooms = new RoomManager();
    const first = rooms.createRoom('Alice', 'HAZARI');
    await new Promise((r) => setTimeout(r, 5));
    const second = rooms.createRoom('Bob', 'HAZARI');
    const tables = rooms.listOpenTables();
    expect(tables.map((t) => t.roomCode)).toEqual([second.room.roomCode, first.room.roomCode]);
  });
});

describe('RoomManager live-table spectators', () => {
  it('allows a spectator on a running live table and keeps private tables closed', () => {
    const rooms = new RoomManager();
    const live = rooms.createRoom('Alice', 'KITTI');
    live.room.status = 'IN_GAME';
    const watched = rooms.watchRoom(live.room.roomCode, 'Watcher');
    expect(live.room.spectators.has(watched.spectatorId)).toBe(true);

    const privateRoom = rooms.createRoom('Bob', 'KITTI');
    privateRoom.room.status = 'IN_GAME';
    rooms.setVisibility(privateRoom.room.roomCode, privateRoom.playerId, 'PRIVATE');
    expect(() => rooms.watchRoom(privateRoom.room.roomCode, 'Watcher')).toThrow(/private/i);
  });

  it.each(['HAZARI', 'KITTI', 'TEEN_PATTI', 'POKER'] as const)(
    'lets a spectator reserve an ordinary %s bot seat only at the next safe boundary',
    (gameId) => {
      const rooms = new RoomManager();
      const host = rooms.createRoom('Alice', gameId);
      const bot = rooms.addBot(host.room.roomCode, host.playerId);
      host.room.status = 'IN_GAME';
      const watcher = rooms.watchRoom(host.room.roomCode, 'Carol');
      rooms.bindSpectatorSocket(host.room.roomCode, watcher.spectatorId, 'watch-socket');
      const claimed = rooms.claimBotSeat(host.room.roomCode, watcher.spectatorId, bot.playerId);
      expect(claimed.playerId).toBe(bot.playerId);
      expect(host.room.players.get(bot.playerId)).toMatchObject({ isBot: true, returnPending: true, connected: true });
      expect(rooms.activatePendingReturns(host.room.roomCode)).toEqual([bot.playerId]);
      expect(host.room.players.get(bot.playerId)).toMatchObject({ isBot: false, name: 'Carol' });
    },
  );

  it('never lets a spectator take the temporary bot protecting an inactive human seat', () => {
    const rooms = new RoomManager();
    const host = rooms.createRoom('Alice', 'POKER');
    const bob = rooms.joinRoom(host.room.roomCode, 'Bob');
    host.room.status = 'IN_GAME';
    rooms.markDisconnected(host.room.roomCode, bob.playerId);
    const disconnectedAt = host.room.players.get(bob.playerId)!.disconnectedAt!;
    rooms.transitionInactive(host.room.roomCode, bob.playerId, disconnectedAt, disconnectedAt + INACTIVITY_THRESHOLD_MS);
    // Poker inactivity sits the player out rather than presenting a bot seat.
    // Simulate the protected temporary-bot representation used by Hazari/Kitti
    // to prove that claimBotSeat itself enforces the protection for every game.
    const protectedSlot = host.room.players.get(bob.playerId)!;
    protectedSlot.isBot = true;
    protectedSlot.inactiveDisposition = 'BOT_SUBSTITUTE';
    const watcher = rooms.watchRoom(host.room.roomCode, 'Carol');
    expect(() => rooms.claimBotSeat(host.room.roomCode, watcher.spectatorId, bob.playerId)).toThrow(/not available/i);
  });
});

describe('RoomManager.resetToLobby (Play Again)', () => {
  it('resets a finished game back to LOBBY with the same players, bots stay ready', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    for (const p of room.players.values()) rooms.setReady(room.roomCode, p.playerId, true);
    rooms.startGame(room.roomCode, playerId);
    // Fake a finished game state for this unit test (full game completion is covered elsewhere).
    (room.game as any) = fakeSession('GAME_COMPLETE');

    rooms.resetToLobby(room.roomCode, playerId);
    expect(room.status).toBe('LOBBY');
    expect(room.game).toBeUndefined();
    expect(room.players.size).toBe(4);
    const host = room.players.get(playerId)!;
    expect(host.ready).toBe(false); // human reset to not-ready
    const bots = [...room.players.values()].filter((p) => p.isBot);
    expect(bots.every((b) => b.ready)).toBe(true); // bots stay auto-ready
  });

  it('refuses to reset if the game has not finished', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    for (const p of room.players.values()) rooms.setReady(room.roomCode, p.playerId, true);
    rooms.startGame(room.roomCode, playerId);
    (room.game as any) = fakeSession('PLAYING_SET_2');
    expect(() => rooms.resetToLobby(room.roomCode, playerId)).toThrow(/finished/);
  });

  it('only the host can trigger Play Again', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    const bob = rooms.joinRoom(room.roomCode, 'Bob');
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    for (const p of room.players.values()) rooms.setReady(room.roomCode, p.playerId, true);
    rooms.startGame(room.roomCode, playerId);
    (room.game as any) = fakeSession('GAME_COMPLETE');
    expect(() => rooms.resetToLobby(room.roomCode, bob.playerId)).toThrow(/host/);
  });
});

describe('RoomManager.quickMatch', () => {
  it('creates a fresh room when no open tables exist', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.quickMatch('Alice', 'HAZARI');
    expect(room.players.size).toBe(1);
    expect(room.hostId).toBe(playerId);
  });

  it('joins the most-full existing open table rather than creating a new one', () => {
    const rooms = new RoomManager();
    const empty = rooms.createRoom('Solo', 'HAZARI'); // 1 player
    const fuller = rooms.createRoom('Host2', 'HAZARI');
    rooms.joinRoom(fuller.room.roomCode, 'Bob'); // 2 players - closer to full

    const result = rooms.quickMatch('Carol', 'HAZARI');
    expect(result.room.roomCode).toBe(fuller.room.roomCode);
    expect(rooms.getRoom(empty.room.roomCode)!.players.size).toBe(1); // untouched
  });

  it('creates a new room once all existing tables are full', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Host', 'HAZARI');
    rooms.joinRoom(room.roomCode, 'P2');
    rooms.joinRoom(room.roomCode, 'P3');
    rooms.joinRoom(room.roomCode, 'P4'); // now full

    const result = rooms.quickMatch('Dave', 'HAZARI');
    expect(result.room.roomCode).not.toBe(room.roomCode);
    expect(result.room.players.size).toBe(1);
  });

  it('never joins a room whose game has already started', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Host', 'HAZARI');
    rooms.joinRoom(room.roomCode, 'P2');
    rooms.joinRoom(room.roomCode, 'P3');
    rooms.joinRoom(room.roomCode, 'P4');
    for (const p of room.players.values()) rooms.setReady(room.roomCode, p.playerId, true);
    rooms.startGame(room.roomCode, playerId);

    const result = rooms.quickMatch('Eve', 'HAZARI');
    expect(result.room.roomCode).not.toBe(room.roomCode);
  });
});

describe('RoomManager shared play-money board', () => {
  it('carries a Kitti Round Boot pot on a tie and opens a fresh pot after payout', () => {
    const rooms = new RoomManager();
    const host = rooms.createRoom('Alice', 'KITTI');
    const bob = rooms.joinRoom(host.room.roomCode, 'Bob');
    const bot = rooms.addBot(host.room.roomCode, host.playerId);
    rooms.proposePlayMoney(host.room.roomCode, host.playerId, 10, 'KITTI_ROUND_BOOT');
    rooms.acceptPlayMoney(host.room.roomCode, bob.playerId);
    for (const player of host.room.players.values()) rooms.setReady(host.room.roomCode, player.playerId, true);
    rooms.startGame(host.room.roomCode, host.playerId);
    rooms.beginPlayMoneyMatch(host.room.roomCode);

    expect(host.room.playMoney.activeMatch).toMatchObject({
      mode: 'KITTI_ROUND_BOOT', pot: 30, contributionRounds: 1, settled: false,
    });
    rooms.fundNextKittiBootRound(host.room.roomCode);
    expect(host.room.playMoney.activeMatch).toMatchObject({ pot: 60, contributionRounds: 2, settled: false });
    expect(host.room.playMoney.tableProfitLoss).toMatchObject({
      [host.playerId]: -20, [bob.playerId]: -20, [bot.playerId]: -20,
    });

    rooms.settlePlayMoney(host.room.roomCode, bob.playerId);
    expect(host.room.playMoney.tableProfitLoss[bob.playerId]).toBe(40);
    rooms.fundNextKittiBootRound(host.room.roomCode);
    expect(host.room.playMoney.activeMatch).toMatchObject({ pot: 30, contributionRounds: 1, settled: false });
    expect(host.room.playMoney.tableProfitLoss[bob.playerId]).toBe(30);
  });

  it('requires unanimous human acceptance, locks one contribution per seat, and settles the pot exactly once', () => {
    const rooms = new RoomManager();
    const host = rooms.createRoom('Alice', 'HAZARI');
    const bob = rooms.joinRoom(host.room.roomCode, 'Bob');
    const carol = rooms.joinRoom(host.room.roomCode, 'Carol');
    const dave = rooms.joinRoom(host.room.roomCode, 'Dave');

    rooms.proposePlayMoney(host.room.roomCode, host.playerId, 100);
    rooms.acceptPlayMoney(host.room.roomCode, bob.playerId);
    rooms.acceptPlayMoney(host.room.roomCode, carol.playerId);

    for (const p of host.room.players.values()) rooms.setReady(host.room.roomCode, p.playerId, true);
    expect(() => rooms.startGame(host.room.roomCode, host.playerId)).toThrow(/every human player must accept/i);

    rooms.acceptPlayMoney(host.room.roomCode, dave.playerId);
    rooms.startGame(host.room.roomCode, host.playerId);
    rooms.beginPlayMoneyMatch(host.room.roomCode);

    expect(host.room.playMoney.activeMatch).toMatchObject({ amount: 100, pot: 400, settled: false });
    expect(host.room.playMoney.proposal).toBeUndefined();
    for (const p of host.room.players.values()) {
      expect(host.room.playMoney.tableProfitLoss[p.playerId]).toBe(-100);
    }

    rooms.settlePlayMoney(host.room.roomCode, bob.playerId);
    expect(host.room.playMoney.activeMatch).toMatchObject({ settled: true, winnerId: bob.playerId });
    expect(host.room.playMoney.tableProfitLoss[bob.playerId]).toBe(300);
    expect(host.room.playMoney.tableProfitLoss[host.playerId]).toBe(-100);
    expect(host.room.playMoney.tableProfitLoss[carol.playerId]).toBe(-100);
    expect(host.room.playMoney.tableProfitLoss[dave.playerId]).toBe(-100);

    // Duplicate end-of-game broadcasts/retries must never award the pot twice.
    rooms.settlePlayMoney(host.room.roomCode, bob.playerId);
    expect(host.room.playMoney.tableProfitLoss[bob.playerId]).toBe(300);
    expect(Object.values(host.room.playMoney.tableProfitLoss).reduce((sum, value) => sum + value, 0)).toBe(0);
  });

  it('works for Kitti too, bots auto-accept, and declining removes the optional board without blocking normal play', () => {
    const rooms = new RoomManager();
    const host = rooms.createRoom('Alice', 'KITTI');
    const bob = rooms.joinRoom(host.room.roomCode, 'Bob');

    rooms.proposePlayMoney(host.room.roomCode, host.playerId, 50);
    expect(host.room.playMoney.proposal?.acceptedBy.has(host.playerId)).toBe(true);
    expect(host.room.playMoney.proposal?.acceptedBy.has(bob.playerId)).toBe(false);

    rooms.declinePlayMoney(host.room.roomCode, bob.playerId);
    expect(host.room.playMoney.proposal).toBeUndefined();

    rooms.setReady(host.room.roomCode, host.playerId, true);
    rooms.setReady(host.room.roomCode, bob.playerId, true);
    expect(() => rooms.startGame(host.room.roomCode, host.playerId)).not.toThrow();
    rooms.beginPlayMoneyMatch(host.room.roomCode);
    expect(host.room.playMoney.activeMatch).toBeUndefined();
    expect(host.room.playMoney.tableProfitLoss[host.playerId]).toBe(0);
    expect(host.room.playMoney.tableProfitLoss[bob.playerId]).toBe(0);
  });

  it('preserves the room-session P/L across Play Again while clearing the finished match board', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    rooms.proposePlayMoney(room.roomCode, playerId, 20); // bots auto-accept
    for (const p of room.players.values()) rooms.setReady(room.roomCode, p.playerId, true);
    rooms.startGame(room.roomCode, playerId);
    rooms.beginPlayMoneyMatch(room.roomCode);
    rooms.settlePlayMoney(room.roomCode, playerId);
    const ledgerBefore = { ...room.playMoney.tableProfitLoss };

    (room.game as any) = fakeSession('GAME_COMPLETE');
    rooms.resetToLobby(room.roomCode, playerId);

    expect(room.playMoney.proposal).toBeUndefined();
    expect(room.playMoney.activeMatch).toBeUndefined();
    expect(room.playMoney.tableProfitLoss).toEqual(ledgerBefore);
  });
});
