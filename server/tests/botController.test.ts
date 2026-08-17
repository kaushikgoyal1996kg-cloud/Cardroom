import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomManager } from '../src/platform/rooms/roomManager.js';
import { runBotActions } from '../src/games/hazari/botController.js';
import { HazariSession, asHazari } from '../src/platform/games/sessions.js';
import { HaazariGame } from '../src/games/hazari/gameEngine.js';
import { GAME_RULES } from '../src/games/hazari/rules.js';
import type { RoomState, PlayerSlot } from '../src/platform/rooms/types.js';
import type { PlayerId } from '../src/games/hazari/types.js';
import { isValidAvatar } from '../src/platform/rooms/avatars.js';

/** Reaches the Hazari engine behind a room's game session. */
function engineOf(room: RoomState) {
  const engine = asHazari(room.game);
  if (!engine) throw new Error('Room is not running a Hazari game');
  return engine;
}

describe('RoomManager bot methods', () => {
  it('addBot fills an empty seat, auto-ready, marked isBot', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Alice', 'HAZARI');
    const bot = rooms.addBot(room.roomCode, [...room.players.keys()][0]);
    expect(bot.isBot).toBe(true);
    expect(bot.ready).toBe(true);
    expect(room.players.size).toBe(2);
  });

  it('new computer seats use a valid Card Room avatar identity', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    const bot = rooms.addBot(room.roomCode, playerId);
    expect(isValidAvatar(bot.avatar)).toBe(true);
    expect(['🐆', '🦅', '🐺', '🐉', '🦉', '🐎', '🐂', '🦊']).toContain(bot.avatar);
  });

  it('does not duplicate a still-seated bot identity after remove then add', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    const first = rooms.addBot(room.roomCode, playerId);
    const second = rooms.addBot(room.roomCode, playerId);
    const third = rooms.addBot(room.roomCode, playerId);
    rooms.removeBot(room.roomCode, playerId, first.playerId);
    const replacement = rooms.addBot(room.roomCode, playerId);

    expect(replacement.name).not.toBe(second.name);
    expect(replacement.name).not.toBe(third.name);
    expect(replacement.avatar).not.toBe(second.avatar);
    expect(replacement.avatar).not.toBe(third.avatar);
    const botIdentities = [...room.players.values()]
      .filter((player) => player.isBot)
      .map((player) => `${player.name}:${player.avatar}`);
    expect(new Set(botIdentities).size).toBe(botIdentities.length);
  });

  it('only the host can add a bot', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom('Alice', 'HAZARI');
    const bob = rooms.joinRoom(room.roomCode, 'Bob');
    expect(() => rooms.addBot(room.roomCode, bob.playerId)).toThrow(/host/);
  });

  it('refuses to add a bot once the room is full', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    expect(room.players.size).toBe(4);
    expect(() => rooms.addBot(room.roomCode, playerId)).toThrow(/full/);
  });

  it('supports Kitti computer seats up to Kitti\'s five-player limit', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'KITTI');
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    rooms.addBot(room.roomCode, playerId);
    expect(room.players.size).toBe(5);
    expect([...room.players.values()].filter((player) => player.isBot)).toHaveLength(4);
    expect(() => rooms.addBot(room.roomCode, playerId)).toThrow(/full/);
  });

  it('new Kitti bots auto-accept an existing optional play-money board', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'KITTI');
    rooms.proposePlayMoney(room.roomCode, playerId, 50);
    const bot = rooms.addBot(room.roomCode, playerId);
    expect(room.playMoney.proposal?.acceptedBy.has(bot.playerId)).toBe(true);
    expect(bot.ready).toBe(true);
  });

  it('lets the host remove a Kitti bot in the lobby and cleans its play-money state', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'KITTI');
    rooms.proposePlayMoney(room.roomCode, playerId, 50);
    const bot = rooms.addBot(room.roomCode, playerId);
    expect(room.playMoney.proposal?.acceptedBy.has(bot.playerId)).toBe(true);

    rooms.removeBot(room.roomCode, playerId, bot.playerId);

    expect(room.players.has(bot.playerId)).toBe(false);
    expect(room.playMoney.proposal?.acceptedBy.has(bot.playerId)).toBe(false);
    expect(room.playMoney.tableProfitLoss[bot.playerId]).toBeUndefined();
  });

  it('never lets a non-host or an active game remove a bot seat', () => {
    const rooms = new RoomManager();
    const { room, playerId: hostId } = rooms.createRoom('Alice', 'KITTI');
    const bob = rooms.joinRoom(room.roomCode, 'Bob');
    const bot = rooms.addBot(room.roomCode, hostId);
    expect(() => rooms.removeBot(room.roomCode, bob.playerId, bot.playerId)).toThrow(/host/i);

    for (const player of room.players.values()) player.ready = true;
    rooms.startGame(room.roomCode, hostId);
    expect(() => rooms.removeBot(room.roomCode, hostId, bot.playerId)).toThrow(/before the game starts/i);
  });

  it('convertToBot marks a seat bot-controlled and invalidates its reconnect token', () => {
    const rooms = new RoomManager();
    const { room, playerId, token } = rooms.createRoom('Alice', 'HAZARI');
    rooms.convertToBot(room.roomCode, playerId);
    expect(room.players.get(playerId)!.isBot).toBe(true);
    expect(() => rooms.reconnect(token, 'new-socket')).toThrow();
  });

  it('transfers room-host controls to a remaining human when the host permanently leaves to a bot', () => {
    const rooms = new RoomManager();
    const { room, playerId: hostId } = rooms.createRoom('Alice', 'KITTI');
    const second = rooms.joinRoom(room.roomCode, 'Bob');
    rooms.addBot(room.roomCode, hostId);

    rooms.convertToBot(room.roomCode, hostId);

    expect(room.players.get(hostId)?.isBot).toBe(true);
    expect(room.hostId).toBe(second.playerId);
    expect(room.players.get(second.playerId)?.isBot).toBe(false);
  });

  it('does not invent a bot-to-bot host transfer when the departing host is the only human', () => {
    const rooms = new RoomManager();
    const { room, playerId: hostId } = rooms.createRoom('Alice', 'KITTI');
    rooms.addBot(room.roomCode, hostId);

    rooms.convertToBot(room.roomCode, hostId);

    // No human remains to receive UI authority; the abandoned all-bot room is
    // eligible for stale-room cleanup instead.
    expect(room.hostId).toBe(hostId);
    expect([...room.players.values()].every((player) => player.isBot)).toBe(true);
  });

  it('sweepStaleRooms ignores bots when deciding if a room is abandoned', () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.createRoom('Alice', 'HAZARI');
    rooms.addBot(room.roomCode, playerId);
    rooms.markDisconnected(room.roomCode, playerId);
    room.players.get(playerId)!.disconnectedAt = Date.now() - GAME_RULES.RECONNECT_WINDOW_MS - 1000;
    rooms.sweepStaleRooms();
    expect(rooms.getRoom(room.roomCode)).toBeUndefined();
  });
});

