// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

/**
 * Coverage for the Welcome -> Player Profile -> THE CARD ROOM entry flow
 * (see PROJECT_STATE.md / DESIGN_SYSTEM.md's Welcome/Profile shell pattern)
 * and the Android/PWA Back behaviour across it. HomeScreen.test.tsx keeps
 * the separate invite/reconnect-race regression coverage; this file is
 * everything downstream of "a normal, non-invite launch".
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

const IDENTITY_KEY = 'haazari_identity_v1';

async function loadHomeScreen() {
  const mod = await import('./HomeScreen');
  return mod.HomeScreen;
}

function fireBack() {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

beforeEach(() => {
  vi.resetModules();
  useGameMock.mockReset();
  getStoredSessionRoomCodeMock.mockReset();
  useGameMock.mockReturnValue(baseGameValue());
  getStoredSessionRoomCodeMock.mockReturnValue(null);
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('first-time visitor (no saved profile)', () => {
  it('sees the Welcome screen, not a form, on first launch', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    expect(screen.queryByText(/^the$/i)).toBeTruthy();
    expect(screen.getByText(/card room/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /enter cardroom/i })).toBeTruthy();
    // No "continue as" for a first-timer.
    expect(screen.queryByText(/continue as/i)).toBeNull();
  });

  it('Enter Cardroom leads to the compact profile sheet, not a full registration form', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /enter cardroom/i }));

    expect(screen.getByText(/your cardroom identity/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/enter your name/i)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/email/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/password/i)).toBeNull();
  });

  it('an empty display name is rejected, with a clear message, not a silent no-op', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /enter cardroom/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByText(/enter a name to continue/i)).toBeTruthy();
    // Still on the profile sheet, not advanced to THE CARD ROOM.
    expect(screen.queryByText(/choose a game/i)).toBeNull();
  });

  it('completing the profile persists identity and enters THE CARD ROOM', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /enter cardroom/i }));
    fireEvent.change(screen.getByPlaceholderText(/enter your name/i), { target: { value: 'Kaushik' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByText(/choose a game/i)).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY)!);
    expect(stored.name).toBe('Kaushik');
    expect(typeof stored.profileId).toBe('string');
  });
});

describe('returning visitor (saved profile)', () => {
  beforeEach(() => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ profileId: 'p1', name: 'Kaushik', avatar: '🦚' }));
  });

  it('Welcome shows the saved identity and a one-tap continue, no setup', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    expect(screen.getByText('Kaushik')).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue as kaushik/i })).toBeTruthy();
    expect(screen.queryByText(/your cardroom identity/i)).toBeNull();
  });

  it('Continue as <name> enters THE CARD ROOM in one tap', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /continue as kaushik/i }));

    expect(screen.getByText(/choose a game/i)).toBeTruthy();
  });

  it('Change profile opens the profile sheet pre-filled, and saving updates the same profileId', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /change profile/i }));
    const nameInput = screen.getByPlaceholderText(/enter your name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Kaushik');

    fireEvent.change(nameInput, { target: { value: 'K' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY)!);
    expect(stored.name).toBe('K');
    expect(stored.profileId).toBe('p1');
  });

  it('the profile control in THE CARD ROOM header also reaches profile editing', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /continue as kaushik/i }));
    fireEvent.click(screen.getByRole('button', { name: /kaushik.*profile/i }));

    expect(screen.getByText(/change profile/i)).toBeTruthy();
    expect((screen.getByPlaceholderText(/enter your name/i) as HTMLInputElement).value).toBe('Kaushik');
  });
});

describe('Android/PWA Back navigation across the entry flow', () => {
  it('Back from THE CARD ROOM returns to Welcome, not exiting the app', async () => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ profileId: 'p1', name: 'Kaushik', avatar: '🦚' }));
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /continue as kaushik/i }));
    expect(screen.getByText(/choose a game/i)).toBeTruthy();

    fireBack();

    expect(screen.getByRole('button', { name: /continue as kaushik/i })).toBeTruthy();
  });

  it('Back from the profile sheet (opened from Welcome) returns to Welcome', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /enter cardroom/i }));
    expect(screen.getByText(/your cardroom identity/i)).toBeTruthy();

    fireBack();

    expect(screen.getByRole('button', { name: /enter cardroom/i })).toBeTruthy();
  });

  it('Back from the profile sheet (opened from THE CARD ROOM) returns to THE CARD ROOM, not Welcome', async () => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ profileId: 'p1', name: 'Kaushik', avatar: '🦚' }));
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /continue as kaushik/i }));
    fireEvent.click(screen.getByRole('button', { name: /kaushik.*profile/i }));
    expect(screen.getByText(/change profile/i)).toBeTruthy();

    fireBack();

    expect(screen.getByText(/choose a game/i)).toBeTruthy();
  });

  it('does not push a history entry per keystroke while typing a name', async () => {
    const HomeScreen = await loadHomeScreen();
    render(<HomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: /enter cardroom/i }));

    const lengthBefore = window.history.length;
    fireEvent.change(screen.getByPlaceholderText(/enter your name/i), { target: { value: 'K' } });
    fireEvent.change(screen.getByPlaceholderText(/enter your name/i), { target: { value: 'Ka' } });
    fireEvent.change(screen.getByPlaceholderText(/enter your name/i), { target: { value: 'Kaushik' } });

    expect(window.history.length).toBe(lengthBefore);
  });
});
