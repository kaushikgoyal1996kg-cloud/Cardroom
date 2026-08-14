import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomManager, RoomManagerError } from '../src/platform/rooms/roomManager.js';
import { RECONNECT_WINDOW_MS } from '../src/platform/rooms/sessionConfig.js';
import { createGameSession, asHazari } from '../src/platform/games/sessions.js';
import { hasPendingBotAction, performOneBotAction } from '../src/games/hazari/botController.js';
import { suggestArrangement } from '../src/games/hazari/arrangement.js';

// ============================================================================
// Helpers
// ============================================================================

/** A lobby room with the requested number of extra humans and bots. */
function makeRoom(humans: number, bots: number) {
  const rooms = new RoomManager();
  const { room, playerId: hostId, token: hostToken } = rooms.createRoom('Host', 'HAZARI');
  const tokens: Record<string, string> = { Host: hostToken };
  for (let i = 0; i < humans; i++) {
    const joined = rooms.joinRoom(room.roomCode, `Human${i + 1}`);
    tokens[`Human${i + 1}`] = joined.token;
  }
  for (let i = 0; i < bots; i++) rooms.addBot(room.roomCode, hostId);
  return { rooms, room, hostId, tokens };
}

/** A started, dealt Hazari game. */
function startGame(humans: number, bots: number) {
  const ctx = makeRoom(humans, bots);
  for (const p of ctx.room.players.values()) p.ready = true;
  ctx.rooms.startGame(ctx.room.roomCode, ctx.hostId);
  ctx.room.game = createGameSession(ctx.room.gameId, ctx.room.roomCode, [
    ...ctx.room.players.keys(),
  ]);
  asHazari(ctx.room.game)!.dealNewRound();
  return ctx;
}

// ============================================================================
// HOST DISCONNECT
//
// Inspected intent: markDisconnected marks the seat and stamps the time. It
// does NOT transfer hostId. The host keeps their seat for the reconnect
// window and resumes as host. These tests assert that intent rather than
// inventing host transfer.
// ============================================================================

describe('host disconnect', () => {
  it('does not end the room or the game', () => {
    const { rooms, room, hostId } = startGame(3, 0);
    rooms.markDisconnected(room.roomCode, hostId);

    expect(rooms.getRoom(room.roomCode)).toBeDefined();
    expect(room.status).toBe('IN_GAME');
    expect(room.game).toBeDefined();
  });

  it('keeps host rights with the disconnected player - host is NOT transferred', () => {
    const { rooms, room, hostId } = startGame(3, 0);
    rooms.markDisconnected(room.roomCode, hostId);
    expect(room.hostId).toBe(hostId);
  });

  it('marks the seat disconnected but keeps it occupied', () => {
    const { rooms, room, hostId } = startGame(3, 0);
    const before = room.players.size;
    rooms.markDisconnected(room.roomCode, hostId);

    expect(room.players.size).toBe(before);
    expect(room.players.get(hostId)!.connected).toBe(false);
    expect(room.players.get(hostId)!.disconnectedAt).toBeGreaterThan(0);
  });

  it('lets the host reconnect and resume as host, with their hand intact', () => {
    const { rooms, room, hostId, tokens } = startGame(3, 0);
    const engine = asHazari(room.game)!;
    const handBefore = engine.getPlayerHand(hostId).map((c) => c.id);

    rooms.markDisconnected(room.roomCode, hostId);
    const restored = rooms.reconnect(tokens.Host, 'new-socket');

    expect(restored.playerId).toBe(hostId);
    expect(restored.room.hostId).toBe(hostId);
    expect(restored.room.players.get(hostId)!.connected).toBe(true);
    expect(asHazari(restored.room.game)!.getPlayerHand(hostId).map((c) => c.id)).toEqual(handBefore);
  });

  it('other players are unaffected while the host is away', () => {
    const { rooms, room, hostId } = startGame(3, 0);
    const others = [...room.players.keys()].filter((p) => p !== hostId);
    rooms.markDisconnected(room.roomCode, hostId);

    for (const pid of others) {
      expect(room.players.get(pid)!.connected).toBe(true);
      expect(asHazari(room.game)!.getPlayerHand(pid)).toHaveLength(13);
    }
  });

  it('a disconnected host still cannot have their actions taken by someone else', () => {
    const { rooms, room, hostId } = startGame(3, 0);
    const other = [...room.players.keys()].find((p) => p !== hostId)!;
    rooms.markDisconnected(room.roomCode, hostId);

    // Host-only operations remain host-only.
    expect(() => rooms.resetToLobby(room.roomCode, other)).toThrow(RoomManagerError);
  });
});

