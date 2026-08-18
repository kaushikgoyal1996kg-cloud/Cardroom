import { describe, expect, it } from 'vitest';
import { acceptPokerLobbySetup, createPokerLobbySetup, pokerSetupAcceptedByAll, publicPokerLobbySetup } from '../src/games/poker/lobbySetup.js';
import type { PokerTableConfig } from '../src/games/poker/rules.js';

const config: PokerTableConfig = {
  mode: 'VARIANT_TABLE',
  variants: ['TEXAS_HOLDEM', 'PLO4', 'PLO5', 'PLO6'],
  rotation: 'DEALER_CHOICE',
  startingStack: 2000,
  smallBlind: 10,
  bigBlind: 20,
  ante: 0,
  actionTimerSeconds: 0,
};

describe('Poker lobby setup', () => {
  it('derives the strictest seat cap and requires unanimous acceptance', () => {
    const setup = createPokerLobbySetup('A', config, ['A', 'B', 'C']);
    const pub = publicPokerLobbySetup(setup);
    expect(pub.seatCap).toBe(7);
    expect(pub.variants.map((v) => v.id)).toEqual(['TEXAS_HOLDEM', 'PLO4', 'PLO5', 'PLO6']);
    expect(pokerSetupAcceptedByAll(setup, ['A', 'B', 'C'])).toBe(false);
    acceptPokerLobbySetup(setup, 'B', 1);
    acceptPokerLobbySetup(setup, 'C', 1);
    expect(pokerSetupAcceptedByAll(setup, ['A', 'B', 'C'])).toBe(true);
  });

  it('rejects a stale setup acceptance', () => {
    const setup = createPokerLobbySetup('A', config, ['A', 'B'], 3);
    expect(() => acceptPokerLobbySetup(setup, 'B', 2)).toThrow(/changed/);
  });

  it('refuses a configured action clock until authoritative timeout actions exist', () => {
    expect(() => createPokerLobbySetup('A', { ...config, actionTimerSeconds: 20 }, ['A', 'B'])).toThrow(/action clock is not enabled/i);
  });

  it('refuses too many seats for the selected variants', () => {
    expect(() => createPokerLobbySetup('1', config, ['1','2','3','4','5','6','7','8'])).toThrow(/at most 7/);
  });
});
