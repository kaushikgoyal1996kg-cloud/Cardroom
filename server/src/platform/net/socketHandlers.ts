import type { Server, Socket } from 'socket.io';
import { RoomManager, RoomManagerError } from '../rooms/roomManager.js';
import { hasPendingBotAction, performOneBotAction } from '../../games/hazari/botController.js';
import { hasPendingKittiBotAction, performOneKittiBotAction } from '../../games/kitti/botController.js';
import { HaazariGame } from '../../games/hazari/gameEngine.js';
import { createGameSession, asHazari, asKitti, asTeenPatti } from '../games/sessions.js';
import { isGameId, type GameId } from '../games/registry.js';
import { suggestArrangement, suggestArrangementOptions } from '../../games/hazari/arrangement.js';
import { getArrangementAssistEligibility } from '../../games/hazari/arrangementAssist.js';
import type { Card, DismissalReason, PlayerId } from '../../games/hazari/types.js';
import type { RoomState } from '../rooms/types.js';
import type { Card as PlatformCard } from '../cards/index.js';
import type { KittiGame, KittiGroups } from '../../games/kitti/engine.js';
import { suggestKittiArrangement } from '../../games/kitti/arrangement.js';
import type { TeenPattiGame } from '../../games/teenpatti/engine.js';
import { createTeenPattiLobbySetup, isTeenPattiLobbySetup, publicTeenPattiLobbySetup, teenPattiSetupAcceptedByAll } from '../../games/teenpatti/lobbySetup.js';
import type { ClientToServerEvents, ServerToClientEvents, HaazariPublicStatePayload, KittiPublicStatePayload, TeenPattiPublicStatePayload } from './events.js';
import { getVoiceIceServers } from './turnConfig.js';

/**
 * Bot actions are paced as visible table actions rather than resolving an entire
 * round instantly. The tiny deterministic variation avoids robotic metronome
 * timing without introducing random/test-flaky behaviour or changing any move.
 */
const BOT_PACING = {
  ARRANGE_BASE_MS: 900,
  ARRANGE_VARIATION_MS: 260,
  PLAY_BASE_MS: 620,
  PLAY_VARIATION_MS: 220,
  DECIDER_BASE_MS: 880,
  DECIDER_VARIATION_MS: 260,
} as const;

type BotSchedule = {
  session: NonNullable<RoomState['game']>;
  timer: ReturnType<typeof setTimeout>;
};

/** At most one bot tick may be pending per room. Multiple humans can confirm
 * arrangements close together, so an unguarded scheduler can otherwise queue
 * two timers and make computer actions land almost simultaneously. */
const pendingBotSchedules = new Map<string, BotSchedule>();

