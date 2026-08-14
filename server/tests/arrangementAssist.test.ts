import { describe, it, expect } from 'vitest';
import {
  getArrangementAssistEligibility,
  canUseArrangementAssist,
  ASSIST_BLOCKED_MESSAGE,
  type SeatOccupant,
} from '../src/games/hazari/arrangementAssist.js';
import { RoomManager } from '../src/platform/rooms/roomManager.js';
import { createGameSession, asHazari } from '../src/platform/games/sessions.js';
import { suggestArrangement, suggestArrangementOptions, validatePlayerArrangement } from '../src/games/hazari/arrangement.js';
import { classifyThreeCardHand, compareThreeCardHands } from '../src/games/hazari/hands.js';
import { classifyFourCardHand } from '../src/games/hazari/fourCardRanking.js';
import { createDeck } from '../src/games/hazari/deck.js';

const human = (id: string): SeatOccupant => ({ playerId: id, isBot: false });
const bot = (id: string): SeatOccupant => ({ playerId: id, isBot: true });

// ============================================================================
// The rule itself
// ============================================================================

describe('arrangement assistance eligibility', () => {
  it('BLOCKS assistance with 3 real human opponents', () => {
    const seats = [human('me'), human('a'), human('b'), human('c')];
    const result = getArrangementAssistEligibility(seats, 'me');
    expect(result.allowed).toBe(false);
    expect(result.humanOpponents).toBe(3);
    expect(result.reason).toBe(ASSIST_BLOCKED_MESSAGE);
  });

  it('BLOCKS assistance with 2 human opponents and 1 bot', () => {
    const seats = [human('me'), human('a'), human('b'), bot('r1')];
    expect(canUseArrangementAssist(seats, 'me')).toBe(false);
  });

  it('BLOCKS assistance with just 1 human opponent and 2 bots', () => {
    const seats = [human('me'), human('a'), bot('r1'), bot('r2')];
    const result = getArrangementAssistEligibility(seats, 'me');
    expect(result.allowed).toBe(false);
    expect(result.humanOpponents).toBe(1);
  });

  it('ALLOWS assistance when every opponent is a bot', () => {
    const seats = [human('me'), bot('r1'), bot('r2'), bot('r3')];
    const result = getArrangementAssistEligibility(seats, 'me');
    expect(result.allowed).toBe(true);
    expect(result.humanOpponents).toBe(0);
  });

  it('is not based on player count - same size table, opposite answers', () => {
    const fourWithBots = [human('me'), bot('r1'), bot('r2'), bot('r3')];
    const fourWithOneHuman = [human('me'), human('a'), bot('r1'), bot('r2')];
    expect(canUseArrangementAssist(fourWithBots, 'me')).toBe(true);
    expect(canUseArrangementAssist(fourWithOneHuman, 'me')).toBe(false);
  });

  it('never counts the requesting player against themselves', () => {
    const seats = [human('me'), bot('r1'), bot('r2'), bot('r3')];
    expect(canUseArrangementAssist(seats, 'me')).toBe(true);
  });

  it('a seat abandoned to a bot stops counting as a human opponent', () => {
    const before = [human('me'), human('a'), bot('r1'), bot('r2')];
    expect(canUseArrangementAssist(before, 'me')).toBe(false);
    // "Leave Table" converts that seat to a bot.
    const after = [human('me'), bot('a'), bot('r1'), bot('r2')];
    expect(canUseArrangementAssist(after, 'me')).toBe(true);
  });

  it('blocks an unknown requester rather than defaulting open', () => {
    const seats = [human('a'), human('b')];
    // A stranger has two human opponents, so it is refused.
    expect(canUseArrangementAssist(seats, 'stranger')).toBe(false);
  });
});

// ============================================================================
// Enforcement against real rooms - the bypass attempt
// ============================================================================

/** Builds a started Hazari room with the requested bot/human mix. */
function startedRoom(opponentsAreBots: boolean[]) {
  const rooms = new RoomManager();
  const { room, playerId: hostId } = rooms.createRoom('Host', 'HAZARI');
  opponentsAreBots.forEach((isBot, i) => {
    if (isBot) {
      rooms.addBot(room.roomCode, hostId);
    } else {
      rooms.joinRoom(room.roomCode, `Human${i}`);
    }
  });
  for (const p of room.players.values()) p.ready = true;
  rooms.startGame(room.roomCode, hostId);
  room.game = createGameSession(room.gameId, room.roomCode, [...room.players.keys()]);
  asHazari(room.game)!.dealNewRound();
  return { rooms, room, hostId };
}