describe('runBotActions - full bots-only game simulation', () => {
  beforeEach(() => {
    GAME_RULES.TEST_MODE = false;
  });
  afterEach(() => {
    GAME_RULES.TEST_MODE = false;
  });

  function makeAllBotRoom(): RoomState {
    const playerIds: PlayerId[] = ['bot1', 'bot2', 'bot3', 'bot4'];
    const players = new Map<PlayerId, PlayerSlot>(
      playerIds.map((id) => [
        id,
        {
          playerId: id,
          token: `tok-${id}`,
          name: id,
          avatar: '🦁',
          connected: true,
          ready: true,
          isBot: true,
        },
      ])
    );
    const session = new HazariSession('TESTROOM', playerIds, 'bot1');
    const game = session.engine;
    game.dealNewRound();
    return {
      roomCode: 'TESTROOM',
      hostId: 'bot1',
      players,
      status: 'IN_GAME',
      gameId: 'HAZARI',
      game: session,
      createdAt: Date.now(),
      voiceCallParticipants: new Set(),
      playMoney: { tableProfitLoss: Object.fromEntries(playerIds.map((id) => [id, 0])) },
    };
  }

  it('plays entire rounds - arranging and every sub-round - without any human input', () => {
    const room = makeAllBotRoom();
    const acted = runBotActions(room);
    expect(acted).toBe(true);
    expect(['ROUND_COMPLETE', 'GAME_COMPLETE']).toContain(room.game!.state);
    expect(engineOf(room).roundHistory.length).toBeGreaterThanOrEqual(1);
  });

  it('plays a complete multi-round game to a valid 1000+ winner, fully bot-driven', () => {
    const room = makeAllBotRoom();
    let rounds = 0;
    const MAX_ROUNDS = 20;

    while (room.game!.state !== 'GAME_COMPLETE' && rounds < MAX_ROUNDS) {
      runBotActions(room);
      rounds++;
      if (room.game!.state === 'ROUND_COMPLETE' || room.game!.state === 'DISMISSED_ROUND') {
        engineOf(room).dealNewRound();
        runBotActions(room);
      }
    }

    expect(room.game!.state).toBe('GAME_COMPLETE');
    const winner = engineOf(room).getWinner();
    expect(winner).not.toBeNull();
    expect(engineOf(room).cumulativeScores[winner!]).toBeGreaterThanOrEqual(GAME_RULES.WINNING_SCORE);

    for (const pid of Object.keys(engineOf(room).cumulativeScores)) {
      if (pid !== winner) {
        expect(engineOf(room).cumulativeScores[winner!]).toBeGreaterThan(engineOf(room).cumulativeScores[pid]);
      }
    }
  });

  it('is a no-op when there are no bots in the room', () => {
    const playerIds: PlayerId[] = ['h1', 'h2', 'h3', 'h4'];
    const players = new Map<PlayerId, PlayerSlot>(
      playerIds.map((id) => [
        id,
        { playerId: id, token: `tok-${id}`, name: id, avatar: '🦁', connected: true, ready: true, isBot: false },
      ])
    );
    const session = new HazariSession('R2', playerIds, 'h1');
    const game = session.engine;
    game.dealNewRound();
    const room: RoomState = { roomCode: 'R2', gameId: 'HAZARI', hostId: 'h1', players, status: 'IN_GAME', game: session, createdAt: Date.now(), voiceCallParticipants: new Set(), playMoney: { tableProfitLoss: Object.fromEntries(playerIds.map((id) => [id, 0])) } };
    const acted = runBotActions(room);
    expect(acted).toBe(false);
    expect(room.game!.state).toBe('ARRANGING_HANDS');
  });

  it("arranges a Hazari bot strictly from that bot's own 13 cards and never arranges the human seat", () => {
    const rooms = new RoomManager();
    const { room, playerId: humanId } = rooms.createRoom('Human', 'HAZARI');
    const bots = [
      rooms.addBot(room.roomCode, humanId),
      rooms.addBot(room.roomCode, humanId),
      rooms.addBot(room.roomCode, humanId),
    ];
    for (const player of room.players.values()) player.ready = true;
    rooms.startGame(room.roomCode, humanId);
    const session = new HazariSession(room.roomCode, [...room.players.keys()], humanId);
    room.game = session;
    session.engine.dealNewRound();

    const firstBot = bots[0];
    const botHandIds = new Set(session.engine.getPlayerHand(firstBot.playerId).map((card) => card.id));
    const acted = runBotActions(room);
    expect(acted).toBe(true);
    const arranged = session.engine.getPlayerArrangement(firstBot.playerId);
    expect(arranged).not.toBeNull();
    expect(arranged!.flat()).toHaveLength(13);
    expect(arranged!.flat().every((card) => botHandIds.has(card.id))).toBe(true);
    expect(session.engine.getPlayerArrangement(humanId)).toBeNull();
  });

  it('a mid-game leave-table conversion lets the bot immediately continue for that seat', () => {
    const playerIds: PlayerId[] = ['h1', 'h2', 'h3', 'h4'];
    const players = new Map<PlayerId, PlayerSlot>(
      playerIds.map((id) => [
        id,
        { playerId: id, token: `tok-${id}`, name: id, avatar: '🦁', connected: true, ready: true, isBot: false },
      ])
    );
    const session = new HazariSession('R3', playerIds, 'h1');
    const game = session.engine;
    game.dealNewRound();
    const room: RoomState = { roomCode: 'R3', gameId: 'HAZARI', hostId: 'h1', players, status: 'IN_GAME', game: session, createdAt: Date.now(), voiceCallParticipants: new Set(), playMoney: { tableProfitLoss: Object.fromEntries(playerIds.map((id) => [id, 0])) } };

    players.get('h1')!.isBot = true;
    const acted = runBotActions(room);
    expect(acted).toBe(true);
    expect(game.getPlayerArrangement('h1')).not.toBeNull();
    expect(game.getPlayerArrangement('h2')).toBeNull();
  });
});

