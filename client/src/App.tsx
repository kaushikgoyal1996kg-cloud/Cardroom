import { useEffect, useRef, useState } from 'react';
import { useGame } from './lib/GameStore';
import { HomeScreen } from './platform/components/HomeScreen';
import { ChromeIcon } from './platform/components/ChromeIcon';
import { RoomLobby } from './components/Lobby/RoomLobby';
import { ArrangementTable } from './games/hazari/ArrangementTable';
import { DealingTable, useDealCeremony } from './games/hazari/DealingTable';
import { canUseArrangementAssist } from './games/hazari/arrangementAssist';
import { ArrangingWaitScreen } from './components/Play/ArrangingWaitScreen';
import { HazariTable } from './games/hazari/HazariTable';
import { RoundSummary } from './games/hazari/RoundSummary';
import { WinnerScreen } from './games/hazari/WinnerScreen';
import { KittiArrangement } from './games/kitti/KittiArrangement';
import { canUseKittiArrangementAssist } from './games/kitti/arrangementAssist';
import { KittiDealingTable } from './games/kitti/KittiDealingTable';
import { KittiTable } from './games/kitti/KittiTable';
import { KittiWaitingTable } from './games/kitti/KittiWaitingTable';
import { KittiRoundSummary } from './games/kitti/KittiRoundSummary';
import { KittiWinner } from './games/kitti/KittiWinner';
import { TeenPattiTable } from './games/teenpatti/TeenPattiTable';
import { TeenPattiRoundSummary } from './games/teenpatti/TeenPattiRoundSummary';
import { RulesModal } from './components/RulesModal';
import { SettingsModal } from './components/SettingsModal';
import { StatsModal } from './components/StatsModal';
import { RoundHistoryModal } from './components/RoundHistoryModal';
import { LoadingSpinner } from './components/LoadingSpinner';
import { TutorialModal } from './components/TutorialModal';
import { ChatPanel } from './components/ChatPanel';
import { VoiceCallPanel } from './components/VoiceCallPanel';
import { UpdateBanner } from './components/UpdateBanner';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useBackGuard } from './lib/useBackGuard';
import { hasSeenTutorial } from './lib/tutorial';
import { hasGameGuide, type GuideGameId } from './platform/games/gameGuides';
import './App.css';

const ARRANGING_STATES = new Set(['ARRANGING_HANDS', 'WAITING_FOR_HAND_CONFIRMATION', 'ROUND_READY']);
const KITTI_ARRANGING_STATES = new Set(['ARRANGING', 'WAITING_FOR_ARRANGEMENTS']);
const KITTI_PLAYING_STATES = new Set(['PLAYING_HAND_1', 'PLAYING_HAND_2', 'PLAYING_HAND_3', 'PLAYING_DECIDER']);

const PLAYING_STATES = new Set([
  'PLAYING_SET_1',
  'REVEALING_SET_1',
  'PLAYING_SET_2',
  'REVEALING_SET_2',
  'PLAYING_SET_3',
  'REVEALING_SET_3',
  'PLAYING_SET_4',
  'REVEALING_SET_4',
]);