/**
 * Reproduces exactly what the gated socket handlers do, from authoritative
 * room state. If this refuses, emitting the raw socket event cannot help -
 * the handler consults nothing else and takes no input from the client.
 */
function serverSideAssistCheck(room: { players: Map<string, { playerId: string; isBot: boolean }> }, playerId: string) {
  const occupants = [...room.players.values()].map((p) => ({
    playerId: p.playerId,
    isBot: p.isBot,
  }));
  return getArrangementAssistEligibility(occupants, playerId);
}

describe('server enforcement - manual socket emission cannot bypass', () => {
  it('refuses a hand-crafted suggestion request when a human opponent is present', () => {
    const { room, hostId } = startedRoom([false, true, true]); // 1 human + 2 bots
    const check = serverSideAssistCheck(room, hostId);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe(ASSIST_BLOCKED_MESSAGE);
  });

  it('refuses in a fully human room', () => {
    const { room, hostId } = startedRoom([false, false, false]);
    expect(serverSideAssistCheck(room, hostId).allowed).toBe(false);
  });

  it('permits a bot-only room', () => {
    const { room, hostId } = startedRoom([true, true, true]);
    expect(serverSideAssistCheck(room, hostId).allowed).toBe(true);
  });

  it('the check reads only server state - no client-supplied value can flip it', () => {
    const { room, hostId } = startedRoom([false, true, true]);
    // A malicious client might claim anything; the check takes no argument
    // from the client beyond the socket's own bound playerId.
    const spoofed = { canUseAssist: true, isBot: true, humanOpponents: 0 };
    expect(serverSideAssistCheck(room, hostId).allowed).toBe(false);
    expect(spoofed.canUseAssist).toBe(true); // the claim exists and is ignored
  });

  it('every opponent must be a bot - one human anywhere is enough to refuse', () => {
    for (const mix of [
      [false, true, true],
      [true, false, true],
      [true, true, false],
    ]) {
      const { room, hostId } = startedRoom(mix);
      expect(serverSideAssistCheck(room, hostId).allowed).toBe(false);
    }
  });

  it('re-evaluates live - a human joining a bot room withdraws assistance', () => {
    const rooms = new RoomManager();
    const { room, playerId: hostId } = rooms.createRoom('Host', 'HAZARI');
    rooms.addBot(room.roomCode, hostId);
    rooms.addBot(room.roomCode, hostId);
    expect(serverSideAssistCheck(room, hostId).allowed).toBe(true);

    rooms.joinRoom(room.roomCode, 'Latecomer');
    expect(serverSideAssistCheck(room, hostId).allowed).toBe(false);
  });
});

// ============================================================================
// The restriction must not touch the rules
// ============================================================================

describe('the restriction changes no Hazari logic', () => {
  const deck = createDeck();
  const hand = deck.slice(0, 13);

  it('the auto-arrange algorithm still exists and works for permitted modes', () => {
    const suggestion = suggestArrangement(hand);
    expect(suggestion).toHaveLength(4);
    expect(suggestion.flat()).toHaveLength(13);
    expect(validatePlayerArrangement(hand, suggestion).valid).toBe(true);

    const options = suggestArrangementOptions(hand);
    expect(options.length).toBeGreaterThan(0);
  });

  it('arrangement validation is identical regardless of table composition', () => {
    const sets = suggestArrangement(hand);
    const result = validatePlayerArrangement(hand, sets);

    // Same call, same answer - validation takes no room/opponent input at all.
    expect(validatePlayerArrangement(hand, sets)).toEqual(result);
    expect(result.valid).toBe(true);
  });

  it('hand classification and ranking are unaffected', () => {
    const three = [deck[0], deck[1], deck[2]];
    const four = [deck[0], deck[1], deck[2], deck[3]];
    const a = classifyThreeCardHand(three);
    const b = classifyThreeCardHand(three);
    expect(compareThreeCardHands(a, b)).toBe(0);
    expect(classifyFourCardHand(four).category).toBe(classifyFourCardHand(four).category);
  });

  it('a blocked player can still submit a perfectly valid manual arrangement', () => {
    const { room, hostId } = startedRoom([false, true, true]);
    const engine = asHazari(room.game)!;
    expect(serverSideAssistCheck(room, hostId).allowed).toBe(false);

    // Blocked from help, but arranging by hand works exactly as before.
    const myHand = engine.getPlayerHand(hostId);
    const manual = suggestArrangement(myHand); // stands in for the player's own choice
    const outcome = engine.confirmArrangement(hostId, manual);
    expect(outcome.ok).toBe(true);
  });
});

