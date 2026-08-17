import { useGame } from '../../lib/GameStore';
import { CardTable } from '../../platform/components/CardTable';
import type { SeatPlayer } from '../../platform/components/Seat';
import { LoadingSpinner } from '../LoadingSpinner';
import './Play.css';

/**
 * Hazari hand-confirmed waiting state on the same physical table used by the
 * rest of the match. No separate square felt / legacy lobby language.
 */
export function ArrangingWaitScreen() {
  const { room, gameState, myPlayerId, voiceParticipants, speakingPlayerIds } = useGame();
  if (!room || !gameState || !myPlayerId) {
    return <div className="waiting-screen"><LoadingSpinner message="Returning to your table…" /></div>;
  }

  const confirmed = new Set(gameState.playersConfirmedArrangement);
  const confirmedCount = confirmed.size;
  const seats: SeatPlayer[] = room.players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    avatar: p.avatar,
    score: gameState.cumulativeScores[p.playerId] ?? 0,
    scoreLabel: 'pts',
    isBot: p.isBot,
    connection: p.connected || p.isBot ? 'CONNECTED' : 'DISCONNECTED',
    hasActed: confirmed.has(p.playerId),
    statusLabel: confirmed.has(p.playerId) ? 'Ready' : 'Arranging',
    inVoiceCall: voiceParticipants.includes(p.playerId),
    speaking: speakingPlayerIds.includes(p.playerId),
  }));

  return (
    <main className="arranging-wait">
      <header className="arranging-wait__header">
        <div><span>Hazari</span><strong>Round {gameState.roundNumber}</strong></div>
        <p>{confirmedCount} / {room.players.length} hands confirmed</p>
      </header>
      <div className="arranging-wait__table">
        <CardTable
          players={seats}
          selfId={myPlayerId}
          dealerId={gameState.dealerId}
          centreLabel={confirmedCount === room.players.length ? 'Everyone is ready' : 'Waiting for the table'}
        />
      </div>
      <footer className="arranging-wait__footer" role="status">
        <span className="arranging-wait__check" aria-hidden="true">✓</span>
        <div><strong>Hand confirmed</strong><p>Your cards are locked. The round starts as soon as everyone is ready.</p></div>
      </footer>
    </main>
  );
}
