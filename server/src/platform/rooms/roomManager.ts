import { customAlphabet } from 'nanoid';
import type { PlayerId, PlayerSlot, PublicPlayerInfo, PublicRoomInfo, RoomState, TableSummary } from './types.js';
import { DEFAULT_AVATAR, isValidAvatar } from './avatars.js';
import { RECONNECT_WINDOW_MS } from './sessionConfig.js';
import { canStartWith, getGame, maxPlayersFor, type GameId } from '../games/registry.js';

// Room codes look like "HZR482" - a fixed "HZR" prefix + 3 random digits/letters
// (Section 28 example). Excludes ambiguous chars (0/O, 1/I).
const codeSuffix = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 3);
const playerIdGen = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 12);
const tokenGen = customAlphabet('23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ', 32);

const BOT_NAMES = ['Raja', 'Rani', 'Nawab', 'Maharani', 'Sultan', 'Begum', 'Vazir', 'Zamindar'];
const BOT_AVATARS = ['🦁', '🐯', '🦜', '🐍', '🪷', '🔱', '🎭', '⭐'];

export class RoomManagerError extends Error {}

/**
 * In-memory room registry. One process = one authoritative source of truth
 * for all currently-active rooms. (A production deployment with multiple
 * server instances would back this with shared storage - out of scope for
 * this reference implementation, called out explicitly rather than silently
 * assumed away.)
 */
export class RoomManager {
  private rooms = new Map<string, RoomState>();
  /** token -> {roomCode, playerId} for fast reconnect lookups. */
  private tokenIndex = new Map<string, { roomCode: string; playerId: PlayerId }>();

