import { describe, it, expect } from 'vitest';
import { RoomManager } from '../src/platform/rooms/roomManager.js';
import {
  GAMES,
  GAME_IDS,
  canStartWith,
  getGame,
  isGameId,
  maxPlayersFor,
} from '../src/platform/games/registry.js';
import {
  createGameSession,
  asHazari,
  asKitti,
  HazariSession,
  KittiSession,
  PokerSession,
  GameNotAvailableError,
} from '../src/platform/games/sessions.js';
import { HaazariGame } from '../src/games/hazari/gameEngine.js';
import { GAME_RULES } from '../src/games/hazari/rules.js';
import { KITTI_RULES } from '../src/games/kitti/rules.js';
import { TEEN_PATTI_RULES } from '../src/games/teenpatti/rules.js';
import { POKER_VARIANTS, DEFAULT_POKER_TABLE_CONFIG } from '../src/games/poker/rules.js';

// ============================================================================
// 1. The registry must not drift from each game's own rules module.
// ============================================================================

describe('game registry stays in sync with each engine', () => {
  it('Hazari limits match GAME_RULES', () => {
    expect(GAMES.HAZARI.maxPlayers).toBe(GAME_RULES.PLAYER_COUNT);
    expect(GAMES.HAZARI.minPlayers).toBe(GAME_RULES.PLAYER_COUNT);
    expect(GAMES.HAZARI.requiredPlayers).toBe(GAME_RULES.PLAYER_COUNT);
    expect(GAMES.HAZARI.cardsPerPlayer).toBe(GAME_RULES.CARDS_PER_PLAYER);
  });

  it('Kitti limits match KITTI_RULES', () => {
    expect(GAMES.KITTI.minPlayers).toBe(KITTI_RULES.MIN_PLAYERS);
    expect(GAMES.KITTI.maxPlayers).toBe(KITTI_RULES.MAX_PLAYERS);
    expect(GAMES.KITTI.cardsPerPlayer).toBe(KITTI_RULES.CARDS_PER_PLAYER);
  });

  it('Teen Patti limits match TEEN_PATTI_RULES', () => {
    expect(GAMES.TEEN_PATTI.minPlayers).toBe(TEEN_PATTI_RULES.MIN_PLAYERS);
    expect(GAMES.TEEN_PATTI.maxPlayers).toBe(TEEN_PATTI_RULES.MAX_PLAYERS);
    expect(TEEN_PATTI_RULES.CLASSIC_CARDS_PER_PLAYER).toBe(3);
    expect(GAMES.TEEN_PATTI.cardsPerPlayer).toBe('VARIES');
  });

  it('Teen Patti seats up to 9', () => {
    expect(maxPlayersFor('TEEN_PATTI')).toBe(9);
  });

  it('Poker limits match POKER_VARIANTS and Poker is network-playable', () => {
    expect(GAMES.POKER.minPlayers).toBe(Math.min(...Object.values(POKER_VARIANTS).map((variant) => variant.minPlayers)));
    expect(GAMES.POKER.maxPlayers).toBe(Math.max(...Object.values(POKER_VARIANTS).map((variant) => variant.maxPlayers)));
    expect(GAMES.POKER.cardsPerPlayer).toBe('VARIES');
    expect(GAMES.POKER.networkPlayable).toBe(true);
  });

  it('validates game ids', () => {
    expect(isGameId('HAZARI')).toBe(true);
    expect(isGameId('POKER')).toBe(true);
    expect(isGameId(undefined)).toBe(false);
    expect(() => getGame('NOPE' as never)).toThrow();
  });

  it('every registered id has a definition', () => {
    for (const id of GAME_IDS) expect(GAMES[id].id).toBe(id);
  });
});

describe('canStartWith enforces per-game counts', () => {
  it('Hazari needs exactly four', () => {
    expect(canStartWith('HAZARI', 4).ok).toBe(true);
    expect(canStartWith('HAZARI', 3).ok).toBe(false);
    expect(canStartWith('HAZARI', 5).ok).toBe(false);
  });

  it('Teen Patti accepts a range', () => {
    expect(canStartWith('TEEN_PATTI', 1).ok).toBe(false);
    expect(canStartWith('TEEN_PATTI', 2).ok).toBe(true);
    expect(canStartWith('TEEN_PATTI', 9).ok).toBe(true);
    expect(canStartWith('TEEN_PATTI', 10).ok).toBe(false);
  });

  it('Kitti accepts two to five', () => {
    expect(canStartWith('KITTI', 1).ok).toBe(false);
    expect(canStartWith('KITTI', 2).ok).toBe(true);
    expect(canStartWith('KITTI', 5).ok).toBe(true);
    expect(canStartWith('KITTI', 6).ok).toBe(false);
  });
});