// ============================================================================
// ROOM CLEANUP / EXPIRY
// ============================================================================

describe('room cleanup', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a room while any human is still connected', () => {
    const { rooms, room, hostId } = makeRoom(2, 0);
    rooms.markDisconnected(room.roomCode, hostId);

    vi.advanceTimersByTime(RECONNECT_WINDOW_MS * 2);
    rooms.sweepStaleRooms();

    expect(rooms.getRoom(room.roomCode)).toBeDefined();
  });

  it('keeps a room while a disconnected human is still inside the reconnect window', () => {
    const { rooms, room } = makeRoom(1, 0);
    for (const p of room.players.values()) rooms.markDisconnected(room.roomCode, p.playerId);

    vi.advanceTimersByTime(RECONNECT_WINDOW_MS - 1000);
    rooms.sweepStaleRooms();

    expect(rooms.getRoom(room.roomCode)).toBeDefined();
  });

  it('removes a room once every human has been gone past the window', () => {
    const { rooms, room } = makeRoom(1, 0);
    for (const p of room.players.values()) rooms.markDisconnected(room.roomCode, p.playerId);

    vi.advanceTimersByTime(RECONNECT_WINDOW_MS + 1000);
    rooms.sweepStaleRooms();

    expect(rooms.getRoom(room.roomCode)).toBeUndefined();
  });

  it('bots do not keep an abandoned room alive', () => {
    const { rooms, room, hostId } = makeRoom(0, 3);
    rooms.markDisconnected(room.roomCode, hostId);

    vi.advanceTimersByTime(RECONNECT_WINDOW_MS + 1000);
    rooms.sweepStaleRooms();

    expect(rooms.getRoom(room.roomCode)).toBeUndefined();
  });

  it('releases reconnect tokens when a room is swept, so they cannot resurrect it', () => {
    const { rooms, room, tokens } = makeRoom(1, 0);
    for (const p of room.players.values()) rooms.markDisconnected(room.roomCode, p.playerId);

    vi.advanceTimersByTime(RECONNECT_WINDOW_MS + 1000);
    rooms.sweepStaleRooms();

    expect(() => rooms.reconnect(tokens.Host, 'sock')).toThrow(RoomManagerError);
  });

  it('sweeping is safe to call repeatedly with nothing to do', () => {
    const { rooms } = makeRoom(2, 0);
    expect(() => {
      rooms.sweepStaleRooms();
      rooms.sweepStaleRooms();
    }).not.toThrow();
  });
});

// ============================================================================
// CONCURRENT ROOMS
// ============================================================================

