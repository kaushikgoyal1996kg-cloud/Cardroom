import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getSocket, type RoomAck, type TablesAck } from './socket';
import type {
  Card,
  ChatMessage,
  DismissalReason,
  GameId,
  FourSets,
  HaazariPublicStatePayload,
  PublicRoomInfo,
  RoundResult,
  TableSummary,
} from '../game/types';
import { DEFAULT_AVATAR } from '../game/avatars';
import { playDealSound, playChatSound, playErrorSound, playRoundCompleteSound, playVictorySound } from './sound';
import { hapticMedium, hapticError, hapticSuccess, hapticVictory } from './haptics';
import { recordGameResult, getAllStats, type PlayerStats } from './stats';
import type { SuggestionOptionsAck } from './socket';
import { friendlyGameError } from './errorMessages';
import { VoiceCallManager, isVoiceCallSupported } from './voiceCall';

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
  myName: string;
  myHand: Card[];
  myArrangedSets: FourSets | null;
  gameState: HaazariPublicStatePayload | null;
  lastRoundResult: RoundResult | null;
  roundHistory: RoundResult[];
  winnerInfo: { winnerId: string; finalScores: Record<string, number> } | null;
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
  joinVoiceCall: () => void;
  leaveVoiceCall: () => void;
  toggleVoiceMute: () => void;
  viewMode: 'active' | 'home';
  goToHomeScreen: () => void;
  returnToGame: () => void;

  createRoom: (playerName: string, avatar?: string, gameId?: GameId) => Promise<RoomAck>;
  joinRoom: (roomCode: string, playerName: string, avatar?: string) => Promise<RoomAck>;
  quickMatch: (playerName: string, avatar?: string, gameId?: GameId) => Promise<RoomAck>;
  listTables: (gameId?: GameId) => Promise<TableSummary[]>;
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
  playAgain: () => void;
  confirmArrangement: (sets: FourSets) => void;
  playSet: () => void;
  requestDismissal: (reason: DismissalReason, proposedSets?: FourSets) => void;
  startNextRound: () => void;
  leaveTable: () => void;
  sendChat: (message: string, kind: 'text' | 'emoji' | 'voice', durationSec?: number) => void;
  getStats: () => { name: string; stats: PlayerStats }[];
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
  const [speakingPlayerIds, setSpeakingPlayerIds] = useState<string[]>([]);

  useEffect(() => {
    const socket = socketRef.current;

    const onConnect = () => {
      setConnectionStatus('connected');
      setHasConnectedOnce(true);
      const stored = readSession();
      if (stored) {
        // The server replays this player's hand as part of reconnect
        // restoration. That is not a new deal and must not animate.
        suppressDealAnimation.current = true;
        setRestoration((r) => ({ active: true, generation: r.generation }));
        socket.emit('room:reconnect', { token: stored.token }, (res: RoomAck) => {
          if (res.ok && res.room) {
            setRoom(res.room);
            setMyPlayerId(res.playerId ?? null);
            setMyName(stored.playerName);
          } else {
            clearSession();
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
      // The server has already dropped us from any voice call on its side
      // (see the disconnect handler in socketHandlers.ts) - tear down our
      // local peer connections and mic stream too rather than leaving them
      // dangling while we're disconnected.
      voiceManagerRef.current?.leave();
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
        }
        return r;
      });
    };
    const onRoomError = ({ message }: { message: string }) => setRoomError(message);
    const onYourHand = ({ hand }: { hand: Card[] }) => {
      setMyHand(hand);
      setMyArrangedSets(null); // a fresh hand means a fresh round - any prior arrangement is stale
      playDealSound();
      if (!suppressDealAnimation.current) {
        setFreshDealCount((n) => n + 1);
      }
    };
    const onYourArrangement = ({ sets }: { sets: FourSets }) => setMyArrangedSets(sets);
    const onGameState = (s: HaazariPublicStatePayload) => setGameState(s);
    const onGameError = ({ message }: { message: string }) => {
      const players = roomRef.current?.players ?? [];
      setGameError(friendlyGameError(message, players, myPlayerIdRef.current));
      playErrorSound();
      hapticError();
    };
    const onRoundComplete = ({ result }: { result: RoundResult }) => {
      setLastRoundResult(result);
      setRoundHistory((prev) => [...prev, result]);
      playRoundCompleteSound();
      hapticSuccess();
    };
    const onGameOver = (payload: { winnerId: string; finalScores: Record<string, number> }) => {
      setWinnerInfo(payload);
      playVictorySound();
      hapticVictory();
      const pid = myPlayerIdRef.current;
      const name = myNameRef.current;
      if (pid && name) {
        recordGameResult(name, pid === payload.winnerId, payload.finalScores[pid] ?? 0);
      }
    };
    const onChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-99), msg]); // keep last 100
      setUnreadChatCount((n) => n + 1);
      playChatSound();
    };

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
    socket.on('room:chatMessage', onChatMessage);

    if (socket.connected) onConnect();

    return () => {
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
      socket.off('room:chatMessage', onChatMessage);
    };
  }, []);

  const createRoom = useCallback((playerName: string, avatar: string = DEFAULT_AVATAR, gameId: GameId = 'HAZARI') => {
    return new Promise<RoomAck>((resolve) => {
      socketRef.current.emit('room:create', { playerName, avatar, gameId }, (res) => {
        if (res.ok && res.roomCode && res.playerId && res.token && res.room) {
          storeSession({ token: res.token, roomCode: res.roomCode, playerName });
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
      socketRef.current.emit('room:join', { roomCode, playerName, avatar }, (res) => {
        if (res.ok && res.roomCode && res.playerId && res.token && res.room) {
          storeSession({ token: res.token, roomCode: res.roomCode, playerName });
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
      socketRef.current.emit('room:quickMatch', { playerName, avatar, gameId }, (res) => {
        if (res.ok && res.roomCode && res.playerId && res.token && res.room) {
          storeSession({ token: res.token, roomCode: res.roomCode, playerName });
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

  const playAgain = useCallback(() => {
    socketRef.current.emit('room:playAgain');
  }, []);

  const sendChat = useCallback((message: string, kind: 'text' | 'emoji' | 'voice', durationSec?: number) => {
    if (!message) return;
    if (kind !== 'voice' && !message.trim()) return;
    socketRef.current.emit('room:chat', { message, kind, durationSec });
  }, []);

  const markChatRead = useCallback(() => setUnreadChatCount(0), []);
  const getStats = useCallback(() => getAllStats(), []);

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
    });
    voiceManagerRef.current = manager;
    manager.join().then(() => setInVoiceCall(manager.isJoined));
  }, [myPlayerId]);

  const leaveVoiceCall = useCallback(() => {
    voiceManagerRef.current?.leave();
    voiceManagerRef.current = null;
    setInVoiceCall(false);
    setVoiceMuted(false);
    setVoiceParticipants([]);
    setSpeakingPlayerIds([]);
  }, []);

  const toggleVoiceMute = useCallback(() => {
    if (!voiceManagerRef.current) return;
    const next = !voiceManagerRef.current.isMuted;
    voiceManagerRef.current.setMuted(next);
    setVoiceMuted(next);
  }, []);

  const goToHomeScreen = useCallback(() => setViewMode('home'), []);
  const returnToGame = useCallback(() => setViewMode('active'), []);

  const confirmArrangement = useCallback((sets: FourSets) => {
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
    socketRef.current.emit('hazari:playSet');
  }, []);

  const requestDismissal = useCallback((reason: DismissalReason, proposedSets?: FourSets) => {
    const proposedCardIdSets = proposedSets
      ? (proposedSets.map((s) => s.map((c) => c.id)) as [string[], string[], string[], string[]])
      : undefined;
    socketRef.current.emit('hazari:requestDismissal', { reason, proposedCardIdSets });
  }, []);

  const startNextRound = useCallback(() => {
    setLastRoundResult(null);
    socketRef.current.emit('hazari:startNextRound');
  }, []);

  const leaveTable = useCallback(() => {
    socketRef.current.emit('room:leaveTable');
    voiceManagerRef.current?.leave();
    voiceManagerRef.current = null;
    setInVoiceCall(false);
    setVoiceMuted(false);
    setVoiceParticipants([]);
    setSpeakingPlayerIds([]);
    // This seat is now bot-controlled for the rest of the game - the local
    // player has no further part in it, so clear their session the same
    // way leaveSession() does and send them back to the landing screen.
    clearSession();
    setRoom(null);
    setMyPlayerId(null);
    setMyHand([]);
    setMyArrangedSets(null);
    setGameState(null);
    setLastRoundResult(null);
    setWinnerInfo(null);
    setViewMode('active');
  }, []);

  const clearGameError = useCallback(() => setGameError(null), []);

  const leaveSession = useCallback(() => {
    voiceManagerRef.current?.leave();
    voiceManagerRef.current = null;
    setInVoiceCall(false);
    setVoiceMuted(false);
    setVoiceParticipants([]);
    setSpeakingPlayerIds([]);
    clearSession();
    setRoom(null);
    setMyPlayerId(null);
    setMyHand([]);
    setMyArrangedSets(null);
    setGameState(null);
    setLastRoundResult(null);
    setWinnerInfo(null);
    setViewMode('active');
  }, []);

  const value: GameContextValue = {
    connectionStatus,
    hasConnectedOnce,
    room,
    myPlayerId,
    myName,
    myHand,
    myArrangedSets,
    gameState,
    lastRoundResult,
    roundHistory,
    winnerInfo,
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
    joinVoiceCall,
    leaveVoiceCall,
    toggleVoiceMute,
    viewMode,
    goToHomeScreen,
    returnToGame,
    createRoom,
    joinRoom,
    quickMatch,
    listTables,
    requestSuggestionOptions,
    freshDealCount,
    isRestoring: restoration.active,
    restorationGeneration: restoration.generation,
    setReady,
    startGame,
    addBot,
    playAgain,
    confirmArrangement,
    playSet,
    requestDismissal,
    startNextRound,
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
