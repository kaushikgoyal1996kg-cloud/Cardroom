import { describe, expect, it } from 'vitest';
import { twoReferenceJokerSet } from './twoReferenceJokers';

describe('Two-Reference Joker option display', () => {
  it('shows the concrete joker ranks for either A/B assignment', () => {
    // A reference=5 as Up+Down; B reference=9 as Same.
    expect(twoReferenceJokerSet('5', '9')).toEqual(['4', '6', '9']);
    // Swapping the two public references produces the other selectable set.
    expect(twoReferenceJokerSet('9', '5')).toEqual(['8', '10', '5']);
  });

  it('uses the agreed wraparound and removes duplicate resulting ranks', () => {
    expect(twoReferenceJokerSet('A', 'K')).toEqual(['K', '2']);
    expect(twoReferenceJokerSet('2', 'A')).toEqual(['A', '3']);
  });
});
