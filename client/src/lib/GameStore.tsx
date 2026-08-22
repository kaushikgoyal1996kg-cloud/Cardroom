import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getSocket, type PokerLeaveAck, type PokerSetupAck, type RoomAck, type TablesAck, type TeenPattiLeaveAck, type TeenPattiSetupAck, type WatchRoomAck } from './socket';
import type {
  Card,
  ChatMessage,
  DismissalReason,
  GameId,
  FourSets,
  HaazariPublicStatePayload,
  KittiGroups,
  KittiPublicStatePayload,
  KittiRoundResult,
  PlayerId,
  PokerAction,
  PokerHandOutcomePayload,
  PokerLobbySetup,
  PokerPlayerSettlement,
  PokerPrivateStatePayload,
  PokerPublicStatePayload,
  PokerTableConfig,
  PokerVariantId,
  PublicRoomInfo,
  RoundResult,
  TableSummary,
  TeenPattiAction,
  TeenPattiFriendlySuggestion,
  TeenPattiLobbySetup,
  TeenPattiPlayerSettlement,
  TeenPattiPrivateStatePayload,
  TeenPattiPublicStatePayload,
  TeenPattiRoundOutcome,
  TeenPattiRoundVariantConfig,
  TeenPattiTableConfig,
  TeenPattiVariantTablePolicy,
} from '../game/types';
import { DEFAULT_AVATAR } from '../game/avatars';
import { playDealSound, playChatSound, playErrorSound, playRoundCompleteSound, playVictorySound } from './sound';
import { hapticMedium, hapticError, hapticSuccess, hapticVictory } from './haptics';
import { recordGameResult, getAllStats, type PlayerStats } from './stats';
import type { KittiSuggestionAck, SuggestionOptionsAck } from './socket';
import { friendlyGameError } from './errorMessages';
import { coherentPokerPrivateState, coherentTeenPattiPrivateState } from './privateStateCoherence';
import { VoiceCallManager, isVoiceCallSupported, type VoiceDiagnosticEvent } from './voiceCall';
import { requestReturnToCardRoom } from './navigation';

const SESSION_KEY = 'haazari_session_v1';

interface StoredSession {
  token: string;
  roomCode: string;
  playerName: string;
}

interface GameContextValue {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  hasConnectedOnce: boolean;
  room: PublicRoomInfo | null;
  myPlayerId: string | null;
  isSpectator: boolean;
  myName: string;
  myHand: Card[];
  myArrangedSets: FourSets | null;
  gameState: HaazariPublicStatePayload | null;
  lastRoundResult: RoundResult | null;
  roundHistory: RoundResult[];
  winnerInfo: { winnerId: string; finalScores: Record<string, number> } | null;
  kittiHand: Card[];
  kittiArrangedGroups: KittiGroups | null;
  kittiDeciderHand: Card[];
  kittiState: KittiPublicStatePayload | null;
  lastKittiRoundResult: KittiRoundResult | null;
  kittiRoundHistory: KittiRoundResult[];
  kittiWinnerInfo: { winnerId: string; roundsWon: Record<string, number> } | null;
  teenPattiSetup: TeenPattiLobbySetup | null;
  teenPattiPrivate: TeenPattiPrivateStatePayload | null;
  teenPattiState: TeenPattiPublicStatePayload | null;
  lastTeenPattiRoundResult: TeenPattiRoundOutcome | null;
  teenPattiRoundHistory: TeenPattiRoundOutcome[];
  teenPattiSettlementNotice: TeenPattiPlayerSettlement | null;
  pokerSetup: PokerLobbySetup | null;
  pokerPrivate: PokerPrivateStatePayload | null;
  pokerState: PokerPublicStatePayload | null;
  lastPokerHandResult: PokerHandOutcomePayload | null;
  pokerHandHistory: PokerHandOutcomePayload[];
  pokerSettlementNotice: PokerPlayerSettlement | null;
  roomError: string | null;
  gameError: string | null;
  chatMessages: ChatMessage[];
  unreadChatCount: number;
  markChatRead: () => void;
  voiceCallSupported: boolean;
  inVoiceCall: boolean;
  voiceMuted: boolean;
  voiceParticipants: string[];
  speakingPlayerIds: string[];
  voiceDiagnostics: VoiceDiagnosticEvent[];
  voicePlaybackBlockedPlayerIds: string[];
  joinVoiceCall: () => void;
  leaveVoiceCall: () => void;
  toggleVoiceMute: () => void;
  retryVoicePlayback: () => void;
  viewMode: 'active' | 'home';
  goToHomeScreen: () => void;
  returnToGame: () => void;

