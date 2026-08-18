import type { PlayerId } from '../../platform/rooms/types.js';
import {
  maxPlayersForPokerTable,
  validatePokerTableConfig,
  variantsForPokerTable,
  type PokerTableConfig,
  type PokerVariantId,
} from './rules.js';

/** Opaque RoomState.gameSetup payload while a Poker table is in the lobby. */
export interface PokerLobbySetup {
  kind: 'POKER';
  config: PokerTableConfig;
  proposedBy: PlayerId;
  acceptedBy: Set<PlayerId>;
  revision: number;
}

export interface PokerLobbySetupPublic {
  config: PokerTableConfig;
  proposedBy: PlayerId;
  acceptedBy: PlayerId[];
  revision: number;
  seatCap: number;
  variants: Array<{
    id: PokerVariantId;
    name: string;
    shortName: string;
    howToPlay: string;
  }>;
}

export function createPokerLobbySetup(
  proposedBy: PlayerId,
  config: PokerTableConfig,
  seatedPlayerIds: PlayerId[],
  revision = 1
): PokerLobbySetup {
  validatePokerTableConfig(config);
  if (!seatedPlayerIds.includes(proposedBy)) throw new Error('Poker setup proposer must be seated.');
  if (new Set(seatedPlayerIds).size !== seatedPlayerIds.length) throw new Error('Duplicate poker seat in setup.');
  if (!Number.isSafeInteger(revision) || revision <= 0) throw new Error('Poker setup revision must be a positive integer.');
  const cap = maxPlayersForPokerTable(config);
  if (seatedPlayerIds.length > cap) {
    throw new Error(`This poker variant selection allows at most ${cap} seats.`);
  }
  return {
    kind: 'POKER',
    config: { ...config, variants: config.variants ? [...config.variants] : undefined },
    proposedBy,
    // Proposing is the host's affirmative acceptance of this exact revision.
    acceptedBy: new Set([proposedBy]),
    revision,
  };
}

export function acceptPokerLobbySetup(setup: PokerLobbySetup, playerId: PlayerId, revision: number): void {
  if (revision !== setup.revision) throw new Error('Poker table setup changed; review the latest proposal.');
  setup.acceptedBy.add(playerId);
}

export function isPokerLobbySetup(value: unknown): value is PokerLobbySetup {
  if (!value || typeof value !== 'object') return false;
  const setup = value as Partial<PokerLobbySetup>;
  return setup.kind === 'POKER'
    && setup.acceptedBy instanceof Set
    && !!setup.config
    && typeof setup.proposedBy === 'string'
    && Number.isSafeInteger(setup.revision);
}

export function pokerSetupAcceptedByAll(setup: PokerLobbySetup, playerIds: PlayerId[]): boolean {
  return playerIds.every((playerId) => setup.acceptedBy.has(playerId));
}

export function publicPokerLobbySetup(setup: PokerLobbySetup): PokerLobbySetupPublic {
  return {
    config: { ...setup.config, variants: setup.config.variants ? [...setup.config.variants] : undefined },
    proposedBy: setup.proposedBy,
    acceptedBy: [...setup.acceptedBy],
    revision: setup.revision,
    seatCap: maxPlayersForPokerTable(setup.config),
    variants: variantsForPokerTable(setup.config).map(({ id, name, shortName, howToPlay }) => ({ id, name, shortName, howToPlay })),
  };
}
