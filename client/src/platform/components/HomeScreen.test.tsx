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
 * The guard is intentionally broader now: if ANY stored seat is recoverable,
 * the entry UI waits for its authoritative reconnect result before exposing
 * Play/Create/Join. This closes the normal Back/reload race as well as the
 * original invite-link race.
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
    expect(screen.queryByText(/private table invitation/i)).toBeNull();
    // Instead, a neutral waiting state defers to the reconnect already in flight.
    expect(screen.queryByText(/rejoining your table/i)).toBeTruthy();
  });

  it('still shows the normal invite flow when there is no stored session at all', async () => {
    window.history.replaceState({}, '', '/?join=HZR999');
    getStoredSessionRoomCodeMock.mockReturnValue(null);
    useGameMock.mockReturnValue(baseGameValue());

    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    expect(screen.queryByText(/private table invitation/i)).toBeTruthy();
    expect(screen.queryByText(/hzr999/i)).toBeTruthy();
  });

  it('restores the existing seat before allowing an invite for a different room', async () => {
    window.history.replaceState({}, '', '/?join=HZR999');
    getStoredSessionRoomCodeMock.mockReturnValue('HZR482'); // a different active session
    useGameMock.mockReturnValue(baseGameValue());

    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    // One device/session cannot safely join a second room while its old seat
    // is still recoverable. Restore HZR482 first; if that token is expired,
    // GameStore clears it and this screen will then expose the invite flow.
    expect(screen.queryByText(/private table invitation/i)).toBeNull();
    expect(screen.queryByText(/rejoining your table hzr482/i)).toBeTruthy();
  });

  it('blocks normal Play/Create/Join entry while any stored seat is being restored', async () => {
    window.history.replaceState({}, '', '/');
    getStoredSessionRoomCodeMock.mockReturnValue('KTI731');
    useGameMock.mockReturnValue(baseGameValue());

    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    expect(screen.queryByText(/rejoining your table kti731/i)).toBeTruthy();
    expect(screen.queryByText(/enter (?:the )?card room/i)).toBeNull();
    expect(screen.queryByText(/choose a game/i)).toBeNull();
  });

  it('is unaffected when there is no invite link and no stored session', async () => {
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
    expect(screen.queryByText(/enter (?:the )?card room/i)).toBeTruthy();
    expect(screen.queryByText(/choose an avatar/i)).toBeNull();
  });
});