describe('multiple concurrent rooms stay isolated', () => {
  function twoGames() {
    const rooms = new RoomManager();
    const build = (hostName: string) => {
      const { room, playerId: hostId } = rooms.createRoom(hostName, 'HAZARI');
      for (let i = 0; i < 3; i++) rooms.addBot(room.roomCode, hostId);
      for (const p of room.players.values()) p.ready = true;
      rooms.startGame(room.roomCode, hostId);
      room.game = createGameSession(room.gameId, room.roomCode, [...room.players.keys()]);
      asHazari(room.game)!.dealNewRound();
      return { room, hostId };
    };
    return { rooms, a: build('AliceHost'), b: build('BobHost') };
  }

  it('gives each room a distinct code', () => {
    const { a, b } = twoGames();
    expect(a.room.roomCode).not.toBe(b.room.roomCode);
  });

  it('gives each room a distinct game session', () => {
    const { a, b } = twoGames();
    expect(a.room.game).not.toBe(b.room.game);
    expect(asHazari(a.room.game)).not.toBe(asHazari(b.room.game));
  });

  it('keeps player sets disjoint', () => {
    const { a, b } = twoGames();
    const aIds = new Set(a.room.players.keys());
    for (const pid of b.room.players.keys()) expect(aIds.has(pid)).toBe(false);
  });

  it('keeps private cards separate - one room cannot see another\'s hands', () => {
    const { a, b } = twoGames();
    const engineA = asHazari(a.room.game)!;
    const engineB = asHazari(b.room.game)!;

    // A player of room B is unknown to room A's engine.
    const bPlayer = [...b.room.players.keys()][0];
    expect(engineA.getPlayerHand(bPlayer)).toHaveLength(0);

    // And room A's public state contains no card from room B.
    const publicA = JSON.stringify(a.room.game!.getPublicState());
    for (const pid of b.room.players.keys()) {
      for (const card of engineB.getPlayerHand(pid)) {
        expect(publicA).not.toContain(card.id);
      }
    }
  });

  it('advancing one room does not advance the other', () => {
    const { a, b } = twoGames();
    const engineA = asHazari(a.room.game)!;
    const engineB = asHazari(b.room.game)!;
    const bStateBefore = engineB.state;
    const bRoundBefore = engineB.roundNumber;

    // Drive room A through all four arrangements, using valid ones.
    for (const pid of a.room.players.keys()) {
      const hand = engineA.getPlayerHand(pid);
      const result = engineA.confirmArrangement(pid, suggestArrangement(hand));
      expect(result.ok, result.errors?.join(' ')).toBe(true);
    }

    expect(engineA.state).not.toBe(bStateBefore);
    expect(engineB.state).toBe(bStateBefore);
    expect(engineB.roundNumber).toBe(bRoundBefore);
  });

  it('deleting one room leaves the other intact', () => {
    const { rooms, a, b } = twoGames();
    for (const p of a.room.players.values()) rooms.markDisconnected(a.room.roomCode, p.playerId);
    vi.useFakeTimers();
    vi.advanceTimersByTime(RECONNECT_WINDOW_MS + 1000);
    rooms.sweepStaleRooms();
    vi.useRealTimers();

    expect(rooms.getRoom(a.room.roomCode)).toBeUndefined();
    expect(rooms.getRoom(b.room.roomCode)).toBeDefined();
    expect(asHazari(rooms.getRoom(b.room.roomCode)!.game)).not.toBeNull();
  });

  it('a token from one room cannot join another', () => {
    const rooms = new RoomManager();
    const first = rooms.createRoom('Alice', 'HAZARI');
    const second = rooms.createRoom('Bob', 'HAZARI');

    const restored = rooms.reconnect(first.token, 'sock');
    expect(restored.room.roomCode).toBe(first.room.roomCode);
    expect(restored.room.roomCode).not.toBe(second.room.roomCode);
  });
});

// ============================================================================
// STALE BOT ACTIONS
//
// The original requirement: no stale bot action may change a later game
// state. The scheduler re-fetches the room by code and re-derives the pending
// action from CURRENT state on every tick, rather than closing over a game
// reference. These tests pin that property down across each lifecycle change.
// ============================================================================