// ============================================================================
// 2. Rooms record their game, and it is immutable.
// ============================================================================

describe('rooms are game-aware', () => {
  it('records the gameId a room was created with', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Alice', 'HAZARI');
    expect(room.gameId).toBe('HAZARI');
  });

  it('exposes the game in the public room info', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Alice', 'HAZARI');
    const pub = rooms.toPublic(room);
    expect(pub.gameId).toBe('HAZARI');
    expect(pub.maxPlayers).toBe(4);
    expect(pub.hostId).toBe(room.hostId);
  });

  it('exposes the game in table summaries', () => {
    const rooms = new RoomManager();
    rooms.createRoom('Alice', 'HAZARI');
    const tables = rooms.listOpenTables();
    expect(tables).toHaveLength(1);
    expect(tables[0].gameId).toBe('HAZARI');
    expect(tables[0].maxPlayers).toBe(4);
    expect(tables[0].status).toBe('LOBBY');
  });

  it('allows rooms for all four network-playable release games', () => {
    const rooms = new RoomManager();

    const { room: kitti } = rooms.createRoom('Alice', 'KITTI');
    expect(kitti.gameId).toBe('KITTI');
    expect(kitti.roomCode.startsWith('KIT')).toBe(true);

    const { room: teenPatti } = rooms.createRoom('Bob', 'TEEN_PATTI');
    expect(teenPatti.gameId).toBe('TEEN_PATTI');
    expect(teenPatti.roomCode.startsWith('TPT')).toBe(true);

    const { room: poker } = rooms.createRoom('Carol', 'POKER');
    expect(poker.gameId).toBe('POKER');
    expect(poker.roomCode.startsWith('PKR')).toBe(true);
  });

  it('there is no API to change a room\'s game after creation', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Alice', 'HAZARI');
    // No setter exists; the only mutation path would be reaching into state.
    const manager = rooms as unknown as Record<string, unknown>;
    const setters = Object.getOwnPropertyNames(Object.getPrototypeOf(rooms)).filter((m) =>
      /setGame|changeGame|switchGame/i.test(m)
    );
    expect(setters).toEqual([]);
    expect(room.gameId).toBe('HAZARI');
    expect(manager).toBeDefined();
  });
});

// ============================================================================
// 3. Seat limits come from the game, not a global constant.
// ============================================================================

describe('seat limits follow the room\'s game', () => {
  it('a Hazari room fills at four and rejects a fifth', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Host', 'HAZARI');
    rooms.joinRoom(room.roomCode, 'B');
    rooms.joinRoom(room.roomCode, 'C');
    rooms.joinRoom(room.roomCode, 'D');
    expect(room.players.size).toBe(4);
    expect(() => rooms.joinRoom(room.roomCode, 'E')).toThrow(/full/i);
  });

  it('allows a new seat into an already-running Teen Patti table but keeps other games lobby-only', () => {
    const rooms = new RoomManager();
    const { room: teenPatti } = rooms.createRoom('Host', 'TEEN_PATTI');
    teenPatti.status = 'IN_GAME';
    const joined = rooms.joinRoom(teenPatti.roomCode, 'Late Player');
    expect(joined.room.players.has(joined.playerId)).toBe(true);

    const { room: poker } = rooms.createRoom('Poker Host', 'POKER');
    poker.status = 'IN_GAME';
    expect(() => rooms.joinRoom(poker.roomCode, 'Late Poker')).toThrow(/already started/i);
  });

  it('quick match never crosses games', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Host', 'HAZARI');
    const result = rooms.quickMatch('Bob', 'HAZARI');
    // Only a Hazari table exists, so it joins that one.
    expect(result.room.roomCode).toBe(room.roomCode);
    expect(result.room.gameId).toBe('HAZARI');
  });

  it('table listing can be filtered by game', () => {
    const rooms = new RoomManager();
    rooms.createRoom('Host', 'HAZARI');
    expect(rooms.listOpenTables('HAZARI')).toHaveLength(1);
    expect(rooms.listOpenTables('TEEN_PATTI')).toHaveLength(0);
  });
});