  private generateRoomCode(): string {
    let code: string;
    do {
      code = `HZR${codeSuffix()}`;
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Creates a new room for a specific game. The creator becomes the host.
   * The game is fixed here and can never be changed afterwards.
   */
  createRoom(
    hostName: string,
    gameId: GameId,
    avatar?: string
  ): { room: RoomState; playerId: PlayerId; token: string } {
    const definition = getGame(gameId);
    if (!definition.networkPlayable) {
      throw new RoomManagerError(
        definition.unavailableReason ?? `${definition.name} is not available online yet.`
      );
    }
    const roomCode = this.generateRoomCode();
    const playerId = playerIdGen();
    const token = tokenGen();

    const hostSlot: PlayerSlot = {
      playerId,
      token,
      name: hostName,
      avatar: isValidAvatar(avatar) ? avatar : DEFAULT_AVATAR,
      connected: true,
      ready: false,
      isBot: false,
    };

    const room: RoomState = {
      roomCode,
      gameId,
      hostId: playerId,
      players: new Map([[playerId, hostSlot]]),
      status: 'LOBBY',
      createdAt: Date.now(),
      voiceCallParticipants: new Set(),
    };

    this.rooms.set(roomCode, room);
    this.tokenIndex.set(token, { roomCode, playerId });
    return { room, playerId, token };
  }

  /** Joins an existing room by code. Seat limit comes from the room's game. */
  joinRoom(roomCode: string, playerName: string, avatar?: string): { room: RoomState; playerId: PlayerId; token: string } {
    const room = this.rooms.get(roomCode);
    if (!room) throw new RoomManagerError('This room does not exist.');
    if (room.status === 'IN_GAME') throw new RoomManagerError('Game has already started.');
    if (room.players.size >= maxPlayersFor(room.gameId)) throw new RoomManagerError('This room is full.');

    const playerId = playerIdGen();
    const token = tokenGen();
    const slot: PlayerSlot = {
      playerId,
      token,
      name: playerName,
      avatar: isValidAvatar(avatar) ? avatar : DEFAULT_AVATAR,
      connected: true,
      ready: false,
      isBot: false,
    };
    room.players.set(playerId, slot);
    this.tokenIndex.set(token, { roomCode, playerId });
    return { room, playerId, token };
  }

  /**
   * Fills one empty seat with a computer player (Section: "Play vs
   * Computer"). Host-only, lobby-only. Bots are auto-ready immediately
   * since there's no human to click "I'm Ready". Returns the new bot's
   * PlayerSlot.
   */
  addBot(roomCode: string, requestingPlayerId: PlayerId): PlayerSlot {
    const room = this.getRoomOrThrow(roomCode);
    if (room.hostId !== requestingPlayerId) {
      throw new RoomManagerError('Only the host can add a computer player.');
    }
    if (room.status === 'IN_GAME') {
      throw new RoomManagerError('Game has already started.');
    }
    if (room.players.size >= maxPlayersFor(room.gameId)) {
      throw new RoomManagerError('This room is full.');
    }
    const existingBotCount = [...room.players.values()].filter((p) => p.isBot).length;
    const playerId = playerIdGen();
    const slot: PlayerSlot = {
      playerId,
      token: tokenGen(), // unused for bots, but keeps the type simple/uniform
      name: BOT_NAMES[existingBotCount % BOT_NAMES.length],
      avatar: BOT_AVATARS[existingBotCount % BOT_AVATARS.length],
      connected: true,
      ready: true,
      isBot: true,
    };
    room.players.set(playerId, slot);
    return slot;
  }

  /**
   * "Leave Table": a connected human player voluntarily hands their seat
   * to a computer player mid-game (or in the lobby) so the game/room isn't
   * disrupted for everyone else. The seat keeps its identity (same
   * playerId, so scores/turn order are untouched) but is marked isBot so
   * the bot controller starts acting on its behalf.
   */
  convertToBot(roomCode: string, playerId: PlayerId): PlayerSlot {
    const room = this.getRoomOrThrow(roomCode);
    const slot = room.players.get(playerId);
    if (!slot) throw new RoomManagerError('Player not in this room.');
    slot.isBot = true;
    slot.ready = true;
    slot.connected = true; // bots are always "present"
    slot.socketId = undefined;
    slot.disconnectedAt = undefined;
    this.tokenIndex.delete(slot.token);
    room.voiceCallParticipants.delete(playerId); // bots don't take voice calls with them
    return slot;
  }

  /** Reconnects a previously-joined player using their persistent token (Section 42). */
  reconnect(token: string, newSocketId: string): { room: RoomState; playerId: PlayerId } {
    const entry = this.tokenIndex.get(token);
    if (!entry) throw new RoomManagerError('Invalid or expired session token.');
    const room = this.rooms.get(entry.roomCode);
    if (!room) throw new RoomManagerError('Room no longer exists.');
    const slot = room.players.get(entry.playerId);
    if (!slot) throw new RoomManagerError('Player no longer in this room.');

    const elapsedSinceDisconnect = slot.disconnectedAt ? Date.now() - slot.disconnectedAt : 0;
    if (!slot.connected && slot.disconnectedAt && elapsedSinceDisconnect > RECONNECT_WINDOW_MS) {
      throw new RoomManagerError('Reconnection window has expired.');
    }

    slot.connected = true;
    slot.socketId = newSocketId;
    slot.disconnectedAt = undefined;
    return { room, playerId: entry.playerId };
  }

  markDisconnected(roomCode: string, playerId: PlayerId): void {
    const room = this.rooms.get(roomCode);
    const slot = room?.players.get(playerId);
    if (!slot) return;
    slot.connected = false;
    slot.disconnectedAt = Date.now();
    slot.socketId = undefined;
    room?.voiceCallParticipants.delete(playerId); // a dropped connection also drops out of any voice call
  }

  setReady(roomCode: string, playerId: PlayerId, ready: boolean): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    const slot = room.players.get(playerId);
    if (!slot) throw new RoomManagerError('Player not in this room.');
    if (room.status === 'IN_GAME') throw new RoomManagerError('Game has already started.');
    slot.ready = ready;
    return room;
  }

  /** Only the host can start, and only once the game's seat requirement is met. */
  startGame(roomCode: string, requestingPlayerId: PlayerId): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (room.hostId !== requestingPlayerId) {
      throw new RoomManagerError('Only the host can start the game.');
    }
    const startCheck = canStartWith(room.gameId, room.players.size);
    if (!startCheck.ok) {
      throw new RoomManagerError(startCheck.error!);
    }
    const allReady = [...room.players.values()].every((p) => p.ready);
    if (!allReady) {
      throw new RoomManagerError('All players must be ready before starting.');
    }
    room.status = 'IN_GAME';
    return room;
  }

