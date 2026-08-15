import type { Server, Socket } from 'socket.io';
import { RoomManager, RoomManagerError } from '../rooms/roomManager.js';
import { hasPendingBotAction, performOneBotAction } from '../../games/hazari/botController.js';
import { HaazariGame } from '../../games/hazari/gameEngine.js';
import { createGameSession, asHazari } from '../games/sessions.js';
import { isGameId, type GameId } from '../games/registry.js';
import { suggestArrangement, suggestArrangementOptions } from '../../games/hazari/arrangement.js';
import { getArrangementAssistEligibility } from '../../games/hazari/arrangementAssist.js';
import type { Card, DismissalReason, PlayerId } from '../../games/hazari/types.js';
import type { ClientToServerEvents, ServerToClientEvents, HaazariPublicStatePayload } from './events.js';

/** Small pause between individual bot actions so play is visible/legible
 *  to human players rather than a whole round resolving instantly. */
const BOT_ACTION_DELAY_MS = 700;

/** Voice notes: cap both duration and encoded size to keep payloads small
 *  over the websocket connection (base64 adds ~33% overhead over raw audio). */
const MAX_VOICE_DURATION_SEC = 10;
const MAX_VOICE_DATA_URL_LENGTH = 700_000; // ~525KB raw audio, comfortably under Socket.IO's 1MB default buffer limit