// ============================================================================
// 4. The session factory, and the guarantee about HaazariGame.
// ============================================================================

describe('Poker session adapter', () => {
  it('adapts the authoritative engine for network play', () => {
    const session = new PokerSession('PKR1', ['a', 'b'], DEFAULT_POKER_TABLE_CONFIG);
    expect(session.gameId).toBe('POKER');
    expect(session.state).toBe('READY');
    expect(session.getPrivateState('a').holeCards).toEqual([]);
  });

  it('keeps preflop hole cards out of the public session state', () => {
    const session = new PokerSession('PKR2', ['a', 'b'], DEFAULT_POKER_TABLE_CONFIG);
    session.engine.dealHand();

    const mine = session.getPrivateState('a').holeCards;
    const theirs = session.getPrivateState('b').holeCards;
    const publicState = session.getPublicState();
    const serializedPublic = JSON.stringify(publicState);

    expect(mine).toHaveLength(2);
    expect(theirs).toHaveLength(2);
    expect(publicState.board).toEqual([]);
    for (const card of [...mine, ...theirs]) {
      expect(serializedPublic).not.toContain(card.id);
    }
  });
});

describe('game session factory', () => {
  it('builds a Hazari session for a Hazari room', () => {
    const session = createGameSession('HAZARI', 'R1', ['a', 'b', 'c', 'd']);
    expect(session.gameId).toBe('HAZARI');
    expect(asHazari(session)).toBeInstanceOf(HaazariGame);
  });

  it('builds Kitti without ever constructing Hazari, while Teen Patti requires approved setup', () => {
    const kitti = createGameSession('KITTI', 'KIT1', ['a', 'b', 'c']);
    expect(kitti).toBeInstanceOf(KittiSession);
    expect(kitti.gameId).toBe('KITTI');
    expect(asKitti(kitti)).not.toBeNull();
    expect(asHazari(kitti)).toBeNull();

    expect(() => createGameSession('TEEN_PATTI', 'TPT1', ['a', 'b', 'c'])).toThrow(
      GameNotAvailableError
    );
  });

  it('asHazari refuses to narrow a session of another game', () => {
    const notHazari = {
      gameId: 'TEEN_PATTI' as const,
      state: 'BETTING',
      isComplete: () => false,
      getPublicState: () => ({}),
      getPrivateState: () => ({}),
    };
    expect(asHazari(notHazari)).toBeNull();
    expect(asHazari(undefined)).toBeNull();
  });

  it('reports completion through the session boundary, not an engine string', () => {
    const session = new HazariSession('R1', ['a', 'b', 'c', 'd']);
    expect(session.isComplete()).toBe(false);
    session.engine.state = 'GAME_COMPLETE';
    expect(session.isComplete()).toBe(true);
  });
});

// ============================================================================
// 5. Starting a Hazari game through the new abstraction.
// ============================================================================

describe('starting a game through the controller abstraction', () => {
  function fillHazariRoom() {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Host', 'HAZARI');
    for (const n of ['B', 'C', 'D']) rooms.joinRoom(room.roomCode, n);
    for (const p of room.players.values()) p.ready = true;
    return { rooms, room, hostId: playerId };
  }

  it('starts, deals, and produces a live Hazari engine', () => {
    const { rooms, room } = fillHazariRoom();
    rooms.startGame(room.roomCode, room.hostId);
    room.game = createGameSession(room.gameId, room.roomCode, [...room.players.keys()]);

    const engine = asHazari(room.game)!;
    engine.dealNewRound();

    expect(room.status).toBe('IN_GAME');
    expect(engine.state).toBe('ARRANGING_HANDS');
    for (const pid of room.players.keys()) {
      expect(engine.getPlayerHand(pid)).toHaveLength(13);
    }
  });

  it('refuses to start a Hazari table with the wrong number of players', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Host', 'HAZARI');
    rooms.joinRoom(room.roomCode, 'B');
    for (const p of room.players.values()) p.ready = true;
    expect(() => rooms.startGame(room.roomCode, playerId)).toThrow(/exactly 4/i);
  });

  it('reconnection restores the same session and the right game', () => {
    const { rooms, room } = fillHazariRoom();
    const hostToken = [...room.players.values()][0].token;
    rooms.startGame(room.roomCode, room.hostId);
    room.game = createGameSession(room.gameId, room.roomCode, [...room.players.keys()]);
    asHazari(room.game)!.dealNewRound();

    rooms.markDisconnected(room.roomCode, room.hostId);
    const restored = rooms.reconnect(hostToken, 'new-socket');

    expect(restored.room.gameId).toBe('HAZARI');
    expect(restored.room.game).toBe(room.game);
    expect(asHazari(restored.room.game)).not.toBeNull();
    expect(asHazari(restored.room.game)!.getPlayerHand(restored.playerId)).toHaveLength(13);
  });
});

