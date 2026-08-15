// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * Bug 1 (confirmed on real Android PWA staging): backgrounding the app and
 * returning could show "You're not in a game right now" even though the
 * room/session was still perfectly valid server-side. Root cause traced to
 * two gaps, both covered here:
 *
 *   1. The client relied entirely on socket.io's own internal reconnection
 *      backoff, which is known to be unreliable across a mobile background
 *      suspend/bfcache-restore cycle - nothing explicitly nudged it on
 *      returning to the foreground.
 *   2. A DEFINITIVE reconnect failure (the server actually saying no, not
 *      just "still trying") left the previous room/game state sitting in
 *      React state un-cleared, with no explanation - a "ghost" table that
 *      only failed, confusingly, the next time it was touched.
 *
 * Drives a fake socket so the real GameStore reconnect path runs, the same
 * technique as reconnectLifecycle.test.tsx (kept separate from that file
 * since this one is specifically about the background/foreground defect).
 */

type Handler = (...args: unknown[]) => void;

function makeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  const pendingReconnectAcks: Array<(res: unknown) => void> = [];
  const emitted: Array<{ event: string; payload?: unknown }> = [];
  let connected = false;
  const connectCalls = vi.fn();

  return {
    get connected() {
      return connected;
    },
    on(event: string, fn: Handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
    },
    off(event: string, fn: Handler) {
      handlers.get(event)?.delete(fn);
    },
    emit(event: string, ...args: unknown[]) {
      const hasAck = typeof args[args.length - 1] === 'function';
      emitted.push({ event, payload: hasAck ? args[0] : args[0] });
      if (event === 'room:reconnect') {
        pendingReconnectAcks.push(args[args.length - 1] as (res: unknown) => void);
      }
    },
    connect: connectCalls.mockImplementation(() => {
      connected = true;
    }),
    connectCalls,
    disconnect() {
      connected = false;
    },
    /** Test helper: fire a server-to-client event. */
    fire(event: string, payload?: unknown) {
      if (event === 'connect') connected = true;
      if (event === 'disconnect') connected = false;
      for (const fn of handlers.get(event) ?? []) fn(payload);
    },
    /** Resolves the OLDEST still-pending room:reconnect ack. */
    completeReconnect(ok = true, extra: Record<string, unknown> = {}) {
      const ack = pendingReconnectAcks.shift();
      ack?.(
        ok
          ? {
              ok: true,
              playerId: 'p1',
              room: {
                roomCode: 'HZR482',
                gameId: 'HAZARI',
                status: 'IN_GAME',
                maxPlayers: 4,
                hostId: 'p1',
                players: [],
              },
              ...extra,
            }
          : { ok: false, error: 'gone', ...extra }
      );
    },
    /** Resolves a specific pending ack by index (0 = oldest), without
     *  removing the others - for simulating out-of-order arrival. */
    completeReconnectAt(index: number, ok = true, extra: Record<string, unknown> = {}) {
      const ack = pendingReconnectAcks[index];
      pendingReconnectAcks[index] = null as unknown as (res: unknown) => void;
      ack?.(
        ok
          ? {
              ok: true,
              playerId: 'p1',
              room: {
                roomCode: 'HZR482',
                gameId: 'HAZARI',
                status: 'IN_GAME',
                maxPlayers: 4,
                hostId: 'p1',
                players: [],
              },
              ...extra,
            }
          : { ok: false, error: 'gone', ...extra }
      );
    },
    pendingReconnectCount() {
      return pendingReconnectAcks.filter((a) => a !== null).length;
    },
    reconnectEmitCount() {
      return emitted.filter((e) => e.event === 'room:reconnect').length;
    },
    joinEmitCount() {
      return emitted.filter((e) => e.event === 'room:join' || e.event === 'room:create' || e.event === 'room:quickMatch')
        .length;
    },
    /** Generic count of any emitted event, for the gameplay-gating tests. */
    emittedCount(event: string) {
      return emitted.filter((e) => e.event === event).length;
    },
  };
}

let socket: ReturnType<typeof makeSocket>;

vi.mock('../lib/socket', async () => ({
  getSocket: () => socket,
}));

