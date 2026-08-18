import { describe, expect, it } from 'vitest';
import { selectTeenPattiRoundVariant } from '../src/games/teenpatti/variantTable.js';
import { describeTeenPattiRoundVariant, teenPattiVariantsForTable, validateTeenPattiVariantPolicy, type TeenPattiVariantTablePolicy } from '../src/games/teenpatti/rules.js';

const dealerChoice: TeenPattiVariantTablePolicy = {
  mode: 'VARIANT_TABLE',
  variants: ['CLASSIC', 'MUFLIS', 'BEST_OF_FOUR', 'AK47', 'CLOSEST_TO_N'],
  rotation: 'DEALER_CHOICE',
};

describe('Teen Patti Variant Table policy', () => {
  it('requires at least two unique approved variants', () => {
    expect(() => teenPattiVariantsForTable({ mode: 'VARIANT_TABLE', variants: ['CLASSIC'], rotation: 'DEALER_CHOICE' })).toThrow(/at least two/);
    expect(() => teenPattiVariantsForTable({ mode: 'VARIANT_TABLE', variants: ['CLASSIC', 'CLASSIC'], rotation: 'DEALER_CHOICE' })).toThrow(/same variant twice/);
  });

  it('lets only the round dealer choose from the approved pool', () => {
    expect(() => selectTeenPattiRoundVariant(dealerChoice, {
      dealerId: 'D', chooserId: 'X', requested: { variantId: 'MUFLIS' },
    })).toThrow(/Only the dealer/);
    const selected = selectTeenPattiRoundVariant(dealerChoice, {
      dealerId: 'D', chooserId: 'D', requested: { variantId: 'MUFLIS' },
    });
    expect(selected.roundVariant.variantId).toBe('MUFLIS');
  });

  it('validates dealer-configured Closest to N before cards are dealt', () => {
    expect(() => selectTeenPattiRoundVariant(dealerChoice, {
      dealerId: 'D', chooserId: 'D', requested: { variantId: 'CLOSEST_TO_N', targetNumber: 77 },
    })).toThrow(/three-digit/);
    expect(selectTeenPattiRoundVariant(dealerChoice, {
      dealerId: 'D', chooserId: 'D', requested: { variantId: 'CLOSEST_TO_N', targetNumber: 786, reorderTargetCards: true },
    }).roundVariant.targetNumber).toBe(786);
  });

  it('can rotate automatically but still accepts required per-round parameters', () => {
    const policy: TeenPattiVariantTablePolicy = {
      mode: 'VARIANT_TABLE', variants: ['CLASSIC', 'CLOSEST_TO_N'], rotation: 'FIXED_ROTATION',
    };
    const first = selectTeenPattiRoundVariant(policy, { dealerId: 'A' });
    expect(first.roundVariant.variantId).toBe('CLASSIC');
    const second = selectTeenPattiRoundVariant(policy, {
      dealerId: 'B', previousRotationIndex: first.rotationIndex,
      requested: { variantId: 'CLOSEST_TO_N', targetNumber: 555, reorderTargetCards: false },
    });
    expect(second.roundVariant.variantId).toBe('CLOSEST_TO_N');
  });

  it('Surprise Me samples only from the host-approved runtime-ready pool', () => {
    const approved = ['CLASSIC', 'AK47', 'REVOLVING_JOKER'] as const;
    const policy: TeenPattiVariantTablePolicy = {
      mode: 'VARIANT_TABLE', variants: [...approved], rotation: 'SURPRISE_ME',
    };
    expect(() => validateTeenPattiVariantPolicy(policy, { requireRuntime: true })).not.toThrow();

    expect(selectTeenPattiRoundVariant(policy, { dealerId: 'D', random: () => 0, permitPendingDealerConfig: true, requireRuntime: true }).roundVariant.variantId)
      .toBe('CLASSIC');
    expect(selectTeenPattiRoundVariant(policy, { dealerId: 'D', random: () => 0.5, permitPendingDealerConfig: true, requireRuntime: true }).roundVariant.variantId)
      .toBe('AK47');
    expect(selectTeenPattiRoundVariant(policy, { dealerId: 'D', random: () => 0.999999, permitPendingDealerConfig: true, requireRuntime: true }).roundVariant.variantId)
      .toBe('REVOLVING_JOKER');
  });

  it('can select a configured variant first and wait for dealer parameters without weakening validation', () => {
    const policy: TeenPattiVariantTablePolicy = {
      mode: 'VARIANT_TABLE', variants: ['CLASSIC', 'CLOSEST_TO_N'], rotation: 'FIXED_ROTATION',
    };
    const first = selectTeenPattiRoundVariant(policy, { dealerId: 'A', requireRuntime: true, permitPendingDealerConfig: true });
    expect(first.roundVariant.variantId).toBe('CLASSIC');
    const pending = selectTeenPattiRoundVariant(policy, {
      dealerId: 'B', previousRotationIndex: first.rotationIndex, requireRuntime: true, permitPendingDealerConfig: true,
    });
    expect(pending.roundVariant).toEqual({ variantId: 'CLOSEST_TO_N' });
    expect(pending.needsDealerConfig).toBe(true);
    expect(() => selectTeenPattiRoundVariant(policy, {
      dealerId: 'B', previousRotationIndex: first.rotationIndex, requireRuntime: true,
    })).toThrow(/three-digit/);
  });

  it('treats K Little, Q Little and J Little as direct variants with no second dealer config', () => {
    const policy: TeenPattiVariantTablePolicy = {
      mode: 'VARIANT_TABLE', variants: ['K_LITTLE', 'Q_LITTLE', 'J_LITTLE'], rotation: 'DEALER_CHOICE',
    };
    for (const variantId of ['K_LITTLE', 'Q_LITTLE', 'J_LITTLE'] as const) {
      expect(selectTeenPattiRoundVariant(policy, {
        dealerId: 'D', chooserId: 'D', requested: { variantId }, requireRuntime: true,
      }).roundVariant).toEqual({ variantId });
    }
  });


  it('builds reconnect-safe player instructions from the exact round config', () => {
    const targetHelp = describeTeenPattiRoundVariant({
      variantId: 'CLOSEST_TO_N', targetNumber: 786, reorderTargetCards: false,
    });
    expect(targetHelp).toContain('Target: 786.');
    expect(targetHelp).toContain('not allowed');

    const littleHelp = describeTeenPattiRoundVariant({ variantId: 'K_LITTLE' });
    expect(littleHelp).toContain('Kings are wild.');
  });
});
