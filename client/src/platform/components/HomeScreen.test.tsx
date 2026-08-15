// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

/**
 * Regression coverage for a duplicate-player path found by source
 * inspection while investigating a live-staging observation (one seat
 * marked Host/Disconnected, a second "(you)" seat marked Waiting - see
 * SESSION_CHANGELOG.md).
 *
 * Root cause: HomeScreen (rendered only while `room` is still null - see
 * App.tsx) unconditionally showed the invite Landing/Join flow whenever the
 * URL had `?join=`, even if this browser already held a valid reconnect
 * token for that exact room and GameStore's own reconnect-on-connect was
 * already in flight. Tapping Join in that window called `room:join`,
 * creating a brand-new player/token and orphaning the original seat -
 * something a person could very plausibly do during the up-to-30-second
 * Render free-tier cold-start window documented in DEPLOYMENT.md, or simply
 * by reopening their own share link.
 *
 * This does not touch reconnect semantics, session handling, or the socket
 * protocol - it only stops the UI from offering a redundant Join when a
 * reconnect for the exact same room is already underway.
 */

const useGameMock = vi.fn();
const getStoredSessionRoomCodeMock = vi.fn();

vi.mock('../../lib/GameStore', () => ({
  useGame: () => useGameMock(),
  getStoredSessionRoomCode: () => getStoredSessionRoomCodeMock(),
}));

function baseGameValue(overrides: Record<string, unknown> = {}) {
  return {
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    quickMatch: vi.fn(),
    roomError: null,
    ...overrides,
  };
}

async function loadHomeScreen() {
  const mod = await import('./HomeScreen');
  return mod.HomeScreen;
}

beforeEach(() => {
  vi.resetModules();
  useGameMock.mockReset();
  getStoredSessionRoomCodeMock.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('HomeScreen invite-link handling', () => {
  it('does not offer to join when a reconnect token for the same room already exists', async () => {
    window.history.replaceState({}, '', '/?join=HZR482');
    getStoredSessionRoomCodeMock.mockReturnValue('HZR482');
    useGameMock.mockReturnValue(baseGameValue());

    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    // The Join flow (which would call room:join and create a second player)
    // must not be offered here.
    expect(screen.queryByText(/join room/i)).toBeNull();
    expect(screen.queryByText(/you've been invited/i)).toBeNull();
    // Instead, a neutral waiting state defers to the reconnect already in flight.
    expect(screen.queryByText(/rejoining your table/i)).toBeTruthy();
  });

  it('still shows the normal invite flow when there is no stored session at all', async () => {
    window.history.replaceState({}, '', '/?join=HZR999');
    getStoredSessionRoomCodeMock.mockReturnValue(null);
    useGameMock.mockReturnValue(baseGameValue());

    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    expect(screen.queryByText(/you've been invited to room/i)).toBeTruthy();
  });

  it('still shows the normal invite flow when the stored session is for a different room', async () => {
    window.history.replaceState({}, '', '/?join=HZR999');
    getStoredSessionRoomCodeMock.mockReturnValue('HZR482'); // a different room entirely
    useGameMock.mockReturnValue(baseGameValue());

    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    expect(screen.queryByText(/you've been invited to room/i)).toBeTruthy();
  });

  it('is unaffected when there is no invite link at all', async () => {
    window.history.replaceState({}, '', '/');
    getStoredSessionRoomCodeMock.mockReturnValue(null);
    useGameMock.mockReturnValue(baseGameValue());

    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    // A normal (non-invite) launch shows the premium Welcome screen first,
    // not the Landing form directly - this is the intended product change
    // this file shipped with (see PROJECT_STATE.md/DESIGN_SYSTEM.md), not a
    // regression of the invite/reconnect behaviour above, which is what
    // this describe block actually guards. Dedicated Welcome/Profile/
    // CardRoom coverage lives in HomeScreen.entryFlow.test.tsx.
    expect(screen.queryByText(/enter cardroom/i)).toBeTruthy();
    expect(screen.queryByText(/choose an avatar/i)).toBeNull();
  });
});