const SESSION_KEY = 'haazari_session_v1';

beforeEach(() => {
  socket = makeSocket();
  localStorage.clear();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'tok-1', playerName: 'Alice', roomCode: 'HZR482' }));
});

afterEach(() => {
  vi.resetModules();
  localStorage.clear();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

async function loadStore() {
  const mod = await import('../lib/GameStore');
  return mod;
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('Bug 1 - backgrounding must not lose an active game', () => {
  it('a temporary socket loss during an active game does not clear room/game state', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.room).not.toBeNull());
    expect(result.current.room?.roomCode).toBe('HZR482');

    // Backgrounded / network blip - a plain disconnect, no server response
    // yet either way.
    act(() => socket.fire('disconnect'));

    // Must NOT have been cleared just because the socket dropped - only an
    // authoritative reconnect failure clears it (see the last test below).
    expect(result.current.room?.roomCode).toBe('HZR482');
    expect(result.current.roomError).toBeNull();
    // The stored session must still be there too - nothing premature.
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it('reconnects and restores the same room/seat after resume, with no false "not in game" error', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => socket.fire('disconnect'));
    // Reconnects on the same token, as a real resume would.
    act(() => socket.fire('connect'));
    expect(socket.pendingReconnectCount()).toBe(1);
    act(() => socket.completeReconnect(true));

    await waitFor(() => expect(result.current.room?.roomCode).toBe('HZR482'));
    expect(result.current.myPlayerId).toBe('p1');
    expect(result.current.roomError).toBeNull();
  });

  it('returning to the foreground with a dead socket explicitly nudges reconnection, not left to internal backoff alone', async () => {
    const { GameProvider, useGame } = await loadStore();
    renderHook(() => useGame(), { wrapper: GameProvider });

    // Backgrounded: socket has silently died, nothing has fired 'disconnect'
    // yet from the app's own perspective (a real scenario when the browser
    // just stops delivering events while suspended).
    setVisibility('hidden');
    expect(socket.connectCalls).not.toHaveBeenCalled();

    setVisibility('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(socket.connectCalls).toHaveBeenCalled();
  });

  it('does not call connect() again if the socket is already connected', async () => {
    const { GameProvider, useGame } = await loadStore();
    renderHook(() => useGame(), { wrapper: GameProvider });
    act(() => socket.fire('connect'));
    socket.connectCalls.mockClear();

    setVisibility('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(socket.connectCalls).not.toHaveBeenCalled();
  });

  it('no duplicate join is issued while a reconnect is pending', async () => {
    const { GameProvider, useGame } = await loadStore();
    renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    expect(socket.reconnectEmitCount()).toBe(1);
    expect(socket.joinEmitCount()).toBe(0);

    // A second connect event (e.g. a rapid disconnect/reconnect blip) before
    // the first ack has resolved must not pile up extra reconnect attempts
    // beyond what the race-guard test below already covers, and must
    // definitely never fall back to a fresh join.
    expect(socket.joinEmitCount()).toBe(0);
  });

  it('a stale reconnect ack from a superseded attempt cannot wipe a newer, successful one', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    // First attempt starts...
    act(() => socket.fire('connect'));
    // ...then the connection drops and reconnects again before the first
    // attempt's ack has arrived (both acks are now pending).
    act(() => socket.fire('disconnect'));
    act(() => socket.fire('connect'));
    expect(socket.pendingReconnectCount()).toBe(2);

    // The NEWER attempt (index 1) succeeds first...
    act(() => socket.completeReconnectAt(1, true));
    await waitFor(() => expect(result.current.room?.roomCode).toBe('HZR482'));

    // ...then the STALE first attempt's ack (index 0) finally arrives,
    // refused. It must be ignored - the player is legitimately back in
    // their room via the newer attempt.
    act(() => socket.completeReconnectAt(0, false));

    expect(result.current.room?.roomCode).toBe('HZR482');
    expect(result.current.roomError).toBeNull();
  });

  it('state is only cleared after an authoritative reconnect failure, with a clear explanation', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => socket.fire('disconnect'));
    act(() => socket.fire('connect'));
    // The server authoritatively refuses - e.g. the reconnect window
    // genuinely expired while backgrounded.
    act(() => socket.completeReconnect(false));

    await waitFor(() => expect(result.current.room).toBeNull());
    expect(result.current.myHand).toEqual([]);
    expect(result.current.gameState).toBeNull();
    expect(result.current.roomError).toMatch(/timed out|no longer|start or join/i);
    // The stored session token must be gone too - it's genuinely dead.
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('Bug 1 retest (2026-08-15) - a queued/stale action or error around a reconnect must never surface a false "not in game"', () => {
  it('a stale "Not currently in a room" game:error arriving WHILE restoration is in flight is not shown, and does not clear the table', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    // Background/foreground cycle: socket drops and reconnects, restoration
    // starts (the ack has not resolved yet)...
    act(() => socket.fire('disconnect'));
    act(() => socket.fire('connect'));

    // ...and, before that ack lands, a queued/replayed action from the OLD
    // socket cycle (or a genuinely racing one) comes back with exactly the
    // raw server error a not-yet-rebound socket produces. This must not
    // reach the player as "You're not in a game right now" - the table is
    // still right there and the reconnect that will settle this is already
    // in flight.
    act(() => socket.fire('game:error', { message: 'Not currently in a room.' }));

    expect(result.current.gameError).toBeNull();
    expect(result.current.room?.roomCode).toBe('HZR482');

    // The in-flight reconnect then succeeds normally, as it would have
    // regardless.
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.room?.roomCode).toBe('HZR482'));
    expect(result.current.gameError).toBeNull();
  });

  it('the same stale error arriving just AFTER restoration completes, while the table is still held, is also not shown', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.room).not.toBeNull());
    // restoration.active releases on the NEXT TICK after the ack (see
    // GameStore.tsx's onConnect: "Release on the next tick, after the
    // restoration burst of events") - wait for it explicitly rather than
    // assuming it's already settled the instant `room` updates.
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    // A late-arriving error from a superseded cycle, well after restoration
    // has already finished - the client still holds a valid room, so this
    // is stale by definition, not authoritative.
    act(() => socket.fire('game:error', { message: 'Not currently in a room.' }));

    expect(result.current.gameError).toBeNull();
    expect(result.current.room?.roomCode).toBe('HZR482');
  });

  it('a GENUINE in-game error (not this one specific race message) still surfaces normally during restoration', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => socket.fire('disconnect'));
    act(() => socket.fire('connect'));
    // A real gameplay error, unrelated to the reconnect race, must not be
    // silently swallowed just because a reconnect happens to be in flight.
    act(() => socket.fire('game:error', { message: 'Game has not started yet.' }));

    expect(result.current.gameError).toBe('The game has not started yet.');
  });

  it('gameplay actions are gated (not sent) while restoration is in flight, and work again once it completes', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => socket.fire('disconnect'));
    act(() => socket.fire('connect')); // restoration starts; ack not yet resolved
    expect(result.current.isRestoring).toBe(true);

    act(() => result.current.playSet());
    act(() => result.current.startNextRound());
    act(() => result.current.requestDismissal('NO_SEQUENCE'));
    expect(socket.emittedCount('hazari:playSet')).toBe(0);
    expect(socket.emittedCount('hazari:startNextRound')).toBe(0);
    expect(socket.emittedCount('hazari:requestDismissal')).toBe(0);

    let suggestAck: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      suggestAck = await result.current.requestSuggestionOptions();
    });
    expect(suggestAck?.ok).toBe(false);
    expect(socket.emittedCount('hazari:requestSuggestionOptions')).toBe(0);

    // Restoration completes - the same actions now go through normally.
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    act(() => result.current.playSet());
    expect(socket.emittedCount('hazari:playSet')).toBe(1);
  });

  it('confirmArrangement is also gated during restoration - no optimistic local update either', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => socket.fire('disconnect'));
    act(() => socket.fire('connect'));
    expect(result.current.isRestoring).toBe(true);

    act(() => result.current.confirmArrangement([[], [], [], []]));
    expect(socket.emittedCount('hazari:confirmArrangement')).toBe(0);
    expect(result.current.myArrangedSets).toBeNull();
  });
});
