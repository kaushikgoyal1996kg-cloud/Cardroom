// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * Focused test for the reconnect/restoration lifecycle itself, independent of
 * any screen that consumes it.
 *
 * Drives a fake socket so the real GameStore reconnect path runs: the store
 * emits `room:reconnect` on connect when a session is stored, and must report
 * `isRestoring` for the duration and tick `restorationGeneration` once the
 * restoration burst has been applied.
 */

type Handler = (...args: unknown[]) => void;

/** Minimal socket double with manual control over the reconnect ack. */
function makeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  let pendingReconnectAck: ((res: unknown) => void) | null = null;

  return {
    connected: false,
    on(event: string, fn: Handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
    },
    off(event: string, fn: Handler) {
      handlers.get(event)?.delete(fn);
    },
    emit(event: string, ...args: unknown[]) {
      if (event === 'room:reconnect') {
        pendingReconnectAck = args[args.length - 1] as (res: unknown) => void;
      }
    },
    disconnect() {},
    /** Test helper: fire a server-to-client event. */
    fire(event: string, payload?: unknown) {
      for (const fn of handlers.get(event) ?? []) fn(payload);
    },
    /** Test helper: complete the reconnect handshake. */
    completeReconnect(ok = true) {
      pendingReconnectAck?.(
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
            }
          : { ok: false, error: 'gone' }
      );
    },
    hasPendingReconnect() {
      return pendingReconnectAck !== null;
    },
  };
}

let socket: ReturnType<typeof makeSocket>;

vi.mock('../../lib/socket', async () => {
  return {
    getSocket: () => socket,
  };
});

/** The real key used by GameStore. Kept in step deliberately: if it changes,
 *  these tests must fail rather than silently skip. */
const SESSION_KEY = 'haazari_session_v1';

beforeEach(() => {
  socket = makeSocket();
  localStorage.clear();
  // The store only attempts a reconnect when a session is stored. Write the
  // shape under every plausible key so this test does not depend on the
  // private key name.
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: 'tok-1', playerName: 'Alice', roomCode: 'HZR482' })
  );
});

afterEach(() => {
  vi.resetModules();
  localStorage.clear();
});

async function loadStore() {
  const mod = await import('../../lib/GameStore');
  return mod;
}

describe('reconnect restoration lifecycle', () => {
  it('starts idle', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    expect(result.current.isRestoring).toBe(false);
    expect(result.current.restorationGeneration).toBe(0);
  });

  it('reports restoring while a reconnect is in flight, then ticks the generation', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    // The store emits room:reconnect when the socket connects.
    act(() => {
      socket.fire('connect');
    });

    // Must actually have been attempted - no vacuous pass.
    expect(socket.hasPendingReconnect()).toBe(true);

    await waitFor(() => expect(result.current.isRestoring).toBe(true));
    expect(result.current.restorationGeneration).toBe(0);

    act(() => {
      socket.completeReconnect(true);
    });

    // Released on the next tick, together with the deal-animation suppression.
    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    expect(result.current.restorationGeneration).toBe(1);
  });

  it('still completes the lifecycle when the reconnect is refused', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => {
      socket.fire('connect');
    });
    expect(socket.hasPendingReconnect()).toBe(true);

    await waitFor(() => expect(result.current.isRestoring).toBe(true));

    act(() => {
      socket.completeReconnect(false);
    });

    // A refused reconnect must not leave restoration stuck on forever, or
    // arrival animations would be suppressed for the rest of the session.
    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    expect(result.current.restorationGeneration).toBe(1);
  });

  it('the generation is monotonic across repeated reconnects', async () => {
    const { GameProvider, useGame } = await loadStore();
    const { result } = renderHook(() => useGame(), { wrapper: GameProvider });

    act(() => socket.fire('connect'));
    expect(socket.hasPendingReconnect()).toBe(true);
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.restorationGeneration).toBe(1));

    act(() => socket.fire('connect'));
    act(() => socket.completeReconnect(true));
    await waitFor(() => expect(result.current.restorationGeneration).toBe(2));
  });
});