  createRoom: (playerName: string, avatar?: string, gameId?: GameId) => Promise<RoomAck>;
  joinRoom: (roomCode: string, playerName: string, avatar?: string) => Promise<RoomAck>;
  quickMatch: (playerName: string, avatar?: string, gameId?: GameId) => Promise<RoomAck>;
  listTables: (gameId?: GameId) => Promise<TableSummary[]>;
  watchTable: (roomCode: string, spectatorName: string, avatar?: string) => Promise<WatchRoomAck>;
  leaveSpectator: () => void;
  joinFromSpectator: (botPlayerId?: PlayerId) => Promise<RoomAck>;
  setTableVisibility: (visibility: 'LIVE' | 'PRIVATE') => void;
  setSpectatorVoicePolicy: (policy: 'DISABLED' | 'LISTEN_ONLY' | 'CONVERSATION') => void;
  removeInactivePlayer: (playerId: PlayerId) => void;
  /**
   * Asks the SERVER for arrangement suggestions. The server re-checks room
   * composition and refuses if the player has any real human opponent, so
   * this resolves to an error rather than options in that case. The client
   * never computes suggestions itself.
   */
  requestSuggestionOptions: () => Promise<SuggestionOptionsAck>;
  /**
   * Increments ONLY when a hand arrives as a genuinely new deal - never when
   * one arrives as part of restoring state after a reconnect. The dealing
   * animation keys off this, so refreshing mid-round shows the correct
   * current state instead of pretending the cards are being dealt again.
   */
  freshDealCount: number;
  /**
   * True while the client is restoring authoritative state after a socket
   * reconnect. Played sets that arrive during this window are HISTORY being
   * replayed, not new plays, so cosmetic arrival animations must be
   * suppressed for them.
   */
  isRestoring: boolean;
  /**
   * Increments once each time a restoration completes. Lets a component that
   * stayed mounted throughout notice that restoration just finished and
   * re-seed, without relying on a remount or a timer.
   */
  restorationGeneration: number;
  setReady: (ready: boolean) => void;
  startGame: () => void;
  addBot: () => void;
  removeBot: (playerId: PlayerId) => void;
  playAgain: () => void;
  proposePlayMoney: (amount: number, mode?: 'MATCH_POT' | 'KITTI_ROUND_BOOT') => void;
  acceptPlayMoney: () => void;
  declinePlayMoney: () => void;
  cancelPlayMoney: () => void;
  confirmArrangement: (sets: FourSets) => void;
  playSet: () => void;
  requestDismissal: (reason: DismissalReason, proposedSets?: FourSets) => void;
  startNextRound: () => void;
  requestKittiSuggestion: () => Promise<KittiSuggestionAck>;
  confirmKittiArrangement: (groups: KittiGroups) => void;
  playKittiHand: () => void;
  playKittiDecider: () => void;
  startNextKittiRound: () => void;
  proposeTeenPattiSetup: (tableConfig: TeenPattiTableConfig, roundVariant: TeenPattiRoundVariantConfig, variantPolicy: TeenPattiVariantTablePolicy) => Promise<TeenPattiSetupAck>;
  acceptTeenPattiSetup: (revision: number) => Promise<TeenPattiSetupAck>;
  chooseTeenPattiRoundVariant: (roundVariant: TeenPattiRoundVariantConfig) => void;
  chooseTeenPattiSurpriseRound: () => void;
  assignTeenPattiTwoReference: (upDownReferenceIndex: 0 | 1) => void;
  chooseTeenPattiDiscards: (discardedSlots: number[]) => void;
  requestTeenPattiFriendlyAssist: (targetPlayerId: PlayerId) => void;
  respondTeenPattiFriendlyAssist: (requestId: string, accept: boolean) => void;
  revokeTeenPattiFriendlyAssist: (requestId: string) => void;
  suggestTeenPattiFriendlyAssist: (requestId: string, suggestion: TeenPattiFriendlySuggestion) => void;
  teenPattiAction: (action: TeenPattiAction) => void;
  topUpTeenPatti: (amount: number) => void;
  startNextTeenPattiRound: () => void;
  leaveTeenPattiTable: () => Promise<TeenPattiLeaveAck>;
  clearTeenPattiSettlementNotice: () => void;
  proposePokerSetup: (config: PokerTableConfig) => Promise<PokerSetupAck>;
  acceptPokerSetup: (revision: number) => Promise<PokerSetupAck>;
  choosePokerVariant: (variantId: PokerVariantId) => void;
  pokerAction: (action: PokerAction) => void;
  topUpPoker: (amount: number) => void;
  startNextPokerHand: () => void;
  leavePokerTable: () => Promise<PokerLeaveAck>;
  clearPokerSettlementNotice: () => void;
  leaveTable: () => void;
  sendChat: (message: string, kind: 'text' | 'emoji' | 'voice', durationSec?: number) => void;
  getStats: (gameId: GameId) => { name: string; stats: PlayerStats }[];
  clearGameError: () => void;
  leaveSession: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef(getSocket());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
  const [room, setRoom] = useState<PublicRoomInfo | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [freshDealCount, setFreshDealCount] = useState(0);
  /** Reconnect restoration lifecycle. `active` is true from the moment a
   *  reconnect is attempted until the restoration burst has been applied;
   *  `generation` ticks once per completed restoration. */
  const [restoration, setRestoration] = useState({ active: false, generation: 0 });
  /** Set while a reconnect is in flight, so the hand the server replays as
   *  part of restoration is not mistaken for a new deal. */
  const suppressDealAnimation = useRef(false);
  const [myName, setMyName] = useState<string>('');
  // Refs mirroring the above, so the socket listener effect below (which
  // only runs once on mount) can always read the LATEST values instead of
  // a stale closure over whatever they were at mount time.
  const myPlayerIdRef = useRef<string | null>(null);
  const myNameRef = useRef<string>('');
  const roomRef = useRef<PublicRoomInfo | null>(null);
  const gameStateRef = useRef<HaazariPublicStatePayload | null>(null);
  const kittiStateRef = useRef<KittiPublicStatePayload | null>(null);
  const teenPattiStateRef = useRef<TeenPattiPublicStatePayload | null>(null);
  const teenPattiDealRoundRef = useRef<number | null>(null);
  const pokerStateRef = useRef<PokerPublicStatePayload | null>(null);
  const pokerDealHandRef = useRef<number | null>(null);
  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);
  useEffect(() => {
    myNameRef.current = myName;
  }, [myName]);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [myArrangedSets, setMyArrangedSets] = useState<FourSets | null>(null);
  const [gameState, setGameState] = useState<HaazariPublicStatePayload | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundResult[]>([]);
  const [winnerInfo, setWinnerInfo] = useState<{ winnerId: string; finalScores: Record<string, number> } | null>(null);
  const [kittiHand, setKittiHand] = useState<Card[]>([]);
  const [kittiArrangedGroups, setKittiArrangedGroups] = useState<KittiGroups | null>(null);
  const [kittiDeciderHand, setKittiDeciderHand] = useState<Card[]>([]);
  const [kittiState, setKittiState] = useState<KittiPublicStatePayload | null>(null);
  const [lastKittiRoundResult, setLastKittiRoundResult] = useState<KittiRoundResult | null>(null);
  const [kittiRoundHistory, setKittiRoundHistory] = useState<KittiRoundResult[]>([]);
  const [kittiWinnerInfo, setKittiWinnerInfo] = useState<{ winnerId: string; roundsWon: Record<string, number> } | null>(null);
  const [teenPattiSetup, setTeenPattiSetup] = useState<TeenPattiLobbySetup | null>(null);
  const [teenPattiPrivate, setTeenPattiPrivate] = useState<TeenPattiPrivateStatePayload | null>(null);
  const [teenPattiState, setTeenPattiState] = useState<TeenPattiPublicStatePayload | null>(null);
  const [lastTeenPattiRoundResult, setLastTeenPattiRoundResult] = useState<TeenPattiRoundOutcome | null>(null);
  const [teenPattiRoundHistory, setTeenPattiRoundHistory] = useState<TeenPattiRoundOutcome[]>([]);
  const [teenPattiSettlementNotice, setTeenPattiSettlementNotice] = useState<TeenPattiPlayerSettlement | null>(null);
  const [pokerSetup, setPokerSetup] = useState<PokerLobbySetup | null>(null);
  const [pokerPrivate, setPokerPrivate] = useState<PokerPrivateStatePayload | null>(null);
  const [pokerState, setPokerState] = useState<PokerPublicStatePayload | null>(null);
  const [lastPokerHandResult, setLastPokerHandResult] = useState<PokerHandOutcomePayload | null>(null);
  const [pokerHandHistory, setPokerHandHistory] = useState<PokerHandOutcomePayload[]>([]);
  const [pokerSettlementNotice, setPokerSettlementNotice] = useState<PokerPlayerSettlement | null>(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    kittiStateRef.current = kittiState;
  }, [kittiState]);
  useEffect(() => {
    teenPattiStateRef.current = teenPattiState;
  }, [teenPattiState]);
  useEffect(() => {
    pokerStateRef.current = pokerState;
  }, [pokerState]);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [viewMode, setViewMode] = useState<'active' | 'home'>('active');

  // Voice call
  const voiceManagerRef = useRef<VoiceCallManager | null>(null);
  const [inVoiceCall, setInVoiceCall] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState<string[]>([]);
  const [voiceDiagnostics, setVoiceDiagnostics] = useState<VoiceDiagnosticEvent[]>([]);
  const [voicePlaybackBlockedPlayerIds, setVoicePlaybackBlockedPlayerIds] = useState<string[]>([]);
  const [speakingPlayerIds, setSpeakingPlayerIds] = useState<string[]>([]);
  // Remember an intentional live call across a temporary transport drop. The
  // local peer graph is torn down immediately, then rebuilt only AFTER the
  // authoritative room reconnect has completed.
  const rejoinVoiceAfterReconnectRef = useRef(false);
  const rejoinVoiceMutedRef = useRef(false);

  // Guards against a stale reconnect ack (from an earlier, since-superseded
  // connect/disconnect cycle on a flaky connection) applying its result
  // after a NEWER attempt has already resolved - see onConnect below.
  const reconnectAttemptRef = useRef(0);
  // Mirrors `restoration.active` and `connectionStatus` for the socket
  // listener effect below and for the gameplay-emitting callbacks further
  // down, both of which need the LATEST value without re-subscribing/
  // re-creating on every change - same reasoning as myPlayerIdRef etc.
  // above. `actionsGatedRef` is true whenever a gameplay action must NOT be
  // sent: mid-restoration, or while not connected at all (emitting while
  // disconnected does not fail - socket.io-client silently buffers it and
  // replays it the instant the transport reconnects, which can land the
  // action on the server BEFORE `room:reconnect` has run and re-bound this
  // socket to its room/player - the exact race behind Bug 1, 2026-08-15
  // retest: a queued action or its resulting error surfacing after the
  // table was already showing).
  const restorationActiveRef = useRef(false);
  const actionsGatedRef = useRef(false);
  useEffect(() => {
    restorationActiveRef.current = restoration.active;
    actionsGatedRef.current = restoration.active || connectionStatus !== 'connected';
  }, [restoration.active, connectionStatus]);

  useEffect(() => {
    const socket = socketRef.current;

    const onConnect = () => {
      setConnectionStatus('connected');
      setHasConnectedOnce(true);
      const stored = readSession();
      if (stored) {
        const attempt = ++reconnectAttemptRef.current;
        // The server replays this player's hand as part of reconnect
        // restoration. That is not a new deal and must not animate.
        suppressDealAnimation.current = true;
        setRestoration((r) => ({ active: true, generation: r.generation }));
        socket.emit('room:reconnect', { token: stored.token }, (res: RoomAck) => {
          if (attempt !== reconnectAttemptRef.current) return; // superseded by a newer attempt - ignore
          if (res.ok && res.room) {
            setRoom(res.room);
            setMyPlayerId(res.playerId ?? null);
            setMyName(stored.playerName);
            setIsSpectator(false);
          } else {
            // An authoritative "no" from the server (bad/expired token, the
            // room is gone, or the seat is gone) - not merely "still
            // trying". Only NOW is it safe to clear whatever room/game
            // state is still sitting in React state from before the
            // disconnect; clearing it any earlier (e.g. on the disconnect
            // itself, or while a reconnect is still in flight) could drop a
            // player who was about to reconnect successfully. Previously
            // this branch only cleared the stored token, leaving a "ghost"
            // table on screen that looked normal but would only fail -
            // confusingly, as "You're not in a game right now" - the next
            // time the player tried to interact with it.
            rejoinVoiceAfterReconnectRef.current = false;
            rejoinVoiceMutedRef.current = false;
            clearSession();
            setRoom(null);
            setMyPlayerId(null);
            setMyHand([]);
            setMyArrangedSets(null);
            setGameState(null);
            setLastRoundResult(null);
            setWinnerInfo(null);
            setKittiHand([]);
            setKittiArrangedGroups(null);
            setKittiDeciderHand([]);
            setKittiState(null);
            setLastKittiRoundResult(null);
            setKittiRoundHistory([]);
            setKittiWinnerInfo(null);
            setTeenPattiSetup(null);
            setTeenPattiPrivate(null);
            setTeenPattiState(null);
            teenPattiStateRef.current = null;
            setLastTeenPattiRoundResult(null);
            setTeenPattiRoundHistory([]);
            teenPattiDealRoundRef.current = null;
            setPokerSetup(null);
            setPokerPrivate(null);
            setPokerState(null);
            pokerStateRef.current = null;
            setLastPokerHandResult(null);
            setPokerHandHistory([]);
            pokerDealHandRef.current = null;
            setViewMode('active');
            setRoomError("Your table timed out while you were away. You'll need to start or join a new one.");
          }
          // Release on the next tick, after the restoration burst of events.
          setTimeout(() => {
            suppressDealAnimation.current = false;
            // Completing the generation lets a still-mounted component
            // re-seed once against the restored state before normal
            // new-play detection resumes.
            setRestoration((r) => ({ active: false, generation: r.generation + 1 }));
          }, 0);
        });
      }
    };
    const onDisconnect = () => {
      setConnectionStatus('disconnected');
      // The server has already dropped us from any voice call on its side.
      // Remember whether the player was in the call, but DO NOT emit a
      // voice:leave while disconnected (Socket.IO would buffer/replay it).
      rejoinVoiceAfterReconnectRef.current = voiceManagerRef.current?.isJoined ?? false;
      rejoinVoiceMutedRef.current = voiceManagerRef.current?.isMuted ?? false;
      voiceManagerRef.current?.leave(false);
      voiceManagerRef.current = null;
      setInVoiceCall(false);
      setVoiceParticipants([]);
      setSpeakingPlayerIds([]);
    };
    const onRoomUpdate = (r: PublicRoomInfo) => {
      setRoom((prev) => {
        // Going back to LOBBY (Play Again) - clear stale game-over/round data
        // from the previous game so RoomLobby renders cleanly.
        if (prev?.status === 'IN_GAME' && r.status === 'LOBBY') {
          setGameState(null);
          setLastRoundResult(null);
          setWinnerInfo(null);
          setMyHand([]);
          setMyArrangedSets(null);
          setRoundHistory([]);
          setKittiHand([]);
          setKittiArrangedGroups(null);
          setKittiDeciderHand([]);
          setKittiState(null);
          setLastKittiRoundResult(null);
          setKittiRoundHistory([]);
          setKittiWinnerInfo(null);
          setTeenPattiPrivate(null);
          setTeenPattiState(null);
          teenPattiStateRef.current = null;
          setLastTeenPattiRoundResult(null);
          setTeenPattiRoundHistory([]);
          teenPattiDealRoundRef.current = null;
          setPokerPrivate(null);
          setPokerState(null);
          pokerStateRef.current = null;
          setLastPokerHandResult(null);
          setPokerHandHistory([]);
          pokerDealHandRef.current = null;
        }
        return r;
      });
    };
    const onRoomError = ({ message }: { message: string }) => setRoomError(message);
    const onYourHand = ({ hand }: { hand: Card[] }) => {
      setMyHand(hand);
      setMyArrangedSets(null); // a fresh hand means a fresh round - any prior arrangement is stale
      if (!suppressDealAnimation.current) {
        playDealSound();
        setFreshDealCount((n) => n + 1);
      }
    };
    const onYourArrangement = ({ sets }: { sets: FourSets }) => setMyArrangedSets(sets);
    const onGameState = (s: HaazariPublicStatePayload) => {
      setGameState(s);
      // Round history is server-authored. This keeps Settings -> Round History
      // complete during the next live round and after reconnect/return-to-table,
      // instead of relying only on transient `roundComplete` events.
      if (Array.isArray(s.roundHistory)) {
        setRoundHistory(s.roundHistory);
        if (s.state === 'ROUND_COMPLETE' || s.state === 'DISMISSED_ROUND') {
          const restored = [...s.roundHistory].reverse().find((round) => round.roundNumber === s.roundNumber);
          if (restored) setLastRoundResult(restored);
        }
      }
      // Reconnect may restore GAME_COMPLETE without replaying hazari:over. The
      // public winnerId + cumulative scores are sufficient to rebuild the
      // winner screen; the event handler remains responsible for sound/stats.
      if (s.state === 'GAME_COMPLETE' && s.winnerId) {
        setWinnerInfo({ winnerId: s.winnerId, finalScores: s.cumulativeScores });
      }
    };
    const onGameError = ({ message }: { message: string }) => {
      // "Not currently in a room." means THIS SOCKET currently has no
      // room/player binding server-side (see `withGame`/`roomCodeOf` on the
      // server) - which is the expected, transient state for the first
      // stretch of every reconnect, before `room:reconnect`'s ack has come
      // back and re-bound it (see onConnect above). It can also arrive from
      // a stale pre-background socket cycle whose response races in behind
      // a newer, already-successful reconnect. Either way, if restoration
      // is currently in flight, or the client still holds a room in state
      // at all, this is that transient/stale signal, not evidence the
      // player is actually out - the AUTHORITATIVE "you're really not in
      // this room any more" path is `room:reconnect`'s own `ok:false`
      // branch above, which already clears state and shows a controlled,
      // specific message ("Your table timed out..."). Surfacing this one
      // too, on top of that, showed a confusing "You're not in a game
      // right now" banner over a table that was actually fine - the exact
      // bug reported on real Android PWA staging (Bug 1, 2026-08-15
      // retest: "the existing Hazari table was still visibly present, then
      // Cardroom showed 'You're not in a game right now'").
      if (message === 'Not currently in a room.' && (restorationActiveRef.current || roomRef.current)) {
        return;
      }
      const players = roomRef.current?.players ?? [];
      setGameError(friendlyGameError(message, players, myPlayerIdRef.current));
      playErrorSound();
      hapticError();
    };
    const onRoundComplete = ({ result }: { result: RoundResult }) => {
      setLastRoundResult(result);
      setRoundHistory((prev) => prev.some((entry) => entry.roundNumber === result.roundNumber) ? prev : [...prev, result]);
      // A reconnect may legitimately replay the result payload purely to
      // rebuild the current screen. Restore silently instead of celebrating
      // the same round twice.
      if (!restorationActiveRef.current) {
        playRoundCompleteSound();
        hapticSuccess();
      }
    };
    const onGameOver = (payload: { winnerId: string; finalScores: Record<string, number> }) => {
      setWinnerInfo(payload);
      if (restorationActiveRef.current) return;
      playVictorySound();
      hapticVictory();
      const pid = myPlayerIdRef.current;
      const name = myNameRef.current;
      if (pid && name) {
        recordGameResult('HAZARI', name, pid === payload.winnerId, payload.finalScores[pid] ?? 0);
      }
    };
    const onKittiHand = ({ hand }: { hand: Card[] }) => {
      setKittiHand(hand);
      setKittiArrangedGroups(null);
      setKittiDeciderHand([]);
      if (!suppressDealAnimation.current) {
        playDealSound();
        setFreshDealCount((n) => n + 1);
      }
    };
    const onKittiArrangement = ({ groups }: { groups: KittiGroups }) => setKittiArrangedGroups(groups);
    const onKittiDeciderHand = ({ hand }: { hand: Card[] }) => setKittiDeciderHand(hand);
    const onKittiState = (state: KittiPublicStatePayload) => {
      const previous = kittiStateRef.current;
      const roundChanged = !!previous && previous.roundNumber !== state.roundNumber;
      if (roundChanged && ['ARRANGING', 'WAITING_FOR_ARRANGEMENTS'].includes(state.state)) {
        // A sudden-death spectator receives no private `yourHand` event by
        // design. Clear the just-finished round's private cards here so they
        // cannot keep rendering a stale rack while watching the leaders.
        // Active players are repopulated immediately by `kitti:yourHand`.
        setKittiHand([]);
        setKittiArrangedGroups(null);
        setKittiDeciderHand([]);
      }
      kittiStateRef.current = state;
      setKittiState(state);
      // Same reconnect-safe history model as Hazari. Older servers may omit
      // the field during a rolling deploy, hence the array guard. A completed
      // snapshot is also sufficient to rebuild the result screen even if the
      // one-time kitti:roundComplete event happened while this client was away.
      if (Array.isArray(state.roundHistory)) {
        setKittiRoundHistory(state.roundHistory);
        if (state.state === 'ROUND_COMPLETE') {
          const restored = [...state.roundHistory].reverse().find((round) => round.roundNumber === state.roundNumber);
          if (restored) setLastKittiRoundResult(restored);
        }
      }
      // Same principle for MATCH_COMPLETE: restore the winner screen from the
      // authoritative snapshot; only kitti:over triggers celebration/device stats.
      if (state.state === 'MATCH_COMPLETE' && state.matchWinnerId) {
        setKittiWinnerInfo({ winnerId: state.matchWinnerId, roundsWon: state.roundsWon });
      }
    };
    const onKittiRoundComplete = ({ result }: { result: KittiRoundResult }) => {
      setLastKittiRoundResult(result);
      setKittiRoundHistory((prev) => prev.some((entry) => entry.roundNumber === result.roundNumber) ? prev : [...prev, result]);
      if (!restorationActiveRef.current) {
        playRoundCompleteSound();
        hapticSuccess();
      }
    };
    const onKittiOver = (payload: { winnerId: string; roundsWon: Record<string, number> }) => {
      setKittiWinnerInfo(payload);
      if (restorationActiveRef.current) return;
      playVictorySound();
      hapticVictory();
      const pid = myPlayerIdRef.current;
      const name = myNameRef.current;
      if (pid && name) {
        recordGameResult('KITTI', name, pid === payload.winnerId, payload.roundsWon[pid] ?? 0);
      }
    };
    const onTeenPattiSetup = ({ setup }: { setup: TeenPattiLobbySetup | null }) => setTeenPattiSetup(setup);
    const onTeenPattiPrivate = (state: TeenPattiPrivateStatePayload) => setTeenPattiPrivate(state);
    const onTeenPattiState = (state: TeenPattiPublicStatePayload) => {
      const hasRoundCards = state.state === 'BETTING'
        || state.state === 'AWAITING_DISCARD'
        || state.state === 'AWAITING_REFERENCE_ASSIGNMENT';
      const isNewDeal = hasRoundCards && teenPattiDealRoundRef.current !== state.roundNumber;
      // A dealer-choice/config table can spend time in AWAITING_VARIANT with
      // the upcoming round number already visible. Do not mark it dealt until
      // cards actually exist. Five-card variants have a post-deal discard
      // gate, while Two-Reference Joker has a post-deal assignment gate, so
      // both states count as the real deal. Otherwise the ceremony would fire
      // late only after players finished those private choices.
      if (hasRoundCards) teenPattiDealRoundRef.current = state.roundNumber;
      // Action emitters read this ref synchronously. Keep it in lock-step with
      // the socket packet (as Poker already does) so a fast tap on a freshly
      // rendered turn cannot accidentally carry the previous sequence while
      // React's effect that mirrors state -> ref is still waiting to run.
      teenPattiStateRef.current = state;
      setTeenPattiState(state);
      if (Array.isArray(state.roundHistory)) setTeenPattiRoundHistory(state.roundHistory);
      // A reconnect can land directly on ROUND_COMPLETE after the one-time
      // teenpatti:roundComplete event already happened. `lastOutcome` is part
      // of the authoritative public snapshot, so use it to restore the same
      // summary silently. Once the server advances, clear the prior result.
      if (state.state === 'ROUND_COMPLETE' && state.lastOutcome) {
        setLastTeenPattiRoundResult(state.lastOutcome);
      } else if (state.state !== 'ROUND_COMPLETE') {
        setLastTeenPattiRoundResult(null);
      }
      if (isNewDeal && !suppressDealAnimation.current && !restorationActiveRef.current) {
        playDealSound();
        setFreshDealCount((n) => n + 1);
      }
    };
    const onTeenPattiRoundComplete = ({ result }: { result: TeenPattiRoundOutcome }) => {
      setLastTeenPattiRoundResult(result);
      setTeenPattiRoundHistory((prev) => prev.some((entry) => entry.roundNumber === result.roundNumber) ? prev : [...prev, result]);
      if (!restorationActiveRef.current) {
        playRoundCompleteSound();
        hapticSuccess();
      }
    };
    const onTeenPattiTableEnded = ({ settlements }: { reason: 'NOT_ENOUGH_PLAYERS'; settlements: TeenPattiPlayerSettlement[] }) => {
      const mine = settlements.find((entry) => entry.playerId === myPlayerIdRef.current);
      if (mine) setTeenPattiSettlementNotice(mine);
      setTeenPattiPrivate(null);
      setTeenPattiState(null);
      teenPattiStateRef.current = null;
      setLastTeenPattiRoundResult(null);
      teenPattiDealRoundRef.current = null;
    };
    const onPokerSetup = ({ setup }: { setup: PokerLobbySetup | null }) => setPokerSetup(setup);
    const onPokerPrivate = (state: PokerPrivateStatePayload) => setPokerPrivate(state);
    const onPokerState = (state: PokerPublicStatePayload) => {
      const isNewDeal = state.handNumber > 0
        && ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(state.state)
        && pokerDealHandRef.current !== state.handNumber;
      if (state.handNumber > 0 && state.state !== 'AWAITING_VARIANT' && state.state !== 'READY') {
        pokerDealHandRef.current = state.handNumber;
      }
      pokerStateRef.current = state;
      setPokerState(state);
      if (Array.isArray(state.handHistory)) setPokerHandHistory(state.handHistory);
      if (state.state === 'HAND_COMPLETE' && state.outcome) {
        setLastPokerHandResult(state.outcome);
      } else if (state.state === 'AWAITING_VARIANT' || state.state === 'PREFLOP') {
        setLastPokerHandResult(null);
      }
      if (isNewDeal && !suppressDealAnimation.current && !restorationActiveRef.current) {
        playDealSound();
        setFreshDealCount((n) => n + 1);
      }
    };
    const onPokerHandComplete = ({ result }: { result: PokerHandOutcomePayload }) => {
      setLastPokerHandResult(result);
      setPokerHandHistory((prev) => prev.some((entry) => entry.handNumber === result.handNumber) ? prev : [...prev, result]);
      if (!restorationActiveRef.current) {
        playRoundCompleteSound();
        hapticSuccess();
      }
    };
    const onPokerTableEnded = ({ settlements }: { reason: 'NOT_ENOUGH_PLAYERS'; settlements: PokerPlayerSettlement[] }) => {
      const mine = settlements.find((entry) => entry.playerId === myPlayerIdRef.current);
      if (mine) setPokerSettlementNotice(mine);
      setPokerPrivate(null);
      setPokerState(null);
      pokerStateRef.current = null;
      setLastPokerHandResult(null);
      setPokerHandHistory([]);
      pokerDealHandRef.current = null;
    };

    const onChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-99), msg]); // keep last 100
      setUnreadChatCount((n) => n + 1);
      playChatSound();
    };

    // Mobile browsers/PWAs throttle or fully suspend background tabs, and
    // can restore a page from the back-forward cache after a WebSocket has
    // already been force-closed. socket.io's own automatic reconnection
    // (see socket.ts) eventually notices and retries on its own, but its
    // backoff timer can be paused or badly delayed across a suspend/resume
    // cycle - waiting on it alone is what let a returning player see a
    // stale "ghost" table instead of a prompt reconnect. Nudge it directly
    // the moment the app is actually visible again; `.connect()` is a
    // documented no-op if already connected or already connecting.
    //
    // This deliberately does NOT touch history/navigation in any way -
    // visibility and pageshow are unrelated to popstate, and useBackGuard
    // only ever listens for popstate - so returning from another app is
    // never mistaken for a Back press. See ARCHITECTURE.md.
    function onForeground() {
      if (document.visibilityState === 'visible' && !socket.connected) {
        socket.connect();
      }
    }
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onForeground);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:update', onRoomUpdate);
    socket.on('room:error', onRoomError);
    socket.on('hazari:yourHand', onYourHand);
    socket.on('hazari:yourArrangement', onYourArrangement);
    socket.on('hazari:state', onGameState);
    socket.on('game:error', onGameError);
    socket.on('hazari:roundComplete', onRoundComplete);
    socket.on('hazari:over', onGameOver);
    socket.on('kitti:yourHand', onKittiHand);
    socket.on('kitti:yourArrangement', onKittiArrangement);
    socket.on('kitti:yourDeciderHand', onKittiDeciderHand);
    socket.on('kitti:state', onKittiState);
    socket.on('kitti:roundComplete', onKittiRoundComplete);
    socket.on('kitti:over', onKittiOver);
    socket.on('teenpatti:setup', onTeenPattiSetup);
    socket.on('teenpatti:private', onTeenPattiPrivate);
    socket.on('teenpatti:state', onTeenPattiState);
    socket.on('teenpatti:roundComplete', onTeenPattiRoundComplete);
    socket.on('teenpatti:tableEnded', onTeenPattiTableEnded);
    socket.on('poker:setup', onPokerSetup);
    socket.on('poker:private', onPokerPrivate);
    socket.on('poker:state', onPokerState);
    socket.on('poker:handComplete', onPokerHandComplete);
    socket.on('poker:tableEnded', onPokerTableEnded);
    socket.on('room:chatMessage', onChatMessage);

    if (socket.connected) onConnect();

    return () => {
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pageshow', onForeground);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:update', onRoomUpdate);
      socket.off('room:error', onRoomError);
      socket.off('hazari:yourHand', onYourHand);
      socket.off('hazari:yourArrangement', onYourArrangement);
      socket.off('hazari:state', onGameState);
      socket.off('game:error', onGameError);
      socket.off('hazari:roundComplete', onRoundComplete);
      socket.off('hazari:over', onGameOver);
      socket.off('kitti:yourHand', onKittiHand);
      socket.off('kitti:yourArrangement', onKittiArrangement);
      socket.off('kitti:yourDeciderHand', onKittiDeciderHand);
      socket.off('kitti:state', onKittiState);
      socket.off('kitti:roundComplete', onKittiRoundComplete);
      socket.off('kitti:over', onKittiOver);
      socket.off('teenpatti:setup', onTeenPattiSetup);
      socket.off('teenpatti:private', onTeenPattiPrivate);
      socket.off('teenpatti:state', onTeenPattiState);
      socket.off('teenpatti:roundComplete', onTeenPattiRoundComplete);
      socket.off('teenpatti:tableEnded', onTeenPattiTableEnded);
      socket.off('poker:setup', onPokerSetup);
      socket.off('poker:private', onPokerPrivate);
      socket.off('poker:state', onPokerState);
      socket.off('poker:handComplete', onPokerHandComplete);
      socket.off('poker:tableEnded', onPokerTableEnded);
      socket.off('room:chatMessage', onChatMessage);
    };
  }, []);

  const createRoom = useCallback((playerName: string, avatar: string = DEFAULT_AVATAR, gameId: GameId = 'HAZARI') => {
    return new Promise<RoomAck>((resolve) => {
      const existingRoomCode = roomRef.current?.roomCode ?? readSession()?.roomCode;
      if (existingRoomCode) {
        const error = `You're already seated in room ${existingRoomCode}. Return to that table or leave it before starting another one.`;
        setRoomError(error);
        resolve({ ok: false, error });
        return;
      }
      socketRef.current.emit('room:create', { playerName, avatar, gameId }, (res) => {
        if (res.ok && res.roomCode && res.playerId && res.token && res.room) {
          storeSession({ token: res.token, roomCode: res.roomCode, playerName });
          setRoomError(null);
          setGameError(null);
          setTeenPattiSettlementNotice(null);
          setPokerSettlementNotice(null);
          setRoom(res.room);
          setMyPlayerId(res.playerId);
          setMyName(playerName);
        } else {
          setRoomError(res.error ?? 'Could not create room.');
        }
        resolve(res);
      });
    });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string, avatar: string = DEFAULT_AVATAR) => {
    return new Promise<RoomAck>((resolve) => {
      const existingRoomCode = roomRef.current?.roomCode ?? readSession()?.roomCode;
      if (existingRoomCode) {
        const error = `You're already seated in room ${existingRoomCode}. Return to that table or leave it before joining another one.`;
        setRoomError(error);
        resolve({ ok: false, error });
        return;
      }
      socketRef.current.emit('room:join', { roomCode, playerName, avatar }, (res) => {
        if (res.ok && res.roomCode && res.playerId && res.token && res.room) {
          storeSession({ token: res.token, roomCode: res.roomCode, playerName });
          setRoomError(null);
          setGameError(null);
          setTeenPattiSettlementNotice(null);
          setPokerSettlementNotice(null);
          setRoom(res.room);
          setMyPlayerId(res.playerId);
          setMyName(playerName);
        } else {
          setRoomError(res.error ?? 'Could not join room.');
        }
        resolve(res);
      });
    });
  }, []);

  const quickMatch = useCallback((playerName: string, avatar: string = DEFAULT_AVATAR, gameId: GameId = 'HAZARI') => {
    return new Promise<RoomAck>((resolve) => {
      const existingRoomCode = roomRef.current?.roomCode ?? readSession()?.roomCode;
      if (existingRoomCode) {
        const error = `You're already seated in room ${existingRoomCode}. Return to that table or leave it before finding another one.`;
        setRoomError(error);
        resolve({ ok: false, error });
        return;
      }
      socketRef.current.emit('room:quickMatch', { playerName, avatar, gameId }, (res) => {
        if (res.ok && res.roomCode && res.playerId && res.token && res.room) {
          storeSession({ token: res.token, roomCode: res.roomCode, playerName });
          setRoomError(null);
          setGameError(null);
          setTeenPattiSettlementNotice(null);
          setPokerSettlementNotice(null);
          setRoom(res.room);
          setMyPlayerId(res.playerId);
          setMyName(playerName);
        } else {
          setRoomError(res.error ?? 'Could not find a match.');
        }
        resolve(res);
      });
    });
  }, []);

  const listTables = useCallback((gameId?: GameId) => {
    return new Promise<TableSummary[]>((resolve) => {
      socketRef.current.emit('room:listTables', { gameId }, (res: TablesAck) => {
        resolve(res.ok && res.tables ? res.tables : []);
      });
    });
  }, []);

  const requestSuggestionOptions = useCallback(() => {
    return new Promise<SuggestionOptionsAck>((resolve) => {
      // See actionsGatedRef above: never send while reconnecting/
      // disconnected - resolve with a same-shaped "not ok" ack instead of
      // either silently hanging or letting socket.io buffer-and-replay this
      // onto a socket that has not been rebound to its room yet.
      if (actionsGatedRef.current) {
        resolve({ ok: false, error: "Reconnecting - try again in a moment." });
        return;
      }
      socketRef.current.emit('hazari:requestSuggestionOptions', (res: SuggestionOptionsAck) => {
        resolve(res);
      });
    });
  }, []);

  const setReady = useCallback((ready: boolean) => {
    socketRef.current.emit('room:ready', { ready });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current.emit('room:start');
  }, []);

  const addBot = useCallback(() => {
    socketRef.current.emit('room:addBot');
  }, []);

  const removeBot = useCallback((playerId: PlayerId) => {
    socketRef.current.emit('room:removeBot', { playerId });
  }, []);

  const playAgain = useCallback(() => {
    socketRef.current.emit('room:playAgain');
  }, []);

  const proposePlayMoney = useCallback((amount: number, mode: 'MATCH_POT' | 'KITTI_ROUND_BOOT' = 'MATCH_POT') => {
    socketRef.current.emit('room:playMoneyPropose', { amount, mode });
  }, []);

  const acceptPlayMoney = useCallback(() => {
    socketRef.current.emit('room:playMoneyAccept');
  }, []);

  const declinePlayMoney = useCallback(() => {
    socketRef.current.emit('room:playMoneyDecline');
  }, []);

  const cancelPlayMoney = useCallback(() => {
    socketRef.current.emit('room:playMoneyCancel');
  }, []);

  const sendChat = useCallback((message: string, kind: 'text' | 'emoji' | 'voice', durationSec?: number) => {
    if (!message) return;
    if (kind !== 'voice' && !message.trim()) return;
    socketRef.current.emit('room:chat', { message, kind, durationSec });
  }, []);

  const markChatRead = useCallback(() => setUnreadChatCount(0), []);
  const getStats = useCallback((gameId: GameId) => getAllStats(gameId), []);

  const joinVoiceCall = useCallback(() => {
    if (!myPlayerId || voiceManagerRef.current?.isJoined) return;
    const manager = new VoiceCallManager(socketRef.current, myPlayerId, {
      onParticipantsChanged: (ids) => setVoiceParticipants(ids),
      onSpeakingChanged: (playerId, speaking) => {
        setSpeakingPlayerIds((prev) => {
          const has = prev.includes(playerId);
          if (speaking && !has) return [...prev, playerId];
          if (!speaking && has) return prev.filter((id) => id !== playerId);
          return prev;
        });
      },
      onError: (message) => setGameError(message),
      onDiagnosticsChanged: setVoiceDiagnostics,
      onPlaybackBlockedChanged: setVoicePlaybackBlockedPlayerIds,
      onSessionEnded: () => {
        voiceManagerRef.current = null;
        setInVoiceCall(false);
        setVoiceMuted(false);
        setVoiceParticipants([]);
        setSpeakingPlayerIds([]);
      },
    });
    voiceManagerRef.current = manager;
    const mode = isSpectator && room?.spectatorVoicePolicy !== 'CONVERSATION' ? 'LISTEN_ONLY' : 'CONVERSATION';
    manager.join(mode).then(() => {
      if (manager.isJoined && rejoinVoiceMutedRef.current) {
        manager.setMuted(true);
        setVoiceMuted(true);
      } else if (manager.isJoined) {
        setVoiceMuted(false);
      }
      rejoinVoiceMutedRef.current = false;
      setInVoiceCall(manager.isJoined);
    });
  }, [myPlayerId, isSpectator, room?.spectatorVoicePolicy]);

  useEffect(() => {
    if (!rejoinVoiceAfterReconnectRef.current) return;
    if (connectionStatus !== 'connected' || restoration.active || !room || !myPlayerId) return;
    rejoinVoiceAfterReconnectRef.current = false;
    joinVoiceCall();
  }, [connectionStatus, restoration.active, room, myPlayerId, joinVoiceCall]);

  const leaveVoiceCall = useCallback(() => {
    rejoinVoiceAfterReconnectRef.current = false;
    rejoinVoiceMutedRef.current = false;
    voiceManagerRef.current?.leave();
    voiceManagerRef.current = null;
    setInVoiceCall(false);
    setVoiceMuted(false);
    setVoiceParticipants([]);
    setSpeakingPlayerIds([]);
    setVoiceDiagnostics([]);
    setVoicePlaybackBlockedPlayerIds([]);
  }, []);

  const watchTable = useCallback((roomCode: string, spectatorName: string, avatar: string = DEFAULT_AVATAR) => {
    return new Promise<WatchRoomAck>((resolve) => {
      if (roomRef.current || readSession()) {
        resolve({ ok: false, error: 'Leave your current table before watching another one.' });
        return;
      }
      socketRef.current.emit('room:watch', { roomCode, spectatorName, avatar }, (res) => {
        if (res.ok && res.room && res.spectatorId) {
          setRoom(res.room);
          setMyPlayerId(res.spectatorId);
          setMyName(spectatorName);
          setIsSpectator(true);
          setViewMode('active');
        } else setRoomError(res.error ?? 'Could not watch this table.');
        resolve(res);
      });
    });
  }, []);

  const leaveSpectator = useCallback(() => {
    socketRef.current.emit('room:leaveSpectator', () => {
      voiceManagerRef.current?.leave(false);
      voiceManagerRef.current = null;
      setRoom(null);
      setMyPlayerId(null);
      setIsSpectator(false);
      setInVoiceCall(false);
      setVoiceParticipants([]);
      setSpeakingPlayerIds([]);
      setVoiceMuted(false);
      setVoiceDiagnostics([]);
      setVoicePlaybackBlockedPlayerIds([]);
      requestReturnToCardRoom();
    });
  }, []);

  const joinFromSpectator = useCallback((botPlayerId?: PlayerId) => {
    return new Promise<RoomAck>((resolve) => {
      // Voice mesh identity is keyed by the spectator id. Tear it down before
      // the server atomically promotes this socket to a player id; otherwise
      // an already-negotiated peer stream could survive under stale identity.
      leaveVoiceCall();
      socketRef.current.emit('room:spectatorJoin', { botPlayerId }, (res) => {
        if (res.ok && res.room && res.playerId && res.token && res.roomCode) {
          storeSession({ token: res.token, roomCode: res.roomCode, playerName: myNameRef.current });
          setRoom(res.room);
          setMyPlayerId(res.playerId);
          setIsSpectator(false);
        } else setGameError(res.error ?? 'Could not join this table.');
        resolve(res);
      });
    });
  }, [leaveVoiceCall]);

  const setTableVisibility = useCallback((visibility: 'LIVE' | 'PRIVATE') => {
    socketRef.current.emit('room:setVisibility', { visibility });
  }, []);

  const setSpectatorVoicePolicy = useCallback((policy: 'DISABLED' | 'LISTEN_ONLY' | 'CONVERSATION') => {
    socketRef.current.emit('room:setSpectatorVoice', { policy });
  }, []);

  const removeInactivePlayer = useCallback((playerId: PlayerId) => {
    socketRef.current.emit('room:removeInactive', { playerId });
  }, []);

  const toggleVoiceMute = useCallback(() => {
    if (!voiceManagerRef.current) return;
    const next = !voiceManagerRef.current.isMuted;
    voiceManagerRef.current.setMuted(next);
    setVoiceMuted(next);
  }, []);

  const retryVoicePlayback = useCallback(() => {
    void voiceManagerRef.current?.retryBlockedAudio();
  }, []);

  const goToHomeScreen = useCallback(() => setViewMode('home'), []);
  const returnToGame = useCallback(() => setViewMode('active'), []);

  const confirmArrangement = useCallback((sets: FourSets) => {
    // See actionsGatedRef above: a tap that lands in the reconnect/
    // restoration window must not reach the server ahead of `room:reconnect`
    // - silently ignored, not queued; the button re-enables the instant
    // restoration completes and the tap can simply be repeated.
    if (actionsGatedRef.current) return;
    const cardIdSets: [string[], string[], string[], string[]] = [
      sets[0].map((c) => c.id),
      sets[1].map((c) => c.id),
      sets[2].map((c) => c.id),
      sets[3].map((c) => c.id),
    ];
    socketRef.current.emit('hazari:confirmArrangement', { cardIdSets });
    setMyArrangedSets(sets); // optimistic; server echoes 'hazari:yourArrangement' to confirm/correct
  }, []);

  const playSet = useCallback(() => {
    // See actionsGatedRef above.
    if (actionsGatedRef.current) return;
    socketRef.current.emit('hazari:playSet');
  }, []);

  const requestDismissal = useCallback((reason: DismissalReason, proposedSets?: FourSets) => {
    // See actionsGatedRef above.
    if (actionsGatedRef.current) return;
    const proposedCardIdSets = proposedSets
      ? (proposedSets.map((s) => s.map((c) => c.id)) as [string[], string[], string[], string[]])
      : undefined;
    socketRef.current.emit('hazari:requestDismissal', { reason, proposedCardIdSets });
  }, []);

  const startNextRound = useCallback(() => {
    // See actionsGatedRef above.
    if (actionsGatedRef.current) return;
    setLastRoundResult(null);
    socketRef.current.emit('hazari:startNextRound');
  }, []);

  const requestKittiSuggestion = useCallback(() => {
    return new Promise<KittiSuggestionAck>((resolve) => {
      if (actionsGatedRef.current) {
        resolve({ ok: false, error: 'Reconnecting - try again in a moment.' });
        return;
      }
      socketRef.current.emit('kitti:requestSuggestion', (res: KittiSuggestionAck) => resolve(res));
    });
  }, []);

  const confirmKittiArrangement = useCallback((groups: KittiGroups) => {
    if (actionsGatedRef.current) return;
    const cardIdGroups = groups.map((group) => group.map((card) => card.id)) as [string[], string[], string[]];
    // Do not optimistically mark the arrangement confirmed. Kitti ordering is
    // strict and server-authoritative; only the server echo moves the client
    // into the waiting state, so a rejected Group 1 > Group 2 > Group 3
    // submission can never make the UI look accepted.
    socketRef.current.emit('kitti:confirmArrangement', { cardIdGroups });
  }, []);

  const playKittiHand = useCallback(() => {
    if (actionsGatedRef.current) return;
    socketRef.current.emit('kitti:playHand');
  }, []);

  const playKittiDecider = useCallback(() => {
    if (actionsGatedRef.current) return;
    socketRef.current.emit('kitti:playDecider');
  }, []);

  const startNextKittiRound = useCallback(() => {
    if (actionsGatedRef.current) return;
    setLastKittiRoundResult(null);
    socketRef.current.emit('kitti:startNextRound');
  }, []);

  const proposeTeenPattiSetup = useCallback((tableConfig: TeenPattiTableConfig, roundVariant: TeenPattiRoundVariantConfig, variantPolicy: TeenPattiVariantTablePolicy) => {
    return new Promise<TeenPattiSetupAck>((resolve) => {
      if (actionsGatedRef.current) {
        resolve({ ok: false, error: 'Reconnect before changing Teen Patti table settings.' });
        return;
      }
      socketRef.current.emit('teenpatti:proposeSetup', { tableConfig, roundVariant, variantPolicy }, (res) => {
        if (!res.ok) setRoomError(res.error ?? 'Could not propose Teen Patti settings.');
        if (res.setup) setTeenPattiSetup(res.setup);
        resolve(res);
      });
    });
  }, []);

  const acceptTeenPattiSetup = useCallback((revision: number) => {
    return new Promise<TeenPattiSetupAck>((resolve) => {
      if (actionsGatedRef.current) {
        resolve({ ok: false, error: 'Reconnect before accepting Teen Patti table settings.' });
        return;
      }
      socketRef.current.emit('teenpatti:acceptSetup', { revision }, (res) => {
        if (!res.ok) setRoomError(res.error ?? 'Could not accept Teen Patti settings.');
        if (res.setup) setTeenPattiSetup(res.setup);
        resolve(res);
      });
    });
  }, []);

  const chooseTeenPattiRoundVariant = useCallback((roundVariant: TeenPattiRoundVariantConfig) => {
    if (actionsGatedRef.current) return;
    const expectedSeq = teenPattiStateRef.current?.sequence;
    if (expectedSeq === undefined) return;
    socketRef.current.emit('teenpatti:chooseRoundVariant', { roundVariant, expectedSeq });
  }, []);

  const chooseTeenPattiSurpriseRound = useCallback(() => {
    if (actionsGatedRef.current) return;
    const expectedSeq = teenPattiStateRef.current?.sequence;
    if (expectedSeq === undefined) return;
    socketRef.current.emit('teenpatti:chooseSurpriseRound', { expectedSeq });
  }, []);

  const assignTeenPattiTwoReference = useCallback((upDownReferenceIndex: 0 | 1) => {
    if (actionsGatedRef.current) return;
    const expectedSeq = teenPattiStateRef.current?.sequence;
    if (expectedSeq === undefined) return;
    socketRef.current.emit('teenpatti:assignTwoReference', { upDownReferenceIndex, expectedSeq });
  }, []);

  const chooseTeenPattiDiscards = useCallback((discardedSlots: number[]) => {
    if (actionsGatedRef.current) return;
    const expectedSeq = teenPattiStateRef.current?.sequence;
    if (expectedSeq === undefined) return;
    socketRef.current.emit('teenpatti:chooseDiscards', { discardedSlots, expectedSeq });
  }, []);

  const requestTeenPattiFriendlyAssist = useCallback((targetPlayerId: PlayerId) => {
    if (actionsGatedRef.current) return;
    const expectedRoundNumber = teenPattiStateRef.current?.roundNumber;
    if (expectedRoundNumber === undefined) return;
    socketRef.current.emit('teenpatti:friendlyAssistRequest', { targetPlayerId, expectedRoundNumber });
  }, []);

  const respondTeenPattiFriendlyAssist = useCallback((requestId: string, accept: boolean) => {
    if (actionsGatedRef.current) return;
    socketRef.current.emit('teenpatti:friendlyAssistRespond', { requestId, accept });
  }, []);

  const revokeTeenPattiFriendlyAssist = useCallback((requestId: string) => {
    if (actionsGatedRef.current) return;
    socketRef.current.emit('teenpatti:friendlyAssistRevoke', { requestId });
  }, []);

  const suggestTeenPattiFriendlyAssist = useCallback((requestId: string, suggestion: TeenPattiFriendlySuggestion) => {
    if (actionsGatedRef.current) return;
    socketRef.current.emit('teenpatti:friendlyAssistSuggest', { requestId, suggestion });
  }, []);

  const teenPattiAction = useCallback((action: TeenPattiAction) => {
    if (actionsGatedRef.current) return;
    const expectedSeq = teenPattiStateRef.current?.sequence;
    // Never send an authoritative betting action before the client has a
    // server state to bind it to. This mirrors Poker's stale-action guard and
    // closes the old optional-sequence bypass at the network boundary.
    if (expectedSeq === undefined) return;
    socketRef.current.emit('teenpatti:action', { action, expectedSeq });
  }, []);

  const topUpTeenPatti = useCallback((amount: number) => {
    if (actionsGatedRef.current) return;
    const expectedSeq = teenPattiStateRef.current?.sequence;
    // Top-ups are additive. Bind them to the current server state so a rapid
    // double tap cannot fund the table twice before the first update arrives.
    if (expectedSeq === undefined) return;
    socketRef.current.emit('teenpatti:topUp', { amount, expectedSeq });
  }, []);

  const startNextTeenPattiRound = useCallback(() => {
    if (actionsGatedRef.current) return;
    const expectedSeq = teenPattiStateRef.current?.sequence;
    if (expectedSeq === undefined) return;
    // Bind the host's next-round command to the exact completed-round state.
    // A delayed/double-tapped command from an older result screen can never
    // start a later round. The result/private UI is cleared only by the
    // authoritative state/private broadcasts that follow a successful deal.
    socketRef.current.emit('teenpatti:startNextRound', { expectedSeq });
  }, []);

  const leaveTeenPattiTable = useCallback(() => {
    if (actionsGatedRef.current) {
      return Promise.resolve({ ok: false, error: 'Reconnect before leaving the table.' } as TeenPattiLeaveAck);
    }
    return new Promise<TeenPattiLeaveAck>((resolve) => {
      socketRef.current.emit('teenpatti:leaveTable', (res) => {
        if (!res.ok) {
          setGameError(res.error ?? 'Could not leave the Teen Patti table.');
          resolve(res);
          return;
        }

        if (res.settlement) setTeenPattiSettlementNotice(res.settlement);
        // The server already removed call membership and detached this socket
        // from the room. Close local media without emitting another voice event.
        voiceManagerRef.current?.leave(false);
        voiceManagerRef.current = null;
        rejoinVoiceAfterReconnectRef.current = false;
        rejoinVoiceMutedRef.current = false;
        setInVoiceCall(false);
        setVoiceMuted(false);
        setVoiceParticipants([]);
        setSpeakingPlayerIds([]);
        requestReturnToCardRoom();
        clearSession();
        setRoom(null);
        setMyPlayerId(null);
        setMyHand([]);
        setMyArrangedSets(null);
        setGameState(null);
        setLastRoundResult(null);
        setWinnerInfo(null);
        setKittiHand([]);
        setKittiArrangedGroups(null);
        setKittiDeciderHand([]);
        setKittiState(null);
        setLastKittiRoundResult(null);
        setKittiRoundHistory([]);
        setKittiWinnerInfo(null);
        setTeenPattiSetup(null);
        setTeenPattiPrivate(null);
        setTeenPattiState(null);
        teenPattiStateRef.current = null;
        setLastTeenPattiRoundResult(null);
        setTeenPattiRoundHistory([]);
        teenPattiDealRoundRef.current = null;
        setPokerSetup(null);
        setPokerPrivate(null);
        setPokerState(null);
        pokerStateRef.current = null;
        setLastPokerHandResult(null);
        setPokerHandHistory([]);
        pokerDealHandRef.current = null;
        setViewMode('active');
        resolve(res);
      });
    });
  }, []);

  const clearTeenPattiSettlementNotice = useCallback(() => setTeenPattiSettlementNotice(null), []);

  const proposePokerSetup = useCallback((config: PokerTableConfig) => {
    return new Promise<PokerSetupAck>((resolve) => {
      if (actionsGatedRef.current) {
        resolve({ ok: false, error: 'Reconnect before changing Poker table settings.' });
        return;
      }
      socketRef.current.emit('poker:proposeSetup', { config }, (res) => {
        if (!res.ok) setRoomError(res.error ?? 'Could not propose Poker settings.');
        if (res.setup) setPokerSetup(res.setup);
        resolve(res);
      });
    });
  }, []);

  const acceptPokerSetup = useCallback((revision: number) => {
    return new Promise<PokerSetupAck>((resolve) => {
      if (actionsGatedRef.current) {
        resolve({ ok: false, error: 'Reconnect before accepting Poker table settings.' });
        return;
      }
      socketRef.current.emit('poker:acceptSetup', { revision }, (res) => {
        if (!res.ok) setRoomError(res.error ?? 'Could not accept Poker settings.');
        if (res.setup) setPokerSetup(res.setup);
        resolve(res);
      });
    });
  }, []);

  const choosePokerVariant = useCallback((variantId: PokerVariantId) => {
    if (actionsGatedRef.current) return;
    const expectedSeq = pokerStateRef.current?.sequence;
    // Dealer Choice must obey the same stale-state boundary as betting. A
    // delayed chooser screen from an older hand must never be able to deal
    // into a newer AWAITING_VARIANT state.
    if (expectedSeq === undefined) return;
    socketRef.current.emit('poker:chooseVariant', { variantId, expectedSeq });
  }, []);

  const pokerAction = useCallback((action: PokerAction) => {
    if (actionsGatedRef.current) return;
    const expectedSeq = pokerStateRef.current?.sequence;
    // A Poker action without a current authoritative sequence could bypass
    // stale-action protection after a delayed/reconnected UI event. Do not
    // put such an action on the wire at all.
    if (expectedSeq === undefined) return;
    socketRef.current.emit('poker:action', { action, expectedSeq });
  }, []);

  const topUpPoker = useCallback((amount: number) => {
    if (actionsGatedRef.current) return;
    const expectedSeq = pokerStateRef.current?.sequence;
    // A between-hand top-up is additive, so a double tap must not be able to
    // fund the stack twice before the first server update comes back.
    if (expectedSeq === undefined) return;
    socketRef.current.emit('poker:topUp', { amount, expectedSeq });
  }, []);

  const startNextPokerHand = useCallback(() => {
    if (actionsGatedRef.current) return;
    const expectedSeq = pokerStateRef.current?.sequence;
    if (expectedSeq === undefined) return;
    // Same stale-result protection as Teen Patti: the server will only deal
    // from the exact completed-hand sequence this button was rendered for.
    socketRef.current.emit('poker:startNextHand', { expectedSeq });
  }, []);

  const leavePokerTable = useCallback(() => {
    if (actionsGatedRef.current) {
      return Promise.resolve({ ok: false, error: 'Reconnect before leaving the table.' } as PokerLeaveAck);
    }
    return new Promise<PokerLeaveAck>((resolve) => {
      socketRef.current.emit('poker:leaveTable', (res) => {
        if (!res.ok) {
          setGameError(res.error ?? 'Could not leave the Poker table.');
          resolve(res);
          return;
        }
        if (res.settlement) setPokerSettlementNotice(res.settlement);
        voiceManagerRef.current?.leave(false);
        voiceManagerRef.current = null;
        rejoinVoiceAfterReconnectRef.current = false;
        rejoinVoiceMutedRef.current = false;
        setInVoiceCall(false);
        setVoiceMuted(false);
        setVoiceParticipants([]);
        setSpeakingPlayerIds([]);
        requestReturnToCardRoom();
        clearSession();
        setRoom(null);
        setMyPlayerId(null);
        setPokerSetup(null);
        setPokerPrivate(null);
        setPokerState(null);
        pokerStateRef.current = null;
        setLastPokerHandResult(null);
        setPokerHandHistory([]);
        pokerDealHandRef.current = null;
        setViewMode('active');
        resolve(res);
      });
    });
  }, []);

  const clearPokerSettlementNotice = useCallback(() => setPokerSettlementNotice(null), []);

  const leaveTable = useCallback(() => {
    // The room lifecycle event itself removes call membership server-side.
    // Tear down locally without emitting a second voice event that could race
    // with the socket being detached from the room.
    voiceManagerRef.current?.leave(false);
    voiceManagerRef.current = null;
    rejoinVoiceAfterReconnectRef.current = false;
    rejoinVoiceMutedRef.current = false;
    socketRef.current.emit('room:leaveTable');
    setInVoiceCall(false);
    setVoiceMuted(false);
    setVoiceParticipants([]);
    setSpeakingPlayerIds([]);
    // This seat is now bot-controlled for the rest of the game - the local
    // player has no further part in it, so clear their session the same
    // way leaveSession() does and send them back to the landing screen.
    requestReturnToCardRoom();
    clearSession();
    setRoom(null);
    setMyPlayerId(null);
    setMyHand([]);
    setMyArrangedSets(null);
    setGameState(null);
    setLastRoundResult(null);
    setWinnerInfo(null);
    setKittiHand([]);
    setKittiArrangedGroups(null);
    setKittiDeciderHand([]);
    setKittiState(null);
    setLastKittiRoundResult(null);
    setKittiRoundHistory([]);
    setKittiWinnerInfo(null);
    setTeenPattiSetup(null);
    setTeenPattiPrivate(null);
    setTeenPattiState(null);
    teenPattiStateRef.current = null;
    setLastTeenPattiRoundResult(null);
    setTeenPattiRoundHistory([]);
    teenPattiDealRoundRef.current = null;
    setPokerSetup(null);
    setPokerPrivate(null);
    setPokerState(null);
    pokerStateRef.current = null;
    setLastPokerHandResult(null);
    setPokerHandHistory([]);
    pokerDealHandRef.current = null;
    setViewMode('active');
  }, []);

  const clearGameError = useCallback(() => setGameError(null), []);

  const leaveSession = useCallback(() => {
    const currentRoom = roomRef.current;
    if (currentRoom?.status === 'IN_GAME') {
      const complete =
        (currentRoom.gameId === 'HAZARI' && gameStateRef.current?.state === 'GAME_COMPLETE') ||
        (currentRoom.gameId === 'KITTI' && kittiStateRef.current?.state === 'MATCH_COMPLETE');
      if (!complete) {
        setGameError('This game is still in progress. Use the in-game Leave Table option instead.');
        return;
      }
    }

    const finalizeLocalLeave = () => {
      voiceManagerRef.current?.leave(false);
      voiceManagerRef.current = null;
      rejoinVoiceAfterReconnectRef.current = false;
      rejoinVoiceMutedRef.current = false;
      setInVoiceCall(false);
      setVoiceMuted(false);
      setVoiceParticipants([]);
      setSpeakingPlayerIds([]);
      requestReturnToCardRoom();
      clearSession();
      setRoom(null);
      setMyPlayerId(null);
      setMyHand([]);
      setMyArrangedSets(null);
      setGameState(null);
      setLastRoundResult(null);
      setWinnerInfo(null);
      setKittiHand([]);
      setKittiArrangedGroups(null);
      setKittiDeciderHand([]);
      setKittiState(null);
      setLastKittiRoundResult(null);
      setKittiRoundHistory([]);
      setKittiWinnerInfo(null);
      setTeenPattiSetup(null);
      setTeenPattiPrivate(null);
      setTeenPattiState(null);
      teenPattiStateRef.current = null;
      setLastTeenPattiRoundResult(null);
      setTeenPattiRoundHistory([]);
      teenPattiDealRoundRef.current = null;
      setPokerSetup(null);
      setPokerPrivate(null);
      setPokerState(null);
      pokerStateRef.current = null;
      setLastPokerHandResult(null);
      setPokerHandHistory([]);
      pokerDealHandRef.current = null;
      setViewMode('active');
    };

    if (!currentRoom) {
      finalizeLocalLeave();
      return;
    }

    // Do not erase the local session until the authoritative server confirms
    // that the seat/token has actually been removed. This prevents the player
    // from believing they left while everybody else still sees a ghost seat.
    socketRef.current.emit('room:leave', (res) => {
      if (!res.ok) {
        setGameError(res.error ?? 'Could not leave this room. Please try again.');
        return;
      }
      finalizeLocalLeave();
    });
  }, []);

  // Public and private game packets are emitted separately. React may paint
  // after the first packet, so expose private cards/legal actions only when
  // their authoritative round/hand + sequence identity matches the public
  // snapshot. This closes the one-frame stale-action/stale-hand window at
  // new deals, betting updates, top-ups and reconnect restoration.
  const coherentTeenPattiPrivate = coherentTeenPattiPrivateState(teenPattiState, teenPattiPrivate);
  const coherentPokerPrivate = coherentPokerPrivateState(pokerState, pokerPrivate);

  const value: GameContextValue = {
    connectionStatus,
    hasConnectedOnce,
    room,
    myPlayerId,
    isSpectator,
    myName,
    myHand,
    myArrangedSets,
    gameState,
    lastRoundResult,
    roundHistory,
    winnerInfo,
    kittiHand,
    kittiArrangedGroups,
    kittiDeciderHand,
    kittiState,
    lastKittiRoundResult,
    kittiRoundHistory,
    kittiWinnerInfo,
    teenPattiSetup,
    teenPattiPrivate: coherentTeenPattiPrivate,
    teenPattiState,
    lastTeenPattiRoundResult,
    teenPattiRoundHistory,
    teenPattiSettlementNotice,
    pokerSetup,
    pokerPrivate: coherentPokerPrivate,
    pokerState,
    lastPokerHandResult,
    pokerHandHistory,
    pokerSettlementNotice,
    roomError,
    gameError,
    chatMessages,
    unreadChatCount,
    markChatRead,
    voiceCallSupported: isVoiceCallSupported(),
    inVoiceCall,
    voiceMuted,
    voiceParticipants,
    speakingPlayerIds,
    voiceDiagnostics,
    voicePlaybackBlockedPlayerIds,
    joinVoiceCall,
    leaveVoiceCall,
    toggleVoiceMute,
    retryVoicePlayback,
    viewMode,
    goToHomeScreen,
    returnToGame,
    createRoom,
    joinRoom,
    quickMatch,
    listTables,
    watchTable,
    leaveSpectator,
    joinFromSpectator,
    setTableVisibility,
    setSpectatorVoicePolicy,
    removeInactivePlayer,
    requestSuggestionOptions,
    freshDealCount,
    isRestoring: restoration.active,
    restorationGeneration: restoration.generation,
    setReady,
    startGame,
    addBot,
    removeBot,
    playAgain,
    proposePlayMoney,
    acceptPlayMoney,
    declinePlayMoney,
    cancelPlayMoney,
    confirmArrangement,
    playSet,
    requestDismissal,
    startNextRound,
    requestKittiSuggestion,
    confirmKittiArrangement,
    playKittiHand,
    playKittiDecider,
    startNextKittiRound,
    proposeTeenPattiSetup,
    acceptTeenPattiSetup,
    chooseTeenPattiRoundVariant,
    chooseTeenPattiSurpriseRound,
    assignTeenPattiTwoReference,
    chooseTeenPattiDiscards,
    requestTeenPattiFriendlyAssist,
    respondTeenPattiFriendlyAssist,
    revokeTeenPattiFriendlyAssist,
    suggestTeenPattiFriendlyAssist,
    teenPattiAction,
    topUpTeenPatti,
    startNextTeenPattiRound,
    leaveTeenPattiTable,
    clearTeenPattiSettlementNotice,
    proposePokerSetup,
    acceptPokerSetup,
    choosePokerVariant,
    pokerAction,
    topUpPoker,
    startNextPokerHand,
    leavePokerTable,
    clearPokerSettlementNotice,
    leaveTable,
    sendChat,
    getStats,
    clearGameError,
    leaveSession,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

/**
 * Read-only check for the UI layer: does this browser already hold a stored
 * session (a real reconnect token) for the given room code?
 *
 * Exists to close a duplicate-player gap: on connect, GameStore always
 * attempts `room:reconnect` first using any stored session (see the
 * `onConnect` handler above) - but that is an async round trip, and while it
 * is in flight `App` still has `room === null`, so it still renders the
 * invite-link flow. If that flow's "Join" button were tapped in that window,
 * it would call `room:join` and create a brand-new player/token, even though
 * a reconnect for the very same room was already on its way - leaving one
 * stale, orphaned seat behind (see HomeScreen's use of this function).
 * This performs no side effect and changes no reconnect/session/protocol
 * behaviour; it only lets the UI avoid offering a redundant join.
 */
export function getStoredSessionRoomCode(): string | null {
  return readSession()?.roomCode ?? null;
}

function storeSession(s: StoredSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore storage failures (private browsing etc.) */
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