function stableBotVariation(seed: string, span: number): number {
  if (span <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % span;
}

function botActionDelayMs(room: RoomState): number {
  const state = room.game?.state ?? '';
  let progress = '';
  const hazari = room.game ? asHazari(room.game) : null;
  if (hazari) {
    const publicState = hazari.getPublicState();
    progress = `${publicState.roundNumber}:${publicState.currentSetIndex ?? '-'}:${publicState.playersConfirmedArrangement.length}:${publicState.playersPlayedThisSubRound.length}`;
  } else {
    const kitti = room.game ? asKitti(room.game) : null;
    if (kitti) {
      const publicState = kitti.getPublicState();
      progress = `${publicState.roundNumber}:${publicState.currentHandIndex ?? '-'}:${publicState.playersConfirmed.length}:${publicState.playersPlayedThisHand.length}`;
    }
  }
  const seed = `${room.roomCode}:${state}:${progress}:${room.players.size}`;
  if (state === 'ARRANGING_HANDS' || state === 'WAITING_FOR_HAND_CONFIRMATION' || state === 'ARRANGING' || state === 'WAITING_FOR_ARRANGEMENTS') {
    return BOT_PACING.ARRANGE_BASE_MS + stableBotVariation(seed, BOT_PACING.ARRANGE_VARIATION_MS);
  }
  if (state === 'PLAYING_DECIDER') {
    return BOT_PACING.DECIDER_BASE_MS + stableBotVariation(seed, BOT_PACING.DECIDER_VARIATION_MS);
  }
  return BOT_PACING.PLAY_BASE_MS + stableBotVariation(seed, BOT_PACING.PLAY_VARIATION_MS);
}

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
        assertSocketNotAlreadySeated(socket);
        const name = sanitizeName(playerName);
        const game = resolveGameId(gameId);
        const { room, playerId, token } = rooms.createRoom(name, game, avatar);
        rooms.bindSocket(room.roomCode, playerId, socket.id);
        joinSocketToRoom(socket, room.roomCode, playerId);
        ack({ ok: true, roomCode: room.roomCode, playerId, token, room: rooms.toPublic(room) });
        broadcastRoom(io, rooms, room.roomCode);
        broadcastTeenPattiSetup(io, room);
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('room:join', ({ roomCode, playerName, avatar }, ack) => {
      try {
        assertSocketNotAlreadySeated(socket);
        const name = sanitizeName(playerName);
        const code = roomCode.trim().toUpperCase();
        const { room, playerId, token } = rooms.joinRoom(code, name, avatar);
        rooms.bindSocket(room.roomCode, playerId, socket.id);
        joinSocketToRoom(socket, room.roomCode, playerId);
        ack({ ok: true, roomCode: room.roomCode, playerId, token, room: rooms.toPublic(room) });
        broadcastRoom(io, rooms, room.roomCode);
        broadcastTeenPattiSetup(io, room);
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('room:quickMatch', ({ playerName, avatar, gameId }, ack) => {
      try {
        assertSocketNotAlreadySeated(socket);
        const name = sanitizeName(playerName);
        const game = resolveGameId(gameId);
        const { room, playerId, token } = rooms.quickMatch(name, game, avatar);
        rooms.bindSocket(room.roomCode, playerId, socket.id);
        joinSocketToRoom(socket, room.roomCode, playerId);
        ack({ ok: true, roomCode: room.roomCode, playerId, token, room: rooms.toPublic(room) });
        broadcastRoom(io, rooms, room.roomCode);
        broadcastTeenPattiSetup(io, room);
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
        const { room, playerId, previousSocketId } = rooms.reconnect(token, socket.id);
        // The token reclaims the EXISTING seat. If a suspended/bfcached app
        // instance still has an old live socket, detach that stale connection
        // before binding the new one. There is still exactly one PlayerSlot.
        detachSupersededSocket(io, socket, previousSocketId, room.roomCode, playerId);
        joinSocketToRoom(socket, room.roomCode, playerId);
        ack({ ok: true, roomCode: room.roomCode, playerId, room: rooms.toPublic(room) });
        broadcastRoom(io, rooms, room.roomCode);
        // Restore public state plus ONLY this player's private cards.
        const hazari = asHazari(room.game);
        if (hazari) {
          sendPrivateHand(io, hazari, playerId);
          sendPrivateArrangement(io, hazari, playerId);
          sendPublicGameState(io, room.roomCode, hazari);
          restoreHazariResultState(socket, hazari);
        }
        const kitti = asKitti(room.game);
        if (kitti) {
          sendKittiPrivateState(io, kitti, playerId);
          sendKittiPublicState(io, room.roomCode, kitti);
          restoreKittiResultState(socket, kitti);
        }
        const teenPatti = asTeenPatti(room.game);
        if (teenPatti) {
          sendTeenPattiPrivateState(io, teenPatti, playerId);
          sendTeenPattiPublicState(io, room.roomCode, teenPatti);
          restoreTeenPattiResultState(socket, teenPatti);
        } else {
          broadcastTeenPattiSetup(io, room);
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

    socket.on('room:playMoneyPropose', ({ amount }) => {
      withRoom(socket, rooms, (room, playerId) => {
        rooms.proposePlayMoney(room.roomCode, playerId, amount);
        broadcastRoom(io, rooms, room.roomCode);
      });
    });

    socket.on('room:playMoneyAccept', () => {
      withRoom(socket, rooms, (room, playerId) => {
        rooms.acceptPlayMoney(room.roomCode, playerId);
        broadcastRoom(io, rooms, room.roomCode);
      });
    });

    socket.on('room:playMoneyDecline', () => {
      withRoom(socket, rooms, (room, playerId) => {
        rooms.declinePlayMoney(room.roomCode, playerId);
        broadcastRoom(io, rooms, room.roomCode);
      });
    });

    socket.on('room:playMoneyCancel', () => {
      withRoom(socket, rooms, (room, playerId) => {
        rooms.cancelPlayMoney(room.roomCode, playerId);
        broadcastRoom(io, rooms, room.roomCode);
      });
    });

    socket.on('teenpatti:proposeSetup', ({ tableConfig, roundVariant }, ack) => {
      try {
        const { roomCode, playerId } = socket.data;
        if (!roomCode || !playerId) throw new Error('Not currently in a room.');
        const room = rooms.getRoomOrThrow(roomCode);
        if (room.gameId !== 'TEEN_PATTI') throw new Error('That setup applies only to Teen Patti.');
        if (room.status !== 'LOBBY') throw new Error('Table setup is locked after the game starts.');
        if (room.hostId !== playerId) throw new Error('Only the host can propose the Teen Patti table setup.');
        const previousRevision = isTeenPattiLobbySetup(room.gameSetup) ? room.gameSetup.revision : 0;
        const setup = createTeenPattiLobbySetup(playerId, tableConfig, roundVariant, previousRevision + 1);
        room.gameSetup = setup;
        broadcastTeenPattiSetup(io, room);
        // Keep the narrowed concrete value rather than reading the opaque
        // RoomState.gameSetup field back immediately. This preserves the
        // room layer's game-agnostic boundary and keeps TypeScript honest.
        ack({ ok: true, setup: publicTeenPattiLobbySetup(setup) });
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('teenpatti:acceptSetup', ({ revision }, ack) => {
      try {
        const { roomCode, playerId } = socket.data;
        if (!roomCode || !playerId) throw new Error('Not currently in a room.');
        const room = rooms.getRoomOrThrow(roomCode);
        if (room.gameId !== 'TEEN_PATTI' || room.status !== 'LOBBY') throw new Error('There is no Teen Patti lobby setup to accept.');
        if (!room.players.has(playerId)) throw new Error('You are not seated at this table.');
        if (!isTeenPattiLobbySetup(room.gameSetup)) throw new Error('The host has not proposed table settings yet.');
        if (revision !== room.gameSetup.revision) throw new Error('Those settings have changed. Review the latest proposal before accepting.');
        room.gameSetup.acceptedBy.add(playerId);
        broadcastTeenPattiSetup(io, room);
        ack({ ok: true, setup: publicTeenPattiLobbySetup(room.gameSetup) });
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('room:start', () => {
      withRoom(socket, rooms, (room, playerId) => {
        const playerIds = [...room.players.keys()];
        let teenPattiOptions: Parameters<typeof createGameSession>[3] = {};
        if (room.gameId === 'TEEN_PATTI') {
          if (!isTeenPattiLobbySetup(room.gameSetup)) {
            throw new Error('The host must propose Teen Patti table settings before starting.');
          }
          if (!teenPattiSetupAcceptedByAll(room.gameSetup, playerIds)) {
            throw new Error('Every player must accept the Teen Patti table settings before starting.');
          }
          teenPattiOptions = {
            teenPatti: {
              tableConfig: room.gameSetup.tableConfig,
              roundVariant: room.gameSetup.roundVariant,
            },
          };
        }
        rooms.startGame(room.roomCode, playerId);
        // The factory decides which engine to build from the room's own
        // gameId. There is no path here that can start a HaazariGame for a
        // room that is not a Hazari room. Do the engine's initial transition
        // BEFORE locking the optional board, so a construction/deal failure
        // can never debit virtual P/L for a match that did not actually start.
        try {
          room.game = createGameSession(room.gameId, room.roomCode, playerIds, teenPattiOptions);

          const hazari = asHazari(room.game);
          if (hazari) {
            hazari.dealNewRound();
            rooms.beginPlayMoneyMatch(room.roomCode);
            broadcastRoom(io, rooms, room.roomCode);
            sendPublicGameState(io, room.roomCode, hazari);
            for (const id of hazari.playersClockwise) sendPrivateHand(io, hazari, id);
            scheduleBotActions(io, rooms, room.roomCode);
            return;
          }

          const kitti = asKitti(room.game);
          if (kitti) {
            kitti.startMatch();
            rooms.beginPlayMoneyMatch(room.roomCode);
            broadcastRoom(io, rooms, room.roomCode);
            sendKittiPublicState(io, room.roomCode, kitti);
            sendAllKittiPrivateHands(io, kitti);
            scheduleBotActions(io, rooms, room.roomCode);
            return;
          }

          const teenPatti = asTeenPatti(room.game);
          if (teenPatti) {
            teenPatti.startSession();
            broadcastRoom(io, rooms, room.roomCode);
            sendTeenPattiPublicState(io, room.roomCode, teenPatti);
            sendAllTeenPattiPrivateState(io, teenPatti);
          }
        } catch (err) {
          // Starting is transactional: never strand a lobby in IN_GAME when
          // an engine/setup/initial-deal construction error occurs. The shared
          // Hazari/Kitti board is locked only after those transitions succeed.
          room.status = 'LOBBY';
          room.game = undefined;
          throw err;
        }
      });
    });

    socket.on('room:addBot', () => {
      withRoom(socket, rooms, (room, playerId) => {
        // Release 1 supports computer seats in Hazari and Kitti. Teen Patti
        // remains Coming Soon and deliberately has no bot controller.
        if (room.gameId !== 'HAZARI' && room.gameId !== 'KITTI') {
          socket.emit('room:error', { message: 'Computer players are not available for this game yet.' });
          return;
        }
        rooms.addBot(room.roomCode, playerId);
        broadcastRoom(io, rooms, room.roomCode);
      });
    });

    socket.on('room:removeBot', ({ playerId: botPlayerId }) => {
      withRoom(socket, rooms, (room, playerId) => {
        rooms.removeBot(room.roomCode, playerId, botPlayerId);
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

    socket.on('room:leave', () => {
      withRoom(socket, rooms, (room, playerId) => {
        const roomCode = room.roomCode;
        const wasInCall = room.voiceCallParticipants.has(playerId);
        const leavingTeenPattiHost = room.gameId === 'TEEN_PATTI' && room.status === 'LOBBY' && room.hostId === playerId;
        const remaining = rooms.leaveSession(roomCode, playerId);
        // Detach before any broadcast so this client cannot receive a stale
        // room:update after it has cleared its local session (same class of
        // race as the fixed Leave Table bug).
        leaveSocketFromRoom(socket, roomCode, playerId);
        if (remaining) {
          // A Teen Patti proposal belongs to the proposing host. If that host
          // leaves before Start, the new host must explicitly propose settings
          // so nobody inherits consent from a departed host.
          if (leavingTeenPattiHost) remaining.gameSetup = undefined;
          broadcastRoom(io, rooms, roomCode);
          broadcastTeenPattiSetup(io, remaining);
        }
        if (wasInCall) io.to(roomCode).emit('voice:peerLeft', { playerId });
      });
    });

    socket.on('room:leaveTable', () => {
      try {
        const { roomCode, playerId } = socket.data;
        if (!roomCode || !playerId) throw new Error('Not currently in a room.');
        const room = rooms.getRoomOrThrow(roomCode);
        assertCurrentSeatSocket(room, playerId, socket.id);
        if (!room.game || (room.gameId !== 'HAZARI' && room.gameId !== 'KITTI')) {
          throw new Error('Leave Table is not available for this game.');
        }

        rooms.convertToBot(room.roomCode, playerId);
        // The same seat/playerId remains in the authoritative game engine; a
        // bot simply takes over its future actions. This works for Hazari and
        // Kitti without changing scores, round wins, dealer order or cards.
        leaveSocketFromRoom(socket, room.roomCode, playerId);
        broadcastRoom(io, rooms, room.roomCode);
        scheduleBotActions(io, rooms, room.roomCode);
        io.to(room.roomCode).emit('voice:peerLeft', { playerId });
      } catch (err) {
        socket.emit('game:error', { message: errMessage(err) });
      }
    });

    // ------------------------------------------------------------------
    // VOICE CALL - pure signaling relay. The server only ever forwards
    // opaque payloads and tracks who's "in" the call; actual audio flows
    // directly device-to-device (or via a TURN relay) once connected.
    // ------------------------------------------------------------------
    socket.on('voice:getIceServers', async (ack) => {
      try {
        const { roomCode, playerId } = socket.data;
        if (!roomCode || !playerId) throw new Error('Not currently in a room.');
        const room = rooms.getRoomOrThrow(roomCode);
        assertCurrentSeatSocket(room, playerId, socket.id);
        // One short-lived credential per TABLE is enough: voice signalling is still
        // authorised and isolated per player/room below, while sharing the TURN
        // relay credential inside that table dramatically reduces free-tier
        // credential churn during reconnects and long game nights.
        ack(await getVoiceIceServers(`cardroom-${roomCode}`));
      } catch (err) {
        ack({
          ok: false,
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun.relay.metered.ca:80' },
          ],
          relayAvailable: false,
          error: errMessage(err),
        });
      }
    });

    socket.on('voice:join', () => {
      withRoom(socket, rooms, (room, playerId) => {
        const alreadyJoined = room.voiceCallParticipants.has(playerId);
        const existing = [...room.voiceCallParticipants].filter((id) => id !== playerId);
        room.voiceCallParticipants.add(playerId);
        socket.emit('voice:participants', { playerIds: existing });
        if (alreadyJoined) return; // idempotent retry/reconnect; do not create duplicate offers
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
        // Signalling is only valid between two CURRENT call participants in
        // this room. Previously any seated client could relay opaque data to
        // any other player's private channel even when neither had joined the
        // call. It could not cross rooms, but it was still an unnecessary
        // trust gap.
        if (!room.voiceCallParticipants.has(playerId)) return;
        if (toPlayerId === playerId || !room.voiceCallParticipants.has(toPlayerId)) return;
        if (!room.players.has(toPlayerId)) return;
        // Keep signalling messages small. SDP/ICE is normally a few KB; this
        // rejects accidental/malicious megabyte payloads before relay.
        try {
          if (JSON.stringify(data).length > 64_000) return;
        } catch {
          return;
        }
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
        maybeAnnounceRoundOrGameEnd(io, rooms, roomCodeOf(socket), game);
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
    // KITTI - authoritative server controller
    // ------------------------------------------------------------------
    socket.on('kitti:confirmArrangement', ({ cardIdGroups }) => {
      withKittiGame(socket, rooms, (game, playerId) => {
        const hand = game.getPlayerHand(playerId);
        const byId = new Map(hand.map((c) => [c.id, c]));
        const resolveGroup = (ids: string[]): PlatformCard[] =>
          ids.map((id) => {
            const card = byId.get(id);
            if (!card) throw new Error(`Card ${id} is not part of your dealt hand.`);
            return card;
          });
        const groups: KittiGroups = [
          resolveGroup(cardIdGroups[0]),
          resolveGroup(cardIdGroups[1]),
          resolveGroup(cardIdGroups[2]),
        ];
        const result = game.confirmArrangement(playerId, groups);
        if (!result.ok) {
          socket.emit('game:error', { message: result.errors!.join(' ') });
          return;
        }
        sendKittiPrivateState(io, game, playerId);
        sendKittiPublicState(io, roomCodeOf(socket), game);
        scheduleBotActions(io, rooms, roomCodeOf(socket));
      });
    });

    socket.on('kitti:requestSuggestion', (ack) => {
      try {
        const { roomCode, playerId } = socket.data;
        if (!roomCode || !playerId) throw new Error('Not currently in a room.');
        const room = rooms.getRoomOrThrow(roomCode);
        assertCurrentSeatSocket(room, playerId, socket.id);
        const game = asKitti(room.game);
        if (!game) throw new Error('Kitti has not started yet.');

        // Same fairness boundary as Hazari: suggestions are training/help for
        // a human playing only against bots, never an advantage against a
        // real human opponent. The server re-derives this from room state.
        const eligibility = assertAssistAllowed(room, playerId);
        if (!eligibility.allowed) {
          ack({ ok: false, error: eligibility.reason });
          return;
        }
        const groups = suggestKittiArrangement(game.getPlayerHand(playerId));
        ack({
          ok: true,
          cardIdGroups: groups.map((group) => group.map((card) => card.id)) as [string[], string[], string[]],
        });
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
    });

    socket.on('kitti:playHand', () => {
      withKittiGame(socket, rooms, (game, playerId) => {
        const before = game.state;
        game.playCurrentHand(playerId);
        sendKittiPublicState(io, roomCodeOf(socket), game);
        if (before !== 'PLAYING_DECIDER' && game.state === 'PLAYING_DECIDER') {
          sendAllKittiDeciderHands(io, game);
        }
        maybeAnnounceKittiEnd(io, rooms, roomCodeOf(socket), game);
        scheduleBotActions(io, rooms, roomCodeOf(socket));
      });
    });

    socket.on('kitti:playDecider', () => {
      withKittiGame(socket, rooms, (game, playerId) => {
        game.playDecider(playerId);
        sendKittiPublicState(io, roomCodeOf(socket), game);
        maybeAnnounceKittiEnd(io, rooms, roomCodeOf(socket), game);
        scheduleBotActions(io, rooms, roomCodeOf(socket));
      });
    });

    socket.on('kitti:startNextRound', () => {
      withKittiGame(socket, rooms, (game, playerId) => {
        const room = rooms.getRoomOrThrow(roomCodeOf(socket));
        if (room.hostId !== playerId) {
          socket.emit('game:error', { message: 'Only the host can start the next round.' });
          return;
        }
        if (game.state !== 'ROUND_COMPLETE') {
          socket.emit('game:error', { message: `Cannot start next Kitti round from state ${game.state}` });
          return;
        }
        game.dealNewRound();
        sendKittiPublicState(io, room.roomCode, game);
        sendAllKittiPrivateHands(io, game);
        scheduleBotActions(io, rooms, room.roomCode);
      });
    });


    // ------------------------------------------------------------------
    // TEEN PATTI - authoritative Classic controller
    // ------------------------------------------------------------------
    socket.on('teenpatti:action', ({ action, expectedSeq }) => {
      withTeenPattiGame(socket, rooms, (game, playerId) => {
        const result = game.act(playerId, action, expectedSeq);
        if (!result.ok) {
          socket.emit('game:error', { message: result.error ?? 'Teen Patti action rejected.' });
          return;
        }
        // An action can change the NEXT player's private betting status
        // too (the third blind chance forces them to continue as seen when
        // their turn comes). Refresh every player's own private channel;
        // each payload still contains only that player's cards.
        sendAllTeenPattiPrivateState(io, game);
        sendTeenPattiPublicState(io, roomCodeOf(socket), game);
        maybeAnnounceTeenPattiRoundEnd(io, roomCodeOf(socket), game);
      });
    });

    socket.on('teenpatti:topUp', ({ amount }) => {
      withTeenPattiGame(socket, rooms, (game, playerId) => {
        const result = game.topUp(playerId, amount);
        if (!result.ok) {
          socket.emit('game:error', { message: result.error ?? 'Top-up rejected.' });
          return;
        }
        sendTeenPattiPublicState(io, roomCodeOf(socket), game);
      });
    });

    socket.on('teenpatti:startNextRound', () => {
      withTeenPattiGame(socket, rooms, (game, playerId) => {
        const room = rooms.getRoomOrThrow(roomCodeOf(socket));
        if (room.hostId !== playerId) {
          socket.emit('game:error', { message: 'Only the host can start the next round.' });
          return;
        }
        if (game.state !== 'ROUND_COMPLETE') {
          socket.emit('game:error', { message: `Cannot start the next Teen Patti round from state ${game.state}.` });
          return;
        }
        game.dealNewRound();
        sendTeenPattiPublicState(io, room.roomCode, game);
        sendAllTeenPattiPrivateState(io, game);
      });
    });

    socket.on('teenpatti:leaveTable', (ack) => {
      try {
        const { roomCode, playerId } = socket.data;
        if (!roomCode || !playerId) throw new Error('Not currently in a room.');
        const room = rooms.getRoomOrThrow(roomCode);
        if (room.gameId !== 'TEEN_PATTI' || room.status !== 'IN_GAME') {
          throw new Error('There is no active Teen Patti table to leave.');
        }
        const game = asTeenPatti(room.game);
        if (!game) throw new Error('Teen Patti has not started yet.');
        const wasInCall = room.voiceCallParticipants.has(playerId);

        // Game first, room second: the engine must settle/pack the player while
        // their authoritative table state still exists. Only after that do we
        // permanently release the room seat/token and detach this socket.
        const leaveResult = game.leaveTable(playerId);
        const remainingRoom = rooms.releaseActiveSeat(roomCode, playerId);
        leaveSocketFromRoom(socket, roomCode, playerId);

        if (!remainingRoom) {
          ack({ ok: true, settlement: leaveResult.settlement, tableEnded: true });
          return;
        }

        const tableEnded = game.playersClockwise.length < 2;
        if (tableEnded) {
          const settlements = game.playersClockwise
            .map((id) => game.getSettlement(id))
            .filter((value): value is NonNullable<typeof value> => !!value);
          io.to(roomCode).emit('teenpatti:tableEnded', {
            reason: 'NOT_ENOUGH_PLAYERS',
            settlements,
          });
          rooms.returnActiveSessionToLobby(roomCode);
          broadcastRoom(io, rooms, roomCode);
          broadcastTeenPattiSetup(io, rooms.getRoomOrThrow(roomCode));
        } else {
          broadcastRoom(io, rooms, roomCode);
          sendTeenPattiPublicState(io, roomCode, game);
          sendAllTeenPattiPrivateState(io, game);
          if (leaveResult.roundEnded) maybeAnnounceTeenPattiRoundEnd(io, roomCode, game);
        }

        if (wasInCall) io.to(roomCode).emit('voice:peerLeft', { playerId });
        ack({ ok: true, settlement: leaveResult.settlement, tableEnded });
      } catch (err) {
        ack({ ok: false, error: errMessage(err) });
      }
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
      rooms.markDisconnected(roomCode, playerId, socket.id);
      broadcastRoom(io, rooms, roomCode);
      if (wasInCall) io.to(roomCode).emit('voice:peerLeft', { playerId });
    });
  });
}

// ============================================================================
// Helpers
// ============================================================================


function assertSocketNotAlreadySeated(socket: Sock): void {
  if (!socket.data.roomCode && !socket.data.playerId) return;
  const suffix = socket.data.roomCode ? ` in room ${socket.data.roomCode}` : '';
  throw new RoomManagerError(`You're already seated${suffix}. Return to that table or leave it before joining another one.`);
}

function sanitizeName(name: string): string {
  const trimmed = (name ?? '').trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : 'Player';
}

function errMessage(err: unknown): string {
  if (err instanceof RoomManagerError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

function detachSupersededSocket(
  io: IO,
  currentSocket: Sock,
  previousSocketId: string | undefined,
  roomCode: string,
  playerId: PlayerId
): void {
  if (!previousSocketId || previousSocketId === currentSocket.id) return;
  const previous = io.sockets.sockets.get(previousSocketId) as Sock | undefined;
  if (!previous) return;
  // Clear membership/data first so a later disconnect from the old transport
  // cannot mark the newly-restored seat offline again.
  leaveSocketFromRoom(previous, roomCode, playerId);
  previous.emit('room:error', { message: 'This seat was restored in another app window.' });
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

function assertCurrentSeatSocket(
  room: ReturnType<RoomManager['getRoomOrThrow']>,
  playerId: PlayerId,
  socketId: string
): void {
  const slot = room.players.get(playerId);
  if (!slot) throw new RoomManagerError('Player not in this room.');
  if (slot.socketId && slot.socketId !== socketId) {
    throw new RoomManagerError('This seat is active in another app window.');
  }
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
    assertCurrentSeatSocket(room, playerId, socket.id);
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
    assertCurrentSeatSocket(room, playerId, socket.id);
    if (!room.game) throw new Error('Game has not started yet.');
    const hazari = asHazari(room.game);
    if (!hazari) throw new Error('That action does not apply to this game.');
    fn(hazari, playerId);
  } catch (err) {
    socket.emit('game:error', { message: errMessage(err) });
  }
}


/** Runs fn only for a running Teen Patti session. */
function withTeenPattiGame(
  socket: Sock,
  rooms: RoomManager,
  fn: (game: TeenPattiGame, playerId: PlayerId) => void
): void {
  try {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) throw new Error('Not currently in a room.');
    const room = rooms.getRoomOrThrow(roomCode);
    assertCurrentSeatSocket(room, playerId, socket.id);
    if (!room.game) throw new Error('Game has not started yet.');
    const teenPatti = asTeenPatti(room.game);
    if (!teenPatti) throw new Error('That action does not apply to this game.');
    fn(teenPatti, playerId);
  } catch (err) {
    socket.emit('game:error', { message: errMessage(err) });
  }
}

function broadcastTeenPattiSetup(io: IO, room: ReturnType<RoomManager['getRoomOrThrow']>): void {
  if (room.gameId !== 'TEEN_PATTI') return;
  io.to(room.roomCode).emit('teenpatti:setup', {
    setup: isTeenPattiLobbySetup(room.gameSetup) ? publicTeenPattiLobbySetup(room.gameSetup) : null,
  });
}

function sendTeenPattiPublicState(io: IO, roomCode: string, game: TeenPattiGame): void {
  io.to(roomCode).emit('teenpatti:state', game.getPublicState() as TeenPattiPublicStatePayload);
}

function sendTeenPattiPrivateState(io: IO, game: TeenPattiGame, playerId: PlayerId): void {
  const state = game.getPrivateState(playerId);
  if (state) io.to(privateChannel(game.roomCode, playerId)).emit('teenpatti:private', state);
}

function sendAllTeenPattiPrivateState(io: IO, game: TeenPattiGame): void {
  for (const playerId of game.playersClockwise) sendTeenPattiPrivateState(io, game, playerId);
}

function maybeAnnounceTeenPattiRoundEnd(io: IO, roomCode: string, game: TeenPattiGame): void {
  if (game.state === 'ROUND_COMPLETE' && game.lastOutcome) {
    io.to(roomCode).emit('teenpatti:roundComplete', { result: game.lastOutcome });
  }
}

function restoreTeenPattiResultState(socket: Sock, game: TeenPattiGame): void {
  if (game.state === 'ROUND_COMPLETE' && game.lastOutcome) {
    socket.emit('teenpatti:roundComplete', { result: game.lastOutcome });
  }
}

/** Runs fn only for a running Kitti session. */
function withKittiGame(
  socket: Sock,
  rooms: RoomManager,
  fn: (game: KittiGame, playerId: PlayerId) => void
): void {
  try {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) throw new Error('Not currently in a room.');
    const room = rooms.getRoomOrThrow(roomCode);
    assertCurrentSeatSocket(room, playerId, socket.id);
    if (!room.game) throw new Error('Game has not started yet.');
    const kitti = asKitti(room.game);
    if (!kitti) throw new Error('That action does not apply to this game.');
    fn(kitti, playerId);
  } catch (err) {
    socket.emit('game:error', { message: errMessage(err) });
  }
}

function sendKittiPublicState(io: IO, roomCode: string, game: KittiGame): void {
  io.to(roomCode).emit('kitti:state', game.getPublicState() as KittiPublicStatePayload);
}

function sendKittiPrivateState(io: IO, game: KittiGame, playerId: PlayerId): void {
  const hand = game.getPlayerHand(playerId);
  if (hand.length) {
    io.to(privateChannel(game.roomCode, playerId)).emit('kitti:yourHand', { hand });
  }
  const groups = game.getPlayerGroups(playerId);
  if (groups) {
    io.to(privateChannel(game.roomCode, playerId)).emit('kitti:yourArrangement', { groups });
  }
  const deciderHand = game.getDeciderHand(playerId);
  if (deciderHand.length) {
    io.to(privateChannel(game.roomCode, playerId)).emit('kitti:yourDeciderHand', { hand: deciderHand });
  }
}

function sendAllKittiPrivateHands(io: IO, game: KittiGame): void {
  for (const playerId of game.getActivePlayerIds()) sendKittiPrivateState(io, game, playerId);
}

function sendAllKittiDeciderHands(io: IO, game: KittiGame): void {
  const state = game.getPublicState();
  for (const playerId of state.deciderPlayerIds) sendKittiPrivateState(io, game, playerId);
}

function maybeAnnounceKittiEnd(io: IO, rooms: RoomManager, roomCode: string, game: KittiGame): void {
  if (game.state === 'ROUND_COMPLETE' || game.state === 'MATCH_COMPLETE') {
    const result = game.roundHistory[game.roundHistory.length - 1];
    if (result) io.to(roomCode).emit('kitti:roundComplete', { result });
  }
  if (game.state === 'MATCH_COMPLETE' && game.matchWinnerId) {
    rooms.settlePlayMoney(roomCode, game.matchWinnerId);
    broadcastRoom(io, rooms, roomCode);
    io.to(roomCode).emit('kitti:over', { winnerId: game.matchWinnerId, roundsWon: { ...game.roundsWon } });
  }
}

/**
 * Rehydrate result-only payloads for a reconnecting socket. Public game state
 * alone is not enough for RoundSummary/Winner screens: the client intentionally
 * keeps those richer result objects separate from the public live-state shape.
 * Emit ONLY to the reconnecting socket so everyone else does not receive a
 * duplicate round/game-complete event.
 */
function restoreHazariResultState(socket: Sock, game: HaazariGame): void {
  const lastRound = game.roundHistory[game.roundHistory.length - 1];
  if (lastRound && ['ROUND_COMPLETE', 'DISMISSED_ROUND', 'GAME_COMPLETE'].includes(game.state)) {
    socket.emit('hazari:roundComplete', { result: lastRound });
  }
  if (game.state === 'GAME_COMPLETE') {
    const winnerId = game.getWinner();
    if (winnerId) socket.emit('hazari:over', { winnerId, finalScores: { ...game.cumulativeScores } });
  }
}

function restoreKittiResultState(socket: Sock, game: KittiGame): void {
  const lastRound = game.roundHistory[game.roundHistory.length - 1];
  if (lastRound && (game.state === 'ROUND_COMPLETE' || game.state === 'MATCH_COMPLETE')) {
    socket.emit('kitti:roundComplete', { result: lastRound });
  }
  if (game.state === 'MATCH_COMPLETE' && game.matchWinnerId) {
    socket.emit('kitti:over', { winnerId: game.matchWinnerId, roundsWon: { ...game.roundsWon } });
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
    initialDealerDraws: s.initialDealerDraws,
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

function maybeAnnounceRoundOrGameEnd(io: IO, rooms: RoomManager, roomCode: string, game: HaazariGame): void {
  if (game.state === 'ROUND_COMPLETE') {
    const lastRound = game.roundHistory[game.roundHistory.length - 1];
    io.to(roomCode).emit('hazari:roundComplete', { result: lastRound });
  }
  if (game.state === 'GAME_COMPLETE') {
    const winnerId = game.getWinner()!;
    rooms.settlePlayMoney(roomCode, winnerId);
    broadcastRoom(io, rooms, roomCode);
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
  if (!room || !room.game) {
    const old = pendingBotSchedules.get(roomCode);
    if (old) clearTimeout(old.timer);
    pendingBotSchedules.delete(roomCode);
    return;
  }

  const hasPending = room.game.gameId === 'HAZARI'
    ? hasPendingBotAction(room)
    : room.game.gameId === 'KITTI'
      ? hasPendingKittiBotAction(room)
      : false;
  if (!hasPending) {
    const old = pendingBotSchedules.get(roomCode);
    if (old?.session === room.game) {
      clearTimeout(old.timer);
      pendingBotSchedules.delete(roomCode);
    }
    return;
  }

  // Capture session identity so a delayed bot tick can never act on a new
  // game after Play Again or on a recycled room code.
  const scheduledSession = room.game;

  const existing = pendingBotSchedules.get(roomCode);
  if (existing?.session === scheduledSession) {
    // Another event (for example a second human confirming an arrangement)
    // reached the scheduler while this table already had a pending bot tick.
    // One table gets one pending computer action, never a burst of duplicates.
    return;
  }
  if (existing) {
    clearTimeout(existing.timer);
    pendingBotSchedules.delete(roomCode);
  }

  const delayMs = botActionDelayMs(room);
  const timer = setTimeout(() => {
    const active = pendingBotSchedules.get(roomCode);
    if (active?.timer === timer) pendingBotSchedules.delete(roomCode);

    const currentRoom = rooms.getRoom(roomCode);
    if (!currentRoom || !currentRoom.game) return;
    if (currentRoom.game !== scheduledSession) {
      // The room may already have started a fresh session. Re-check that
      // current session rather than letting an old timer suppress its bots.
      scheduleBotActions(io, rooms, roomCode);
      return;
    }

    const hazari = asHazari(currentRoom.game);
    if (hazari) {
      const acted = performOneBotAction(currentRoom);
      if (acted) {
        sendPublicGameState(io, roomCode, hazari);
        maybeAnnounceRoundOrGameEnd(io, rooms, roomCode, hazari);
      }
      scheduleBotActions(io, rooms, roomCode);
      return;
    }

    const kitti = asKitti(currentRoom.game);
    if (kitti) {
      const before = kitti.state;
      const acted = performOneKittiBotAction(currentRoom);
      if (acted) {
        sendKittiPublicState(io, roomCode, kitti);
        if (before !== 'PLAYING_DECIDER' && kitti.state === 'PLAYING_DECIDER') {
          sendAllKittiDeciderHands(io, kitti);
        }
        maybeAnnounceKittiEnd(io, rooms, roomCode, kitti);
      }
      scheduleBotActions(io, rooms, roomCode);
    }
  }, delayMs);

  pendingBotSchedules.set(roomCode, { session: scheduledSession, timer });
}