function HomeScreenReturn() {
  const { room, gameState, kittiState, teenPattiState, returnToGame, leaveSession, leaveTable, leaveTeenPattiTable } = useGame();
  const [confirmTeenPattiLeave, setConfirmTeenPattiLeave] = useState(false);
  if (!room) return null;
  const isHazari = room.gameId === 'HAZARI';
  const hazariActive = isHazari && room.status === 'IN_GAME' && gameState?.state !== 'GAME_COMPLETE';
  const kittiActive = room.gameId === 'KITTI' && room.status === 'IN_GAME' && kittiState?.state !== 'MATCH_COMPLETE';
  const teenPattiActive = room.gameId === 'TEEN_PATTI' && room.status === 'IN_GAME';
  const gameName = room.gameId === 'HAZARI' ? 'Hazari' : room.gameId === 'KITTI' ? 'Kitti' : 'Teen Patti';

  return (
    <main className="home-return">
      <div className="home-return__lamp" aria-hidden="true" />
      <section className="home-return__pass" aria-label={`Active ${gameName} table`}>
        <p className="home-return__eyebrow">Your seat is still connected</p>
        <h1>{gameName}</h1>
        <div className="home-return__room-code">{room.roomCode}</div>
        <p className="home-return__copy">
          You stepped away from the table without leaving it. Your original seat is still yours.
        </p>
        <button className="btn btn-primary home-return__primary" onClick={returnToGame}>
          {room.status === 'LOBBY' ? 'Return to room' : `Return to ${gameName}`}
        </button>

        {hazariActive && (
          <button className="btn btn-ghost" onClick={leaveTable}>
            Leave seat to a computer
          </button>
        )}
        {!hazariActive && !kittiActive && !teenPattiActive && (
          <button className="btn btn-ghost" onClick={leaveSession}>
            Leave this table
          </button>
        )}
        {kittiActive && (
          <p className="home-return__note">Your Kitti seat remains reserved while the match is in progress.</p>
        )}
        {teenPattiActive && !confirmTeenPattiLeave && (
          <button className="btn btn-ghost" onClick={() => setConfirmTeenPattiLeave(true)}>
            Leave and settle table
          </button>
        )}
        {teenPattiActive && confirmTeenPattiLeave && (
          <div className="home-return-settle">
            <p className="home-return__note">Leaving packs your live hand if needed, settles your play-money P/L, and permanently releases your seat.</p>
            <div>
              <button className="btn btn-ghost" onClick={() => setConfirmTeenPattiLeave(false)}>Stay</button>
              <button className="btn btn-primary" onClick={() => void leaveTeenPattiTable()}>Leave &amp; settle</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export function App() {
  const {
    connectionStatus,
    hasConnectedOnce,
    room,
    gameState,
    kittiState,
    myPlayerId,
    lastRoundResult,
    winnerInfo,
    myHand,
    myArrangedSets,
    kittiHand,
    kittiArrangedGroups,
    lastKittiRoundResult,
    kittiWinnerInfo,
    teenPattiState,
    teenPattiPrivate,
    lastTeenPattiRoundResult,
    teenPattiSettlementNotice,
    gameError,
    clearGameError,
    confirmArrangement,
    requestDismissal,
    requestSuggestionOptions,
    requestKittiSuggestion,
    confirmKittiArrangement,
    viewMode,
    goToHomeScreen,
    leaveTable,
    leaveTeenPattiTable,
    clearTeenPattiSettlementNotice,
    leaveSession,
    returnToGame,
  } = useGame();
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRoundHistory, setShowRoundHistory] = useState(false);
  const [showConnBanner, setShowConnBanner] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialGameId, setTutorialGameId] = useState<GuideGameId | null>(null);
  const guideRoomRef = useRef<string | null>(null);
  // Set only by the Android/PWA/browser Back guard below, when the current
  // screen needs confirmation before it's safe to actually leave - never by
  // any of the screens' own visible Leave buttons, which already call
  // leaveSession/leaveTable directly. 'lobby' shows the plain "leave this
  // room" wording; 'game' adds the bot-takeover warning, matching
  // SettingsModal's existing in-game leave confirmation.
  const [pendingLeaveConfirm, setPendingLeaveConfirm] = useState<null | 'lobby' | 'game'>(null);

  // A multi-game card room must never open with one game's rules before a
  // game has even been chosen. Show the guide only after the player actually
  // enters a playable game, and remember that choice independently per game.
  // Reconnects / returning to the same live room do not re-open the guide;
  // Settings -> Rules & How to Play remains available at any time.
  useEffect(() => {
    if (!room || viewMode !== 'active' || !hasGameGuide(room.gameId)) return;
    const roomKey = `${room.gameId}:${room.roomCode}`;
    if (guideRoomRef.current === roomKey) return;
    guideRoomRef.current = roomKey;
    if (hasSeenTutorial(room.gameId)) return;
    setTutorialGameId(room.gameId);
    setShowTutorial(true);
  }, [room?.gameId, room?.roomCode, viewMode]);

  useEffect(() => {
    if (room) return;
    guideRoomRef.current = null;
    setShowTutorial(false);
    setTutorialGameId(null);
  }, [room]);

  // Delay showing the connection banner briefly so a normal fast connection
  // never flashes it - only show once a wait is actually noticeable.
  useEffect(() => {
    if (connectionStatus === 'connected') {
      setShowConnBanner(false);
      return;
    }
    const t = setTimeout(() => setShowConnBanner(true), 1200);
    return () => clearTimeout(t);
  }, [connectionStatus]);

  // The server transitions straight from "playing Set 4" to
  // ROUND_COMPLETE (or straight to GAME_COMPLETE, if that round won the
  // game) in a single tick - there's no separate "revealing Set 4"
  // broadcast the way there is between Sets 1-3 (where the state stays
  // PLAYING_SET_X, keeping HazariTable mounted so its reveal overlay can
  // show). Without this hold, the screen would swap straight to
  // RoundSummary/WinnerScreen the instant Set 4 resolves, and players
  // would never see the 4th set's cards or who won it. Keep rendering
  // HazariTable for a brief grace period after that transition so its
  // existing reveal-overlay logic (driven by subRoundResultsThisRound,
  // which already contains Set 4's result regardless of top-level state)
  // gets a chance to actually show and auto-dismiss, matching the same
  // ~3.2s timing HazariTable itself uses for Sets 1-3.
  const [holdingFinalReveal, setHoldingFinalReveal] = useState(false);
  const prevGameStateRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevGameStateRef.current;
    const curr = gameState?.state;
    const justFinished =
      prev && PLAYING_STATES.has(prev) && (curr === 'ROUND_COMPLETE' || curr === 'DISMISSED_ROUND' || curr === 'GAME_COMPLETE');
    prevGameStateRef.current = curr;
    if (!justFinished) return;
    setHoldingFinalReveal(true);
    const t = setTimeout(() => setHoldingFinalReveal(false), 3600);
    return () => clearTimeout(t);
  }, [gameState?.state]);

  // Like Hazari's final set, Kitti's third hand/decider resolves in the same
  // authoritative tick that marks the round complete. Keep the table visible
  // briefly so the final cards do not vanish straight into a summary screen.
  const [holdingKittiFinalReveal, setHoldingKittiFinalReveal] = useState(false);
  const prevKittiStateRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevKittiStateRef.current;
    const curr = kittiState?.state;
    const justFinished = !!prev && KITTI_PLAYING_STATES.has(prev) && (curr === 'ROUND_COMPLETE' || curr === 'MATCH_COMPLETE');
    prevKittiStateRef.current = curr;
    if (!justFinished) return;
    setHoldingKittiFinalReveal(true);
    const timer = setTimeout(() => setHoldingKittiFinalReveal(false), 2800);
    return () => clearTimeout(timer);
  }, [kittiState?.state]);

  // Cosmetic dealing ceremony. Runs only for a genuinely new deal (never on
  // reconnect). Reduced motion keeps the informative dealer-draw reveal but
  // skips the flying-card deal animation.
  const dealCardsEach = room?.gameId === 'KITTI' ? 9 : room?.gameId === 'TEEN_PATTI' ? 3 : 13;
  const initialDealerDrawRounds = room?.gameId === 'HAZARI'
    ? gameState?.roundNumber === 1 ? (gameState.initialDealerDraws?.length ?? 0) : 0
    : room?.gameId === 'KITTI'
      ? kittiState?.roundNumber === 1 && kittiState.scheduledRoundsComplete === 0 ? kittiState.initialDealerDraws.length : 0
      : 0;
  const dealingCeremony = useDealCeremony(
    room?.players.length ?? 4,
    dealCardsEach,
    initialDealerDrawRounds
  );

  let screen: React.ReactNode;
  let screenKey: string;

  if (room && viewMode === 'home') {
    screen = <HomeScreenReturn />;
    screenKey = 'home-return';
  } else if (!room) {
    screen = <HomeScreen />;
    screenKey = 'home';
  } else if (room.status === 'LOBBY') {
    screen = <RoomLobby />;
    screenKey = 'lobby';
  } else if (room.gameId === 'KITTI') {
    if (kittiState?.state === 'MATCH_COMPLETE' && !holdingKittiFinalReveal && kittiWinnerInfo) {
      screen = <KittiWinner />;
      screenKey = 'winner';
    } else if (kittiState?.state === 'ROUND_COMPLETE' && !holdingKittiFinalReveal && lastKittiRoundResult) {
      screen = <KittiRoundSummary />;
      screenKey = 'round-summary';
    } else if (
      kittiState && myPlayerId &&
      (KITTI_PLAYING_STATES.has(kittiState.state) || (holdingKittiFinalReveal && ['ROUND_COMPLETE', 'MATCH_COMPLETE'].includes(kittiState.state)))
    ) {
      screen = <KittiTable />;
      screenKey = 'playing';
    } else if (kittiState && KITTI_ARRANGING_STATES.has(kittiState.state)) {
      if (kittiState.spectatorIds.includes(myPlayerId ?? '') || (kittiArrangedGroups && myPlayerId)) {
        screen = <KittiWaitingTable />;
        screenKey = 'arranging-waiting';
      } else if (dealingCeremony && kittiHand.length === 9) {
        screen = <KittiDealingTable />;
        screenKey = 'dealing';
      } else if (kittiHand.length === 9) {
        screen = (
          <KittiArrangement
            hand={kittiHand}
            onConfirm={confirmKittiArrangement}
            canSuggest={canUseKittiArrangementAssist(room.players, myPlayerId)}
            onSuggest={requestKittiSuggestion}
            submitError={gameError}
          />
        );
        screenKey = 'arranging';
      } else {
        screen = <div className="waiting-screen"><LoadingSpinner message="Dealing nine cards…" /></div>;
        screenKey = 'dealing';
      }
    } else {
      screen = <div className="waiting-screen"><LoadingSpinner message="Loading Kitti…" /></div>;
      screenKey = 'loading';
    }
  } else if (room.gameId === 'TEEN_PATTI') {
    if (teenPattiState?.state === 'ROUND_COMPLETE' && lastTeenPattiRoundResult) {
      screen = <TeenPattiRoundSummary />;
      screenKey = 'round-summary';
    } else if (teenPattiState?.state === 'BETTING' && teenPattiPrivate) {
      screen = <TeenPattiTable dealing={dealingCeremony} />;
      screenKey = dealingCeremony ? 'dealing' : 'playing';
    } else {
      screen = <div className="waiting-screen"><LoadingSpinner message="Loading Teen Patti…" /></div>;
      screenKey = 'loading';
    }
  } else if (gameState?.state === 'GAME_COMPLETE' && !holdingFinalReveal && winnerInfo) {
    screen = <WinnerScreen />;
    screenKey = 'winner';
  } else if (
    (gameState?.state === 'ROUND_COMPLETE' || gameState?.state === 'DISMISSED_ROUND') &&
    !holdingFinalReveal &&
    lastRoundResult
  ) {
    screen = <RoundSummary />;
    screenKey = 'round-summary';
  } else if (
    gameState &&
    myPlayerId &&
    (PLAYING_STATES.has(gameState.state) ||
      (holdingFinalReveal && (gameState.state === 'ROUND_COMPLETE' || gameState.state === 'DISMISSED_ROUND' || gameState.state === 'GAME_COMPLETE')))
  ) {
    screen = <HazariTable />;
    screenKey = 'playing';
  } else if (gameState && ARRANGING_STATES.has(gameState.state)) {
    screen = myArrangedSets && myPlayerId ? (
      <ArrangingWaitScreen />
    ) : dealingCeremony && myHand.length === 13 ? (
      <DealingTable />
    ) : myHand.length === 13 ? (
      <ArrangementTable
        hand={myHand}
        onConfirm={confirmArrangement}
        onDismiss={requestDismissal}
        submitError={gameError}
        cumulativeScore={myPlayerId ? gameState?.cumulativeScores[myPlayerId] : undefined}
        canUseAssist={canUseArrangementAssist(room?.players ?? [], myPlayerId)}
        requestSuggestions={requestSuggestionOptions}
      />
    ) : (
      <div className="waiting-screen">
        <LoadingSpinner message="Dealing the cards…" />
      </div>
    );
    screenKey = myArrangedSets && myPlayerId
      ? 'arranging-waiting'
      : dealingCeremony && myHand.length === 13
        ? 'dealing'
        : myHand.length === 13
          ? 'arranging'
          : 'dealing';
  } else {
    // The deliberate catch-all - a screen the app can ALWAYS safely land
    // on. Reached both for genuinely transient moments (state still
    // loading in) and for the defensive case above: something the chosen
    // screen requires is missing, so falling through here instead of
    // asking that screen to render anyway - and possibly return null - is
    // the fix for "never render a blank page because route state and
    // GameStore state temporarily disagree."
    screen = (
      <div className="waiting-screen">
        <LoadingSpinner message="Loading…" />
      </div>
    );
    screenKey = 'loading';
  }

  const hazariCanLeaveToBot = !!(
    room?.gameId === 'HAZARI' &&
    viewMode === 'active' &&
    gameState &&
    (ARRANGING_STATES.has(gameState.state) || PLAYING_STATES.has(gameState.state))
  );
  const teenPattiCanSettleAndLeave = !!(
    room?.gameId === 'TEEN_PATTI' &&
    room.status === 'IN_GAME' &&
    viewMode === 'active' &&
    teenPattiState
  );

  // Android/PWA/browser Back guard. `screenKey` above already IS the
  // existing screen-routing state (ARCHITECTURE.md: "a plain conditional
  // chain in App.tsx"); this only keeps browser history in step with it and
  // intercepts Back where leaving needs confirmation first. 'home' is
  // excluded because HomeScreen owns its own, finer-grained back-guard
  // internally while it is mounted - see HomeScreen.tsx.
  const backGuard = useBackGuard({
    screenKey,
    disabled: screenKey === 'home',
    onBack: () => {
      switch (screenKey) {
        case 'home-return':
          // The player navigated here via Settings -> "Back to Card Room
          // (stay connected)" - Back undoes exactly that, the same
          // as tapping "Return to Room" would.
          returnToGame();
          return 'handled';
        case 'lobby':
          setPendingLeaveConfirm('lobby');
          return 'blocked';
        case 'dealing':
        case 'arranging-waiting':
        case 'arranging':
        case 'playing':
          if (room?.gameId === 'KITTI' || room?.gameId === 'TEEN_PATTI') {
            // Kitti and Teen Patti do not use Hazari's bot-takeover exit.
            // Back returns to the Card Room shell while keeping the live
            // seat/session connected. Teen Patti's settle-on-leave path is a
            // separate product flow and must not be faked by `room:leaveTable`.
            goToHomeScreen();
            return 'handled';
          }
          setPendingLeaveConfirm('game');
          return 'blocked';
        case 'round-summary':
        case 'winner':
        case 'loading':
        default:
          // No sensible Back destination from a transient/result screen -
          // absorb the press rather than unexpectedly exiting the PWA or
          // silently abandoning anything. The screen's own buttons (Next
          // round, Play Again, Return to Card Room, Leave) remain the way
          // forward.
          return 'blocked';
      }
    },
  });

  // A confirm dialog opened by a Back press can otherwise go stale if the
  // room's status changes for a reason OTHER than that confirm/cancel while
  // it's still open - e.g. the host starts the game while a different
  // player has a Lobby leave-confirm sitting open. Rather than try to keep
  // a stale dialog's wording in step, just dismiss it: screenKey changing
  // out from under an open confirmation means whatever it was about no
  // longer describes the current screen, and the player can press Back
  // again for a dialog that matches wherever they actually are now.
  useEffect(() => {
    setPendingLeaveConfirm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey]);

  function confirmLeave() {
    backGuard.consumeAsBack();
    if (pendingLeaveConfirm === 'lobby') leaveSession();
    else if (pendingLeaveConfirm === 'game') leaveTable();
    setPendingLeaveConfirm(null);
  }

  function cancelLeave() {
    setPendingLeaveConfirm(null);
  }

  return (
    // data-screen lets fixed chrome (the chat FAB in particular) reserve
    // space for whatever action rail the current screen puts at the bottom,
    // declaratively in CSS rather than by measuring the DOM.
    <div className="app-root" data-screen={screenKey}>
      <UpdateBanner />
      {showConnBanner && connectionStatus !== 'connected' && (
        <div className="conn-banner">
          {hasConnectedOnce
            ? 'Returning you to the table…'
            : 'Opening the Card Room… the first connection can take up to a minute'}
        </div>
      )}
      {room && viewMode === 'active' && (
        <button className="settings-fab fab" onClick={() => setShowSettings(true)} aria-label="Settings">
          <ChromeIcon name="settings" />
        </button>
      )}
      {room && viewMode === 'active' && <ChatPanel />}
      {room && viewMode === 'active' && <VoiceCallPanel />}
      <div key={screenKey} className="screen-fade">
        {screen}
      </div>
      {showTutorial && tutorialGameId && (
        <TutorialModal gameId={tutorialGameId} onClose={() => setShowTutorial(false)} />
      )}
      {showRules && room && hasGameGuide(room.gameId) && (
        <RulesModal gameId={room.gameId} onClose={() => setShowRules(false)} />
      )}
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
      {showRoundHistory && <RoundHistoryModal onClose={() => setShowRoundHistory(false)} />}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onOpenRules={() => setShowRules(true)}
          onOpenStats={() => setShowStats(true)}
          onOpenRoundHistory={() => setShowRoundHistory(true)}
          onLeaveTable={
            hazariCanLeaveToBot
              ? leaveTable
              : teenPattiCanSettleAndLeave
                ? () => { void leaveTeenPattiTable(); }
                : undefined
          }
          leaveDescription={
            teenPattiCanSettleAndLeave
              ? 'Leaving packs your live hand if needed, settles your current play-money P/L, and permanently releases your seat. You cannot reconnect to this table with the old session token.'
              : undefined
          }
          leaveActionLabel={teenPattiCanSettleAndLeave ? 'Leave & settle' : undefined}
        />
      )}
      {gameError && !ARRANGING_STATES.has(gameState?.state ?? '') && !PLAYING_STATES.has(gameState?.state ?? '') && !KITTI_ARRANGING_STATES.has(kittiState?.state ?? '') && !KITTI_PLAYING_STATES.has(kittiState?.state ?? '') && (
        <div className="toast toast--error" onClick={clearGameError}>
          {gameError}
        </div>
      )}
      {teenPattiSettlementNotice && (
        <aside className="tp-settlement-notice" role="status" aria-live="polite">
          <div>
            <span>Teen Patti table settled</span>
            <strong className={teenPattiSettlementNotice.profitLoss >= 0 ? 'is-positive' : 'is-negative'}>
              P/L {teenPattiSettlementNotice.profitLoss >= 0 ? '+' : ''}{teenPattiSettlementNotice.profitLoss}
            </strong>
            <small>Final balance {teenPattiSettlementNotice.currentBalance} · Funding {teenPattiSettlementNotice.totalFunding}</small>
          </div>
          <button type="button" onClick={clearTeenPattiSettlementNotice} aria-label="Dismiss settlement">✕</button>
        </aside>
      )}
      {pendingLeaveConfirm && (
        <ConfirmDialog
          title="Leave this room?"
          message={
            pendingLeaveConfirm === 'game'
              ? "A computer player will take over your seat and the game will continue for everyone else. You won't be able to rejoin this game."
              : "You'll leave the room. If you want back in, you'll need the room code again."
          }
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />
      )}
    </div>
  );
}
