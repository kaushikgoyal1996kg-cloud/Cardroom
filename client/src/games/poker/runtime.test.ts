import { describe, expect, it } from 'vitest';
import type { PokerPublicStatePayload } from '../../game/types';
import { pokerRuntimeIdentities, pokerSeatPlayers, pokerStreetLabel, pokerWinnerNames } from './runtime';

const state: PokerPublicStatePayload = {
  state: 'FLOP',
  sequence: 7,
  handNumber: 2,
  variantId: 'PLO5',
  variant: { id: 'PLO5', name: 'Pot-Limit Omaha 5', shortName: 'PLO5', holeCards: 5, betting: 'POT_LIMIT', minPlayers: 2, maxPlayers: 8, howToPlay: 'Use exactly two hole cards and three board cards.' },
  tableConfig: { mode: 'FIXED', fixedVariant: 'PLO5', startingStack: 1000, smallBlind: 10, bigBlind: 20, ante: 0, actionTimerSeconds: 0 },
  dealerId: 'A',
  nextVariantChooserId: null,
  approvedVariantIds: ['PLO5'],
  approvedVariants: [{ id: 'PLO5', name: 'Pot-Limit Omaha 5', shortName: 'PLO5', holeCards: 5, betting: 'POT_LIMIT', minPlayers: 2, maxPlayers: 8, howToPlay: 'Use exactly two hole cards and three board cards.' }],
  currentTurn: 'B',
  board: [],
  pot: 120,
  currentBet: 40,
  minRaiseTo: 80,
  maxRaiseTo: 240,
  handHistory: [],
  outcome: null,
  players: [
    { playerId: 'A', stack: 880, folded: true, allIn: false, streetCommitted: 0, handCommitted: 20, actedThisStreet: true, topUps: 0, handsWon: 0 },
    { playerId: 'B', stack: 960, folded: false, allIn: false, streetCommitted: 0, handCommitted: 40, actedThisStreet: false, topUps: 0, handsWon: 0 },
  ],
};

describe('Poker hidden runtime adapter', () => {
  it('maps only authoritative seated poker players and preserves stack/status', () => {
    const seats = pokerSeatPlayers(state, [
      { playerId: 'A', name: 'Anchal', avatar: 'A', connected: true },
      { playerId: 'B', name: 'Bimal', avatar: 'B', connected: false },
      { playerId: 'OLD', name: 'Departed', connected: true },
    ]);
    expect(seats).toHaveLength(2);
    expect(seats[0]).toMatchObject({ playerId: 'A', name: 'Anchal', score: 880, statusLabel: 'Folded' });
    expect(seats[1]).toMatchObject({ playerId: 'B', name: 'Bimal', score: 960, connection: 'DISCONNECTED', statusLabel: 'Acting' });
  });

  it('keeps the current street wager visible on the shared seat without inventing chip state', () => {
    const bettingState: PokerPublicStatePayload = {
      ...state,
      currentTurn: 'B',
      players: state.players.map((player) => player.playerId === 'B'
        ? { ...player, streetCommitted: 40, actedThisStreet: false }
        : player),
    };
    const seats = pokerSeatPlayers(bettingState, [
      { playerId: 'A', name: 'Anchal', connected: true },
      { playerId: 'B', name: 'Bimal', connected: true },
    ]);
    expect(seats[1].statusLabel).toBe('Acting · 40 bet');
  });

  it('derives the street label while betting/rule metadata stays server-authored', () => {
    expect(state.variant.betting).toBe('POT_LIMIT');
    expect(state.variant.holeCards).toBe(5);
    expect(pokerStreetLabel('PREFLOP')).toBe('Pre-flop');
    expect(pokerStreetLabel('HAND_COMPLETE')).toBe('Hand complete');
  });

  it('keeps a settled/departed player name available for the still-visible hand result', () => {
    const identities = pokerRuntimeIdentities(
      [
        { playerId: 'B', name: 'Bimal', avatar: 'B', connected: true, ready: true, isHost: true, isBot: false },
      ],
      {
        A: { name: 'Anchal', avatar: 'A' },
        B: { name: 'Old Bimal', avatar: 'OLD' },
      }
    );

    expect(pokerWinnerNames(['A'], identities)).toEqual(['Anchal']);
    // Live room identity always wins over the archived fallback.
    expect(pokerWinnerNames(['B'], identities)).toEqual(['Bimal']);
  });
});
