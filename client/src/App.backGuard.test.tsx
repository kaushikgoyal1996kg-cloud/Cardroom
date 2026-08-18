// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

/**
 * Android/PWA/browser Back-button coverage for the room-level screens
 * (lobby, an active game, round-summary/winner, home-return). The entry-
 * level screens (Welcome/Profile/CardRoom) have their own back coverage in
 * HomeScreen.entryFlow.test.tsx - HomeScreen owns its own guard while
 * mounted (see App.tsx's `disabled: screenKey === 'home'`), so it is
 * deliberately out of scope here.
 *
 * Heavy child screens are mocked to trivial markers so this file tests
 * App.tsx's OWN routing/back-guard wiring, not each screen's internals -
 * those already have their own dedicated test files.
 */

const useGameMock = vi.fn();
const leaveSessionMock = vi.fn();
const leaveTableMock = vi.fn();
const leaveTeenPattiTableMock = vi.fn();
const leavePokerTableMock = vi.fn();
const returnToGameMock = vi.fn();

vi.mock('./lib/GameStore', () => ({ useGame: () => useGameMock() }));
vi.mock('./platform/components/HomeScreen', () => ({ HomeScreen: () => <div>MOCK_HOME</div> }));
vi.mock('./components/Lobby/RoomLobby', () => ({ RoomLobby: () => <div>MOCK_LOBBY</div> }));
vi.mock('./games/hazari/ArrangementTable', () => ({ ArrangementTable: () => <div>MOCK_ARRANGING</div> }));
vi.mock('./games/hazari/DealingTable', () => ({
  DealingTable: () => <div>MOCK_DEALING</div>,
  useDealCeremony: () => false,
}));
vi.mock('./components/Play/ArrangingWaitScreen', () => ({ ArrangingWaitScreen: () => <div>MOCK_ARRANGING_WAIT</div> }));
vi.mock('./games/hazari/HazariTable', () => ({ HazariTable: () => <div>MOCK_PLAYING</div> }));
vi.mock('./games/hazari/RoundSummary', () => ({ RoundSummary: () => <div>MOCK_ROUND_SUMMARY</div> }));
vi.mock('./games/hazari/WinnerScreen', () => ({ WinnerScreen: () => <div>MOCK_WINNER</div> }));
vi.mock('./components/ChatPanel', () => ({ ChatPanel: () => null }));
vi.mock('./components/VoiceCallPanel', () => ({ VoiceCallPanel: () => null }));
// Back-guard tests intentionally supply a minimal GameStore. The radial table
// hub has its own contracts; rendering it here would make these navigation
// tests depend on unrelated chat/voice state fields.
vi.mock('./components/TableControls', () => ({ TableControls: () => null }));
vi.mock('./components/UpdateBanner', () => ({ UpdateBanner: () => null }));

function baseGameValue(overrides: Record<string, unknown> = {}) {
  return {
    connectionStatus: 'connected',
    hasConnectedOnce: true,
    room: null,
    gameState: null,
    myPlayerId: 'p1',
    myHand: [],
    myArrangedSets: null,
    gameError: null,
    clearGameError: vi.fn(),
    confirmArrangement: vi.fn(),
    requestDismissal: vi.fn(),
    requestSuggestionOptions: vi.fn(),
    viewMode: 'active',
    leaveTable: leaveTableMock,
    leaveTeenPattiTable: leaveTeenPattiTableMock,
    leavePokerTable: leavePokerTableMock,
    leaveSession: leaveSessionMock,
    returnToGame: returnToGameMock,
    ...overrides,
  };
}

async function loadApp() {
  const mod = await import('./App');
  return mod.App;
}

