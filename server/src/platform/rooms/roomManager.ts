import { customAlphabet } from 'nanoid';
import type { PlayerId, PlayerSlot, PublicPlayerInfo, PublicRoomInfo, RoomState, TableSummary } from './types.js';
import { DEFAULT_AVATAR, isValidAvatar } from './avatars.js';
import { INACTIVITY_THRESHOLD_MS, RECONNECT_WINDOW_MS } from './sessionConfig.js';
import { canStartWith, getGame, maxPlayersFor, type GameId } from '../games/registry.js';

// Room codes carry the game identity so an invite is self-explanatory:
// HZR = Hazari, KIT = Kitti, TPT = Teen Patti, PKR = Poker. The three-character suffix
// excludes ambiguous chars (0/O, 1/I). Existing Hazari codes keep HZR.
const codeSuffix = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 3);
const playerIdGen = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 12);
const tokenGen = customAlphabet('23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ', 32);

// Computer seats use the newer Card Room identity set so they read as deliberate
// table characters rather than leftover utility avatars. Pair name + avatar as
// one identity and choose an UNUSED pair when bots are removed/re-added; using
// only `existingBotCount` can duplicate a still-seated bot after a removal.
const BOT_IDENTITIES = [
  { name: 'Raja', avatar: '🐆' },
  { name: 'Rani', avatar: '🦅' },
  { name: 'Nawab', avatar: '🐺' },
  { name: 'Maharani', avatar: '🐉' },
  { name: 'Sultan', avatar: '🦉' },
  { name: 'Begum', avatar: '🐎' },
  { name: 'Vazir', avatar: '🐂' },
  { name: 'Zamindar', avatar: '🦊' },
] as const;

const MAX_PLAY_MONEY_BOARD = 1_000_000;

