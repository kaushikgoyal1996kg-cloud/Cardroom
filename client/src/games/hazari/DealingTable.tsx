import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import { CardTable } from '../../platform/components/CardTable';
import { DealerDrawReveal, dealerDrawRevealDuration } from '../../platform/components/DealerDrawReveal';
import type { SeatPlayer } from '../../platform/components/Seat';
import { totalDealDuration } from '../../platform/table/seatLayout';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import './DealingTable.css';

/**
 * Whether to run the dealing ceremony, and for how long.
 *
 * Keyed on `freshDealCount` from the game store, which increments ONLY for a
 * genuinely new deal - never for the hand the server replays during reconnect
 * restoration. So refreshing mid-round shows the current state rather than
 * pretending the cards are being dealt again.
 *
 * The initial high-card dealer reveal is different from decorative motion: it
 * communicates how the first dealer was chosen. Under reduced-motion we still
 * show that static reveal, but skip the flying-card deal itself.
 */
export function useDealCeremony(
  seatCount: number,
  cardsEach: number,
  initialDealerDrawRounds = 0
): boolean {
  const { freshDealCount } = useGame();
  const [active, setActive] = useState(false);
  const seenDealRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const scheduledDurationRef = useRef(0);

  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    // First observation - including mounting mid-round after a refresh - is
    // recorded without animating. Only a LATER increment is a new deal.
    if (seenDealRef.current === null) {
      seenDealRef.current = freshDealCount;
      return;
    }

    const dealDuration = reducedMotion ? 0 : totalDealDuration(cardsEach, seatCount, false);
    const revealDuration = dealerDrawRevealDuration(initialDealerDrawRounds);
    const desiredDuration = revealDuration + dealDuration;

    const scheduleEnd = (remainingMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setActive(false);
        startedAtRef.current = null;
        scheduledDurationRef.current = 0;
        timerRef.current = null;
      }, Math.max(0, remainingMs));
    };

    if (freshDealCount !== seenDealRef.current) {
      seenDealRef.current = freshDealCount;

      if (reducedMotion && initialDealerDrawRounds === 0) {
        setActive(false);
        return;
      }

      setActive(true);
      startedAtRef.current = Date.now();
      scheduledDurationRef.current = desiredDuration;
      scheduleEnd(desiredDuration);
      return;
    }

    // The public game-state packet and the private fresh hand can land in
    // either order. If the hand starts the ceremony first and the dealer-draw
    // rounds arrive a tick later, extend the SAME ceremony rather than
    // truncating the reveal or replaying anything.
    if (
      startedAtRef.current !== null &&
      desiredDuration > scheduledDurationRef.current
    ) {
      const elapsed = Date.now() - startedAtRef.current;
      scheduledDurationRef.current = desiredDuration;
      scheduleEnd(desiredDuration - elapsed);
    }
  }, [freshDealCount, reducedMotion, seatCount, cardsEach, initialDealerDrawRounds]);

  return active;
}

/**
 * The deal itself: the first round visibly resolves the authoritative high-card
 * dealer draw, then the deck appears and face-down cards travel to each seat in
 * the real dealing order. No actual hand card data is passed into CardTable.
 */
export function DealingTable() {
  const { room, gameState, myPlayerId, voiceParticipants, speakingPlayerIds } = useGame();

  const seats: SeatPlayer[] = useMemo(() => {
    if (!room) return [];
    return room.players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      avatar: p.avatar,
      score: gameState?.cumulativeScores[p.playerId] ?? 0,
      scoreLabel: 'pts',
      isBot: p.isBot,
      connection: p.connected || p.isBot ? 'CONNECTED' : 'DISCONNECTED',
      inVoiceCall: voiceParticipants.includes(p.playerId),
      speaking: speakingPlayerIds.includes(p.playerId),
    }));
  }, [room, gameState, voiceParticipants, speakingPlayerIds]);

  const initialDraws = gameState?.initialDealerDraws ?? [];
  const shouldRevealDealer = !!gameState && gameState.roundNumber === 1 && initialDraws.length > 0;
  const revealKey = shouldRevealDealer ? `${room?.roomCode ?? ''}:${gameState?.dealerId ?? ''}:${initialDraws.length}` : '';
  const [revealingDealer, setRevealingDealer] = useState(shouldRevealDealer);

  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    setRevealingDealer(shouldRevealDealer);
    if (!shouldRevealDealer || reducedMotion) return;
    const timer = setTimeout(() => setRevealingDealer(false), dealerDrawRevealDuration(initialDraws.length));
    return () => clearTimeout(timer);
  }, [revealKey, shouldRevealDealer, reducedMotion]);

  // Defensive fallback, not the primary guard - see RoomLobby.tsx's comment
  // on the same pattern.
  if (!room || !gameState || seats.length === 0) {
    return (
      <div className="waiting-screen">
        <LoadingSpinner message="Returning to the Card Room…" />
      </div>
    );
  }

  const nameOf = (playerId: string) => room.players.find((player) => player.playerId === playerId)?.name ?? 'Player';
  const dealNow = !revealingDealer && !reducedMotion;

  return (
    <div className="dealing">
      <div className="dealing__table-area">
        <CardTable
          players={seats}
          selfId={myPlayerId}
          dealerId={revealingDealer ? null : gameState.dealerId}
          dealing={dealNow}
          dealCardsEach={13}
          centreLabel={revealingDealer ? 'High card deals first' : undefined}
        />

        {revealingDealer && (
          <DealerDrawReveal
            rounds={initialDraws}
            dealerId={gameState.dealerId}
            nameOf={nameOf}
          />
        )}
      </div>
      <p className="dealing__caption" role="status">
        {revealingDealer ? 'Drawing for dealer…' : 'Thirteen cards · dealer first'}
      </p>
    </div>
  );
}