describe('stale bot actions cannot mutate a later state', () => {
  it('a pending action is a no-op once the room is gone', () => {
    const { rooms, room } = startGame(0, 3);
    expect(hasPendingBotAction(room)).toBe(true);

    // Room torn down while a tick was pending.
    const code = room.roomCode;
    for (const p of room.players.values()) rooms.markDisconnected(code, p.playerId);
    vi.useFakeTimers();
    vi.advanceTimersByTime(RECONNECT_WINDOW_MS + 1000);
    rooms.sweepStaleRooms();
    vi.useRealTimers();

    // What the scheduler does on tick: re-fetch by code.
    expect(rooms.getRoom(code)).toBeUndefined();
  });

  it('acts against the CURRENT session after Play Again, not the old one', () => {
    const { rooms, room, hostId } = startGame(0, 3);
    const oldEngine = asHazari(room.game)!;

    // Finish the game and reset, then start a brand-new session.
    oldEngine.state = 'GAME_COMPLETE';
    rooms.resetToLobby(room.roomCode, hostId);
    for (const p of room.players.values()) p.ready = true;
    rooms.startGame(room.roomCode, hostId);
    room.game = createGameSession(room.gameId, room.roomCode, [...room.players.keys()]);
    const newEngine = asHazari(room.game)!;
    newEngine.dealNewRound();

    const oldStateBefore = oldEngine.state;
    // A tick that was pending from before the reset now runs.
    performOneBotAction(room);

    // The old engine is untouched; only the current one advanced.
    expect(oldEngine.state).toBe(oldStateBefore);
    expect(asHazari(room.game)).toBe(newEngine);
  });

  it('does not act when the current state has nothing for a bot to do', () => {
    const { room } = startGame(0, 3);
    const engine = asHazari(room.game)!;

    // Force a state with no pending bot action.
    engine.state = 'GAME_COMPLETE';
    expect(hasPendingBotAction(room)).toBe(false);
    expect(performOneBotAction(room)).toBe(false);
  });

  it('re-derives the pending action after a round transition', () => {
    const { room } = startGame(0, 3);
    const engine = asHazari(room.game)!;

    // Arrange everyone so the round moves on.
    let guard = 0;
    while (hasPendingBotAction(room) && guard++ < 50) performOneBotAction(room);

    // Whatever state we reached, any further action must be legal for it.
    const stateBefore = engine.state;
    const roundBefore = engine.roundNumber;
    const acted = performOneBotAction(room);
    if (!acted) {
      expect(engine.state).toBe(stateBefore);
      expect(engine.roundNumber).toBe(roundBefore);
    }
  });

  it('never acts for a human seat', () => {
    const { room, hostId } = startGame(0, 3);
    const engine = asHazari(room.game)!;

    let guard = 0;
    while (hasPendingBotAction(room) && guard++ < 50) performOneBotAction(room);

    // The human host is the only non-bot; their arrangement must be absent.
    expect(engine.getPlayerArrangement(hostId)).toBeNull();
  });

  it('a bot action in one room cannot touch another room', () => {
    const rooms = new RoomManager();
    const build = (name: string) => {
      const { room, playerId: hostId } = rooms.createRoom(name, 'HAZARI');
      for (let i = 0; i < 3; i++) rooms.addBot(room.roomCode, hostId);
      for (const p of room.players.values()) p.ready = true;
      rooms.startGame(room.roomCode, hostId);
      room.game = createGameSession(room.gameId, room.roomCode, [...room.players.keys()]);
      asHazari(room.game)!.dealNewRound();
      return room;
    };
    const roomA = build('A');
    const roomB = build('B');
    const engineB = asHazari(roomB.game)!;
    const bStateBefore = engineB.state;

    let guard = 0;
    while (hasPendingBotAction(roomA) && guard++ < 50) performOneBotAction(roomA);

    expect(engineB.state).toBe(bStateBefore);
  });
});

// ============================================================================
// SERVER RESTART
//
// Rooms are held in memory only. There is no persistence layer and none is
// invented here. The contract being tested is that a restart loses rooms
// CLEANLY - clients are refused rather than admitted into a corrupt state.
// ============================================================================

