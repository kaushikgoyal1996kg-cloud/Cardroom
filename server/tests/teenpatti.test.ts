import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../src/platform/cards/index.js';
import { createDeck } from '../src/platform/cards/index.js';
import {
  TeenPattiGame,
  drawInitialTeenPattiDealer,
} from '../src/games/teenpatti/engine.js';
import {
  TEEN_PATTI_RULES,
  TEEN_PATTI_VARIANTS,
  nextBlindAmount,
} from '../src/games/teenpatti/rules.js';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${suit}_${rank}` });

function deckBeginningWith(cards: Card[]): Card[] {
  const used = new Set(cards.map((card) => card.id));
  return [...cards, ...createDeck().filter((card) => !used.has(card.id))];
}

/** Build a deck whose round-robin deal gives exactly these hands in order. */
function deckForHands(order: string[], hands: Record<string, Card[]>): Card[] {
  const count = hands[order[0]].length;
  const beginning: Card[] = [];
  for (let round = 0; round < count; round++) {
    for (const playerId of order) beginning.push(hands[playerId][round]);
  }
  return deckBeginningWith(beginning);
}

const config = {
  startingBalance: 1000,
  bootAmount: 10,
  baseBlind: 20,
  maxBlind: 60,
};

describe('Teen Patti authoritative rules', () => {
  it('supports 2-9 players and rejects duplicate/out-of-range tables', () => {
    expect(() => new TeenPattiGame('T', ids(2))).not.toThrow();
    expect(() => new TeenPattiGame('T', ids(9))).not.toThrow();
    expect(() => new TeenPattiGame('T', ids(1))).toThrow(/2-9/);
    expect(() => new TeenPattiGame('T', ids(10))).toThrow(/2-9/);
    expect(() => new TeenPattiGame('T', ['p1', 'p1'])).toThrow(/duplicate/i);
  });

  it('locks the agreed blind and sideshow constants', () => {
    expect(TEEN_PATTI_RULES.MAX_BLIND_TURNS).toBe(3);
    expect(TEEN_PATTI_RULES.SEEN_MULTIPLIER).toBe(2);
    expect(TEEN_PATTI_RULES.NEXT_DEALER).toBe('PREVIOUS_ROUND_WINNER');
    expect(TEEN_PATTI_RULES.COMPULSORY_SIDESHOW).toBe(false);
    expect(nextBlindAmount(20, 60)).toBe(40);
    expect(nextBlindAmount(40, 60)).toBe(60);
    expect(nextBlindAmount(60, 60)).toBe(60);
  });

  it('rejects a table setup whose starting balance cannot cover the first boot', () => {
    expect(() => new TeenPattiGame('T', ids(2), {
      tableConfig: { startingBalance: 5, bootAmount: 10, baseBlind: 10, maxBlind: 20 },
    })).toThrow(/first boot/i);
  });

  it('keeps K Little, Q Little and J Little as separate runtime-enabled variants', () => {
    expect(TEEN_PATTI_VARIANTS.K_LITTLE.runtimeImplemented).toBe(true);
    expect(TEEN_PATTI_VARIANTS.Q_LITTLE.runtimeImplemented).toBe(true);
    expect(TEEN_PATTI_VARIANTS.J_LITTLE.runtimeImplemented).toBe(true);
    expect(() => new TeenPattiGame('T', ids(3), { roundVariant: { variantId: 'K_LITTLE' } })).not.toThrow();
    expect(() => new TeenPattiGame('T', ids(3), { roundVariant: { variantId: 'Q_LITTLE' } })).not.toThrow();
    expect(() => new TeenPattiGame('T', ids(3), { roundVariant: { variantId: 'J_LITTLE' } })).not.toThrow();
  });
});

describe('Teen Patti dealer and dealing', () => {
  it('chooses the initial dealer by Ace-high draw and redraws tied leaders', () => {
    const drawDeck = deckBeginningWith([
      c('A', 'SPADES'), // p1
      c('A', 'HEARTS'), // p2
      c('K', 'CLUBS'),  // p3 -> eliminated
      c('10', 'DIAMONDS'), // p1 redraw
      c('Q', 'SPADES'),    // p2 redraw -> dealer
    ]);
    const result = drawInitialTeenPattiDealer(['p1', 'p2', 'p3'], drawDeck);
    expect(result.dealerId).toBe('p2');
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[1].contenders).toEqual(['p1', 'p2']);
  });

  it('collects the boot from everyone and starts with player clockwise of dealer', () => {
    const game = new TeenPattiGame('T', ids(4), { initialDealerId: 'p2', tableConfig: config });
    game.dealNewRound(createDeck());
    expect(game.pot).toBe(40);
    expect(game.currentTurn).toBe('p3');
    expect(game.currentBlind).toBe(20);
    for (const id of ids(4)) {
      expect(game.getPlayer(id)!.chips).toBe(990);
      expect(game.getPlayerHand(id)).toHaveLength(3);
    }
  });

  it('requires top-up rather than silently sitting an underfunded player out', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.getPlayer('p2')!.chips = 5;
    expect(() => game.dealNewRound()).toThrow(/top-up required/i);
    expect(game.getPlayer('p2')!.packed).toBe(false);
  });
});

describe('Teen Patti privacy and betting', () => {
  it('does not expose any dealt hand in public state', () => {
    const game = new TeenPattiGame('T', ids(4), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    const publicJson = JSON.stringify(game.getPublicState());
    for (const id of ids(4)) {
      for (const card of game.getPlayerHand(id)) expect(publicJson).not.toContain(card.id);
    }
  });


  it('publishes the active variant identity and deal count without exposing private cards', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    const state = game.getPublicState();
    expect(state.variantName).toBe('Classic');
    expect(state.variantDealCount).toBe(3);
    expect(state.variantHelp).toMatch(/Three cards each/);
  });

  it('keeps own cards hidden until explicit See', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    expect(game.getPrivateState('p2')!.cards).toEqual([]);
    expect(game.act('p2', { type: 'SEE' }).ok).toBe(true);
    expect(game.getPrivateState('p2')!.cards).toHaveLength(3);
  });

  it('uses fixed blind doubling and caps at max blind', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    expect(game.act('p2', { type: 'BLIND' }).ok).toBe(true);
    expect(game.currentBlind).toBe(40);
    expect(game.act('p3', { type: 'BLIND' }).ok).toBe(true);
    expect(game.currentBlind).toBe(60);
    expect(game.act('p1', { type: 'BLIND' }).ok).toBe(true);
    expect(game.currentBlind).toBe(60);
  });

  it('forces seen betting status after three blind chances without revealing cards', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    for (let cycle = 0; cycle < 3; cycle++) {
      expect(game.act('p2', { type: 'BLIND' }).ok).toBe(true);
      expect(game.act('p3', { type: 'BLIND' }).ok).toBe(true);
      expect(game.act('p1', { type: 'BLIND' }).ok).toBe(true);
    }
    expect(game.currentTurn).toBe('p2');
    expect(game.getPlayer('p2')!.seen).toBe(true);
    expect(game.getPlayer('p2')!.cardsViewed).toBe(false);
    expect(game.getPrivateState('p2')!.cards).toEqual([]);
    expect(game.act('p2', { type: 'BLIND' }).ok).toBe(false);
    expect(game.act('p2', { type: 'CHAAL' }).ok).toBe(true);
  });

  it('seen amount is always exactly 2x current blind', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    game.act('p2', { type: 'SEE' });
    const before = game.getPlayer('p2')!.chips;
    expect(game.act('p2', { type: 'CHAAL' }).ok).toBe(true);
    expect(before - game.getPlayer('p2')!.chips).toBe(40);
    expect(game.currentBlind).toBe(20);
  });

  it('rejects stale duplicate actions by sequence', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    const seq = game.sequence;
    expect(game.act('p2', { type: 'BLIND' }, seq).ok).toBe(true);
    expect(game.act('p2', { type: 'BLIND' }, seq).error).toMatch(/already applied/i);
  });
});

describe('Teen Patti optional all-seen sideshow', () => {
  it('keeps normal Chaal legal when everyone is seen and makes Sideshow an optional anticlockwise action', () => {
    const order = ['p2', 'p3', 'p4', 'p1']; // dealer p1 -> deal/first turn starts p2
    const deck = deckForHands(order, {
      p2: [c('9', 'SPADES'), c('7', 'HEARTS'), c('4', 'CLUBS')],
      p3: [c('Q', 'SPADES'), c('J', 'HEARTS'), c('8', 'CLUBS')],
      p4: [c('K', 'SPADES'), c('K', 'HEARTS'), c('2', 'CLUBS')],
      p1: [c('A', 'SPADES'), c('A', 'HEARTS'), c('A', 'CLUBS')],
    });
    const game = new TeenPattiGame('T', ids(4), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(deck);
    for (const id of ids(4)) game.getPlayer(id)!.seen = true;

    expect(game.currentTurn).toBe('p2');
    expect(game.act('p2', { type: 'CHAAL' }).ok).toBe(true);
    expect(game.currentTurn).toBe('p3');
    expect(game.act('p3', { type: 'SIDESHOW' }).ok).toBe(true);
    expect(game.lastSideshow).toMatchObject({ initiatorId: 'p3', opponentId: 'p2', packedPlayerId: 'p2' });
  });

  it('packs the initiator on an exact sideshow tie', () => {
    const order = ['p2', 'p3', 'p1'];
    const deck = deckForHands(order, {
      p2: [c('K', 'SPADES'), c('9', 'HEARTS'), c('4', 'CLUBS')],
      p3: [c('Q', 'SPADES'), c('8', 'HEARTS'), c('3', 'CLUBS')],
      p1: [c('K', 'HEARTS'), c('9', 'CLUBS'), c('4', 'DIAMONDS')],
    });
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(deck);
    for (const id of ids(3)) game.getPlayer(id)!.seen = true;
    expect(game.act('p2', { type: 'SIDESHOW' }).ok).toBe(true);
    expect(game.lastSideshow).toMatchObject({ packedPlayerId: 'p2', tied: true });
  });
});

describe('Teen Patti Mutual Show', () => {
  it('allows a unanimous Mutual Show with three or more active players', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    expect(game.activePlayers()).toHaveLength(3);
    const turnBeforeVote = game.currentTurn;

    expect(game.act('p3', { type: 'REQUEST_OPEN_SHOW' }).ok).toBe(true);
    const proposal = game.getPublicState();
    expect(proposal.openShowRequestFrom).toBe('p3');
    expect(proposal.openShowAcceptedBy).toEqual(['p3']);
    expect(game.currentTurn).toBe(turnBeforeVote);

    expect(game.act('p1', { type: 'ACCEPT_OPEN_SHOW' }, proposal.sequence).ok).toBe(true);
    expect(game.state).toBe('BETTING');
    expect(game.act('p2', { type: 'ACCEPT_OPEN_SHOW' }, proposal.sequence).ok).toBe(true);
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.lastOutcome?.reason).toBe('MUTUAL_OPEN_SHOW');
    expect(game.lastOutcome?.showdown).toHaveLength(3);
  });

  it('cancels a final-two Mutual Show on decline and resumes the exact betting turn', () => {
    const game = new TeenPattiGame('T', ids(2), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    expect(game.currentTurn).toBe('p2');

    // The non-turn final player may propose, but a decline resumes p2's turn.
    expect(game.act('p1', { type: 'REQUEST_OPEN_SHOW' }).ok).toBe(true);
    const voteSeq = game.getPublicState().sequence;
    expect(game.act('p2', { type: 'DECLINE_OPEN_SHOW' }, voteSeq).ok).toBe(true);
    expect(game.getPublicState().openShowRequestFrom).toBeNull();
    expect(game.currentTurn).toBe('p2');

    const resumedSeq = game.getPublicState().sequence;
    expect(game.act('p2', { type: 'BLIND' }, resumedSeq).ok).toBe(true);
    expect(game.currentTurn).toBe('p1');
  });
});

describe('Teen Patti final two', () => {
  const finalDeck = () => deckForHands(['p2', 'p1'], {
    p2: [c('K', 'SPADES'), c('K', 'HEARTS'), c('K', 'CLUBS')],
    p1: [c('A', 'SPADES'), c('K', 'DIAMONDS'), c('Q', 'CLUBS')],
  });

  it('allows mutual open show with no extra payment', () => {
    const game = new TeenPattiGame('T', ids(2), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(finalDeck());
    const pot = game.pot;
    const p2Before = game.getPlayer('p2')!.chips;
    expect(game.act('p2', { type: 'REQUEST_OPEN_SHOW' }).ok).toBe(true);
    expect(game.act('p1', { type: 'ACCEPT_OPEN_SHOW' }).ok).toBe(true);
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.lastOutcome!.reason).toBe('MUTUAL_OPEN_SHOW');
    expect(game.lastOutcome!.winnerIds).toEqual(['p2']);
    expect(game.lastOutcome!.potAwarded).toBe(pot);
    expect(game.getPlayer('p2')!.chips).toBe(p2Before + pot);
  });

  it('paid showdown costs exactly the current seen amount', () => {
    const game = new TeenPattiGame('T', ids(2), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(finalDeck());
    const before = game.getPlayer('p2')!.chips;
    const initialPot = game.pot;
    expect(game.act('p2', { type: 'SHOWDOWN' }).ok).toBe(true);
    expect(game.lastOutcome!.potAwarded).toBe(initialPot + 40);
    // p2 wins, so after paying 40 it receives the whole resulting pot.
    expect(game.getPlayer('p2')!.chips).toBe(before - 40 + initialPot + 40);
  });

  it('splits an exact equal final hand equally', () => {
    const tieDeck = deckForHands(['p2', 'p1'], {
      p2: [c('K', 'SPADES'), c('9', 'HEARTS'), c('4', 'CLUBS')],
      p1: [c('K', 'HEARTS'), c('9', 'CLUBS'), c('4', 'DIAMONDS')],
    });
    const game = new TeenPattiGame('T', ids(2), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(tieDeck);
    expect(game.act('p2', { type: 'REQUEST_OPEN_SHOW' }).ok).toBe(true);
    expect(game.act('p1', { type: 'ACCEPT_OPEN_SHOW' }).ok).toBe(true);
    expect(game.lastOutcome!.split).toBe(true);
    expect(game.lastOutcome!.winnerIds.sort()).toEqual(['p1', 'p2']);
    expect(game.getPlayer('p1')!.chips).toBe(1000);
    expect(game.getPlayer('p2')!.chips).toBe(1000);
  });
});

describe('Teen Patti rounds, top-ups and P&L', () => {
  it('makes the unique previous-round winner the next dealer', () => {
    const game = new TeenPattiGame('T', ids(2), { initialDealerId: 'p1', tableConfig: config });
    const deck = deckForHands(['p2', 'p1'], {
      p2: [c('K', 'SPADES'), c('K', 'HEARTS'), c('K', 'CLUBS')],
      p1: [c('A', 'SPADES'), c('K', 'DIAMONDS'), c('Q', 'CLUBS')],
    });
    game.dealNewRound(deck);
    game.act('p2', { type: 'SHOWDOWN' });
    expect(game.dealerId).toBe('p1'); // result screen stays on round's dealer
    expect(game.roundNumber).toBe(1);
    game.dealNewRound(createDeck());
    expect(game.dealerId).toBe('p2');
    expect(game.roundNumber).toBe(2);
  });

  it('does not advance round or dealer when the next boot is rejected for insufficient balance', () => {
    const small = { startingBalance: 30, bootAmount: 10, baseBlind: 10, maxBlind: 20 };
    const game = new TeenPattiGame('T', ids(2), { initialDealerId: 'p1', tableConfig: small });
    const winningDeck = deckForHands(['p2', 'p1'], {
      p2: [c('K', 'SPADES'), c('K', 'HEARTS'), c('K', 'CLUBS')],
      p1: [c('A', 'SPADES'), c('K', 'DIAMONDS'), c('Q', 'CLUBS')],
    });
    game.dealNewRound(winningDeck);
    game.act('p2', { type: 'SHOWDOWN' });
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.roundNumber).toBe(1);
    expect(game.dealerId).toBe('p1');

    // Make p1 unable to pay the next boot. The rejected deal must leave the
    // completed result exactly where it was so a later retry is safe.
    game.getPlayer('p1')!.chips = 5;
    expect(() => game.dealNewRound(createDeck())).toThrow(/top-up required/i);
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.roundNumber).toBe(1);
    expect(game.dealerId).toBe('p1');

    expect(game.topUp('p1', 10).ok).toBe(true);
    game.dealNewRound(createDeck());
    expect(game.roundNumber).toBe(2);
    expect(game.dealerId).toBe('p2');
  });

  it('supports unlimited positive top-ups without changing P&L at funding time', () => {
    const game = new TeenPattiGame('T', ids(2), { initialDealerId: 'p1', tableConfig: config });
    expect(game.getSettlement('p2')!.profitLoss).toBe(0);
    const seqBeforeTopUp = game.sequence;
    expect(game.topUp('p2', 500_000).ok).toBe(true);
    expect(game.sequence).toBe(seqBeforeTopUp + 1);
    expect(game.getPlayer('p2')!.chips).toBe(501_000);
    expect(game.getSettlement('p2')).toMatchObject({
      totalFunding: 501_000,
      topUps: 500_000,
      profitLoss: 0,
    });
  });

  it('settles and permanently removes a player who leaves mid-round', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    expect(game.currentTurn).toBe('p2');

    const result = game.leaveTable('p3');
    expect(result.settlement).toMatchObject({ playerId: 'p3', currentBalance: 990, profitLoss: -10 });
    expect(result.remainingPlayerIds).toEqual(['p1', 'p2']);
    expect(game.getPlayer('p3')).toBeUndefined();
    expect(game.playersClockwise).toEqual(['p1', 'p2']);
    expect(game.currentTurn).toBe('p2');
    expect(game.state).toBe('BETTING');
  });

  it('treats the current player leaving as a pack and awards a two-player pot to the survivor', () => {
    const game = new TeenPattiGame('T', ids(2), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    expect(game.currentTurn).toBe('p2');

    const result = game.leaveTable('p2');
    expect(result.roundEnded).toBe(true);
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.lastOutcome).toMatchObject({ winnerIds: ['p1'], reason: 'LAST_STANDING', potAwarded: 20 });
    expect(game.getPlayer('p1')!.chips).toBe(1010);
    expect(game.getPlayer('p2')).toBeUndefined();
    expect(game.playersClockwise).toEqual(['p1']);
    expect(() => game.dealNewRound(createDeck())).toThrow(/at least 2 seated players/i);
  });

  it('uses the next seated player as dealer fallback if the previous winner leaves before the next deal', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    game.dealNewRound(createDeck());
    // p2 is first. p2 stays; p3 and p1 pack, so p2 is the unique winner.
    expect(game.act('p2', { type: 'BLIND' }).ok).toBe(true);
    expect(game.act('p3', { type: 'PACK' }).ok).toBe(true);
    expect(game.act('p1', { type: 'PACK' }).ok).toBe(true);
    expect(game.lastOutcome?.winnerIds).toEqual(['p2']);

    game.leaveTable('p2');
    expect(game.playersClockwise).toEqual(['p1', 'p3']);
    game.dealNewRound(createDeck());
    expect(game.dealerId).toBe('p3');
  });

  it('conserves play money across a completed non-top-up round', () => {
    const game = new TeenPattiGame('T', ids(3), { initialDealerId: 'p1', tableConfig: config });
    const total = () => ids(3).reduce((sum, id) => sum + game.getPlayer(id)!.chips, 0) + game.pot;
    const before = total();
    game.dealNewRound(createDeck());
    game.act('p2', { type: 'PACK' });
    game.act('p3', { type: 'PACK' });
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(total()).toBe(before);
  });
});

describe('Teen Patti live-table joining', () => {
  it('packs an inactive player, keeps the seat out, and resumes only on the next safe round', () => {
    const game = new TeenPattiGame('INACTIVE', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1', tableConfig: config,
    });
    game.dealNewRound(createDeck());
    const inactiveId = game.currentTurn!;
    expect(game.setInactiveSittingOut(inactiveId)).toEqual({ ok: true });
    expect(game.getPublicState().players.find((player) => player.playerId === inactiveId)).toMatchObject({
      sittingOut: true, packed: true,
    });

    while (game.state === 'BETTING') {
      expect(game.act(game.currentTurn!, { type: 'PACK' }, game.sequence).ok).toBe(true);
    }
    expect(game.state).toBe('ROUND_COMPLETE');
    expect(game.resumePlayerNextRound(inactiveId)).toEqual({ ok: true });
    game.dealNewRound(createDeck());
    expect(game.getPublicState().players.find((player) => player.playerId === inactiveId)).toMatchObject({
      sittingOut: false, packed: false,
    });
    expect(game.getPlayerHand(inactiveId)).toHaveLength(3);
  });

  it('seats a new player immediately during a running hand but activates them only from the next round', () => {
    const game = new TeenPattiGame('LIVE-JOIN', ['p1', 'p2', 'p3'], {
      initialDealerId: 'p1', tableConfig: config,
    });
    game.dealNewRound(createDeck());

    expect(game.addPlayerForNextRound('p4')).toEqual({ ok: true });
    expect(game.getPublicState().players.find((player) => player.playerId === 'p4')).toMatchObject({
      sittingOut: true,
      packed: true,
    });
    expect(game.getPlayerHand('p4')).toEqual([]);
    expect(game.activePlayers()).not.toContain('p4');

    // Finish the hand using only the original active seats.
    while (game.state === 'BETTING') {
      const turn = game.currentTurn!;
      expect(game.act(turn, { type: 'PACK' }, game.sequence).ok).toBe(true);
    }
    expect(game.state).toBe('ROUND_COMPLETE');

    game.dealNewRound();
    expect(game.state).toBe('BETTING');
    expect(game.getPlayerHand('p4')).toHaveLength(3);
    expect(game.activePlayers()).toContain('p4');
    expect(game.getPublicState().players.find((player) => player.playerId === 'p4')).toMatchObject({
      sittingOut: false,
      packed: false,
    });
  });

  it('keeps the nine-seat ceiling when players join an already-running table', () => {
    const starting = ['p1', 'p2'];
    const game = new TeenPattiGame('LIVE-JOIN-CAP', starting, {
      initialDealerId: 'p1', tableConfig: config,
    });
    game.dealNewRound(createDeck());

    for (let i = 3; i <= 9; i += 1) {
      expect(game.addPlayerForNextRound(`p${i}`).ok).toBe(true);
    }
    expect(game.playersClockwise).toHaveLength(9);
    expect(game.addPlayerForNextRound('p10')).toMatchObject({ ok: false });
  });
});
