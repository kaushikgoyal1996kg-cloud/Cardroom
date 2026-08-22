import { useGame } from '../../lib/GameStore';
import { CardTable } from '../../platform/components/CardTable';
import type { SeatPlayer } from '../../platform/components/Seat';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import './KittiTable.css';

/** Kitti arrangement-confirmed / sudden-death waiting state on the shared table. */
export function KittiWaitingTable() {
  const { room, myPlayerId, isSpectator: watching, kittiState, voiceParticipants, speakingPlayerIds } = useGame();
  if (!room || !myPlayerId || !kittiState) {
    return <div className="waiting-screen"><LoadingSpinner message="Returning to Kitti…" /></div>;
  }
  const spectator = watching || kittiState.spectatorIds.includes(myPlayerId);
  const confirmed = new Set(kittiState.playersConfirmed);
  const seats: SeatPlayer[] = room.players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    avatar: p.avatar,
    score: kittiState.roundsWon[p.playerId] ?? 0,
    scoreLabel: 'rounds',
    isBot: p.isBot,
    connection: p.connected || p.isBot ? 'CONNECTED' : 'DISCONNECTED',
    hasActed: confirmed.has(p.playerId),
    statusLabel: spectator && kittiState.suddenDeath && kittiState.activePlayerIds.includes(p.playerId)
      ? 'Sudden death'
      : confirmed.has(p.playerId) ? 'Ready' : 'Arranging',
    inVoiceCall: voiceParticipants.includes(p.playerId),
    speaking: speakingPlayerIds.includes(p.playerId),
  }));
  const readyCount = kittiState.playersConfirmed.length;
  const activeCount = kittiState.activePlayerIds.length;

  return (
    <main className="kitti-waiting">
      <header className="kitti-waiting__header">
        <div><span>Kitti</span><strong>{kittiState.mode === 'ROUND_BOOT' ? `Round Boot · Deal ${kittiState.roundNumber}` : kittiState.suddenDeath ? `Sudden death · Round ${kittiState.roundNumber}` : `Round ${Math.min(kittiState.roundNumber, 10)} of 10`}</strong></div>
        <p>{spectator ? 'Leaders arranging' : `${readyCount} / ${activeCount} ready`}</p>
      </header>
      <section className="kitti-waiting__table">
        <CardTable
          players={seats}
          selfId={myPlayerId}
          dealerId={kittiState.roundDealerId}
          centreLabel={spectator ? kittiState.suddenDeath ? 'Sudden death — watching' : 'Watching the table' : readyCount >= activeCount ? 'Everyone is ready' : 'Arrangement locked'}
        />
      </section>
      <footer className="kitti-waiting__footer" role="status">
        <span className="kitti-waiting__mark" aria-hidden="true">{spectator ? 'SD' : '✓'}</span>
        <div>
          <strong>{spectator ? 'Watching arrangements' : 'Arrangement locked'}</strong>
          <p>{spectator ? kittiState.suddenDeath ? 'Only the tied leaders receive cards for sudden death.' : 'The deal begins when every seated player is ready.' : 'Your three hands are locked while the other players finish arranging.'}</p>
        </div>
      </footer>
    </main>
  );
}
