import type { PlayerId } from '../../platform/rooms/types.js';
import {
  DEFAULT_TEEN_PATTI_TABLE_CONFIG,
  DEFAULT_TEEN_PATTI_VARIANT_POLICY,
  describeTeenPattiRoundVariant,
  getTeenPattiVariant,
  teenPattiVariantNeedsDealerConfig,
  teenPattiVariantsForTable,
  validateTeenPattiRoundVariantConfig,
  validateTeenPattiTableConfig,
  validateTeenPattiVariantPolicy,
  type TeenPattiRoundVariantConfig,
  type TeenPattiTableConfig,
  type TeenPattiVariantTablePolicy,
} from './rules.js';

/** Opaque RoomState.gameSetup payload while a Teen Patti table is in lobby. */
export interface TeenPattiLobbySetup {
  kind: 'TEEN_PATTI';
  tableConfig: TeenPattiTableConfig;
  variantPolicy: TeenPattiVariantTablePolicy;
  /**
   * Exact first/default round config for FIXED tables. On a Variant Table this
   * is only a reconnect-safe preview/default; Dealer Choice still belongs to
   * the actual dealer after the dealer draw; Fixed Rotation and Surprise Me are
   * selected by the server from the approved policy.
   */
  roundVariant: TeenPattiRoundVariantConfig;
  proposedBy: PlayerId;
  acceptedBy: Set<PlayerId>;
  revision: number;
}

export interface TeenPattiLobbySetupPublic {
  tableConfig: TeenPattiTableConfig;
  variantPolicy: TeenPattiVariantTablePolicy;
  roundVariant: TeenPattiRoundVariantConfig;
  proposedBy: PlayerId;
  acceptedBy: PlayerId[];
  revision: number;
  howToPlay: string;
}

function defaultPolicyFor(roundVariant: TeenPattiRoundVariantConfig): TeenPattiVariantTablePolicy {
  return { mode: 'FIXED', fixedVariant: roundVariant.variantId };
}

function describeLobbyPolicy(
  policy: TeenPattiVariantTablePolicy,
  roundVariant: TeenPattiRoundVariantConfig
): string {
  if (policy.mode === 'FIXED') return describeTeenPattiRoundVariant(roundVariant);
  const variants = teenPattiVariantsForTable(policy).map((variant) => variant.name).join(', ');
  if (policy.rotation === 'DEALER_CHOICE') {
    return `Variant Table. Host-approved games: ${variants}. The dealer for each round may choose one approved variant or choose Surprise Me, in which case the server randomly selects from this same approved pool before cards are dealt.`;
  }
  if (policy.rotation === 'SURPRISE_ME') {
    return `Surprise Me Table. The server randomly selects one Teen Patti variant from the host-approved pool before every round. Approved pool: ${variants}.`;
  }
  return `Variant Table. Approved games: ${variants}. The server rotates them in the approved order between rounds.`;
}

export function createTeenPattiLobbySetup(
  proposedBy: PlayerId,
  tableConfig: TeenPattiTableConfig = DEFAULT_TEEN_PATTI_TABLE_CONFIG,
  roundVariant: TeenPattiRoundVariantConfig = { variantId: 'CLASSIC' },
  revision = 1,
  variantPolicy: TeenPattiVariantTablePolicy = defaultPolicyFor(roundVariant)
): TeenPattiLobbySetup {
  validateTeenPattiTableConfig(tableConfig);
  validateTeenPattiVariantPolicy(variantPolicy, { requireRuntime: true });

  if (variantPolicy.mode === 'FIXED') {
    if (variantPolicy.fixedVariant !== roundVariant.variantId) {
      throw new Error('The fixed Teen Patti table variant must match the proposed round variant.');
    }
    validateTeenPattiRoundVariantConfig(roundVariant, { requireRuntime: true, allowMissingDealerConfig: teenPattiVariantNeedsDealerConfig(roundVariant.variantId) });
  } else {
    const allowed = teenPattiVariantsForTable(variantPolicy).map((variant) => variant.id);
    if (!allowed.includes(roundVariant.variantId)) {
      throw new Error('The Teen Patti setup preview variant must belong to the approved Variant Table pool.');
    }
    // Runtime-ready variants currently require no extra round parameter. Keep
    // this validation here so later named/target variants cannot enter the
    // network path without their exact config being supplied.
    validateTeenPattiRoundVariantConfig(roundVariant, { requireRuntime: true, allowMissingDealerConfig: teenPattiVariantNeedsDealerConfig(roundVariant.variantId) });
  }

  const descriptor = getTeenPattiVariant(roundVariant.variantId);
  if (!descriptor.runtimeImplemented) throw new Error(`${descriptor.name} is not available to play yet.`);

  return {
    kind: 'TEEN_PATTI',
    tableConfig: { ...tableConfig },
    variantPolicy: {
      ...variantPolicy,
      variants: variantPolicy.variants ? [...variantPolicy.variants] : undefined,
    },
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
  return setup.kind === 'TEEN_PATTI'
    && setup.acceptedBy instanceof Set
    && !!setup.tableConfig
    && !!setup.roundVariant
    && !!setup.variantPolicy;
}

export function publicTeenPattiLobbySetup(setup: TeenPattiLobbySetup): TeenPattiLobbySetupPublic {
  return {
    tableConfig: { ...setup.tableConfig },
    variantPolicy: {
      ...setup.variantPolicy,
      variants: setup.variantPolicy.variants ? [...setup.variantPolicy.variants] : undefined,
    },
    roundVariant: { ...setup.roundVariant },
    proposedBy: setup.proposedBy,
    acceptedBy: [...setup.acceptedBy],
    revision: setup.revision,
    howToPlay: `${describeLobbyPolicy(setup.variantPolicy, setup.roundVariant)} ${setup.tableConfig.friendlyAssist ? 'Friendly Assist is on: after packing, a player may request consent to watch one active friend and send private suggestions; accepting while blind changes that active player to seen betting status.' : 'Friendly Assist is off for this table.'}`,
  };
}

export function teenPattiSetupAcceptedByAll(setup: TeenPattiLobbySetup, playerIds: PlayerId[]): boolean {
  return playerIds.every((playerId) => setup.acceptedBy.has(playerId));
}

export { DEFAULT_TEEN_PATTI_VARIANT_POLICY };
