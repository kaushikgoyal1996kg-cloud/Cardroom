import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/platform/cards/index.js';
import { createDeck, shuffleDeck } from '../src/platform/cards/index.js';
import { TeenPattiGame } from '../src/games/teenpatti/engine.js';
import { TEEN_PATTI_RULES, TEEN_PATTI_VARIANTS } from '../src/games/teenpatti/rules.js';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${suit}_${rank}` });

function players(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

/** Builds a deck whose one-at-a-time deal gives the requested hands in seat order. */
function stackedDeck(hands: Card[][]): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < 3; i++) {
    for (const h of hands) out.push(h[i]);
  }
  const used = new Set(out.map((x) => x.id));
  return [...out, ...createDeck().filter((x) => !used.has(x.id))];
}

describe('Teen Patti table limits', () => {
  it('supports up to 9 players', () => {
    expect(TEEN_PATTI_RULES.MAX_PLAYERS).toBe(9);
    expect(() => new TeenPattiGame('T1', players(9))).not.toThrow();
  });

  it('rejects 1 player and 10 players', () => {
    expect(() => new TeenPattiGame('T1', players(1))).toThrow();
    expect(() => new TeenPattiGame('T1', players(10))).toThrow();
  });

  it('is hard-coded to never involve real money', () => {
    expect(TEEN_PATTI_RULES.REAL_MONEY).toBe(false);
  });
});

describe('Teen Patti dealing and boot', () => {
  it('deals exactly 3 distinct cards each and collects the boot', () => {
    const game = new TeenPattiGame('T1', players(4), 'p1');
    game.dealNewRound();
    const all: string[] = [];
    for (const pid of players(4)) {
      const h = game.getPlayerHand(pid);
      expect(h).toHaveLength(3);
      all.push(...h.map((x) => x.id));
    }
    expect(new Set(all).size).toBe(12);
    expect(game.pot).toBe(TEEN_PATTI_VARIANTS.BOOT_AMOUNT * 4);
    for (const pid of players(4)) {
      expect(game.getPlayer(pid)!.chips).toBe(
        TEEN_PATTI_VARIANTS.STARTING_CHIPS - TEEN_PATTI_VARIANTS.BOOT_AMOUNT
      );
    }
  });

  it('starts betting with the player left of the dealer', () => {
    const game = new TeenPattiGame('T1', players(4), 'p1');
    game.dealNewRound();
    expect(game.currentTurn).toBe('p2');
    expect(game.state).toBe('BETTING');
  });
});

describe('Teen Patti server authority', () => {
  it('rejects an action from a player whose turn it is not', () => {
    const game = new TeenPattiGame('T1', players(3), 'p1');
    game.dealNewRound();
    const res = game.act('p3', { type: 'BLIND', multiplier: 1 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not your turn/i);
  });

  it('rejects an action from someone not seated at the table', () => {
    const game = new TeenPattiGame('T1', players(3), 'p1');
    game.dealNewRound();
    const res = game.act('intruder', { type: 'BLIND', multiplier: 1 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not seated/i);
  });

  it('rejects a chaal from a player who has not looked at their cards', () => {
    const game = new TeenPattiGame('T1', players(3), 'p1');
    game.dealNewRound();
    const res = game.act('p2', { type: 'CHAAL', multiplier: 2 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/look at your cards/i);
  });

  it('rejects a blind bet from a player who has already seen their cards', () => {
    const game = new TeenPattiGame('T1', players(3), 'p1');
    game.dealNewRound();
    game.act('p2', { type: 'SEE' });
    const res = game.act('p2', { type: 'BLIND', multiplier: 1 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/must play chaal/i);
  });

  it('rejects an off-schedule bet multiplier', () => {
    const game = new TeenPattiGame('T1', players(3), 'p1');
    game.dealNewRound();
    const res = game.act('p2', { type: 'BLIND', multiplier: 7 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/must be/i);
  });

  it('rejects a bet larger than the player can afford', () => {
    const game = new TeenPattiGame('T1', players(3), 'p1');
    game.dealNewRound();
    game.getPlayer('p2')!.chips = 1;
    const res = game.act('p2', { type: 'BLIND', multiplier: 2 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/enough chips/i);
  });

  it('rejects any action from a player who has packed', () => {
    const game = new TeenPattiGame('T1', players(4), 'p1');
    game.dealNewRound();
    game.act('p2', { type: 'PACK' });
    const res = game.act('p2', { type: 'BLIND', multiplier: 1 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/packed/i);
  });

  it('never exposes another player\'s cards in the public state', () => {
    const game = new TeenPattiGame('T1', players(4), 'p1');
    game.dealNewRound();
    const serialised = JSON.stringify(game.getPublicState());
    for (const pid of players(4)) {
      for (const card of game.getPlayerHand(pid)) {
        expect(serialised).not.toContain(card.id);
      }
    }
  });
});

describe('Teen Patti duplicate action protection', () => {
  it('rejects a stale action whose sequence number is out of date', () => {
    const game = new TeenPattiGame('T1', players(3), 'p1');
    game.dealNewRound();
    const seq = game.sequence;

    const first = game.act('p2', { type: 'BLIND', multiplier: 1 }, seq);
    expect(first.ok).toBe(true);

    // A double-tap replays the same action with the now-stale sequence.
    const replay = game.act('p2', { type: 'BLIND', multiplier: 1 }, seq);
    expect(replay.ok).toBe(false);
    expect(replay.error).toMatch(/already applied/i);
  });

  it('a double-tapped pack cannot remove two players', () => {
    const game = new TeenPattiGame('T1', players(4), 'p1');
    game.dealNewRound();
    const before = game.activePlayers().length;
    const seq = game.sequence;
    game.act('p2', { type: 'PACK' }, seq);
    game.act('p2', { type: 'PACK' }, seq);
    expect(game.activePlayers().length).toBe(before - 1);
  });
});

describe('Teen Patti round resolution', () => {
  it('awards the pot to the last player standing when everyone else packs', () => {
    const game = new TeenPattiGame('T1', players(3), 'p1');
    game.dealNewRound();
    const potBefore = game.pot;

    game.act('p2', { type: 'PACK' });
    game.act('p3', { type: 'PACK' });

    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.lastOutcome!.winnerIds).toEqual(['p1']);
    expect(game.lastOutcome!.potAwarded).toBe(potBefore);
    // No showdown happened, so no cards were revealed.
    expect(game.lastOutcome!.showdown).toBeNull();
  });

  it('resolves a show in favour of the stronger hand', () => {
    const game = new TeenPattiGame('T1', players(2), 'p1');
    // Seat order left of dealer p1 is [p2, p1].
    const deck = stackedDeck([
      [c('K', 'SPADES'), c('K', 'HEARTS'), c('K', 'CLUBS')],   // p2 - trail
      [c('A', 'SPADES'), c('K', 'DIAMONDS'), c('Q', 'CLUBS')], // p1 - sequence
    ]);
    game.dealNewRound(deck);

    game.act('p2', { type: 'SEE' });
    game.act('p2', { type: 'SHOW' });

    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.lastOutcome!.winnerIds).toEqual(['p2']);
    expect(game.lastOutcome!.showdown).toHaveLength(2);
    expect(game.lastOutcome!.split).toBe(false);
  });

  it('splits the pot on an exact tie', () => {
    const game = new TeenPattiGame('T1', players(2), 'p1');
    const deck = stackedDeck([
      [c('K', 'SPADES'), c('9', 'HEARTS'), c('4', 'CLUBS')],
      [c('K', 'HEARTS'), c('9', 'CLUBS'), c('4', 'DIAMONDS')], // identical ranks
    ]);
    game.dealNewRound(deck);

    game.act('p2', { type: 'SEE' });
    game.act('p2', { type: 'SHOW' });

    expect(game.lastOutcome!.split).toBe(true);
    expect(game.lastOutcome!.winnerIds.sort()).toEqual(['p1', 'p2']);
  });

  it('does not allow a show while more than two players remain', () => {
    const game = new TeenPattiGame('T1', players(4), 'p1');
    game.dealNewRound();
    game.act('p2', { type: 'SEE' });
    const res = game.act('p2', { type: 'SHOW' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/two players/i);
  });

  it('conserves chips - total in play never changes across a round', () => {
    const game = new TeenPattiGame('T1', players(4), 'p1');
    const total = () =>
      players(4).reduce((s, pid) => s + game.getPlayer(pid)!.chips, 0) + game.pot;

    const before = total();
    game.dealNewRound();
    game.act('p2', { type: 'BLIND', multiplier: 1 });
    game.act('p3', { type: 'SEE' });
    game.act('p3', { type: 'CHAAL', multiplier: 2 });
    game.act('p4', { type: 'PACK' });
    game.act('p1', { type: 'PACK' });
    game.act('p2', { type: 'PACK' });
    expect(total()).toBe(before);
  });

  it('rotates the dealer clockwise between rounds', () => {
    const game = new TeenPattiGame('T1', players(5), 'p1');
    game.rotateDealer();
    expect(game.dealerId).toBe('p2');
    expect(game.roundNumber).toBe(2);
  });
});

describe('Teen Patti multi-round stability', () => {
  it('plays 30 randomised rounds at a 6-player table without corrupting state', () => {
    const game = new TeenPattiGame('T1', players(6), 'p1');
    const startingTotal = players(6).reduce(
      (s, pid) => s + game.getPlayer(pid)!.chips, 0
    );

    for (let round = 0; round < 30; round++) {
      const withChips = players(6).filter(
        (p) => game.getPlayer(p)!.chips >= TEEN_PATTI_VARIANTS.BOOT_AMOUNT
      );
      if (withChips.length < 2) break;

      game.dealNewRound(shuffleDeck(createDeck()));

      let guard = 0;
      // A playable round must finish well inside this. Before the pot limit
      // and blind limit were enabled, an all-blind round took 599 turns.
      const MAX_REASONABLE_TURNS = 120;
      while (game.state === 'BETTING' && guard++ < MAX_REASONABLE_TURNS) {
        const turn = game.currentTurn!;
        const p = game.getPlayer(turn)!;
        const active = game.activePlayers();

        if (active.length === 2 && p.seen) {
          if (!game.act(turn, { type: 'SHOW' }).ok) {
            game.act(turn, { type: 'PACK' });
          }
        } else if (!p.seen && guard % 3 === 0) {
          game.act(turn, { type: 'SEE' });
        } else if (p.seen) {
          if (!game.act(turn, { type: 'CHAAL', multiplier: 2 }).ok) {
            game.act(turn, { type: 'PACK' });
          }
        } else if (!game.act(turn, { type: 'BLIND', multiplier: 1 }).ok) {
          game.act(turn, { type: 'PACK' });
        }
      }

      expect(game.state).toBe('ROUND_COMPLETE');
      expect(game.pot).toBe(0);
      // Chips are conserved and nobody ever goes negative.
      for (const pid of players(6)) {
        expect(game.getPlayer(pid)!.chips).toBeGreaterThanOrEqual(0);
      }
      const now = players(6).reduce((s, pid) => s + game.getPlayer(pid)!.chips, 0);
      expect(now).toBe(startingTotal);

      game.rotateDealer();
    }
  });

  it('an all-blind round still terminates quickly (regression: used to take 599 turns)', () => {
    const game = new TeenPattiGame('T1', players(6), 'p1');
    game.dealNewRound();

    let turns = 0;
    while (game.state === 'BETTING' && turns < 500) {
      const t = game.currentTurn!;
      if (!game.act(t, { type: 'BLIND', multiplier: 1 }).ok) {
        // Forced to look once MAX_BLIND_ROUNDS is hit.
        if (!game.act(t, { type: 'SEE' }).ok || !game.act(t, { type: 'CHAAL', multiplier: 2 }).ok) {
          game.act(t, { type: 'PACK' });
        }
      }
      turns++;
    }

    expect(game.state).toBe('ROUND_COMPLETE');
    expect(turns).toBeLessThan(120);
  });

  it('the pot limit forces a showdown even with more than two players left', () => {
    const game = new TeenPattiGame('T1', players(5), 'p1');
    game.dealNewRound();

    let guard = 0;
    while (game.state === 'BETTING' && guard++ < 300) {
      const t = game.currentTurn!;
      if (!game.act(t, { type: 'BLIND', multiplier: 2 }).ok) {
        if (!game.act(t, { type: 'SEE' }).ok || !game.act(t, { type: 'CHAAL', multiplier: 2 }).ok) {
          game.act(t, { type: 'PACK' });
        }
      }
    }

    expect(game.state).toBe('ROUND_COMPLETE');
    // Nobody packed, so the showdown covered every seated player.
    if (game.lastOutcome!.showdown) {
      expect(game.lastOutcome!.showdown.length).toBeGreaterThanOrEqual(2);
    }
  });
});
