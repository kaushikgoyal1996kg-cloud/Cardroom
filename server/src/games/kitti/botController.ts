import type { RoomState } from '../../platform/rooms/types.js';
import { asKitti } from '../../platform/games/sessions.js';
import type { PlayerId } from './engine.js';
import { suggestKittiArrangement } from './arrangement.js';

type PendingKittiBotAction =
  | { kind: 'arrange'; botId: PlayerId }
  | { kind: 'play'; botId: PlayerId }
  | { kind: 'decider'; botId: PlayerId };

const PLAYING_STATES = new Set(['PLAYING_HAND_1', 'PLAYING_HAND_2', 'PLAYING_HAND_3']);

function findPendingKittiBotAction(room: RoomState): PendingKittiBotAction | null {
  const game = asKitti(room.game);
  if (!game) return null;

  const bots = new Set([...room.players.values()].filter((player) => player.isBot).map((player) => player.playerId));
  if (bots.size === 0) return null;

  if (game.state === 'ARRANGING' || game.state === 'WAITING_FOR_ARRANGEMENTS') {
    for (const botId of game.getActivePlayerIds()) {
      if (!bots.has(botId)) continue;
      if (game.getPlayerGroups(botId)) continue;
      if (game.getPlayerHand(botId).length !== 9) continue;
      return { kind: 'arrange', botId };
    }
  }

  const state = game.getPublicState();
  if (PLAYING_STATES.has(game.state) && state.currentPlayOrder) {
    const nextPlayerId = state.currentPlayOrder[state.playersPlayedThisHand.length];
    if (nextPlayerId && bots.has(nextPlayerId)) return { kind: 'play', botId: nextPlayerId };
  }

  if (game.state === 'PLAYING_DECIDER' && state.currentPlayOrder) {
    const nextPlayerId = state.currentPlayOrder[state.playersPlayedThisHand.length];
    if (nextPlayerId && bots.has(nextPlayerId)) return { kind: 'decider', botId: nextPlayerId };
  }

  return null;
}

export function hasPendingKittiBotAction(room: RoomState): boolean {
  return findPendingKittiBotAction(room) !== null;
}

/** Performs exactly one visible Kitti bot action. */
export function performOneKittiBotAction(room: RoomState): boolean {
  const action = findPendingKittiBotAction(room);
  if (!action) return false;
  const game = asKitti(room.game);
  if (!game) return false;

  try {
    if (action.kind === 'arrange') {
      const groups = suggestKittiArrangement(game.getPlayerHand(action.botId));
      return game.confirmArrangement(action.botId, groups).ok;
    }
    if (action.kind === 'play') {
      game.playCurrentHand(action.botId);
      return true;
    }
    game.playDecider(action.botId);
    return true;
  } catch {
    return false;
  }
}

/** Synchronous helper for deterministic tests. Real socket play uses pacing. */
export function runKittiBotActions(room: RoomState): boolean {
  let acted = false;
  let safety = 0;
  while (performOneKittiBotAction(room) && safety < 200) {
    acted = true;
    safety++;
  }
  return acted;
}