// ============================================================================
// 6. Privacy: the public surface must never carry anyone's cards.
// ============================================================================

describe('private card state stays private', () => {
  it('the session public state contains no player hands', () => {
    const session = new HazariSession('R1', ['a', 'b', 'c', 'd']);
    session.engine.dealNewRound();

    const serialised = JSON.stringify(session.getPublicState());
    for (const pid of ['a', 'b', 'c', 'd']) {
      for (const card of session.engine.getPlayerHand(pid)) {
        expect(serialised).not.toContain(card.id);
      }
    }
  });

  it('private state returns only the requesting player\'s own cards', () => {
    const session = new HazariSession('R1', ['a', 'b', 'c', 'd']);
    session.engine.dealNewRound();

    const mine = session.getPrivateState('a') as { hand: { id: string }[] };
    const myIds = new Set(mine.hand.map((c) => c.id));
    expect(myIds.size).toBe(13);

    for (const other of ['b', 'c', 'd']) {
      for (const card of session.engine.getPlayerHand(other)) {
        expect(myIds.has(card.id)).toBe(false);
      }
    }
  });

  it('the public room info never contains tokens', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Alice', 'HAZARI');
    const serialised = JSON.stringify(rooms.toPublic(room));
    for (const p of room.players.values()) {
      expect(serialised).not.toContain(p.token);
    }
  });
});

// ============================================================================
// 7. Game-agnostic active-seat release for open-ended game controllers.
// ============================================================================

describe('active-seat release boundary', () => {
  it('permanently releases an active seat and transfers host without knowing game rules', () => {
    const rooms = new RoomManager();
    const { room, playerId: hostId, token: hostToken } = rooms.createRoom('Host', 'KITTI');
    const second = rooms.joinRoom(room.roomCode, 'B');
    rooms.joinRoom(room.roomCode, 'C');
    for (const player of room.players.values()) player.ready = true;
    rooms.startGame(room.roomCode, hostId);
    room.game = createGameSession('KITTI', room.roomCode, [...room.players.keys()]);

    const remaining = rooms.releaseActiveSeat(room.roomCode, hostId)!;
    expect(remaining.players.has(hostId)).toBe(false);
    expect(remaining.hostId).toBe(second.playerId);
    // Open-ended Teen Patti/Poker histories can still reference a player after
    // their live seat is released. Preserve only public-safe identity data so
    // reconnecting tablemates see the real historical name, not a raw id or
    // generic “Former player” label.
    expect(rooms.toPublic(remaining).playerDirectory?.[hostId]).toMatchObject({ name: 'Host' });
    expect(() => rooms.reconnect(hostToken, 'stale-socket')).toThrow(/invalid|expired/i);
  });

  it('can reopen an open-ended active session as a lobby after its game controller ends it', () => {
    const rooms = new RoomManager();
    const { room, playerId: hostId } = rooms.createRoom('Host', 'KITTI');
    rooms.joinRoom(room.roomCode, 'B');
    for (const player of room.players.values()) player.ready = true;
    rooms.startGame(room.roomCode, hostId);
    room.game = createGameSession('KITTI', room.roomCode, [...room.players.keys()]);
    room.gameSetup = { opaque: true };

    const reopened = rooms.returnActiveSessionToLobby(room.roomCode);
    expect(reopened.status).toBe('LOBBY');
    expect(reopened.game).toBeUndefined();
    expect(reopened.gameSetup).toBeUndefined();
    expect([...reopened.players.values()].every((player) => player.ready === player.isBot)).toBe(true);
  });
});