  /**
   * "Play Again": resets a finished room back to the lobby with the same 4
   * seats (same players, avatars, bots) so the host can start a fresh game
   * without everyone re-creating/re-joining a room. Host-only; only valid
   * once the previous game has actually finished (GAME_COMPLETE). Human
   * players are reset to not-ready (so everyone consciously opts back in);
   * bots are always auto-ready.
   */
  resetToLobby(roomCode: string, requestingPlayerId: PlayerId): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (room.hostId !== requestingPlayerId) {
      throw new RoomManagerError('Only the host can start a new game.');
    }
    if (!room.game?.isComplete()) {
      throw new RoomManagerError('The current game has not finished yet.');
    }
    room.status = 'LOBBY';
    room.game = undefined;
    for (const slot of room.players.values()) {
      slot.ready = slot.isBot; // bots stay auto-ready; humans opt back in
    }
    return room;
  }

  getRoomOrThrow(roomCode: string): RoomState {
    const room = this.rooms.get(roomCode);
    if (!room) throw new RoomManagerError('This room does not exist.');
    return room;
  }

  getRoom(roomCode: string): RoomState | undefined {
    return this.rooms.get(roomCode);
  }

  toPublic(room: RoomState): PublicRoomInfo {
    const players: PublicPlayerInfo[] = [...room.players.values()].map((p) => ({
      playerId: p.playerId,
      name: p.name,
      avatar: p.avatar,
      connected: p.connected,
      ready: p.ready,
      isHost: p.playerId === room.hostId,
      isBot: p.isBot,
    }));
    return {
      roomCode: room.roomCode,
      gameId: room.gameId,
      status: room.status,
      players,
      maxPlayers: maxPlayersFor(room.gameId),
      hostId: room.hostId,
      gameState: room.game?.state,
    };
  }

  /**
   * "Quick Match": joins the player into the best available open table
   * (preferring one that's closest to full, so tables fill up and start
   * rather than everyone scattering into new empty ones), or creates a
   * fresh room if no open table exists. No room code needed - this is for
   * "whoever's online can join" random matchmaking.
   */
  quickMatch(
    playerName: string,
    gameId: GameId,
    avatar?: string
  ): { room: RoomState; playerId: PlayerId; token: string } {
    // Only ever matches into a table playing the SAME game - a Hazari player
    // must never be dropped into a Teen Patti table.
    const candidates = [...this.rooms.values()]
      .filter(
        (r) =>
          r.gameId === gameId &&
          r.status === 'LOBBY' &&
          r.players.size < maxPlayersFor(r.gameId)
      )
      .sort((a, b) => b.players.size - a.players.size || a.createdAt - b.createdAt);

    if (candidates.length > 0) {
      return this.joinRoom(candidates[0].roomCode, playerName, avatar);
    }
    return this.createRoom(playerName, gameId, avatar);
  }

  /**
   * Lists currently-joinable tables for the public "Browse Tables" lobby
   * (Section 28-style casino browsing, in addition to the private
   * room-code flow) - only rooms still in LOBBY status with an open seat.
   */
  listOpenTables(gameId?: GameId): TableSummary[] {
    const tables: TableSummary[] = [];
    for (const room of this.rooms.values()) {
      if (room.status !== 'LOBBY') continue;
      if (gameId && room.gameId !== gameId) continue;
      const max = maxPlayersFor(room.gameId);
      if (room.players.size >= max) continue;
      const host = room.players.get(room.hostId);
      tables.push({
        roomCode: room.roomCode,
        gameId: room.gameId,
        hostName: host?.name ?? 'Unknown',
        playerCount: room.players.size,
        maxPlayers: max,
        status: room.status,
      });
    }
    // Most recently created first, so new tables are easy to find.
    tables.sort((a, b) => (this.rooms.get(b.roomCode)?.createdAt ?? 0) - (this.rooms.get(a.roomCode)?.createdAt ?? 0));
    return tables;
  }

  /** Removes rooms that have sat empty (all real humans disconnected) past
   *  the reconnect window. Bots don't count as "present" for this check -
   *  a room full of bots and no humans should still get cleaned up. */
  sweepStaleRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const humans = [...room.players.values()].filter((p) => !p.isBot);
      const anyoneConnected = humans.some((p) => p.connected);
      if (anyoneConnected) continue;
      const allExpired = humans.every(
        (p) => p.disconnectedAt && now - p.disconnectedAt > RECONNECT_WINDOW_MS
      );
      if (allExpired) {
        for (const p of room.players.values()) this.tokenIndex.delete(p.token);
        this.rooms.delete(code);
      }
    }
  }
}