interface SocketData {
  roomCode?: string;
  playerId?: PlayerId;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function registerSocketHandlers(io: IO, rooms: RoomManager): void {
  io.on('connection', (socket: Sock) => {
    // ------------------------------------------------------------------
    // ROOM LIFECYCLE
    // ------------------------------------------------------------------

    socket.on('room:create', ({ playerName, avatar, gameId }, ack) => {
      try {
        const name = sanitizeName(playerName);
        const game = resolveGameId(gameId);
        const { room, playerId, token } = rooms.createRoom(name, game, avatar);
        joinSocketToRoom(socket, room.roomCode, playerId);
        ack({ ok: true, roomCode: room.roomCode, playerId, token, room: rooms.toPublic(room) });
        broadcastRoom(io, rooms, room.roomCode);
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('room:join', ({ roomCode, playerName, avatar }, ack) => {
      try {
        const name = sanitizeName(playerName);
        const code = roomCode.trim().toUpperCase();
        const { room, playerId, token } = rooms.joinRoom(code, name, avatar);
        joinSocketToRoom(socket, room.roomCode, playerId);
        ack({ ok: true, roomCode: room.roomCode, playerId, token, room: rooms.toPublic(room) });
        broadcastRoom(io, rooms, room.roomCode);
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('room:quickMatch', ({ playerName, avatar, gameId }, ack) => {
      try {
        const name = sanitizeName(playerName);
        const game = resolveGameId(gameId);
        const { room, playerId, token } = rooms.quickMatch(name, game, avatar);
        joinSocketToRoom(socket, room.roomCode, playerId);
        ack({ ok: true, roomCode: room.roomCode, playerId, token, room: rooms.toPublic(room) });
        broadcastRoom(io, rooms, room.roomCode);
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('room:listTables', (payload, ack) => {
      try {
        const filter = payload?.gameId && isGameId(payload.gameId) ? payload.gameId : undefined;
        ack({ ok: true, tables: rooms.listOpenTables(filter) });
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('room:reconnect', ({ token }, ack) => {
      try {
        const { room, playerId } = rooms.reconnect(token, socket.id);
        joinSocketToRoom(socket, room.roomCode, playerId);
        ack({ ok: true, roomCode: room.roomCode, playerId, room: rooms.toPublic(room) });
        broadcastRoom(io, rooms, room.roomCode);
        // Restore game state through the session boundary. Each game
        // restores its own private state; only Hazari has a controller today.
        const hazari = asHazari(room.game);
        if (hazari) {
          sendPrivateHand(io, hazari, playerId);
          sendPrivateArrangement(io, hazari, playerId);
          sendPublicGameState(io, room.roomCode, hazari);
        }
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('room:ready', ({ ready }) => {
      withRoom(socket, rooms, (room, playerId) => {
        rooms.setReady(room.roomCode, playerId, ready);
        broadcastRoom(io, rooms, room.roomCode);
      });
    });

    socket.on('room:start', () => {
      withRoom(socket, rooms, (room, playerId) => {
        rooms.startGame(room.roomCode, playerId);
        const playerIds = [...room.players.keys()];
        // The factory decides which engine to build from the room's own
        // gameId. There is no path here that can start a HaazariGame for a
        // room that is not a Hazari room.
        room.game = createGameSession(room.gameId, room.roomCode, playerIds);
        broadcastRoom(io, rooms, room.roomCode);

        const hazari = asHazari(room.game);
        if (hazari) {
          dealAndBroadcast(io, hazari);
          scheduleBotActions(io, rooms, room.roomCode);
        }
      });
    });

    socket.on('room:addBot', () => {
      withRoom(socket, rooms, (room, playerId) => {
        rooms.addBot(room.roomCode, playerId);
        broadcastRoom(io, rooms, room.roomCode);
      });
    });

    socket.on('room:playAgain', () => {
      withRoom(socket, rooms, (room, playerId) => {
        rooms.resetToLobby(room.roomCode, playerId);
        broadcastRoom(io, rooms, room.roomCode);
      });
    });

    socket.on('room:chat', ({ message, kind, durationSec }) => {
      withRoom(socket, rooms, (room, playerId) => {
        const sender = room.players.get(playerId);
        if (!sender) return;

        let payloadMessage: string;
        let payloadDuration: number | undefined;

        if (kind === 'voice') {
          // message is a base64 data URL (audio/webm or audio/ogg) - never
          // trim it like text (would corrupt the encoding). Cap size/length
          // instead so nobody can send an oversized payload.
          const raw = message ?? '';
          if (!raw.startsWith('data:audio/')) return; // reject anything that isn't actually audio
          if (raw.length > MAX_VOICE_DATA_URL_LENGTH) {
            socket.emit('room:error', { message: 'Voice note is too long - please keep it under 10 seconds.' });
            return;
          }
          payloadMessage = raw;
          payloadDuration = Math.min(Math.max(durationSec ?? 0, 0), MAX_VOICE_DURATION_SEC);
        } else {
          const trimmed = (message ?? '').trim().slice(0, 240);
          if (!trimmed) return;
          payloadMessage = trimmed;
        }

        io.to(room.roomCode).emit('room:chatMessage', {
          playerId,
          name: sender.name,
          avatar: sender.avatar,
          message: payloadMessage,
          kind: kind === 'emoji' ? 'emoji' : kind === 'voice' ? 'voice' : 'text',
          durationSec: payloadDuration,
          timestamp: Date.now(),
        });
      });
    });

    socket.on('room:leaveTable', () => {
      withGame(socket, rooms, (game, playerId) => {
        const room = rooms.getRoomOrThrow(roomCodeOf(socket));
        rooms.convertToBot(room.roomCode, playerId);
        // Detach THIS socket from the room's channels BEFORE broadcasting
        // the update - see leaveSocketFromRoom for why (Bug 2, 2026-08-15
        // retest). room.roomCode is captured above, so it remains usable
        // below even though socket.data.roomCode is cleared by this call.
        leaveSocketFromRoom(socket, room.roomCode, playerId);
        broadcastRoom(io, rooms, room.roomCode);
        scheduleBotActions(io, rooms, room.roomCode);
        io.to(room.roomCode).emit('voice:peerLeft', { playerId });
      });
    });

    // ------------------------------------------------------------------
    // VOICE CALL - pure signaling relay. The server only ever forwards
    // opaque payloads and tracks who's "in" the call; actual audio flows
    // directly device-to-device (or via a TURN relay) once connected.
    // ------------------------------------------------------------------
    socket.on('voice:join', () => {
      withRoom(socket, rooms, (room, playerId) => {
        const existing = [...room.voiceCallParticipants];
        room.voiceCallParticipants.add(playerId);
        // Tell the new joiner who's already there (for UI + so they know
        // who to expect incoming offers from)...
        socket.emit('voice:participants', { playerIds: existing });
        // ...and tell each existing member a new peer showed up, so THEY
        // initiate a connection to the new joiner (one-directional
        // initiation per pair avoids duplicate/glare offers). Delivered
        // via each player's private channel (joined on connect/reconnect)
        // rather than a raw socket id, which isn't reliably tracked for
        // the very first connection of a session.
        for (const existingId of existing) {
          io.to(privateChannel(room.roomCode, existingId)).emit('voice:peerJoined', { playerId });
        }
      });
    });

    socket.on('voice:leave', () => {
      withRoom(socket, rooms, (room, playerId) => {
        if (room.voiceCallParticipants.delete(playerId)) {
          io.to(room.roomCode).emit('voice:peerLeft', { playerId });
        }
      });
    });

    socket.on('voice:signal', ({ toPlayerId, data }) => {
      withRoom(socket, rooms, (room, playerId) => {
        io.to(privateChannel(room.roomCode, toPlayerId)).emit('voice:signal', { fromPlayerId: playerId, data });
      });
    });

    socket.on('voice:mute', ({ muted }) => {
      withRoom(socket, rooms, (room, playerId) => {
        if (room.voiceCallParticipants.has(playerId)) {
          io.to(room.roomCode).emit('voice:muteChanged', { playerId, muted });
        }
      });
    });

    // ------------------------------------------------------------------
    // GAMEPLAY - every handler re-validates server-side; client input is
    // never trusted (Section 30).
    // ------------------------------------------------------------------

    socket.on('hazari:confirmArrangement', ({ cardIdSets }) => {
      withGame(socket, rooms, (game, playerId) => {
        const hand = game.getPlayerHand(playerId);
        const byId = new Map(hand.map((c) => [c.id, c]));
        const resolveSet = (ids: string[]): Card[] =>
          ids.map((id) => {
            const card = byId.get(id);
            if (!card) throw new Error(`Card ${id} is not part of your dealt hand.`);
            return card;
          });

        const sets: [Card[], Card[], Card[], Card[]] = [
          resolveSet(cardIdSets[0]),
          resolveSet(cardIdSets[1]),
          resolveSet(cardIdSets[2]),
          resolveSet(cardIdSets[3]),
        ];

        const result = game.confirmArrangement(playerId, sets);
        if (!result.ok) {
          socket.emit('game:error', { message: result.errors!.join(' ') });
          return;
        }
        sendPrivateArrangement(io, game, playerId);
        sendPublicGameState(io, roomCodeOf(socket), game);
        scheduleBotActions(io, rooms, roomCodeOf(socket));
      });
    });

    socket.on('hazari:requestSuggestion', (ack) => {
      try {
        const { roomCode, playerId } = socket.data;
        if (!roomCode || !playerId) throw new Error('Not currently in a room.');
        const room = rooms.getRoomOrThrow(roomCode);
        const game = asHazari(room.game);
        if (!game) throw new Error('Game has not started yet.');
        // GAME INTEGRITY: refuse to compute anything at all when the player
        // has a real human opponent. Checked here, against authoritative room
        // state, so emitting this event by hand cannot bypass the rule.
        const eligibility = assertAssistAllowed(room, playerId);
        if (!eligibility.allowed) {
          ack({ ok: false, error: eligibility.reason });
          return;
        }
        const hand = game.getPlayerHand(playerId);
        const cumulativeScore = game.cumulativeScores[playerId] ?? 0;
        const suggestion = suggestArrangement(hand, cumulativeScore);
        ack({ ok: true, cardIdSets: suggestion.map((s) => s.map((c) => c.id)) as [string[], string[], string[], string[]] });
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('hazari:requestSuggestionOptions', (ack) => {
      try {
        const { roomCode, playerId } = socket.data;
        if (!roomCode || !playerId) throw new Error('Not currently in a room.');
        const room = rooms.getRoomOrThrow(roomCode);
        const game = asHazari(room.game);
        if (!game) throw new Error('Game has not started yet.');
        // GAME INTEGRITY: see the note on hazari:requestSuggestion above.
        const eligibility = assertAssistAllowed(room, playerId);
        if (!eligibility.allowed) {
          ack({ ok: false, error: eligibility.reason });
          return;
        }
        const hand = game.getPlayerHand(playerId);
        const cumulativeScore = game.cumulativeScores[playerId] ?? 0;
        const options = suggestArrangementOptions(hand, cumulativeScore);
        ack({
          ok: true,
          options: options.map((opt) => ({
            label: opt.label,
            description: opt.description,
            cardIdSets: opt.sets.map((s) => s.map((c) => c.id)) as [string[], string[], string[], string[]],
          })),
        });
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('hazari:playSet', () => {
      withGame(socket, rooms, (game, playerId) => {
        game.playSet(playerId);
        sendPublicGameState(io, roomCodeOf(socket), game);
        maybeAnnounceRoundOrGameEnd(io, roomCodeOf(socket), game);
        scheduleBotActions(io, rooms, roomCodeOf(socket));
      });
    });

    socket.on('hazari:requestDismissal', ({ reason, proposedCardIdSets }) => {
      withGame(socket, rooms, (game, playerId) => {
        let proposedSets: [Card[], Card[], Card[], Card[]] | undefined;
        if (proposedCardIdSets) {
          try {
            const hand = game.getPlayerHand(playerId);
            const byId = new Map(hand.map((c) => [c.id, c]));
            const resolveSet = (ids: string[]): Card[] =>
              ids.map((id) => {
                const card = byId.get(id);
                if (!card) throw new Error(`Card ${id} is not part of your dealt hand.`);
                return card;
              });
            proposedSets = [
              resolveSet(proposedCardIdSets[0]),
              resolveSet(proposedCardIdSets[1]),
              resolveSet(proposedCardIdSets[2]),
              resolveSet(proposedCardIdSets[3]),
            ];
          } catch (err) {
            socket.emit('game:error', { message: errMessage(err) });
            return;
          }
        }

        const outcome = game.requestDismissal(playerId, reason, proposedSets);
        if (!outcome.ok) {
          socket.emit('game:error', { message: outcome.error! });
          return;
        }
        sendPublicGameState(io, roomCodeOf(socket), game);
        const lastRound = game.roundHistory[game.roundHistory.length - 1];
        io.to(roomCodeOf(socket)).emit('hazari:roundComplete', { result: lastRound });
      });
    });

    socket.on('hazari:startNextRound', () => {
      withGame(socket, rooms, (game, playerId) => {
        const room = rooms.getRoomOrThrow(roomCodeOf(socket));
        if (room.hostId !== playerId) {
          socket.emit('game:error', { message: 'Only the host can start the next round.' });
          return;
        }
        if (game.state !== 'ROUND_COMPLETE' && game.state !== 'DISMISSED_ROUND') {
          socket.emit('game:error', { message: `Cannot start next round from state ${game.state}` });
          return;
        }
        dealAndBroadcast(io, game);
        scheduleBotActions(io, rooms, room.roomCode);
      });
    });

    // ------------------------------------------------------------------
    // DISCONNECT (Section 42) - preserve state, mark disconnected, allow
    // reconnection within the window; never reveal hidden cards.
    // ------------------------------------------------------------------
    socket.on('disconnect', () => {
      const { roomCode, playerId } = socket.data;
      if (!roomCode || !playerId) return;
      const room = rooms.getRoom(roomCode);
      const wasInCall = room?.voiceCallParticipants.delete(playerId) ?? false;
      rooms.markDisconnected(roomCode, playerId);
      broadcastRoom(io, rooms, roomCode);
      if (wasInCall) io.to(roomCode).emit('voice:peerLeft', { playerId });
    });
  });
}

// ============================================================================
// Helpers
// ============================================================================

function sanitizeName(name: string): string {
  const trimmed = (name ?? '').trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : 'Player';
}

function errMessage(err: unknown): string {
  if (err instanceof RoomManagerError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

function joinSocketToRoom(socket: Sock, roomCode: string, playerId: PlayerId): void {
  socket.data.roomCode = roomCode;
  socket.data.playerId = playerId;
  socket.join(roomCode);
  socket.join(privateChannel(roomCode, playerId));
}

/**
 * The inverse of joinSocketToRoom - detaches THIS socket from a room it is
 * intentionally leaving (Bug 2, confirmed on real Android PWA staging,
 * 2026-08-15 retest: Leave Table got stuck on an indefinite branded
 * "Loading…" screen).
 *
 * Root cause: `room:leaveTable` converted the player to a bot server-side
 * and broadcast the update, but never called this - the leaving socket
 * stayed subscribed to the room's Socket.IO channels (joined once, at
 * room:create/join/reconnect, and never left) and `socket.data` kept
 * pointing at the room it had just asked to leave. The very
 * `room:update` broadcast this handler sends out (now showing the player
 * as a bot) therefore also reached the LEAVING player's own client - and
 * every further update for the rest of that game, since a bot keeps
 * playing - racing against the local `setRoom(null)`/`setGameState(null)`
 * etc. that `leaveTable()` had just done client-side. Whichever arrived
 * last won: if a stale broadcast landed after the local clear, it
 * silently resurrected `room` (and, moments later, `gameState`) to a
 * real, non-null value with none of the OTHER state any actual screen
 * needs (myPlayerId, myHand, lastRoundResult, winnerInfo - all correctly
 * still cleared) - matching no screen's requirements, so App.tsx's
 * deliberate catch-all was all that was left to render, forever, since
 * nothing further would ever clear `room` again.
 *
 * Detaching the socket here means the broadcast this handler sends next
 * simply never reaches it - the race is prevented at its source rather
 * than patched after the fact. `socket.data` is also cleared so any
 * further action this socket sends (there should be none - the client
 * doesn't keep using it for this room) is correctly refused as "not
 * currently in a room" rather than stale-succeeding against a room this
 * socket no longer has any real business in.
 */
function leaveSocketFromRoom(socket: Sock, roomCode: string, playerId: PlayerId): void {
  socket.leave(roomCode);
  socket.leave(privateChannel(roomCode, playerId));
  socket.data.roomCode = undefined;
  socket.data.playerId = undefined;
}

function roomCodeOf(socket: Sock): string {
  if (!socket.data.roomCode) throw new Error('Not currently in a room.');
  return socket.data.roomCode;
}

function broadcastRoom(io: IO, rooms: RoomManager, roomCode: string): void {
  const room = rooms.getRoom(roomCode);
  if (!room) return;
  io.to(roomCode).emit('room:update', rooms.toPublic(room));
}

/** Runs `fn` only if the calling socket is validly attached to a room; emits a friendly error otherwise (Section 58). */
function withRoom(
  socket: Sock,
  rooms: RoomManager,
  fn: (room: ReturnType<RoomManager['getRoomOrThrow']>, playerId: PlayerId) => void
): void {
  try {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) throw new Error('Not currently in a room.');
    const room = rooms.getRoomOrThrow(roomCode);
    fn(room, playerId);
  } catch (err) {
    socket.emit('room:error', { message: errMessage(err) });
  }
}

/**
 * Runs `fn` only if this socket's room has a running HAZARI game.
 *
 * This is the single place in the server where a GameSession is narrowed to a
 * concrete engine. Every Hazari handler goes through it, so adding another
 * game never requires touching Hazari's handlers, and a Hazari event arriving
 * at a Teen Patti table is rejected here rather than misinterpreted.
 */
function withGame(socket: Sock, rooms: RoomManager, fn: (game: HaazariGame, playerId: PlayerId) => void): void {
  try {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) throw new Error('Not currently in a room.');
    const room = rooms.getRoomOrThrow(roomCode);
    if (!room.game) throw new Error('Game has not started yet.');
    const hazari = asHazari(room.game);
    if (!hazari) throw new Error('That action does not apply to this game.');
    fn(hazari, playerId);
  } catch (err) {
    socket.emit('game:error', { message: errMessage(err) });
  }
}

/**
 * Re-derives arrangement-assistance eligibility from authoritative room state.
 * Nothing supplied by the client is consulted - only the server's own record
 * of which seats are bots.
 */
function assertAssistAllowed(
  room: ReturnType<RoomManager['getRoomOrThrow']>,
  playerId: PlayerId
) {
  const occupants = [...room.players.values()].map((p) => ({
    playerId: p.playerId,
    isBot: p.isBot,
  }));
  return getArrangementAssistEligibility(occupants, playerId);
}

/** Validates a client-supplied game id, defaulting to Hazari for older clients. */
function resolveGameId(value: unknown): GameId {
  if (value === undefined || value === null) return 'HAZARI';
  if (!isGameId(value)) throw new Error('Unknown game.');
  return value;
}

/**
 * Hidden-card guarantee (Section 31): a player's hand is emitted ONLY to
 * their own private channel, which is scoped by (roomCode, playerId) - not
 * by socket id - so it survives a reconnect onto a brand-new socket.
 */
function sendPrivateHand(io: IO, game: HaazariGame, playerId: PlayerId): void {
  io.to(privateChannel(game.roomCode, playerId)).emit('hazari:yourHand', { hand: game.getPlayerHand(playerId) });
}

/** Resends a player's own confirmed arrangement - used after reconnect so a
 *  refreshed/rejoined client can recover which cards are in its own Set 1-4
 *  without ever exposing any other player's hidden cards. No-op if the
 *  player hasn't confirmed an arrangement yet this round. */
function sendPrivateArrangement(io: IO, game: HaazariGame, playerId: PlayerId): void {
  const sets = game.getPlayerArrangement(playerId);
  if (sets) {
    io.to(privateChannel(game.roomCode, playerId)).emit('hazari:yourArrangement', { sets });
  }
}

function privateChannel(roomCode: string, playerId: PlayerId): string {
  return `${roomCode}:player:${playerId}`;
}

function sendPublicGameState(io: IO, roomCode: string, game: HaazariGame): void {
  const s = game.getPublicState();
  const payload: HaazariPublicStatePayload = {
    roomCode: s.roomCode,
    state: s.state,
    dealerId: s.dealerId,
    roundNumber: s.roundNumber,
    cumulativeScores: s.cumulativeScores,
    currentSetIndex: s.currentSetIndex,
    currentLeader: s.currentLeader,
    currentPlayOrder: s.currentPlayOrder,
    playersPlayedThisSubRound: s.playersPlayedThisSubRound,
    playersConfirmedArrangement: s.playersConfirmedArrangement,
    playedSetsThisSubRound: s.playedSetsThisSubRound,
    subRoundResultsThisRound: s.subRoundResultsThisRound,
    winnerId: s.winnerId,
  };
  io.to(roomCode).emit('hazari:state', payload);
}

function dealAndBroadcast(io: IO, game: HaazariGame): void {
  game.dealNewRound();
  sendPublicGameState(io, game.roomCode, game);
  for (const playerId of game.playersClockwise) {
    sendPrivateHand(io, game, playerId);
  }
}

function maybeAnnounceRoundOrGameEnd(io: IO, roomCode: string, game: HaazariGame): void {
  if (game.state === 'ROUND_COMPLETE') {
    const lastRound = game.roundHistory[game.roundHistory.length - 1];
    io.to(roomCode).emit('hazari:roundComplete', { result: lastRound });
  }
  if (game.state === 'GAME_COMPLETE') {
    const winnerId = game.getWinner()!;
    io.to(roomCode).emit('hazari:over', { winnerId, finalScores: game.cumulativeScores });
  }
}

/**
 * Schedules the next pending bot action (if any) after a short delay, then
 * broadcasts the result and chains to check for further pending actions -
 * so a room with several bots plays out one visible action at a time
 * rather than an entire round resolving instantly. Safe to call after any
 * human action; it's a no-op if the room has no bots or nothing is
 * currently actionable by a bot. Re-fetches the room by code on each tick
 * (rather than closing over a stale reference) so it degrades gracefully
 * if the room is torn down while a delay is pending.
 */
function scheduleBotActions(io: IO, rooms: RoomManager, roomCode: string): void {
  const room = rooms.getRoom(roomCode);
  if (!room || !room.game || !hasPendingBotAction(room)) return;

  // Capture the session this tick was scheduled for. Re-fetching by code is
  // not sufficient on its own: after Play Again the room keeps its code but
  // gets a BRAND NEW session, and a room code freed by cleanup can later be
  // handed to a different table. In both cases a pending tick would find a
  // live room and act on a game it was never scheduled for. Comparing session
  // identity on the tick closes that: a replaced session ends the chain.
  const scheduledSession = room.game;

  setTimeout(() => {
    const currentRoom = rooms.getRoom(roomCode);
    if (!currentRoom || !currentRoom.game) return;
    if (currentRoom.game !== scheduledSession) return; // stale - session replaced

    const botGame = asHazari(currentRoom.game);
    if (!botGame) return; // only Hazari has bots today

    const acted = performOneBotAction(currentRoom);
    if (acted) {
      sendPublicGameState(io, roomCode, botGame);
      maybeAnnounceRoundOrGameEnd(io, roomCode, botGame);
    }
    // Chain: check again for more pending bot actions (e.g. the next seat
    // is also a bot, or this same bot has another arrangement/turn to take).
    scheduleBotActions(io, rooms, roomCode);
  }, BOT_ACTION_DELAY_MS);
}
