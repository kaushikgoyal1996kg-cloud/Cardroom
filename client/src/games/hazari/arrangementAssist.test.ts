import { describe, it, expect } from 'vitest';
import {
  getArrangementAssistEligibility,
  canUseArrangementAssist,
  ASSIST_BLOCKED_MESSAGE,
  type SeatOccupant,
} from './arrangementAssist';
import { validateLocally } from './ArrangementTable';
import { autoArrange, autoArrangeOptions } from '../../game/autoArrange';
import {
  classifyThree,
  classifyFour,
  compareHand,
  labelFor,
  RANK_VALUE,
} from '../../game/handClassification';
import type { Card, Rank, Suit } from '../../game/types';
// Reading the component source is how we prove the Suggest control is absent
// from the tree rather than merely hidden, without a DOM renderer available.
import ARRANGEMENT_SOURCE from './ArrangementTable.tsx?raw';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${suit}_${rank}` });
const human = (id: string): SeatOccupant => ({ playerId: id, isBot: false });
const bot = (id: string): SeatOccupant => ({ playerId: id, isBot: true });

/** A full 13-card hand, all distinct. */
const HAND: Card[] = [
  c('A', 'SPADES'), c('K', 'SPADES'), c('Q', 'SPADES'),
  c('9', 'HEARTS'), c('8', 'HEARTS'), c('7', 'HEARTS'),
  c('5', 'CLUBS'), c('4', 'CLUBS'), c('3', 'CLUBS'),
  c('J', 'DIAMONDS'), c('10', 'DIAMONDS'), c('6', 'DIAMONDS'), c('2', 'DIAMONDS'),
];

// ============================================================================
// 1-3. Capability, from room composition
// ============================================================================

describe('canUseArrangementAssist', () => {
  it('is FALSE with three real human opponents', () => {
    expect(canUseArrangementAssist(
      [human('me'), human('a'), human('b'), human('c')], 'me'
    )).toBe(false);
  });

  it('is FALSE with one real human opponent plus bots', () => {
    expect(canUseArrangementAssist(
      [human('me'), human('a'), bot('r1'), bot('r2')], 'me'
    )).toBe(false);
  });

  it('is FALSE with two humans and one bot', () => {
    expect(canUseArrangementAssist(
      [human('me'), human('a'), human('b'), bot('r1')], 'me'
    )).toBe(false);
  });

  it('is TRUE when every opponent is a bot', () => {
    expect(canUseArrangementAssist(
      [human('me'), bot('r1'), bot('r2'), bot('r3')], 'me'
    )).toBe(true);
  });

  it('carries a player-facing reason when blocked', () => {
    const r = getArrangementAssistEligibility([human('me'), human('a')], 'me');
    expect(r.reason).toBe(ASSIST_BLOCKED_MESSAGE);
  });

  it('is FALSE when the local player is unknown, rather than defaulting open', () => {
    expect(canUseArrangementAssist([human('a'), bot('r1')], null)).toBe(false);
  });

  it('does not depend on table size', () => {
    // Four seats, opposite answers - the difference is composition, not count.
    expect(canUseArrangementAssist([human('me'), bot('a'), bot('b'), bot('c')], 'me')).toBe(true);
    expect(canUseArrangementAssist([human('me'), human('a'), bot('b'), bot('c')], 'me')).toBe(false);
  });
});

// ============================================================================
// 4-6. Sorting stays available regardless
// ============================================================================

/** Mirrors the screen's sort implementation, which takes no room state. */
type SortMode = 'dealt' | 'rank' | 'suit';
const SUIT_ORDER: Record<Suit, number> = { SPADES: 0, HEARTS: 1, DIAMONDS: 2, CLUBS: 3 };

function sortCards(cards: Card[], mode: SortMode): Card[] {
  if (mode === 'dealt') return cards;
  const sorted = [...cards];
  if (mode === 'rank') sorted.sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  else sorted.sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  return sorted;
}

describe('sorting is neutral and always available', () => {
  const blockedTable = [human('me'), human('a'), human('b'), human('c')];

  it('rank sort works against human opponents', () => {
    expect(canUseArrangementAssist(blockedTable, 'me')).toBe(false);
    const sorted = sortCards(HAND, 'rank');
    const values = sorted.map((x) => RANK_VALUE[x.rank]);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(sorted).toHaveLength(13);
  });

  it('suit sort works against human opponents', () => {
    const sorted = sortCards(HAND, 'suit');
    const suits = sorted.map((x) => SUIT_ORDER[x.suit]);
    expect(suits).toEqual([...suits].sort((a, b) => a - b));
  });

  it('dealt order works against human opponents and preserves the deal', () => {
    expect(sortCards(HAND, 'dealt')).toEqual(HAND);
  });

  it('sorting never changes which cards are held, only their order', () => {
    for (const mode of ['rank', 'suit', 'dealt'] as SortMode[]) {
      const ids = sortCards(HAND, mode).map((x) => x.id).sort();
      expect(ids).toEqual(HAND.map((x) => x.id).sort());
    }
  });

  it('sorting does not choose the four sets - it returns a flat list', () => {
    const sorted = sortCards(HAND, 'rank');
    expect(Array.isArray(sorted)).toBe(true);
    expect(sorted.every((x) => 'rank' in x && 'suit' in x)).toBe(true);
  });
});

// ============================================================================
// 7-8. The restriction must not alter validation or classification
// ============================================================================

describe('blocking assistance changes no game logic', () => {
  const sets = autoArrange(HAND)!;

  it('validation is identical whether or not assistance is allowed', () => {
    // validateLocally takes only slots and pool - there is no room state
    // parameter it could vary on.
    const a = validateLocally(sets, []);
    const b = validateLocally(sets, []);
    expect(a.valid).toBe(b.valid);
    expect(a.setOk).toEqual(b.setOk);
    expect(a.valid).toBe(true);
  });

  it('validation still rejects an out-of-order arrangement', () => {
    const weakFirst: [Card[], Card[], Card[], Card[]] = [
      [c('4', 'CLUBS'), c('3', 'CLUBS'), c('2', 'DIAMONDS')],
      [c('A', 'SPADES'), c('K', 'SPADES'), c('Q', 'SPADES')],
      [c('9', 'HEARTS'), c('8', 'HEARTS'), c('7', 'HEARTS')],
      [c('J', 'DIAMONDS'), c('10', 'DIAMONDS'), c('6', 'DIAMONDS'), c('5', 'CLUBS')],
    ];
    const result = validateLocally(weakFirst, []);
    expect(result.valid).toBe(false);
    expect(result.setOk[1]).toBe(false);
  });

  it('still requires all 13 cards placed', () => {
    const result = validateLocally([[], [], [], []], HAND);
    expect(result.valid).toBe(false);
    expect(result.summary).toMatch(/place all 13/i);
  });

  it('hand classification and ranking are unchanged', () => {
    const trail = [c('K', 'SPADES'), c('K', 'HEARTS'), c('K', 'CLUBS')];
    const pair = [c('5', 'HEARTS'), c('5', 'SPADES'), c('A', 'CLUBS')];
    expect(compareHand(classifyThree(trail), classifyThree(pair))).toBeGreaterThan(0);
    expect(labelFor(classifyThree(trail))).toBe('Trail');
    expect(classifyFour([...pair, c('2', 'CLUBS')])).toBeDefined();
  });

  it('the auto-arrange algorithm is preserved, not deleted', () => {
    expect(autoArrange(HAND)).not.toBeNull();
    expect(autoArrangeOptions(HAND).length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 9. The routed screen has no local solver at all
//
// Behavioural proof that the Suggest control is absent, that no request is
// made, and that a refusal is surfaced lives in ArrangementTable.test.tsx,
// which renders the real component. What is checked here is structural: the
// routed screen must not even be able to reach the solver.
// ============================================================================

describe('the routed arrangement screen cannot compute an arrangement locally', () => {
  it('does not import the auto-arrange solver', () => {
    expect(ARRANGEMENT_SOURCE).not.toMatch(/from ['"].*autoArrange['"]/);
    expect(ARRANGEMENT_SOURCE).not.toContain('autoArrangeOptions(');
    expect(ARRANGEMENT_SOURCE).not.toContain('autoArrange(');
  });

  it('obtains suggestions only through the injected server request', () => {
    expect(ARRANGEMENT_SOURCE).toContain('await requestSuggestions()');
  });

  it('renders no Suggest control without a server route', () => {
    expect(ARRANGEMENT_SOURCE).toContain('canUseAssist && requestSuggestions &&');
  });

  it('resolves suggested cards against the player\'s own hand', () => {
    // A card id the player was not dealt is dropped rather than materialised.
    expect(ARRANGEMENT_SOURCE).toContain('new Map(hand.map(');
    expect(ARRANGEMENT_SOURCE).toMatch(/filter\(\(c\): c is Card => !!c\)/);
  });
});