describe('Kitti bot controller', () => {
  it('arranges and plays bot seats without touching the human hand', async () => {
    const { KittiSession } = await import('../src/platform/games/sessions.js');
    const { runKittiBotActions } = await import('../src/games/kitti/botController.js');

    const ids = ['human', 'bot1'];
    const players = new Map<PlayerId, PlayerSlot>([
      ['human', { playerId: 'human', token: 'tok-human', name: 'Human', avatar: '🦁', connected: true, ready: true, isBot: false }],
      ['bot1', { playerId: 'bot1', token: 'tok-bot1', name: 'Bot', avatar: '🐯', connected: true, ready: true, isBot: true }],
    ]);
    const session = new KittiSession('KITBOT', ids);
    session.engine.startMatch();
    const room: RoomState = {
      roomCode: 'KITBOT',
      gameId: 'KITTI',
      hostId: 'human',
      players,
      status: 'IN_GAME',
      game: session,
      createdAt: Date.now(),
      voiceCallParticipants: new Set(),
      playMoney: { tableProfitLoss: { human: 0, bot1: 0 } },
    };

    const acted = runKittiBotActions(room);
    expect(acted).toBe(true);
    expect(session.engine.getPlayerGroups('bot1')).not.toBeNull();
    expect(session.engine.getPlayerGroups('human')).toBeNull();
    // The controller must stop at the human decision boundary rather than
    // playing/arranging a real player's cards for them.
    expect(['ARRANGING', 'WAITING_FOR_ARRANGEMENTS']).toContain(session.engine.state);
  });

  it('runs a full five-seat Kitti round with one human and four bots', async () => {
    const { KittiSession } = await import('../src/platform/games/sessions.js');
    const { runKittiBotActions } = await import('../src/games/kitti/botController.js');
    const { suggestKittiArrangement } = await import('../src/games/kitti/arrangement.js');

    const ids = ['human', 'b1', 'b2', 'b3', 'b4'];
    const players = new Map<PlayerId, PlayerSlot>(ids.map((id) => [
      id,
      { playerId: id, token: `tok-${id}`, name: id, avatar: '🦁', connected: true, ready: true, isBot: id !== 'human' },
    ]));
    const session = new KittiSession('KITMAXBOT', ids);
    session.engine.startMatch();
    const room: RoomState = {
      roomCode: 'KITMAXBOT',
      gameId: 'KITTI',
      hostId: 'human',
      players,
      status: 'IN_GAME',
      game: session,
      createdAt: Date.now(),
      voiceCallParticipants: new Set(),
      playMoney: { tableProfitLoss: Object.fromEntries(ids.map((id) => [id, 0])) },
    };

    // Bots arrange only their own hands and stop at the human decision.
    runKittiBotActions(room);
    expect(session.engine.getPlayerGroups('human')).toBeNull();
    for (const botId of ids.slice(1)) expect(session.engine.getPlayerGroups(botId)).not.toBeNull();

    const humanGroups = suggestKittiArrangement(session.engine.getPlayerHand('human'));
    expect(session.engine.confirmArrangement('human', humanGroups).ok).toBe(true);

    // Whenever it becomes the human's turn, make that one legal human action;
    // between those turns the controller must autonomously advance every bot.
    let safety = 0;
    while (!['ROUND_COMPLETE', 'MATCH_COMPLETE'].includes(session.engine.state) && safety < 100) {
      runKittiBotActions(room);
      const state = session.engine.getPublicState();
      const next = state.currentPlayOrder?.[state.playersPlayedThisHand.length];
      if (next === 'human') {
        if (session.engine.state === 'PLAYING_DECIDER') session.engine.playDecider('human');
        else session.engine.playCurrentHand('human');
      }
      safety++;
    }

    expect(['ROUND_COMPLETE', 'MATCH_COMPLETE']).toContain(session.engine.state);
    expect(session.engine.roundHistory).toHaveLength(1);
    expect(safety).toBeLessThan(100);
  });

  it('can drive an all-bot Kitti round to completion', async () => {
    const { KittiSession } = await import('../src/platform/games/sessions.js');
    const { runKittiBotActions } = await import('../src/games/kitti/botController.js');

    const ids = ['b1', 'b2', 'b3'];
    const players = new Map<PlayerId, PlayerSlot>(ids.map((id) => [
      id,
      { playerId: id, token: `tok-${id}`, name: id, avatar: '🦁', connected: true, ready: true, isBot: true },
    ]));
    const session = new KittiSession('KITALLBOT', ids);
    session.engine.startMatch();
    const room: RoomState = {
      roomCode: 'KITALLBOT',
      gameId: 'KITTI',
      hostId: 'b1',
      players,
      status: 'IN_GAME',
      game: session,
      createdAt: Date.now(),
      voiceCallParticipants: new Set(),
      playMoney: { tableProfitLoss: Object.fromEntries(ids.map((id) => [id, 0])) },
    };

    expect(runKittiBotActions(room)).toBe(true);
    expect(['ROUND_COMPLETE', 'MATCH_COMPLETE']).toContain(session.engine.state);
    expect(session.engine.roundHistory).toHaveLength(1);
  });
});