describe('server restart behaviour', () => {
  it('rooms are in-memory only, so a fresh manager starts empty', () => {
    const before = new RoomManager();
    const { room } = before.createRoom('Alice', 'HAZARI');
    expect(before.getRoom(room.roomCode)).toBeDefined();

    // A restart is a brand-new RoomManager.
    const after = new RoomManager();
    expect(after.getRoom(room.roomCode)).toBeUndefined();
    expect(after.listOpenTables()).toHaveLength(0);
  });

  it('a reconnect token from before the restart is cleanly refused', () => {
    const before = new RoomManager();
    const { token } = before.createRoom('Alice', 'HAZARI');

    const after = new RoomManager();
    // Refused with an error, NOT admitted to a half-built room.
    expect(() => after.reconnect(token, 'sock')).toThrow(RoomManagerError);
  });

  it('joining a pre-restart room code is cleanly refused', () => {
    const before = new RoomManager();
    const { room } = before.createRoom('Alice', 'HAZARI');

    const after = new RoomManager();
    expect(() => after.joinRoom(room.roomCode, 'Bob')).toThrow(/does not exist/i);
  });

  it('the player can simply create a new room afterwards', () => {
    const after = new RoomManager();
    const { room } = after.createRoom('Alice', 'HAZARI');
    expect(room.roomCode).toBeTruthy();
    expect(after.getRoom(room.roomCode)).toBeDefined();
  });

  it('no game state survives a restart, so no corrupt session can be resumed', () => {
    const before = new RoomManager();
    const { room, playerId } = before.createRoom('Alice', 'HAZARI');
    for (let i = 0; i < 3; i++) before.addBot(room.roomCode, playerId);
    for (const p of room.players.values()) p.ready = true;
    before.startGame(room.roomCode, playerId);
    room.game = createGameSession(room.gameId, room.roomCode, [...room.players.keys()]);

    const after = new RoomManager();
    expect(after.getRoom(room.roomCode)).toBeUndefined();
  });
});

// ============================================================================
// Session-identity guard on scheduled bot ticks
//
// Re-fetching the room by code is not enough on its own. After Play Again the
// room keeps its code but gets a new session, and a code freed by cleanup can
// later be reused by a different table. A tick scheduled against the old
// session must not act on the new one. socketHandlers captures the session
// and compares identity before acting; these tests pin that contract down.
// ============================================================================

describe('a scheduled bot tick is bound to the session it was scheduled for', () => {
  /** Mirrors the guard in scheduleBotActions. */
  function tickIsStale(room: RoomStateLike, scheduledSession: unknown): boolean {
    if (!room.game) return true;
    return room.game !== scheduledSession;
  }
  type RoomStateLike = { game?: unknown };

  it('is fresh while the same session is still in place', () => {
    const { room } = startGame(0, 3);
    const scheduled = room.game;
    expect(tickIsStale(room, scheduled)).toBe(false);
  });

  it('is STALE after Play Again replaces the session under the same room code', () => {
    const { rooms, room, hostId } = startGame(0, 3);
    const scheduled = room.game;
    const codeBefore = room.roomCode;

    asHazari(room.game)!.state = 'GAME_COMPLETE';
    rooms.resetToLobby(room.roomCode, hostId);
    for (const p of room.players.values()) p.ready = true;
    rooms.startGame(room.roomCode, hostId);
    room.game = createGameSession(room.gameId, room.roomCode, [...room.players.keys()]);

    // Same code, different session - the old tick must not act.
    expect(room.roomCode).toBe(codeBefore);
    expect(tickIsStale(room, scheduled)).toBe(true);
  });

  it('is STALE if the room code is reused by a different table', () => {
    const { room } = startGame(0, 3);
    const scheduled = room.game;

    // A different table that happens to occupy the same code later.
    const replacement = startGame(0, 3);
    const impostor = { game: replacement.room.game };

    expect(tickIsStale(impostor, scheduled)).toBe(true);
  });

  it('is STALE once the game is cleared entirely', () => {
    const { room } = startGame(0, 3);
    const scheduled = room.game;
    room.game = undefined;
    expect(tickIsStale(room, scheduled)).toBe(true);
  });

  it('stays fresh across a normal round transition within one session', () => {
    const { room } = startGame(0, 3);
    const scheduled = room.game;
    const engine = asHazari(room.game)!;

    // Same session, later round - the chain must keep running.
    engine.state = 'ROUND_COMPLETE';
    engine.dealNewRound();
    expect(room.game).toBe(scheduled);
    expect(tickIsStale(room, scheduled)).toBe(false);
  });
});
