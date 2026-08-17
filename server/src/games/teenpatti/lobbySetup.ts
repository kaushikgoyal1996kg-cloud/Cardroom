import type { PlayerId } from '../../platform/rooms/types.js';
import {
  DEFAULT_TEEN_PATTI_TABLE_CONFIG,
  getTeenPattiVariant,
  validateTeenPattiTableConfig,
  type TeenPattiRoundVariantConfig,
  type TeenPattiTableConfig,
} from './rules.js';

/** Opaque RoomState.gameSetup payload while a Teen Patti table is in lobby. */
export interface TeenPattiLobbySetup {
  kind: 'TEEN_PATTI';
  tableConfig: TeenPattiTableConfig;
  roundVariant: TeenPattiRoundVariantConfig;
  proposedBy: PlayerId;
  acceptedBy: Set<PlayerId>;
  revision: number;
}

export interface TeenPattiLobbySetupPublic {
  tableConfig: TeenPattiTableConfig;
  roundVariant: TeenPattiRoundVariantConfig;
  proposedBy: PlayerId;
  acceptedBy: PlayerId[];
  revision: number;
  howToPlay: string;
}

export function createTeenPattiLobbySetup(
  proposedBy: PlayerId,
  tableConfig: TeenPattiTableConfig = DEFAULT_TEEN_PATTI_TABLE_CONFIG,
  roundVariant: TeenPattiRoundVariantConfig = { variantId: 'CLASSIC' },
  revision = 1
): TeenPattiLobbySetup {
  validateTeenPattiTableConfig(tableConfig);
  const descriptor = getTeenPattiVariant(roundVariant.variantId);
  if (!descriptor.runtimeImplemented) {
    throw new Error(`${descriptor.name} is not available to play yet.`);
  }
  if (descriptor.requiresTargetNumber) {
    const target = roundVariant.targetNumber;
    if (!Number.isInteger(target) || target! < 100 || target! > 999) {
      throw new Error('Closest to N requires a three-digit target from 100 to 999.');
    }
  }
  if (descriptor.requiresNamedRank && !roundVariant.namedRank) {
    throw new Error(`${descriptor.name} requires the dealer to choose a rank.`);
  }
  return {
    kind: 'TEEN_PATTI',
    tableConfig: { ...tableConfig },
    roundVariant: { ...roundVariant },
    proposedBy,
    // Proposing the setup is the host's affirmative vote; every other seated
    // human must still accept this exact revision before Start is allowed.
    acceptedBy: new Set([proposedBy]),
    revision,
  };
}

export function isTeenPattiLobbySetup(value: unknown): value is TeenPattiLobbySetup {
  if (!value || typeof value !== 'object') return false;
  const setup = value as Partial<TeenPattiLobbySetup>;
  return setup.kind === 'TEEN_PATTI' && setup.acceptedBy instanceof Set && !!setup.tableConfig && !!setup.roundVariant;
}

export function publicTeenPattiLobbySetup(setup: TeenPattiLobbySetup): TeenPattiLobbySetupPublic {
  return {
    tableConfig: { ...setup.tableConfig },
    roundVariant: { ...setup.roundVariant },
    proposedBy: setup.proposedBy,
    acceptedBy: [...setup.acceptedBy],
    revision: setup.revision,
    howToPlay: getTeenPattiVariant(setup.roundVariant.variantId).howToPlay,
  };
}

export function teenPattiSetupAcceptedByAll(setup: TeenPattiLobbySetup, playerIds: PlayerId[]): boolean {
  return playerIds.every((playerId) => setup.acceptedBy.has(playerId));
}
