import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import { CardTable } from '../../platform/components/CardTable';
import { DealerDrawReveal, dealerDrawRevealDuration } from '../../platform/components/DealerDrawReveal';
import type { SeatPlayer } from '../../platform/components/Seat';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import '../hazari/DealingTable.css';

export function KittiDealingTable() {
  const { room, kittiState, myPlayerId, voiceParticipants, speakingPlayerIds } = useGame();
  const seats: SeatPlayer[] = useMemo(() => {
    if (!room) return [];
    return room.players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      avatar: p.avatar,
      score: kittiState?.roundsWon[p.playerId] ?? 0,
      scoreLabel: 'rounds',
      isBot: p.isBot,
      connection: p.connected || p.isBot ? 'CONNECTED' : 'DISCONNECTED',
      inVoiceCall: voiceParticipants.includes(p.playerId),
      speaking: speakingPlayerIds.includes(p.playerId),
    }));
  }, [room, kittiState, voiceParticipants, speakingPlayerIds]);

  const showInitialDraw = !!kittiState
    && kittiState.roundNumber === 1
    && kittiState.scheduledRoundsComplete === 0
    && kittiState.initialDealerDraws.length > 0;
  const revealKey = showInitialDraw ? `${room?.roomCode ?? ''}:${kittiState?.roundDealerId ?? ''}:${kittiState?.initialDealerDraws.length ?? 0}` : '';
  const [revealingDealer, setRevealingDealer] = useState(showInitialDraw);
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    setRevealingDealer(showInitialDraw);
    if (!showInitialDraw || reducedMotion) return;
    const timer = setTimeout(() => setRevealingDealer(false), dealerDrawRevealDuration(kittiState?.initialDealerDraws.length ?? 0));
    return () => clearTimeout(timer);
  }, [revealKey, showInitialDraw, reducedMotion]);

  if (!room || !kittiState || !seats.length) {
    return <div className="waiting-screen"><LoadingSpinner message="Preparing the Kitti table…" /></div>;
  }

  const nameOf = (playerId: string) => room.players.find((player) => player.playerId === playerId)?.name ?? 'Player';
  const dealNow = !revealingDealer && !reducedMotion;

  return (
    <div className="dealing">
      <div className="dealing__table-area">
        <CardTable
          players={seats}
          selfId={myPlayerId}
          dealerId={revealingDealer ? null : kittiState.roundDealerId}
          dealing={dealNow}
          dealCardsEach={9}
          centreLabel={revealingDealer ? 'High card deals first' : undefined}
        />
        {revealingDealer && (
          <DealerDrawReveal
            rounds={kittiState.initialDealerDraws}
            dealerId={kittiState.roundDealerId}
            nameOf={nameOf}
          />
        )}
      </div>
      <p className="dealing__caption" role="status">
        {revealingDealer ? 'Drawing for dealer…' : 'Nine cards each · dealer first'}
      </p>
    </div>
  );
}
