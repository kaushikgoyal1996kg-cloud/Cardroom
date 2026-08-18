import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import { CardTable, type PlayedSetView } from '../../platform/components/CardTable';
import type { SeatPlayer } from '../../platform/components/Seat';
import { PlayingCard } from '../../platform/components/PlayingCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { playCardPlaySound, playRevealSound, playPointsSound } from '../../lib/sound';
import { hapticMedium } from '../../lib/haptics';
import { classifySet, labelFor, setValue } from '../../game/handClassification';
import { useWakeLock } from '../../lib/useWakeLock';
import { useVisualViewport } from '../../platform/lib/useVisualViewport';
import { PlayMoneyPotBadge } from '../../platform/components/PlayMoneyBoard';
import { PhaseTrack } from '../../platform/components/PhaseTrack';
import type { PlayerId } from '../../game/types';
import './HazariTable.css';

const SET_LABELS = ['Set 1', 'Set 2', 'Set 3', 'Set 4'];

/**
 * Hazari at the table.
 *
 * The rules all live on the server - this component only renders what the
 * server says and sends the one action a player can take (play their current
 * set). It deliberately computes nothing about who won or what anything
 * scores beyond labelling what the server already decided.
 */
export function HazariTable() {
  const {
    room,
    gameState,
    myPlayerId,
    myArrangedSets,
    playSet,
    gameError,
    clearGameError,
    voiceParticipants,
    speakingPlayerIds,
    isRestoring,
    restorationGeneration,
  } = useGame();

  const [dismissedResultKey, setDismissedResultKey] = useState<string | null>(null);
  /** Blocks a second Play tap until the server's state actually moves on. */
  const [playPending, setPlayPending] = useState(false);
  const playedCountRef = useRef<number>(-1);
  // JS-measured viewport height for the reveal sheet's own bound - see
  // HazariTable.css's .reveal__sheet comment for the full reasoning (Bug 5,
  // 2026-08-16 CLARIFIED: the per-set reveal, not RoundSummary, was the
  // actually-broken screen).
  const { viewportHeight } = useVisualViewport();
  /**
   * Sets already on the felt when this component last rendered. A set only
   * animates in on the render where it FIRST appears, identified by a stable
   * round/set/player key rather than a timer. On reconnect the whole set of
   * plays arrives at once and is recorded here without animating.
   */
  const seenPlayKeysRef = useRef<Set<string> | null>(null);
  /** Last restoration generation this component has already re-seeded for. */
  const seenRestorationGenRef = useRef<number>(restorationGeneration);

  // Hooks must run unconditionally, so everything below is null-safe and sits
  // above the early return.
  const safePlayOrder = gameState?.currentPlayOrder ?? [];
  const safePlayedCount = gameState?.playersPlayedThisSubRound.length ?? 0;
  const isMyTurnForWakeLock = !!myPlayerId && safePlayOrder[safePlayedCount] === myPlayerId;
  useWakeLock(isMyTurnForWakeLock);

  const latestResult =
    gameState?.subRoundResultsThisRound[gameState.subRoundResultsThisRound.length - 1] ?? null;
  const resultKey = latestResult
    ? `${gameState!.roundNumber}-${latestResult.setIndex}`
    : null;
  const showReveal = !!latestResult && resultKey !== dismissedResultKey;

  useEffect(() => {
    if (!showReveal) return;
    const t = setTimeout(() => setDismissedResultKey(resultKey), 3200);
    return () => clearTimeout(t);
  }, [showReveal, resultKey]);

  useEffect(() => {
    if (!resultKey || !latestResult) return;
    playRevealSound();
    if (latestResult.winnerId === myPlayerId) playPointsSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);

  // Release the Play lock as soon as the authoritative state changes - either
  // our set landed, or the sub-round moved on. Never released on a timer,
  // because a timer would let a double tap through on a slow connection.
  useEffect(() => {
    if (safePlayedCount !== playedCountRef.current) {
      playedCountRef.current = safePlayedCount;
      setPlayPending(false);
    }
  }, [safePlayedCount]);

  const pendingPlayerId = gameState?.currentPlayOrder?.[gameState.playersPlayedThisSubRound.length] ?? null;

  const seats: SeatPlayer[] = useMemo(() => {
    if (!room || !gameState) return [];
    return room.players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      avatar: p.avatar,
      score: gameState.cumulativeScores[p.playerId] ?? 0,
      scoreLabel: 'pts',
      isBot: p.isBot,
      connection: p.connected || p.isBot ? 'CONNECTED' : 'DISCONNECTED',
      hasActed: gameState.playersPlayedThisSubRound.includes(p.playerId),
      inVoiceCall: voiceParticipants.includes(p.playerId),
      speaking: speakingPlayerIds.includes(p.playerId),
      statusLabel: p.isBot && p.playerId === pendingPlayerId ? 'Thinking…' : undefined,
    }));
  }, [room, gameState, voiceParticipants, speakingPlayerIds, pendingPlayerId]);

  // Defensive fallback, not the primary guard - see RoomLobby.tsx's comment
  // on the same pattern.
  if (!room || !gameState || !myPlayerId) {
    return (
      <div className="waiting-screen">
        <LoadingSpinner message="Returning to the Card Room…" />
      </div>
    );
  }

  const currentSetIdx = gameState.currentSetIndex;
  const playOrder = gameState.currentPlayOrder ?? [];
  const played = new Set(gameState.playersPlayedThisSubRound);
  const nextToPlay = pendingPlayerId;
  const isMyTurn = nextToPlay === myPlayerId && !played.has(myPlayerId);

  const nameOf = (pid: PlayerId) =>
    room.players.find((p) => p.playerId === pid)?.name ?? 'Player';

  // Stable identity for a play: which round, which set index, which player.
  // Using this rather than a timer means an unrelated rerender can never
  // replay an animation, and a set that was already on the felt when this
  // component mounted (a refresh or reconnect) is recorded silently.
  const playKey = (pid: PlayerId) =>
    `${gameState!.roundNumber}:${gameState!.currentSetIndex}:${pid}`;

  const isFirstObservation = seenPlayKeysRef.current === null;

  // A reconnect does NOT necessarily remount this component - App keeps the
  // same screen mounted and just shows the connection banner over it. So
  // "first observation" alone is not enough: authoritative state restored
  // while we stayed mounted would look like a burst of brand-new plays.
  //
  // Two further cases therefore also seed rather than animate:
  //   - restoration is currently in progress
  //   - restoration just completed (generation ticked) - catches state that
  //     landed on the same tick the lifecycle closed
  const restorationJustCompleted = seenRestorationGenRef.current !== restorationGeneration;
  if (restorationJustCompleted) {
    seenRestorationGenRef.current = restorationGeneration;
  }

  const seedWithoutAnimating = isFirstObservation || isRestoring || restorationJustCompleted;

  if (seedWithoutAnimating) {
    // Record exactly what the server says is on the table, animating none of
    // it. Replacing rather than merging is correct: this IS the authoritative
    // set of plays for the current sub-round.
    seenPlayKeysRef.current = new Set(
      gameState.playedSetsThisSubRound.map((p) => playKey(p.playerId))
    );
  }

  const playedSets: PlayedSetView[] = gameState.playedSetsThisSubRound.map((p) => {
    const key = playKey(p.playerId);
    const isNew = !seedWithoutAnimating && !seenPlayKeysRef.current!.has(key);
    if (isNew) seenPlayKeysRef.current!.add(key);
    return {
      playerId: p.playerId,
      cards: p.cards,
      winning: !!latestResult && latestResult.winnerId === p.playerId && showReveal,
      // Cosmetic only. The set is already authoritative; this just says
      // whether this is the render on which it FIRST appeared.
      arriving: isNew,
    };
  });

  const myCurrentSetCards = myArrangedSets ? myArrangedSets[currentSetIdx] : null;
  const pointsSoFar = gameState.subRoundResultsThisRound.reduce(
    (s, r) => s + r.pointsAwarded,
    0
  );

  function handlePlay() {
    if (playPending || !isMyTurn) return;
    setPlayPending(true);
    playCardPlaySound();
    hapticMedium();
    playSet();
  }

  const centreLabel =
    playedSets.length === 0
      ? isMyTurn
        ? 'Your turn'
        : nextToPlay
          ? room.players.find((p) => p.playerId === nextToPlay)?.isBot
            ? `${nameOf(nextToPlay)} is thinking…`
            : `Waiting for ${nameOf(nextToPlay)}`
          : undefined
      : undefined;

  return (
    <div className="hazari">
      <header className="hazari__bar">
        <div className="hazari__phase">
          <p className="hazari__eyebrow">Hazari · Round {gameState.roundNumber}</p>
          <strong className="hazari__phase-title">{SET_LABELS[currentSetIdx]}</strong>
        </div>
        <PhaseTrack
          labels={SET_LABELS}
          activeIndex={currentSetIdx}
          ariaLabel={`Hazari round ${gameState.roundNumber} progress`}
          compact
        />
        <div className="hazari__scoreline">
          <span>{pointsSoFar}/360 points</span>
          <small>Room {room.roomCode}</small>
          <PlayMoneyPotBadge />
        </div>
      </header>

      <div className="hazari__table-area">
        <CardTable
          players={seats}
          selfId={myPlayerId}
          dealerId={gameState.dealerId}
          activePlayerId={nextToPlay}
          playedSets={playedSets}
          centreLabel={centreLabel}
          centreLabelEmphasis={isMyTurn}
        />
      </div>

      <div className="hazari__hand">
        <div className="hazari__sets" role="group" aria-label="Your four sets">
          {myArrangedSets?.map((set, idx) => {
            const isActive = idx === currentSetIdx;
            const isDone = idx < currentSetIdx;
            return (
              <div
                key={idx}
                className={[
                  'hazari__set',
                  isActive && 'is-active',
                  isDone && 'is-done',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="hazari__set-label">
                  <span>
                    {SET_LABELS[idx]}
                    {isDone && <span className="hazari__set-tick" aria-label="played"> ✓</span>}
                  </span>
                  <small>{labelFor(classifySet(set))}</small>
                </span>
                <div className="hazari__set-cards">
                  {set.map((card) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      size="sm"
                      disabled={!isActive}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hazari__action">
          {isMyTurn && myCurrentSetCards ? (
            <button
              type="button"
              className="btn btn--primary hazari__play"
              onClick={handlePlay}
              disabled={playPending}
            >
              {playPending
                ? 'Playing…'
                : `Play ${SET_LABELS[currentSetIdx]} · ${setValue(myCurrentSetCards)} pts`}
            </button>
          ) : played.has(myPlayerId) && nextToPlay ? (
            <p className="hazari__waiting">Waiting for {nameOf(nextToPlay)}…</p>
          ) : nextToPlay ? (
            <p className="hazari__waiting">Waiting for {nameOf(nextToPlay)}…</p>
          ) : null}
        </div>
      </div>

      {gameError && (
        <div className="hazari__toast" role="alert" onClick={clearGameError}>
          {gameError}
        </div>
      )}

      {showReveal && latestResult && (
        <div
          className="reveal"
          role="dialog"
          aria-label="Set result"
          style={viewportHeight ? ({ '--js-vh': `${viewportHeight}px` } as React.CSSProperties) : undefined}
        >
          <div className="reveal__sheet">
            <h2 className="reveal__title">{SET_LABELS[latestResult.setIndex]}</h2>

            <div className="reveal__body">
              {latestResult.wasTie && (
                <p className="reveal__tie">Tied — last throw takes it</p>
              )}

              <ul className="reveal__hands" role="list">
                {latestResult.playedSets.map((ps) => {
                  const isWinner = ps.playerId === latestResult.winnerId;
                  return (
                    <li
                      key={ps.playerId}
                      className={`reveal__hand${isWinner ? ' is-winner' : ''}`}
                    >
                      <span className="reveal__hand-name">
                        {nameOf(ps.playerId)}
                        {isWinner && <span className="reveal__crown"> · won</span>}
                      </span>
                      <span className="reveal__hand-cards">
                        {ps.cards.map((cd) => (
                          <PlayingCard
                            key={cd.id}
                            card={cd}
                            size="sm"
                            highlighted={isWinner}
                          />
                        ))}
                      </span>
                      <span className="reveal__hand-label">
                        {labelFor(classifySet(ps.cards))}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="reveal__points">
                {latestResult.pointsAwarded} points to {nameOf(latestResult.winnerId)}
              </p>
            </div>

            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setDismissedResultKey(resultKey)}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
