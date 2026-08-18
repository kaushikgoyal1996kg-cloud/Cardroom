import { useEffect, useRef, useState } from 'react';
import { useGame } from './lib/GameStore';
import { HomeScreen } from './platform/components/HomeScreen';
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
import { TeenPattiVariantChoice } from './games/teenpatti/TeenPattiVariantChoice';
import { TeenPattiRulesSheet } from './games/teenpatti/TeenPattiRulesSheet';
import { PokerRuntimeView } from './games/poker/PokerRuntimeView';
import { pokerRuntimeIdentities } from './games/poker/runtime';
import { PokerRulesSheet } from './games/poker/PokerRulesSheet';
import { RulesModal } from './components/RulesModal';
import { SettingsModal } from './components/SettingsModal';
import { StatsModal } from './components/StatsModal';
import { RoundHistoryModal } from './components/RoundHistoryModal';
import { LoadingSpinner } from './components/LoadingSpinner';
import { TutorialModal } from './components/TutorialModal';
import { ChatPanel } from './components/ChatPanel';
import { VoiceCallPanel } from './components/VoiceCallPanel';
import { TableControls } from './components/TableControls';
import { ChromeIcon } from './platform/components/ChromeIcon';
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
  const { room, gameState, kittiState, returnToGame, leaveSession, leaveTable, leaveTeenPattiTable, leavePokerTable } = useGame();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  if (!room) return null;

  const isHazari = room.gameId === 'HAZARI';
  const hazariActive = isHazari && room.status === 'IN_GAME' && gameState?.state !== 'GAME_COMPLETE';
  const kittiActive = room.gameId === 'KITTI' && room.status === 'IN_GAME' && kittiState?.state !== 'MATCH_COMPLETE';
  const teenPattiActive = room.gameId === 'TEEN_PATTI' && room.status === 'IN_GAME';
  // The room's IN_GAME status is authoritative even during the brief reconnect
  // window before detailed Poker state rehydrates. Leave must still use the
  // Poker settle/release path in that window, never generic room:leave.
  const pokerActive = room.gameId === 'POKER' && room.status === 'IN_GAME';
  const gameName = room.gameId === 'HAZARI'
    ? 'Hazari'
    : room.gameId === 'KITTI'
      ? 'Kitti'
      : room.gameId === 'TEEN_PATTI'
        ? 'Teen Patti'
        : 'Poker';

  const leaveLabel = teenPattiActive || pokerActive ? 'Leave & settle' : room.status === 'LOBBY' ? 'Leave this table' : 'Leave table';
  const leaveMessage = teenPattiActive
    ? 'Leaving packs your live hand if needed, settles your play-money P/L, and permanently releases your seat.'
    : pokerActive
      ? 'Leaving folds your live hand if needed, settles your virtual Poker stack/P&L, and permanently releases your seat.'
    : hazariActive || kittiActive
      ? 'Your seat will be handed to a computer so the match can continue for everyone else. You will not be able to reclaim this seat in the current match.'
      : 'Your seat will be released and you will return to The Card Room.';

  function confirmPermanentLeave() {
    setConfirmingLeave(false);
    if (teenPattiActive) void leaveTeenPattiTable();
    else if (pokerActive) void leavePokerTable();
    else if (hazariActive || kittiActive) leaveTable();
    else leaveSession();
  }

  return (
    <main className="home-return">
      <div className="home-return__lamp" aria-hidden="true" />
      <section className="home-return__pass" aria-label={`Active ${gameName} table`}>
        <p className="home-return__eyebrow">Your seat is still connected</p>
        <h1>{gameName}</h1>
        <div className="home-return__room-code">{room.roomCode}</div>
        <p className="home-return__copy">
          You stepped away without leaving the table. Choose whether to return to your seat or release it permanently.
        </p>

        <div className="home-return__choices">
          <button className="home-return__choice home-return__choice--return" onClick={returnToGame}>
            <span className="home-return__choice-mark"><ChromeIcon name="cards" /></span>
            <span>
              <strong>{room.status === 'LOBBY' ? 'Return to room' : `Return to ${gameName}`}</strong>
              <small>Continue with the same seat and identity</small>
            </span>
            <em>Resume</em>
          </button>

          <button className="home-return__choice home-return__choice--leave" onClick={() => setConfirmingLeave(true)}>
            <span className="home-return__choice-mark"><ChromeIcon name="leave" /></span>
            <span>
              <strong>{leaveLabel}</strong>
              <small>{teenPattiActive || pokerActive ? 'Settle and release your seat' : hazariActive || kittiActive ? 'Computer takes over the live seat' : 'Release this seat'}</small>
            </span>
            <em>Permanent</em>
          </button>
        </div>

        <p className="home-return__note">Returning to The Card Room from the table controls keeps your seat connected. Leaving here does not.</p>
      </section>

      {confirmingLeave && (
        <ConfirmDialog
          title={teenPattiActive || pokerActive ? 'Leave and settle?' : 'Leave this table?'}
          message={leaveMessage}
          confirmLabel={leaveLabel}
          onConfirm={confirmPermanentLeave}
          onCancel={() => setConfirmingLeave(false)}
        />
      )}
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
    pokerState,
    pokerPrivate,
    lastPokerHandResult,
    pokerSettlementNotice,
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
    choosePokerVariant,
    pokerAction,
    startNextPokerHand,
    topUpPoker,
    leavePokerTable,
    clearPokerSettlementNotice,
    leaveSession,
    returnToGame,
  } = useGame();
  const [showRules, setShowRules] = useState(false);
  // Table utilities are intentionally exclusive. The old independent Chat /
  // Voice / Settings booleans allowed two surfaces to remain open at once and
  // recreated the exact chrome collision the circular hub was introduced to
  // eliminate. Full-screen guide/stat/history surfaces are tracked separately.
  const [activeTableUtility, setActiveTableUtility] = useState<null | 'chat' | 'voice' | 'settings'>(null);
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
  const [pendingLeaveConfirm, setPendingLeaveConfirm] = useState<null | 'lobby' | 'game' | 'teen-patti' | 'poker'>(null);

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

  const activeRoomSurfaceKey = room ? `${room.gameId}:${room.roomCode}:${viewMode}` : 'no-room';
  useEffect(() => {
    // Utility/modal state belongs to one visible room surface only. Leaving a
    // room, switching into the Card Room while keeping the seat connected, or
    // joining another game must never carry an old game's Chat/Settings/Rules
    // or history sheet into the new surface. Voice-call membership itself is
    // store-owned and is intentionally not ended here.
    setActiveTableUtility(null);
    setShowRules(false);
    setShowStats(false);
    setShowRoundHistory(false);
    clearGameError();
  }, [activeRoomSurfaceKey, clearGameError]);

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
  const dealCardsEach = room?.gameId === 'KITTI'
    ? 9
    : room?.gameId === 'TEEN_PATTI'
      ? (teenPattiState?.variantDealCount ?? 3)
      : room?.gameId === 'POKER'
        ? (pokerState?.variant.holeCards ?? 0)
        : 13;
  const initialDealerDrawRounds = room?.gameId === 'HAZARI'
    ? gameState?.roundNumber === 1 ? (gameState.initialDealerDraws?.length ?? 0) : 0
    : room?.gameId === 'KITTI'
      ? kittiState?.roundNumber === 1 && kittiState.scheduledRoundsComplete === 0 ? kittiState.initialDealerDraws.length : 0
      : room?.gameId === 'TEEN_PATTI'
        ? teenPattiState?.roundNumber === 1 ? teenPattiState.initialDealerDraws.length : 0
        : 0;
  const dealSeatCount = room?.gameId === 'POKER' && pokerState
    ? pokerState.players.filter((player) => player.stack > 0 || player.handCommitted > 0 || !player.folded).length
    : (room?.players.length ?? 4);
  const dealingCeremony = useDealCeremony(
    Math.max(1, dealSeatCount),
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
    } else if (teenPattiState?.state === 'AWAITING_VARIANT') {
      screen = <TeenPattiVariantChoice />;
      screenKey = 'variant-choice';
    } else if (teenPattiState?.state === 'BETTING' || teenPattiState?.state === 'AWAITING_DISCARD' || teenPattiState?.state === 'AWAITING_REFERENCE_ASSIGNMENT') {
      // Public/private Teen Patti packets are deliberately coherence-gated in
      // GameStore. For a few milliseconds during an authoritative update the
      // private half can therefore be null even though the public table is
      // perfectly valid. Keep the physical table mounted through that brief
      // gap; TeenPattiTable disables private/action surfaces until the matching
      // private snapshot arrives. Requiring teenPattiPrivate here caused a
      // full-screen "Loading Teen Patti…" flash on normal betting updates.
      screen = (
        <TeenPattiTable
          dealing={dealingCeremony}
          onOpenRules={() => { setActiveTableUtility(null); setShowRules(true); }}
        />
      );
      screenKey = dealingCeremony ? 'dealing' : 'playing';
    } else {
      screen = <div className="waiting-screen"><LoadingSpinner message="Loading Teen Patti…" /></div>;
      screenKey = 'loading';
    }
  } else if (room.gameId === 'POKER') {
    if (pokerState && myPlayerId) {
      screen = (
        <PokerRuntimeView
          state={pokerState}
          privateState={pokerPrivate}
          selfId={myPlayerId}
          players={pokerRuntimeIdentities(room.players, room.playerDirectory)}
          lastHandResult={lastPokerHandResult}
          dealing={dealingCeremony && !['AWAITING_VARIANT', 'HAND_COMPLETE'].includes(pokerState.state)}
          canStartNextHand={room.hostId === myPlayerId && pokerState.state === 'HAND_COMPLETE'}
          onChooseVariant={choosePokerVariant}
          onAction={pokerAction}
          onStartNextHand={startNextPokerHand}
          onTopUp={topUpPoker}
          onBackToCardRoom={goToHomeScreen}
        />
      );
      screenKey = pokerState.state === 'AWAITING_VARIANT'
        ? 'variant-choice'
        : pokerState.state === 'HAND_COMPLETE'
          ? 'round-summary'
          : dealingCeremony
            ? 'dealing'
            : 'playing';
    } else {
      screen = <div className="waiting-screen"><LoadingSpinner message="Loading Poker…" /></div>;
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
    room.status === 'IN_GAME' &&
    gameState?.state !== 'GAME_COMPLETE'
  );
  const kittiCanLeaveToBot = !!(
    room?.gameId === 'KITTI' &&
    viewMode === 'active' &&
    room.status === 'IN_GAME' &&
    kittiState?.state !== 'MATCH_COMPLETE'
  );
  const botTakeoverLeaveAvailable = hazariCanLeaveToBot || kittiCanLeaveToBot;
  const teenPattiCanSettleAndLeave = !!(
    room?.gameId === 'TEEN_PATTI' &&
    room.status === 'IN_GAME' &&
    viewMode === 'active' &&
    teenPattiState
  );
  const pokerCanSettleAndLeave = !!(
    room?.gameId === 'POKER' &&
    room.status === 'IN_GAME' &&
    viewMode === 'active' &&
    pokerState
  );
  const activeGameName = room?.gameId === 'HAZARI'
    ? 'Hazari'
    : room?.gameId === 'KITTI'
      ? 'Kitti'
      : room?.gameId === 'TEEN_PATTI'
        ? 'Teen Patti'
        : room?.gameId === 'POKER'
          ? 'Poker'
          : 'Card Room';
  const tableLeaveAction = botTakeoverLeaveAvailable
    ? leaveTable
    : teenPattiCanSettleAndLeave
      ? () => { void leaveTeenPattiTable(); }
      : pokerCanSettleAndLeave
        ? () => { void leavePokerTable(); }
        : undefined;
  const tableLeaveDescription = teenPattiCanSettleAndLeave
    ? 'Leaving packs your live hand if needed, settles your current play-money P/L, and permanently releases your seat. You cannot reconnect to this table with the old session token.'
    : pokerCanSettleAndLeave
      ? 'Leaving folds your live hand if needed, keeps committed chips in the pot, settles your virtual Poker stack/P&L, and permanently releases your seat.'
      : 'A computer player will take over your seat and continue the match from the same score, cards and turn position. Your leave is permanent for this match.';

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
        case 'variant-choice':
        case 'playing':
          if (room?.gameId === 'TEEN_PATTI') {
            setPendingLeaveConfirm('teen-patti');
            return 'blocked';
          }
          if (room?.gameId === 'POKER') {
            setPendingLeaveConfirm('poker');
            return 'blocked';
          }
          if (room?.gameId === 'HAZARI' || room?.gameId === 'KITTI') {
            setPendingLeaveConfirm('game');
            return 'blocked';
          }
          goToHomeScreen();
          return 'handled';
        case 'round-summary':
        case 'winner':
          // No sensible Back destination from a transient/result screen -
          // absorb the press rather than unexpectedly exiting the PWA or
          // silently abandoning anything. The screen's own buttons (Next
          // round, Play Again, Return to Card Room, Leave) remain the way
          // forward.
          return 'blocked';
        case 'loading':
          // Open-ended tables can briefly know that the seat is IN_GAME
          // before their detailed reconnect state arrives. Do not trap the
          // player on an indefinite spinner if that rehydration fails: Back
          // still offers the authoritative settle/release path. Hazari/Kitti
          // keep the old transient-loading guard because their permanent
          // leave semantics depend on the live match state/bot takeover.
          if (room?.status === 'IN_GAME' && room.gameId === 'TEEN_PATTI') {
            setPendingLeaveConfirm('teen-patti');
            return 'blocked';
          }
          if (room?.status === 'IN_GAME' && room.gameId === 'POKER') {
            setPendingLeaveConfirm('poker');
            return 'blocked';
          }
          return 'blocked';
        default:
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

  // Chat / Voice are table utilities, not result-screen chrome. A hand can
  // complete while either panel is open (or while the radial wheel itself is
  // expanded), especially on a fast fold/showdown. Close the controlled
  // utility before a transient/result screen is painted so the new result's
  // actions can never inherit an overlay from the previous betting screen.
  // The voice *call* itself is not ended here - only its panel is closed.
  useEffect(() => {
    if (screenKey === 'dealing' || screenKey === 'round-summary' || screenKey === 'winner' || screenKey === 'loading') {
      setActiveTableUtility(null);
    }
  }, [screenKey]);

  const showTableControls = !!(
    room &&
    viewMode === 'active' &&
    screenKey !== 'dealing' &&
    screenKey !== 'round-summary' &&
    screenKey !== 'winner' &&
    screenKey !== 'loading'
  );

  function confirmLeave() {
    backGuard.consumeAsBack();
    if (pendingLeaveConfirm === 'lobby') leaveSession();
    else if (pendingLeaveConfirm === 'game') leaveTable();
    else if (pendingLeaveConfirm === 'teen-patti') void leaveTeenPattiTable();
    else if (pendingLeaveConfirm === 'poker') void leavePokerTable();
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
      {showTableControls && (
        <>
          {!showTutorial && !showRules && !showStats && !showRoundHistory && activeTableUtility !== 'settings' && (
            <TableControls
              key={`table-controls:${screenKey}`}
              gameName={activeGameName}
              onOpenChat={() => setActiveTableUtility('chat')}
              onOpenVoice={() => setActiveTableUtility('voice')}
              onOpenSettings={() => setActiveTableUtility('settings')}
              onBackToCardRoom={() => { setActiveTableUtility(null); goToHomeScreen(); }}
              onLeaveTable={tableLeaveAction}
              leaveDescription={tableLeaveDescription}
              leaveActionLabel={teenPattiCanSettleAndLeave || pokerCanSettleAndLeave ? 'Leave & settle' : 'Leave Table'}
            />
          )}
          <ChatPanel
            open={activeTableUtility === 'chat'}
            onClose={() => setActiveTableUtility(null)}
            showLauncher={false}
          />
          <VoiceCallPanel
            open={activeTableUtility === 'voice'}
            onClose={() => setActiveTableUtility(null)}
            showLauncher={false}
          />
        </>
      )}
      <div key={screenKey} className="screen-fade">
        {screen}
      </div>
      {showTutorial && tutorialGameId && (
        <TutorialModal gameId={tutorialGameId} onClose={() => setShowTutorial(false)} />
      )}
      {showRules && room && room.gameId === 'TEEN_PATTI' && teenPattiState && (
        <TeenPattiRulesSheet state={teenPattiState} onClose={() => setShowRules(false)} />
      )}
      {showRules && room && room.gameId === 'POKER' && pokerState && (
        <PokerRulesSheet state={pokerState} onClose={() => setShowRules(false)} />
      )}
      {showRules && room && room.gameId !== 'TEEN_PATTI' && room.gameId !== 'POKER' && hasGameGuide(room.gameId) && (
        <RulesModal gameId={room.gameId} onClose={() => setShowRules(false)} />
      )}
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
      {showRoundHistory && <RoundHistoryModal onClose={() => setShowRoundHistory(false)} />}
      {activeTableUtility === 'settings' && (
        <SettingsModal
          onClose={() => setActiveTableUtility(null)}
          onOpenRules={() => { setActiveTableUtility(null); setShowRules(true); }}
          onOpenStats={() => { setActiveTableUtility(null); setShowStats(true); }}
          onOpenRoundHistory={() => { setActiveTableUtility(null); setShowRoundHistory(true); }}
          onLeaveTable={tableLeaveAction}
          leaveDescription={tableLeaveAction ? tableLeaveDescription : undefined}
          leaveActionLabel={teenPattiCanSettleAndLeave || pokerCanSettleAndLeave ? 'Leave & settle' : undefined}
        />
      )}
      {gameError && room && !(room.gameId === 'TEEN_PATTI' && ['variant-choice', 'dealing', 'playing', 'round-summary'].includes(screenKey)) && !ARRANGING_STATES.has(gameState?.state ?? '') && !PLAYING_STATES.has(gameState?.state ?? '') && !KITTI_ARRANGING_STATES.has(kittiState?.state ?? '') && !KITTI_PLAYING_STATES.has(kittiState?.state ?? '') && (
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
      {pokerSettlementNotice && (
        <aside className="tp-settlement-notice" role="status" aria-live="polite">
          <div>
            <span>Poker table settled</span>
            <strong className={pokerSettlementNotice.profitLoss >= 0 ? 'is-positive' : 'is-negative'}>
              P/L {pokerSettlementNotice.profitLoss >= 0 ? '+' : ''}{pokerSettlementNotice.profitLoss}
            </strong>
            <small>Final stack {pokerSettlementNotice.stack} · Funding {pokerSettlementNotice.totalFunding}</small>
          </div>
          <button type="button" onClick={clearPokerSettlementNotice} aria-label="Dismiss Poker settlement">✕</button>
        </aside>
      )}
      {pendingLeaveConfirm && (
        <ConfirmDialog
          title="Leave this room?"
          message={
            pendingLeaveConfirm === 'game'
              ? "A computer player will take over your seat and the game will continue for everyone else. You won't be able to rejoin this match."
              : pendingLeaveConfirm === 'teen-patti'
                ? 'Leaving packs your live hand if needed, settles your current play-money P/L, and permanently releases your seat.'
                : pendingLeaveConfirm === 'poker'
                  ? 'Leaving folds your live hand if needed, keeps committed chips in the pot, settles your virtual Poker P/L, and permanently releases your seat.'
                  : "You'll leave the room. If you want back in, you'll need the room code again."
          }
          confirmLabel={pendingLeaveConfirm === 'teen-patti' || pendingLeaveConfirm === 'poker' ? 'Leave & settle' : 'Leave'}
          cancelLabel="Stay"
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />
      )}
    </div>
  );
}