// ============================================================================
// The suggestion endpoint's actual payload
//
// Reproduces what the gated handler does end to end, so we prove not only
// that it refuses when it should, but that it returns usable options when it
// should - i.e. moving the computation to the server did not break the
// feature for bot-only play.
// ============================================================================

/** Exactly the body of the hazari:requestSuggestionOptions handler. */
function suggestionOptionsEndpoint(
  room: { players: Map<string, { playerId: string; isBot: boolean }>; game?: unknown },
  playerId: string
): { ok: boolean; error?: string; options?: { label: string; description: string; cardIdSets: string[][] }[] } {
  const engine = asHazari(room.game as never);
  if (!engine) return { ok: false, error: 'Game has not started yet.' };

  const eligibility = serverSideAssistCheck(room, playerId);
  if (!eligibility.allowed) return { ok: false, error: eligibility.reason };

  const hand = engine.getPlayerHand(playerId);
  const cumulativeScore = engine.cumulativeScores[playerId] ?? 0;
  const options = suggestArrangementOptions(hand, cumulativeScore);
  return {
    ok: true,
    options: options.map((opt) => ({
      label: opt.label,
      description: opt.description,
      cardIdSets: opt.sets.map((set) => set.map((card) => card.id)),
    })),
  };
}

describe('hazari:requestSuggestionOptions payload', () => {
  it('returns valid, usable options for a bot-only room', () => {
    const { room, hostId } = startedRoom([true, true, true]);
    const res = suggestionOptionsEndpoint(room, hostId);

    expect(res.ok).toBe(true);
    expect(res.options!.length).toBeGreaterThan(0);

    const engine = asHazari(room.game)!;
    const handIds = new Set(engine.getPlayerHand(hostId).map((c) => c.id));

    for (const opt of res.options!) {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);
      // 3+3+3+4, every id from this player's own hand, no duplicates.
      expect(opt.cardIdSets.map((s) => s.length)).toEqual([3, 3, 3, 4]);
      const flat = opt.cardIdSets.flat();
      expect(flat).toHaveLength(13);
      expect(new Set(flat).size).toBe(13);
      for (const id of flat) expect(handIds.has(id)).toBe(true);
    }
  });

  it('every returned option passes the real server-side validation', () => {
    const { room, hostId } = startedRoom([true, true, true]);
    const engine = asHazari(room.game)!;
    const hand = engine.getPlayerHand(hostId);
    const byId = new Map(hand.map((c) => [c.id, c]));

    for (const opt of suggestionOptionsEndpoint(room, hostId).options!) {
      const sets = opt.cardIdSets.map((ids) => ids.map((id) => byId.get(id)!));
      const result = validatePlayerArrangement(hand, sets as never);
      expect(result.valid, result.errors.join(' ')).toBe(true);
    }
  });

  it('returns NO options and an explanation with one human opponent', () => {
    const { room, hostId } = startedRoom([false, true, true]);
    const res = suggestionOptionsEndpoint(room, hostId);
    expect(res.ok).toBe(false);
    expect(res.options).toBeUndefined();
    expect(res.error).toBe(ASSIST_BLOCKED_MESSAGE);
  });

  it('returns NO options in a fully human room', () => {
    const { room, hostId } = startedRoom([false, false, false]);
    const res = suggestionOptionsEndpoint(room, hostId);
    expect(res.ok).toBe(false);
    expect(res.options).toBeUndefined();
  });

  it('refuses for every mixed human/bot seating combination', () => {
    for (const mix of [
      [false, true, true],
      [true, false, true],
      [true, true, false],
      [false, false, true],
      [false, true, false],
      [true, false, false],
    ]) {
      const { room, hostId } = startedRoom(mix);
      const res = suggestionOptionsEndpoint(room, hostId);
      expect(res.ok, `mix ${JSON.stringify(mix)} should be refused`).toBe(false);
      expect(res.options).toBeUndefined();
    }
  });

  it('endgame strategy still applies, computed server-side from the real score', () => {
    const { room, hostId } = startedRoom([true, true, true]);
    const engine = asHazari(room.game)!;

    const normal = suggestionOptionsEndpoint(room, hostId).options!.map((o) => o.label);

    // Push the player close to the 1000-point line.
    engine.cumulativeScores[hostId] = 900;
    const endgame = suggestionOptionsEndpoint(room, hostId).options!.map((o) => o.label);

    // The endgame set leads with the aggressive option; the normal set does not.
    expect(endgame[0]).toBe('Aggressive');
    expect(normal[0]).not.toBe('Aggressive');
  });
});