function supportsSharedPlayMoney(gameId: GameId): boolean {
  return gameId === 'HAZARI' || gameId === 'KITTI';
}

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

  private generateRoomCode(gameId: GameId): string {
    const prefix: Record<GameId, string> = { HAZARI: 'HZR', KITTI: 'KIT', TEEN_PATTI: 'TPT', POKER: 'PKR' };
    let code: string;
    do {
      code = `${prefix[gameId]}${codeSuffix()}`;
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
    const roomCode = this.generateRoomCode(gameId);
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
      spectators: new Map(),
      playerDirectory: { [playerId]: { name: hostSlot.name, avatar: hostSlot.avatar } },
      status: 'LOBBY',
      createdAt: Date.now(),
      visibility: 'LIVE',
      spectatorVoicePolicy: 'LISTEN_ONLY',
      voiceCallParticipants: new Set(),
      playMoney: { tableProfitLoss: { [playerId]: 0 } },
    };

    this.rooms.set(roomCode, room);
    this.tokenIndex.set(token, { roomCode, playerId });
    return { room, playerId, token };
  }

  /** Joins an existing room by code. Seat limit comes from the room's game. */
  joinRoom(roomCode: string, playerName: string, avatar?: string): { room: RoomState; playerId: PlayerId; token: string } {
    const room = this.rooms.get(roomCode);
    if (!room) throw new RoomManagerError('This room does not exist.');
    // Teen Patti and Poker are open table sessions: completely new players may
    // take an empty seat while a round/hand is already running, then enter at
    // the next safe boundary. Hazari/Kitti keep their lobby-only join rule.
    // In every game, a spectator may instead reserve an ordinary bot seat and
    // take control only when the current round/hand reaches a safe boundary.
    if (room.status === 'IN_GAME' && room.gameId !== 'TEEN_PATTI' && room.gameId !== 'POKER') {
      throw new RoomManagerError('Game has already started.');
    }
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
    room.playerDirectory ??= {};
    room.playerDirectory[playerId] = { name: slot.name, avatar: slot.avatar };
    room.playMoney.tableProfitLoss[playerId] = 0;
    // A player joining after a proposal must explicitly accept it.
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
    const seatedBots = [...room.players.values()].filter((p) => p.isBot);
    const identity = BOT_IDENTITIES.find(({ name, avatar }) =>
      seatedBots.every((bot) => bot.name !== name && bot.avatar !== avatar)
    ) ?? BOT_IDENTITIES[0];
    const playerId = playerIdGen();
    const slot: PlayerSlot = {
      playerId,
      token: tokenGen(), // unused for bots, but keeps the type simple/uniform
      name: identity.name,
      avatar: identity.avatar,
      connected: true,
      ready: true,
      isBot: true,
    };
    room.players.set(playerId, slot);
    room.playerDirectory ??= {};
    room.playerDirectory[playerId] = { name: slot.name, avatar: slot.avatar };
    room.playMoney.tableProfitLoss[playerId] = 0;
    room.playMoney.proposal?.acceptedBy.add(playerId); // bots auto-accept the optional board
    return slot;
  }

  /** Host-only lobby action for freeing a computer seat before Start. */
  removeBot(roomCode: string, requestingPlayerId: PlayerId, botPlayerId: PlayerId): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (room.hostId !== requestingPlayerId) {
      throw new RoomManagerError('Only the host can remove a computer player.');
    }
    if (room.status !== 'LOBBY') {
      throw new RoomManagerError('Computer seats can only be removed before the game starts.');
    }
    const slot = room.players.get(botPlayerId);
    if (!slot || !slot.isBot) {
      throw new RoomManagerError('That seat is not a computer player.');
    }

    room.players.delete(botPlayerId);
    if (room.playerDirectory) delete room.playerDirectory[botPlayerId];
    room.playMoney.proposal?.acceptedBy.delete(botPlayerId);
    delete room.playMoney.tableProfitLoss[botPlayerId];
    return room;
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

    // A temporary disconnect deliberately does NOT transfer host rights, but
    // Leave Table is permanent for this human session: its reconnect token is
    // invalidated above and a computer owns the seat from now on. If that seat
    // was host, hand room-level controls (Next Round / Play Again) to the first
    // remaining HUMAN so the table cannot deadlock behind a bot host. The bot's
    // engine seat/playerId is untouched, so dealer/score/turn rules do not move.
    if (room.hostId === playerId) {
      const nextHumanHost = [...room.players.values()].find((player) => player.playerId !== playerId && !player.isBot);
      if (nextHumanHost) room.hostId = nextHumanHost.playerId;
    }
    return slot;
  }

  /**
   * Voluntary session exit from a lobby or a completed game. Unlike a disconnect, this permanently releases the
   * seat/token immediately. If the host leaves while other humans remain,
   * host responsibility moves to the first remaining human in seating order;
   * if no humans remain, the lobby is deleted instead of leaving a bot-only
   * zombie room behind.
   */
  leaveSession(roomCode: string, playerId: PlayerId): RoomState | undefined {
    const room = this.getRoomOrThrow(roomCode);
    const safeToRemove = room.status === 'LOBBY' || room.game?.isComplete() === true;
    if (!safeToRemove) throw new RoomManagerError('Use Leave Table during an active game.');
    return this.releaseSeat(room, playerId);
  }

  /**
   * Permanently releases a seat while a game is active. The room layer does
   * NOT decide whether that is legal for a particular game; the concrete
   * game controller must first update/settle its own authoritative engine.
   * This keeps the room package game-agnostic while allowing open-ended games
   * such as Teen Patti to remove a human instead of converting them to a bot.
   */
  releaseActiveSeat(roomCode: string, playerId: PlayerId): RoomState | undefined {
    const room = this.getRoomOrThrow(roomCode);
    if (room.status !== 'IN_GAME') throw new RoomManagerError('There is no active game at this table.');
    return this.releaseSeat(room, playerId);
  }

  /**
   * Ends an open-ended active session and reopens the room as a lobby while
   * preserving the remaining seats. Any game-owned setup is cleared because
   * the participant set has changed and must be agreed again.
   */
  returnActiveSessionToLobby(roomCode: string): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    room.status = 'LOBBY';
    room.game = undefined;
    room.gameSetup = undefined;
    room.playMoney.proposal = undefined;
    room.playMoney.activeMatch = undefined;
    for (const slot of room.players.values()) slot.ready = slot.isBot;
    return room;
  }

  private releaseSeat(room: RoomState, playerId: PlayerId): RoomState | undefined {
    const slot = room.players.get(playerId);
    if (!slot) throw new RoomManagerError('Player not in this room.');

    room.voiceCallParticipants.delete(playerId);
    this.tokenIndex.delete(slot.token);
    const departingHost = room.hostId === playerId;
    room.players.delete(playerId);
    if (departingHost) room.playMoney.proposal = undefined;
    else room.playMoney.proposal?.acceptedBy.delete(playerId);
    delete room.playMoney.tableProfitLoss[playerId];

    const remainingHumans = [...room.players.values()].filter((p) => !p.isBot);
    if (remainingHumans.length === 0) {
      for (const p of room.players.values()) this.tokenIndex.delete(p.token);
      this.rooms.delete(room.roomCode);
      return undefined;
    }

    if (departingHost) room.hostId = remainingHumans[0].playerId;
    return room;
  }

  /**
   * Binds one concrete Socket.IO connection to an existing seat. The seat is
   * the identity; reconnecting never creates another PlayerSlot. If another
   * socket was still attached (bfcache, duplicate tab, suspended PWA), its id
   * is returned so the network layer can detach that stale connection.
   */
  bindSocket(roomCode: string, playerId: PlayerId, socketId: string): string | undefined {
    const room = this.getRoomOrThrow(roomCode);
    const slot = room.players.get(playerId);
    if (!slot) throw new RoomManagerError('Player not in this room.');
    const previousSocketId = slot.socketId && slot.socketId !== socketId ? slot.socketId : undefined;
    slot.connected = true;
    slot.socketId = socketId;
    slot.disconnectedAt = undefined;
    if (slot.inactiveDisposition) slot.returnPending = room.status === 'IN_GAME';
    if (room.status === 'LOBBY' && slot.inactiveDisposition) {
      slot.isBot = false;
      slot.inactiveDisposition = undefined;
      slot.returnPending = undefined;
    }
    return previousSocketId;
  }

  /** Reconnects a previously-joined player using their persistent secret token. */
  reconnect(token: string, newSocketId: string): { room: RoomState; playerId: PlayerId; previousSocketId?: string } {
    const entry = this.tokenIndex.get(token);
    if (!entry) throw new RoomManagerError('Invalid or expired session token.');
    const room = this.rooms.get(entry.roomCode);
    if (!room) throw new RoomManagerError('Room no longer exists.');
    const slot = room.players.get(entry.playerId);
    if (!slot) throw new RoomManagerError('Player no longer in this room.');

    const elapsedSinceDisconnect = slot.disconnectedAt ? Date.now() - slot.disconnectedAt : 0;
    if (!slot.connected && slot.disconnectedAt && elapsedSinceDisconnect > RECONNECT_WINDOW_MS && !slot.inactiveDisposition) {
      throw new RoomManagerError('Reconnection window has expired.');
    }

    const previousSocketId = this.bindSocket(room.roomCode, entry.playerId, newSocketId);
    return { room, playerId: entry.playerId, previousSocketId };
  }

  markDisconnected(roomCode: string, playerId: PlayerId, socketId?: string): void {
    const room = this.rooms.get(roomCode);
    const slot = room?.players.get(playerId);
    if (!slot) return;
    // A superseded browser/PWA instance can disconnect AFTER a newer socket
    // has reclaimed this same seat. Never let that stale disconnect flip the
    // newly-online player back to Waiting/Disconnected.
    if (socketId && slot.socketId && slot.socketId !== socketId) return;
    slot.connected = false;
    slot.disconnectedAt = Date.now();
    slot.socketId = undefined;
    // In the lobby, Ready means "I am here and ready to start now". A human
    // who has actually lost transport must opt in again after reconnect;
    // otherwise a host could start Kitti with an offline seat and deadlock
    // the human-only match before the first action. Active games keep their
    // game-owned state untouched and rely on the reconnect window instead.
    if (room?.status === 'LOBBY' && !slot.isBot) slot.ready = false;
    room?.voiceCallParticipants.delete(playerId); // a dropped connection also drops out of any voice call
  }

  /** Applies only after the exact disconnectedAt timestamp has remained stale
   * for the full grace period. Returns whether public room state changed. */
  transitionInactive(roomCode: string, playerId: PlayerId, disconnectedAt: number, now = Date.now()): boolean {
    const room = this.rooms.get(roomCode);
    const slot = room?.players.get(playerId);
    if (!room || !slot || slot.isBot || slot.connected || slot.disconnectedAt !== disconnectedAt) return false;
    if (now - disconnectedAt < INACTIVITY_THRESHOLD_MS) return false;

    slot.inactiveDisposition = room.gameId === 'HAZARI' || room.gameId === 'KITTI' ? 'BOT_SUBSTITUTE' : 'SITTING_OUT';
    if (slot.inactiveDisposition === 'BOT_SUBSTITUTE') {
      slot.isBot = true;
      slot.ready = true;
    }
    if (room.hostId === playerId) {
      const nextHost = [...room.players.values()].find((candidate) =>
        candidate.playerId !== playerId
        && !candidate.isBot
        && candidate.connected
        && !candidate.inactiveDisposition
        && !candidate.returnPending
      );
      if (nextHost) room.hostId = nextHost.playerId;
    }
    return true;
  }

  /** Activates humans who returned from inactivity at a caller-confirmed safe
   * round/hand boundary. Engine-specific sit-out flags are handled alongside
   * this room-level transition by the network controller. */
  activatePendingReturns(roomCode: string): PlayerId[] {
    const room = this.getRoomOrThrow(roomCode);
    const activated: PlayerId[] = [];
    for (const slot of room.players.values()) {
      if (!slot.returnPending || !slot.connected || !slot.inactiveDisposition) continue;
      slot.isBot = false;
      slot.inactiveDisposition = undefined;
      slot.returnPending = undefined;
      slot.ready = true;
      activated.push(slot.playerId);
    }
    return activated;
  }

  setVisibility(roomCode: string, requestingPlayerId: PlayerId, visibility: RoomState['visibility']): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (room.hostId !== requestingPlayerId) throw new RoomManagerError('Only the host can change table visibility.');
    room.visibility = visibility;
    return room;
  }

  watchRoom(roomCode: string, name: string, avatar?: string): { room: RoomState; spectatorId: string } {
    const room = this.getRoomOrThrow(roomCode);
    if (room.visibility !== 'LIVE') throw new RoomManagerError('This table is private.');
    if (room.status !== 'IN_GAME') throw new RoomManagerError('This table has not started yet. Join it as a player instead.');
    const spectatorId = `watch_${playerIdGen()}`;
    room.spectators.set(spectatorId, {
      spectatorId,
      name,
      avatar: isValidAvatar(avatar) ? avatar : DEFAULT_AVATAR,
    });
    return { room, spectatorId };
  }

  bindSpectatorSocket(roomCode: string, spectatorId: string, socketId: string): void {
    const spectator = this.getRoomOrThrow(roomCode).spectators.get(spectatorId);
    if (!spectator) throw new RoomManagerError('Spectator is no longer watching this table.');
    spectator.socketId = socketId;
  }

  leaveSpectator(roomCode: string, spectatorId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.spectators.delete(spectatorId);
    room.voiceCallParticipants.delete(spectatorId);
  }

  setSpectatorVoicePolicy(roomCode: string, requestingPlayerId: PlayerId, policy: RoomState['spectatorVoicePolicy']): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (room.hostId !== requestingPlayerId) throw new RoomManagerError('Only the host can change spectator voice.');
    room.spectatorVoicePolicy = policy;
    // A connected conversation stream cannot be downgraded safely in place:
    // its already-negotiated microphone track would keep flowing peer-to-peer.
    // Remove current spectators whenever conversation becomes unavailable;
    // listen-only spectators may rejoin under the new policy.
    if (policy !== 'CONVERSATION') {
      for (const spectatorId of room.spectators.keys()) room.voiceCallParticipants.delete(spectatorId);
    }
    return room;
  }

  removeInactiveBotClaim(roomCode: string, requestingPlayerId: PlayerId, targetPlayerId: PlayerId): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (room.hostId !== requestingPlayerId) throw new RoomManagerError('Only the host can remove an inactive player.');
    const slot = room.players.get(targetPlayerId);
    if (!slot?.inactiveDisposition || slot.connected) throw new RoomManagerError('That player is not eligible for inactivity removal.');
    if (slot.inactiveDisposition !== 'BOT_SUBSTITUTE') throw new RoomManagerError('This seat must be settled by its game controller.');
    this.tokenIndex.delete(slot.token);
    slot.inactiveDisposition = undefined;
    slot.returnPending = undefined;
    return room;
  }

  claimBotSeat(roomCode: string, spectatorId: string, botPlayerId: PlayerId): { room: RoomState; playerId: PlayerId; token: string } {
    const room = this.getRoomOrThrow(roomCode);
    const spectator = room.spectators.get(spectatorId);
    const slot = room.players.get(botPlayerId);
    if (!spectator) throw new RoomManagerError('You are not watching this table.');
    if (!slot?.isBot || slot.inactiveDisposition) throw new RoomManagerError('That bot seat is not available to take.');
    const token = tokenGen();
    slot.token = token;
    slot.name = spectator.name;
    slot.avatar = spectator.avatar;
    slot.connected = true;
    slot.returnPending = room.status === 'IN_GAME';
    slot.inactiveDisposition = room.status === 'IN_GAME' ? 'BOT_SUBSTITUTE' : undefined;
    slot.socketId = spectator.socketId;
    room.playerDirectory ??= {};
    room.playerDirectory[slot.playerId] = { name: slot.name, avatar: slot.avatar };
    room.spectators.delete(spectatorId);
    room.voiceCallParticipants.delete(spectatorId);
    this.tokenIndex.set(token, { roomCode, playerId: slot.playerId });
    if (room.status !== 'IN_GAME') slot.isBot = false;
    return { room, playerId: slot.playerId, token };
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
    const allHumansOnline = [...room.players.values()].every((p) => p.isBot || p.connected);
    if (!allHumansOnline) {
      throw new RoomManagerError('Every human player must be online before starting.');
    }
    const allReady = [...room.players.values()].every((p) => p.ready);
    if (!allReady) {
      throw new RoomManagerError('All players must be ready before starting.');
    }
    if (room.playMoney.proposal) {
      const missingAcceptance = [...room.players.values()].some(
        (p) => !p.isBot && !room.playMoney.proposal!.acceptedBy.has(p.playerId)
      );
      if (missingAcceptance) {
        throw new RoomManagerError('Every human player must accept the play-money board before starting.');
      }
    }
    room.status = 'IN_GAME';
    return room;
  }

  /** Host proposes an optional virtual board for the next Hazari/Kitti match. */
  proposePlayMoney(
    roomCode: string,
    requestingPlayerId: PlayerId,
    amount: number,
    mode: 'MATCH_POT' | 'KITTI_ROUND_BOOT' = 'MATCH_POT'
  ): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (!supportsSharedPlayMoney(room.gameId)) {
      throw new RoomManagerError('This play-money board applies only to Hazari and Kitti.');
    }
    if (room.status !== 'LOBBY') throw new RoomManagerError('The board is locked once a match starts.');
    if (room.hostId !== requestingPlayerId) throw new RoomManagerError('Only the host can propose the play-money board.');
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_PLAY_MONEY_BOARD) {
      throw new RoomManagerError(`Board amount must be a whole number from 1 to ${MAX_PLAY_MONEY_BOARD}.`);
    }
    if (mode === 'KITTI_ROUND_BOOT' && room.gameId !== 'KITTI') {
      throw new RoomManagerError('Round Boot mode applies only to Kitti.');
    }
    const acceptedBy = new Set<PlayerId>([requestingPlayerId]);
    for (const slot of room.players.values()) if (slot.isBot) acceptedBy.add(slot.playerId);
    room.playMoney.proposal = { amount, mode, proposedBy: requestingPlayerId, acceptedBy };
    return room;
  }

  /** A human player accepts the host's current proposal. Bots are auto-accepted. */
  acceptPlayMoney(roomCode: string, playerId: PlayerId): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (room.status !== 'LOBBY') throw new RoomManagerError('The board is locked once a match starts.');
    const slot = room.players.get(playerId);
    if (!slot) throw new RoomManagerError('Player not in this room.');
    const proposal = room.playMoney.proposal;
    if (!proposal) throw new RoomManagerError('There is no play-money board to accept.');
    proposal.acceptedBy.add(playerId);
    return room;
  }

  /** Any human can explicitly veto the optional board; unanimity is required. */
  declinePlayMoney(roomCode: string, playerId: PlayerId): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (room.status !== 'LOBBY') throw new RoomManagerError('The board is locked once a match starts.');
    const slot = room.players.get(playerId);
    if (!slot) throw new RoomManagerError('Player not in this room.');
    if (slot.isBot) throw new RoomManagerError('Computer players auto-accept the play-money board.');
    if (!room.playMoney.proposal) throw new RoomManagerError('There is no play-money board to decline.');
    room.playMoney.proposal = undefined;
    return room;
  }

  /** Host withdraws the proposal; the match can then start with no play money. */
  cancelPlayMoney(roomCode: string, requestingPlayerId: PlayerId): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (room.status !== 'LOBBY') throw new RoomManagerError('The board is locked once a match starts.');
    if (room.hostId !== requestingPlayerId) throw new RoomManagerError('Only the host can withdraw the play-money board.');
    room.playMoney.proposal = undefined;
    return room;
  }

  /**
   * Locks the accepted board at match start and records each seat's virtual
   * contribution. There is intentionally no wallet/balance requirement yet:
   * this is a room-session P/L ledger, so no arbitrary starting balance is
   * invented and no player can ever owe or withdraw real money.
   */
  beginPlayMoneyMatch(roomCode: string): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    if (!supportsSharedPlayMoney(room.gameId)) return room;
    const proposal = room.playMoney.proposal;
    if (!proposal) {
      room.playMoney.activeMatch = undefined;
      return room;
    }
    const participantIds = [...room.players.keys()];
    const missingAcceptance = [...room.players.values()].some(
      (p) => !p.isBot && !proposal.acceptedBy.has(p.playerId)
    );
    if (missingAcceptance) throw new RoomManagerError('Every human player must accept the play-money board before starting.');

    for (const id of participantIds) {
      room.playMoney.tableProfitLoss[id] = (room.playMoney.tableProfitLoss[id] ?? 0) - proposal.amount;
    }
    room.playMoney.activeMatch = {
      amount: proposal.amount,
      mode: proposal.mode,
      pot: proposal.amount * participantIds.length,
      contributionRounds: 1,
      participantIds,
      settled: false,
    };
    room.playMoney.proposal = undefined;
    return room;
  }

  /** Awards the full virtual pot once, to the authoritative match winner. */
  settlePlayMoney(roomCode: string, winnerId: PlayerId): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    const active = room.playMoney.activeMatch;
    if (!active || active.settled) return room;
    if (!active.participantIds.includes(winnerId)) {
      throw new RoomManagerError('Play-money winner was not a participant in this match.');
    }
    room.playMoney.tableProfitLoss[winnerId] = (room.playMoney.tableProfitLoss[winnerId] ?? 0) + active.pot;
    active.settled = true;
    active.winnerId = winnerId;
    return room;
  }

  /**
   * Funds the next Kitti Round Boot deal. A tied 1-1-1 deal keeps the old
   * pot and adds one new boot from every seat. After a winner was paid, this
   * opens a fresh pot for the next deal at the same table.
   */
  fundNextKittiBootRound(roomCode: string): RoomState {
    const room = this.getRoomOrThrow(roomCode);
    const active = room.playMoney.activeMatch;
    if (room.gameId !== 'KITTI' || !active || active.mode !== 'KITTI_ROUND_BOOT') return room;
    const participantIds = [...room.players.keys()];
    for (const id of participantIds) {
      room.playMoney.tableProfitLoss[id] = (room.playMoney.tableProfitLoss[id] ?? 0) - active.amount;
    }
    if (active.settled) {
      room.playMoney.activeMatch = {
        amount: active.amount,
        mode: active.mode,
        pot: active.amount * participantIds.length,
        contributionRounds: 1,
        participantIds,
        settled: false,
      };
    } else {
      active.pot += active.amount * participantIds.length;
      active.contributionRounds += 1;
      active.participantIds = participantIds;
    }
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
    room.playMoney.proposal = undefined;
    room.playMoney.activeMatch = undefined;
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
      inactiveDisposition: p.inactiveDisposition,
      returnPending: p.returnPending,
    }));
    return {
      roomCode: room.roomCode,
      gameId: room.gameId,
      status: room.status,
      players,
      spectators: [...room.spectators.values()].map(({ spectatorId, name, avatar }) => ({ spectatorId, name, avatar })),
      playerDirectory: room.playerDirectory ? Object.fromEntries(
        Object.entries(room.playerDirectory).map(([id, identity]) => [id, { ...identity }])
      ) : undefined,
      maxPlayers: maxPlayersFor(room.gameId),
      hostId: room.hostId,
      gameState: room.game?.state,
      playMoney: {
        proposal: room.playMoney.proposal
          ? {
              amount: room.playMoney.proposal.amount,
              mode: room.playMoney.proposal.mode,
              proposedBy: room.playMoney.proposal.proposedBy,
              acceptedBy: [...room.playMoney.proposal.acceptedBy],
            }
          : null,
        activeMatch: room.playMoney.activeMatch
          ? { ...room.playMoney.activeMatch, participantIds: [...room.playMoney.activeMatch.participantIds] }
          : null,
        tableProfitLoss: { ...room.playMoney.tableProfitLoss },
      },
      visibility: room.visibility,
      spectatorVoicePolicy: room.spectatorVoicePolicy,
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
      if (room.visibility !== 'LIVE') continue;
      if (gameId && room.gameId !== gameId) continue;
      const max = maxPlayersFor(room.gameId);
      if (room.players.size >= max && room.status === 'LOBBY') continue;
      const host = room.players.get(room.hostId);
      tables.push({
        roomCode: room.roomCode,
        gameId: room.gameId,
        hostName: host?.name ?? 'Unknown',
        playerCount: room.players.size,
        maxPlayers: max,
        status: room.status,
        visibility: room.visibility,
        spectatorCount: room.spectators.size,
        botCount: [...room.players.values()].filter((player) => player.isBot).length,
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
