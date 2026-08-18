import type {
  PublicPlayerInfo,
  PublicRoomInfo,
  PokerPlayerStatePayload,
  PokerPublicStatePayload,
} from '../../game/types';
import type { SeatPlayer } from '../../platform/components/Seat';

export interface PokerRuntimeIdentity {
  playerId: string;
  name: string;
  avatar?: string;
  connected: boolean;
  isBot?: boolean;
}

/**
 * Build the identity view used by the hidden Poker runtime.
 *
 * The live room seats are authoritative for connection/bot state. The
 * public-safe room-lifetime directory is only a fallback for people who have
 * already settled and released their seat, so a still-visible hand result can
 * keep saying "Anchal" instead of degrading to the generic "Player" label.
 */
export function pokerRuntimeIdentities(
  players: readonly PublicPlayerInfo[],
  directory: PublicRoomInfo['playerDirectory']
): PokerRuntimeIdentity[] {
  const identities = new Map<string, PokerRuntimeIdentity>();

  Object.entries(directory ?? {}).forEach(([playerId, identity]) => {
    identities.set(playerId, {
      playerId,
      name: identity.name,
      avatar: identity.avatar,
      connected: false,
      isBot: false,
    });
  });

  players.forEach((player) => {
    identities.set(player.playerId, {
      playerId: player.playerId,
      name: player.name,
      avatar: player.avatar,
      connected: player.connected,
      isBot: player.isBot,
    });
  });

  return [...identities.values()];
}

export function pokerStreetLabel(state: PokerPublicStatePayload['state']): string {
  switch (state) {
    case 'PREFLOP': return 'Pre-flop';
    case 'FLOP': return 'Flop';
    case 'TURN': return 'Turn';
    case 'RIVER': return 'River';
    case 'SHOWDOWN': return 'Showdown';
    case 'HAND_COMPLETE': return 'Hand complete';
    case 'AWAITING_VARIANT': return 'Choosing game';
    default: return 'Ready';
  }
}

function playerStatus(player: PokerPlayerStatePayload, isTurn: boolean): string | undefined {
  if (player.folded) return 'Folded';
  const wager = player.streetCommitted > 0 ? `${player.streetCommitted} bet` : '';
  if (player.allIn) return wager ? `All-in · ${wager}` : 'All-in';
  if (isTurn) return wager ? `Acting · ${wager}` : 'Acting';
  if (wager) return wager;
  if (player.actedThisStreet) return 'Acted';
  return undefined;
}

/**
 * Converts authoritative Poker public state to the shared physical-seat model.
 * Names/avatars come from the room directory; stacks, fold/all-in/turn state
 * always come from PokerPublicStatePayload so the table never fabricates them.
 */
export function pokerSeatPlayers(
  state: PokerPublicStatePayload,
  identities: readonly PokerRuntimeIdentity[]
): SeatPlayer[] {
  const identityById = new Map(identities.map((player) => [player.playerId, player]));
  return state.players.map((player) => {
    const identity = identityById.get(player.playerId);
    const isTurn = state.currentTurn === player.playerId;
    return {
      playerId: player.playerId,
      name: identity?.name ?? 'Player',
      avatar: identity?.avatar,
      score: player.stack,
      scoreLabel: 'chips',
      isBot: identity?.isBot ?? false,
      connection: identity?.connected === false ? 'DISCONNECTED' : 'CONNECTED',
      hasActed: player.actedThisStreet,
      statusLabel: playerStatus(player, isTurn),
    };
  });
}

export function pokerWinnerNames(
  winnerIds: string[],
  identities: readonly PokerRuntimeIdentity[]
): string[] {
  const identityById = new Map(identities.map((player) => [player.playerId, player.name]));
  return winnerIds.map((id) => identityById.get(id) ?? 'Player');
}
