import { useGame } from '../../lib/GameStore';
import { AvatarBadge } from '../../components/Lobby/AvatarPicker';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Confetti } from '../../components/Confetti';
import { useVisualViewport } from '../../platform/lib/useVisualViewport';
import { PlayMoneySettlement } from '../../platform/components/PlayMoneyBoard';
import './KittiResult.css';

export function KittiWinner() {
  const { room, myPlayerId, kittiWinnerInfo, playAgain, leaveSession } = useGame();
  const { viewportHeight } = useVisualViewport();
  if (!room || !kittiWinnerInfo) {
    return <div className="waiting-screen"><LoadingSpinner message="Preparing match result…" /></div>;
  }
  const winner = room.players.find((p) => p.playerId === kittiWinnerInfo.winnerId);
  if (!winner) return <div className="waiting-screen"><LoadingSpinner message="Preparing match result…" /></div>;
  const isHost = room.hostId === myPlayerId;
  const standings = [...room.players].sort((a, b) => (kittiWinnerInfo.roundsWon[b.playerId] ?? 0) - (kittiWinnerInfo.roundsWon[a.playerId] ?? 0));

  return (
    <main className="kwin" style={viewportHeight ? ({ '--js-vh': `${viewportHeight}px` } as React.CSSProperties) : undefined}>
      <Confetti count={36} />
      <div className="kwin__lamp" aria-hidden="true" />
      <div className="kwin__scroll">
        <header className="kwin__head">
          <p>Kitti champion</p>
          <AvatarBadge avatar={winner.avatar} size="lg" />
          <h1>{winner.name}</h1>
          <div className="kwin__score">{kittiWinnerInfo.roundsWon[winner.playerId] ?? 0} round wins</div>
          {winner.playerId === myPlayerId && <span className="kwin__you">You won the match</span>}
        </header>
        <section className="kwin__standings">
          <h2>Final standings</h2>
          {standings.map((player, index) => (
            <div key={player.playerId} className={`kwin__row${player.playerId === winner.playerId ? ' is-winner' : ''}`}>
              <span>{index + 1}</span>
              <strong>{player.name}{player.playerId === myPlayerId ? ' · You' : ''}</strong>
              <b>{kittiWinnerInfo.roundsWon[player.playerId] ?? 0}</b>
            </div>
          ))}
        </section>
        <PlayMoneySettlement />
      </div>
      <footer className="kwin__actions">
        {isHost ? <button className="btn btn-primary" type="button" onClick={playAgain}>Play Kitti again</button> : <p>Waiting for the host to start another match…</p>}
        <button className="btn btn-ghost" type="button" onClick={leaveSession}>Return to Card Room</button>
      </footer>
    </main>
  );
}
