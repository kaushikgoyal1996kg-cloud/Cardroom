import { describe, expect, it } from 'vitest';
import { pokerQuickRaisePresets, potFractionRaiseTo } from './betSizing';

describe('PokerTable raise presets', () => {
  it('sizes fractional raises from the pot after calling, not by adding the full call twice', () => {
    // Pot 30, current bet 20, player owes 20. After the call the pot is 50;
    // half-pot raise is +25, so the correct raise-to target is 45.
    expect(potFractionRaiseTo(30, 20, 20, 0.5, 40, 1000)).toBe(45);
    expect(potFractionRaiseTo(30, 20, 20, 1, 40, 1000)).toBe(70);
  });

  it('clamps suggestions to the server-provided legal range', () => {
    expect(potFractionRaiseTo(300, 100, 50, 1, 160, 240)).toBe(240);
    expect(potFractionRaiseTo(10, 20, 0, 0.33, 40, 500)).toBe(40);
  });

  it('adds the exact max legal raise as an All-in shortcut on no-limit tables', () => {
    const presets = pokerQuickRaisePresets('NO_LIMIT', 120, 20, 20, 40, 500);
    expect(presets.at(-1)).toEqual({ label: 'All-in', amount: 500 });
  });

  it('does not add a separate All-in shortcut to pot-limit tables', () => {
    const presets = pokerQuickRaisePresets('POT_LIMIT', 120, 20, 20, 40, 160);
    expect(presets.some((preset) => preset.label === 'All-in')).toBe(false);
    expect(presets.at(-1)?.amount).toBe(160);
  });

  it('deduplicates clamped quick sizes on short stacks', () => {
    const presets = pokerQuickRaisePresets('NO_LIMIT', 1000, 100, 100, 180, 200);
    expect(new Set(presets.map((preset) => preset.amount)).size).toBe(presets.length);
    expect(presets.at(-1)).toEqual({ label: 'All-in', amount: 200 });
  });
});
