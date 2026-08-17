import { useGame } from '../lib/GameStore';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './RulesModal.css';
import './StatsModal.css';

interface Props { onClose: () => void; }

export function RoundHistoryModal({ onClose }: Props) {
  const { room, roundHistory, kittiRoundHistory } = useGame();
  if (!room) return null;

  const nameOf = (pid: string) => room.players.find((p) => p.playerId === pid)?.name ?? pid;
  const gameName = room.gameId === 'HAZARI' ? 'Hazari' : room.gameId === 'KITTI' ? 'Kitti' : 'Teen Patti';
  const empty = room.gameId === 'KITTI' ? kittiRoundHistory.length === 0 : roundHistory.length === 0;

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-panel panel" onClick={(e) => e.stopPropagation()}>
        <div className="rules-panel__header">
          <div><p className="rules-panel__eyebrow">{gameName}</p><h2>Round History</h2></div>
          <button className="rules-close btn btn-ghost" onClick={onClose} aria-label="Close round history"><ChromeIcon name="close" /></button>
        </div>

        {empty ? (
          <div className="stats-modal__empty">
            <span className="stats-modal__empty-mark" aria-hidden="true">CR</span>
            <p>No completed rounds yet.</p>
            <small>This table's results will appear here as you play.</small>
          </div>
        ) : room.gameId === 'KITTI' ? (
          <div className="round-history-list">
            {[...kittiRoundHistory].reverse().map((r) => (
              <div key={r.roundNumber} className="round-history-row">
                <div className="round-history-row__header">
                  <span>Round {r.roundNumber}{r.suddenDeath ? <span className="round-history-row__sudden"> · sudden death</span> : null}</span>
                  <span className="text-muted">Dealer: {nameOf(r.dealerId)}</span>
                </div>
                <div className="round-history-row__winner">Won by <strong>{nameOf(r.winnerId)}</strong></div>
                <div className="round-history-row__scores">
                  {room.players.map((p) => (
                    <div key={p.playerId} className="round-history-row__player">
                      <span>{p.name}</span>
                      <span>{r.roundsWon[p.playerId] ?? 0} round{(r.roundsWon[p.playerId] ?? 0) === 1 ? '' : 's'} won</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="round-history-list">
            {[...roundHistory].reverse().map((r) => (
              <div key={r.roundNumber} className="round-history-row">
                <div className="round-history-row__header">
                  <span>Round {r.roundNumber} {r.dismissed && <span className="round-history-row__dismissed">· dismissed</span>}</span>
                  <span className="text-muted">Dealer: {nameOf(r.dealerId)}</span>
                </div>
                <div className="round-history-row__scores">
                  {room.players.map((p) => (
                    <div key={p.playerId} className="round-history-row__player">
                      <span>{p.name}</span>
                      <span>{r.dismissed ? '0' : `+${r.pointsThisRound[p.playerId] ?? 0}`}<span className="text-muted"> · {r.cumulativeScores[p.playerId] ?? 0}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
