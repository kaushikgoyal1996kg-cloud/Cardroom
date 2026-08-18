/** Shared, dependency-free poker bet-sizing helpers for the table UI. */
export function clampWhole(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Converts a familiar pot-fraction shortcut into a raise-to target.
 * `pot` already includes the live bets on the table; after first calling,
 * the effective pot is `pot + toCall`. The player's prior street contribution
 * is implicit in `currentBet - toCall`, so the target is:
 *
 *   currentBet + fraction × (pot + toCall)
 *
 * The authoritative server-provided min/max range is always applied last.
 */
export function potFractionRaiseTo(
  pot: number,
  currentBet: number,
  toCall: number,
  fraction: number,
  minRaise: number,
  maxRaise: number
): number {
  return clampWhole(currentBet + (pot + toCall) * fraction, minRaise, maxRaise);
}

export interface PokerRaisePreset {
  label: string;
  amount: number;
}

/**
 * Builds the table's quick raise buttons from the authoritative legal range.
 * Pot-limit stops at the pot-sized cap; no-limit structures also expose the
 * exact max legal raise as an explicit All-in shortcut when it is not already
 * represented by a fractional preset.
 */
export function pokerQuickRaisePresets(
  betting: 'NO_LIMIT' | 'POT_LIMIT' | 'ANTE_NO_LIMIT',
  pot: number,
  currentBet: number,
  toCall: number,
  minRaise: number,
  maxRaise: number
): PokerRaisePreset[] {
  if (maxRaise <= 0 || minRaise <= 0 || maxRaise < minRaise) return [];

  const fractions: readonly (readonly [number, string])[] = betting === 'POT_LIMIT'
    ? [[0.5, '½ Pot'], [0.75, '¾ Pot'], [1, 'Pot']]
    : [[0.33, '⅓ Pot'], [0.5, '½ Pot'], [0.75, '¾ Pot'], [1, 'Pot']];

  const seen = new Set<number>();
  const presets: PokerRaisePreset[] = [];
  for (const [fraction, label] of fractions) {
    const amount = potFractionRaiseTo(Math.max(pot, 1), currentBet, toCall, fraction, minRaise, maxRaise);
    // On no-limit tables the maximum legal raise gets one unambiguous label:
    // All-in. If a pot-fraction shortcut clamps to that same number, omit the
    // fractional duplicate and reserve the value for the explicit All-in key.
    if (betting !== 'POT_LIMIT' && amount === maxRaise) continue;
    if (seen.has(amount)) continue;
    seen.add(amount);
    presets.push({ label, amount });
  }

  if (betting !== 'POT_LIMIT') {
    presets.push({ label: 'All-in', amount: maxRaise });
  }

  return presets;
}

