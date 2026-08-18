import {
  teenPattiVariantNeedsDealerConfig,
  teenPattiVariantsForTable,
  validateTeenPattiRoundVariantConfig,
  type TeenPattiRoundVariantConfig,
  type TeenPattiVariantId,
  type TeenPattiVariantTablePolicy,
} from './rules.js';

export interface TeenPattiVariantSelectionResult {
  roundVariant: TeenPattiRoundVariantConfig;
  /** For FIXED_ROTATION tables, feed this back into the next selection. */
  rotationIndex: number;
  /** True when the server selected the variant but the dealer still owes round parameters. */
  needsDealerConfig: boolean;
}

function selectRandomApprovedVariant(
  policy: TeenPattiVariantTablePolicy,
  params: {
    random?: () => number;
    requireRuntime?: boolean;
    permitPendingDealerConfig?: boolean;
  }
): { roundVariant: TeenPattiRoundVariantConfig; index: number; needsDealerConfig: boolean } {
  const allowed = teenPattiVariantsForTable(policy).map((variant) => variant.id);
  const random = params.random ?? Math.random;
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error('Surprise Me random source must return a number from 0 (inclusive) to 1 (exclusive).');
  }
  const index = Math.floor(sample * allowed.length);
  const variantId = allowed[index] as TeenPattiVariantId;
  const roundVariant: TeenPattiRoundVariantConfig = { variantId };
  const pending = !!params.permitPendingDealerConfig && teenPattiVariantNeedsDealerConfig(variantId);
  validateTeenPattiRoundVariantConfig(roundVariant, {
    requireRuntime: params.requireRuntime,
    allowMissingDealerConfig: pending,
  });
  return { roundVariant, index, needsDealerConfig: pending };
}

/** Server-owned Surprise Me draw from exactly the host-approved table pool. */
export function selectTeenPattiSurpriseVariant(
  policy: TeenPattiVariantTablePolicy,
  params: {
    random?: () => number;
    requireRuntime?: boolean;
    permitPendingDealerConfig?: boolean;
  } = {}
): TeenPattiVariantSelectionResult {
  if (policy.mode !== 'VARIANT_TABLE') {
    throw new Error('Surprise Me requires a Teen Patti Variant Table with a host-approved pool.');
  }
  const selected = selectRandomApprovedVariant(policy, params);
  return {
    roundVariant: selected.roundVariant,
    rotationIndex: selected.index,
    needsDealerConfig: selected.needsDealerConfig,
  };
}

/**
 * Resolves exactly one round's variant BEFORE any round cards are dealt.
 * The caller owns dealer determination; this helper owns only variant policy.
 */
export function selectTeenPattiRoundVariant(
  policy: TeenPattiVariantTablePolicy,
  params: {
    dealerId: string;
    chooserId?: string;
    requested?: TeenPattiRoundVariantConfig;
    previousRotationIndex?: number;
    /** Server-owned randomness hook. Tests can inject a deterministic source. */
    random?: () => number;
    /** Allow the server to select a configured variant before the dealer supplies its round parameters. */
    permitPendingDealerConfig?: boolean;
    /** Keep false while building; turn true at the network boundary before enabling a variant. */
    requireRuntime?: boolean;
  }
): TeenPattiVariantSelectionResult {
  const allowed = teenPattiVariantsForTable(policy).map((variant) => variant.id);

  const validateSelection = (roundVariant: TeenPattiRoundVariantConfig) => {
    const pending = !!params.permitPendingDealerConfig && teenPattiVariantNeedsDealerConfig(roundVariant.variantId);
    validateTeenPattiRoundVariantConfig(roundVariant, {
      requireRuntime: params.requireRuntime,
      allowMissingDealerConfig: pending,
    });
    return pending && (roundVariant.targetNumber === undefined && roundVariant.fiveCardJoker === undefined);
  };

  if (policy.mode === 'FIXED') {
    const roundVariant: TeenPattiRoundVariantConfig = params.requested ?? { variantId: policy.fixedVariant! };
    if (roundVariant.variantId !== policy.fixedVariant) throw new Error('This fixed Teen Patti table cannot change variant.');
    const needsDealerConfig = validateSelection(roundVariant);
    return { roundVariant: { ...roundVariant }, rotationIndex: 0, needsDealerConfig };
  }

  if (policy.rotation === 'DEALER_CHOICE') {
    if (params.chooserId !== params.dealerId) throw new Error('Only the dealer may choose the Teen Patti round variant.');
    if (!params.requested) throw new Error('Dealer Choice needs a variant before the round can be dealt.');
    if (!allowed.includes(params.requested.variantId)) throw new Error('That Teen Patti variant is not approved for this table.');
    validateTeenPattiRoundVariantConfig(params.requested, { requireRuntime: params.requireRuntime });
    return { roundVariant: { ...params.requested }, rotationIndex: params.previousRotationIndex ?? -1, needsDealerConfig: false };
  }

  if (policy.rotation === 'SURPRISE_ME') {
    return selectTeenPattiSurpriseVariant(policy, {
      random: params.random,
      requireRuntime: params.requireRuntime,
      permitPendingDealerConfig: params.permitPendingDealerConfig,
    });
  }

  const index = ((params.previousRotationIndex ?? -1) + 1) % allowed.length;
  const expected = allowed[index] as TeenPattiVariantId;
  const roundVariant: TeenPattiRoundVariantConfig = params.requested ?? { variantId: expected };
  if (roundVariant.variantId !== expected) throw new Error(`Fixed Rotation expects ${expected} for this round.`);
  const needsDealerConfig = validateSelection(roundVariant);
  return { roundVariant: { ...roundVariant }, rotationIndex: index, needsDealerConfig };
}
