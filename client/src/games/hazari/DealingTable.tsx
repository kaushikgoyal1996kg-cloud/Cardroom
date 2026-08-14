import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import { CardTable } from '../../platform/components/CardTable';
import type { SeatPlayer } from '../../platform/components/Seat';
import { totalDealDuration } from '../../platform/table/seatLayout';
import './DealingTable.css';

/**
 * Whether to run the dealing ceremony, and for how long.
 *
 * Keyed on `freshDealCount` from the game store, which increments ONLY for a
 * genuinely new deal - never for the hand the server replays during reconnect
 * restoration. So refreshing mid-round shows the current state rather than
 * pretending the cards are being dealt again.
 *
 * The ceremony is purely cosmetic. The authoritative hand has already
 * arrived; this only delays *showing the arrangement screen*, and only for as
 * long as the animation runs.
 */
export function useDealCeremony(seatCount: number, cardsEach: number): boolean {
  const { freshDealCount } = useGame();
  const [active, setActive] = useState(false);
  const seenDealRef = useRef<number | null>(null);

  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    // First observation - including mounting mid-round after a refresh - is
    // recorded without animating. Only a LATER increment is a new deal.
    if (seenDealRef.current === null) {
      seenDealRef.current = freshDealCount;
      return;
    }
    if (freshDealCount === seenDealRef.current) return;

    seenDealRef.current = freshDealCount;

    if (reducedMotion) {
      setActive(false);
      return;
    }

    setActive(true);
    const duration = totalDealDuration(cardsEach, seatCount, false);
    const timer = setTimeout(() => setActive(false), duration);
    return () => clearTimeout(timer);
  }, [freshDealCount, reducedMotion, seatCount, cardsEach]);

  return active;
}

/**
 * The deal itself: a deck on the felt, and face-down cards travelling out to
 * each seat in the real dealing order.
 *
 * Every card rendered here is FACE DOWN, including the local player's. No
 * card data is passed to this component at all, so it is structurally
 * incapable of revealing anyone's hand - the arrangement screen reveals the
 * local player's cards once the deal finishes.
 */
export function DealingTable() {
  const { room, gameState, myPlayerId } = useGame();

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
    }));
  }, [room, gameState]);

  if (!room || seats.length === 0) return null;

  return (
    <div className="dealing">
      <div className="dealing__table-area">
        <CardTable
          players={seats}
          selfId={myPlayerId}
          dealerId={gameState?.dealerId ?? null}
          dealing
          dealCardsEach={13}
          centreLabel={undefined}
        />
      </div>
      <p className="dealing__caption" role="status">
        Dealing…
      </p>
    </div>
  );
}