function fireBack() {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

beforeEach(() => {
  vi.resetModules();
  useGameMock.mockReset();
  leaveSessionMock.mockReset();
  leaveTableMock.mockReset();
  leaveTeenPattiTableMock.mockReset();
  leavePokerTableMock.mockReset();
  returnToGameMock.mockReset();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Lobby: Back is guarded, never a silent exit', () => {
  it('Back shows a confirmation instead of navigating away immediately', async () => {
    useGameMock.mockReturnValue(baseGameValue({ room: { status: 'LOBBY', roomCode: 'HZR482', players: [] } }));
    const App = await loadApp();
    render(<App />);
    expect(screen.getByText('MOCK_LOBBY')).toBeTruthy();

    fireBack();

    expect(screen.getByText(/leave this room/i)).toBeTruthy();
    expect(leaveSessionMock).not.toHaveBeenCalled();
    // Still showing the lobby underneath - nothing navigated away yet.
    expect(screen.getByText('MOCK_LOBBY')).toBeTruthy();
  });

  it('"Stay" dismisses the confirmation without leaving', async () => {
    useGameMock.mockReturnValue(baseGameValue({ room: { status: 'LOBBY', roomCode: 'HZR482', players: [] } }));
    const App = await loadApp();
    render(<App />);

    fireBack();
    fireEvent.click(screen.getByRole('button', { name: /^stay$/i }));

    expect(screen.queryByText(/leave this room/i)).toBeNull();
    expect(leaveSessionMock).not.toHaveBeenCalled();
  });

  it('"Leave" calls the same leaveSession() the visible Leave button uses', async () => {
    useGameMock.mockReturnValue(baseGameValue({ room: { status: 'LOBBY', roomCode: 'HZR482', players: [] } }));
    const App = await loadApp();
    render(<App />);

    fireBack();
    fireEvent.click(screen.getByRole('button', { name: /^leave$/i }));

    expect(leaveSessionMock).toHaveBeenCalledTimes(1);
    expect(leaveTableMock).not.toHaveBeenCalled();
  });
});

describe('Active game (playing): Back is guarded with the bot-takeover warning', () => {
  function playingValue() {
    return baseGameValue({
      room: { gameId: 'HAZARI', status: 'IN_GAME', roomCode: 'HZR482', players: [] },
      gameState: { state: 'PLAYING_SET_1', subRoundResultsThisRound: [], cumulativeScores: {} },
    });
  }

  it('Back shows a confirmation mentioning the computer takeover, not the plain lobby wording', async () => {
    useGameMock.mockReturnValue(playingValue());
    const App = await loadApp();
    render(<App />);
    expect(screen.getByText('MOCK_PLAYING')).toBeTruthy();

    fireBack();

    expect(screen.getByText(/leave this room/i)).toBeTruthy();
    expect(screen.getByText(/computer player will take over your seat/i)).toBeTruthy();
  });

  it('"Leave" calls leaveTable(), not leaveSession()', async () => {
    useGameMock.mockReturnValue(playingValue());
    const App = await loadApp();
    render(<App />);

    fireBack();
    fireEvent.click(screen.getByRole('button', { name: /^leave$/i }));

    expect(leaveTableMock).toHaveBeenCalledTimes(1);
    expect(leaveSessionMock).not.toHaveBeenCalled();
  });
});

describe('Round Summary / Winner: Back never unexpectedly exits the PWA', () => {
  it('Back on Round Summary is absorbed - no dialog, no navigation, no leave call', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'HAZARI', status: 'IN_GAME', roomCode: 'HZR482', players: [] },
        gameState: { state: 'ROUND_COMPLETE', subRoundResultsThisRound: [], cumulativeScores: {} },
        lastRoundResult: { winnerId: 'p1', points: {}, dealerId: 'p1' },
      })
    );
    const App = await loadApp();
    render(<App />);
    expect(screen.getByText('MOCK_ROUND_SUMMARY')).toBeTruthy();

    fireBack();

    expect(screen.queryByText(/leave this room/i)).toBeNull();
    expect(leaveSessionMock).not.toHaveBeenCalled();
    expect(leaveTableMock).not.toHaveBeenCalled();
    expect(screen.getByText('MOCK_ROUND_SUMMARY')).toBeTruthy();
  });
});

describe('a stale leave-confirm dialog is dismissed if the room changes underneath it', () => {
  it('clears the pending confirmation when screenKey changes for a reason other than confirm/cancel', async () => {
    useGameMock.mockReturnValue(baseGameValue({ room: { status: 'LOBBY', roomCode: 'HZR482', players: [] } }));
    const App = await loadApp();
    const { rerender } = render(<App />);
    expect(screen.getByText('MOCK_LOBBY')).toBeTruthy();

    fireBack();
    expect(screen.getByText(/leave this room/i)).toBeTruthy();

    // The host started the game - a legitimate server-driven change, not
    // this player confirming or cancelling anything.
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'HAZARI', status: 'IN_GAME', roomCode: 'HZR482', players: [] },
        gameState: { state: 'PLAYING_SET_1', subRoundResultsThisRound: [], cumulativeScores: {} },
      })
    );
    rerender(<App />);

    expect(screen.getByText('MOCK_PLAYING')).toBeTruthy();
    // The stale Lobby dialog must not still be showing over the new screen.
    expect(screen.queryByText(/leave this room/i)).toBeNull();
    expect(leaveSessionMock).not.toHaveBeenCalled();
    expect(leaveTableMock).not.toHaveBeenCalled();
  });
});

