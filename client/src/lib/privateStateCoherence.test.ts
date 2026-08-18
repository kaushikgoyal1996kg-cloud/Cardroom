import { describe, expect, it } from 'vitest';
import type {
  PokerPrivateStatePayload,
  PokerPublicStatePayload,
  TeenPattiPrivateStatePayload,
  TeenPattiPublicStatePayload,
} from '../game/types';
import { coherentPokerPrivateState, coherentTeenPattiPrivateState } from './privateStateCoherence';

const teenPublic = { roundNumber: 4, sequence: 12 } as TeenPattiPublicStatePayload;
const teenPrivate: TeenPattiPrivateStatePayload = { roundNumber: 4, sequence: 12, cards: [], cardCount: 0, cardsViewed: false, seen: false, friendlyAssist: { enabled: false, coachLockedTargetPlayerId: null, outgoing: null, incoming: [] }, twoReferenceAssignment: null, discardState: null };
const pokerPublic = { handNumber: 7, sequence: 31 } as PokerPublicStatePayload;
const pokerPrivate: PokerPrivateStatePayload = { handNumber: 7, sequence: 31, holeCards: [], toCall: 0, legalActions: { fold: false, check: false, call: false, raise: false, minRaiseTo: null, maxRaiseTo: null } };

describe('private/public snapshot coherence', () => {
  it('accepts Teen Patti private state only for the exact public round and sequence', () => {
    expect(coherentTeenPattiPrivateState(teenPublic, teenPrivate)).toBe(teenPrivate);
    expect(coherentTeenPattiPrivateState(teenPublic, { ...teenPrivate, roundNumber: 3 })).toBeNull();
    expect(coherentTeenPattiPrivateState(teenPublic, { ...teenPrivate, sequence: 11 })).toBeNull();
  });

  it('accepts Poker hole cards/legal actions only for the exact public hand and sequence', () => {
    expect(coherentPokerPrivateState(pokerPublic, pokerPrivate)).toBe(pokerPrivate);
    expect(coherentPokerPrivateState(pokerPublic, { ...pokerPrivate, handNumber: 6 })).toBeNull();
    expect(coherentPokerPrivateState(pokerPublic, { ...pokerPrivate, sequence: 30 })).toBeNull();
  });

  it('never exposes private state before both halves of the authoritative snapshot exist', () => {
    expect(coherentTeenPattiPrivateState(null, teenPrivate)).toBeNull();
    expect(coherentTeenPattiPrivateState(teenPublic, null)).toBeNull();
    expect(coherentPokerPrivateState(null, pokerPrivate)).toBeNull();
    expect(coherentPokerPrivateState(pokerPublic, null)).toBeNull();
  });
});
