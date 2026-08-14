import { describe, it, expect } from 'vitest';
import { RoomManager, RoomManagerError } from '../src/platform/rooms/roomManager.js';
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
  HazariSession,
  GameNotAvailableError,
} from '../src/platform/games/sessions.js';
import { HaazariGame } from '../src/games/hazari/gameEngine.js';
import { GAME_RULES } from '../src/games/hazari/rules.js';
import { KITTI_RULES } from '../src/games/kitti/rules.js';
import { TEEN_PATTI_RULES } from '../src/games/teenpatti/rules.js';

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
    expect(GAMES.TEEN_PATTI.cardsPerPlayer).toBe(TEEN_PATTI_RULES.CARDS_PER_PLAYER);
  });

  it('Teen Patti seats up to 9', () => {
    expect(maxPlayersFor('TEEN_PATTI')).toBe(9);
  });

  it('validates game ids', () => {
    expect(isGameId('HAZARI')).toBe(true);
    expect(isGameId('POKER')).toBe(false);
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

  it('refuses to create a room for a game with no controller', () => {
    const rooms = new RoomManager();
    expect(() => rooms.createRoom('Alice', 'KITTI')).toThrow(RoomManagerError);
    expect(() => rooms.createRoom('Alice', 'TEEN_PATTI')).toThrow(RoomManagerError);
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

describe('game session factory', () => {
  it('builds a Hazari session for a Hazari room', () => {
    const session = createGameSession('HAZARI', 'R1', ['a', 'b', 'c', 'd']);
    expect(session.gameId).toBe('HAZARI');
    expect(asHazari(session)).toBeInstanceOf(HaazariGame);
  });

  it('a non-Hazari room can never start a HaazariGame', () => {
    for (const gameId of ['KITTI', 'TEEN_PATTI'] as const) {
      expect(() => createGameSession(gameId, 'R1', ['a', 'b', 'c'])).toThrow(
        GameNotAvailableError
      );
    }
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