describe('Bug 2 defensive invariant: never select a screen whose required state is missing', () => {
  it('GAME_COMPLETE without winnerInfo falls back to Loading, not WinnerScreen (which would return null)', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'HAZARI', status: 'IN_GAME', roomCode: 'HZR482', players: [] },
        gameState: { state: 'GAME_COMPLETE', subRoundResultsThisRound: [], cumulativeScores: {} },
        winnerInfo: null, // the gap this fix closes
      })
    );
    const App = await loadApp();
    render(<App />);

    expect(screen.queryByText('MOCK_WINNER')).toBeNull();
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('ROUND_COMPLETE without lastRoundResult falls back to Loading, not RoundSummary', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'HAZARI', status: 'IN_GAME', roomCode: 'HZR482', players: [] },
        gameState: { state: 'ROUND_COMPLETE', subRoundResultsThisRound: [], cumulativeScores: {} },
        lastRoundResult: null, // the gap this fix closes
      })
    );
    const App = await loadApp();
    render(<App />);

    expect(screen.queryByText('MOCK_ROUND_SUMMARY')).toBeNull();
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('PLAYING_SET_1 without myPlayerId falls back to Loading, not HazariTable', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'HAZARI', status: 'IN_GAME', roomCode: 'HZR482', players: [] },
        gameState: { state: 'PLAYING_SET_1', subRoundResultsThisRound: [], cumulativeScores: {} },
        myPlayerId: null, // the gap this fix closes
      })
    );
    const App = await loadApp();
    render(<App />);

    expect(screen.queryByText('MOCK_PLAYING')).toBeNull();
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('the normal, fully-populated case is unaffected - still selects the real screen', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'HAZARI', status: 'IN_GAME', roomCode: 'HZR482', players: [] },
        gameState: { state: 'GAME_COMPLETE', subRoundResultsThisRound: [], cumulativeScores: {} },
        winnerInfo: { winnerId: 'p1', finalScores: { p1: 100 } },
      })
    );
    const App = await loadApp();
    render(<App />);

    expect(screen.getByText('MOCK_WINNER')).toBeTruthy();
  });
});

describe('home-return: Back returns to the active game, matching "Return to Room"', () => {
  it('Back calls returnToGame() directly, with no confirmation needed', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'HAZARI', status: 'IN_GAME', roomCode: 'HZR482', players: [] },
        gameState: { state: 'PLAYING_SET_1', subRoundResultsThisRound: [], cumulativeScores: {} },
        viewMode: 'home',
      })
    );
    const App = await loadApp();
    render(<App />);

    fireBack();

    expect(returnToGameMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/leave this room/i)).toBeNull();
  });
});


describe('home-return: Poker leave remains authoritative during reconnect rehydration', () => {
  it('uses Poker settle/release when room is IN_GAME even before pokerState arrives', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'POKER', status: 'IN_GAME', roomCode: 'PKR482', players: [] },
        pokerState: null,
        viewMode: 'home',
      })
    );
    const App = await loadApp();
    render(<App />);

    expect(screen.getByText('Your seat is still connected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /leave & settle/i }));
    expect(screen.getByText(/leaving folds your live hand if needed/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^leave & settle$/i }));

    expect(leavePokerTableMock).toHaveBeenCalledTimes(1);
    expect(leaveSessionMock).not.toHaveBeenCalled();
    expect(leaveTableMock).not.toHaveBeenCalled();
  });
});

describe('Open-ended table loading fallback: Back can still settle/release the seat', () => {
  it('offers Teen Patti leave & settle when room state is IN_GAME but detailed state has not rehydrated yet', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'TEEN_PATTI', status: 'IN_GAME', roomCode: 'TPR482', players: [] },
        teenPattiState: null,
        viewMode: 'active',
      })
    );
    const App = await loadApp();
    render(<App />);

    expect(screen.getByText(/loading teen patti/i)).toBeTruthy();
    fireBack();

    expect(screen.getByText(/leaving packs your live hand if needed/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^leave & settle$/i }));
    expect(leaveTeenPattiTableMock).toHaveBeenCalledTimes(1);
  });

  it('offers Poker leave & settle when room state is IN_GAME but detailed state has not rehydrated yet', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'POKER', status: 'IN_GAME', roomCode: 'PKR482', players: [] },
        pokerState: null,
        viewMode: 'active',
      })
    );
    const App = await loadApp();
    render(<App />);

    expect(screen.getByText(/loading poker/i)).toBeTruthy();
    fireBack();

    expect(screen.getByText(/leaving folds your live hand if needed/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^leave & settle$/i }));
    expect(leavePokerTableMock).toHaveBeenCalledTimes(1);
  });
});

describe('Teen Patti non-table errors remain visible outside contextual table screens', () => {
  it('shows the shared error toast on the connected-seat return screen', async () => {
    useGameMock.mockReturnValue(
      baseGameValue({
        room: { gameId: 'TEEN_PATTI', status: 'IN_GAME', roomCode: 'TPR482', players: [] },
        teenPattiState: null,
        viewMode: 'home',
        gameError: 'Reconnect before leaving the table.',
      })
    );
    const App = await loadApp();
    render(<App />);

    expect(screen.getByText('Reconnect before leaving the table.')).toBeTruthy();
  });
});
