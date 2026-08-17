import { useGame } from '../lib/GameStore';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './RulesModal.css';
import './StatsModal.css';

interface Props { onClose: () => void; }

export function StatsModal({ onClose }: Props) {
  const { getStats, room } = useGame();
  if (!room) return null;
  const rows = getStats(room.gameId);
  const gameName = room.gameId === 'HAZARI' ? 'Hazari' : room.gameId === 'KITTI' ? 'Kitti' : 'Teen Patti';
  const averageLabel = room.gameId === 'KITTI' ? 'Avg rounds' : 'Avg pts';

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-panel panel" onClick={(e) => e.stopPropagation()}>
        <div className="rules-panel__header">
          <div><p className="rules-panel__eyebrow">{gameName}</p><h2>Your Stats</h2></div>
          <button className="rules-close btn btn-ghost" onClick={onClose} aria-label="Close stats"><ChromeIcon name="close" /></button>
        </div>

        <p className="text-muted stats-modal__note">Stored privately on this device. Each Card Room game keeps its own record.</p>

        {rows.length === 0 ? (
          <div className="stats-modal__empty">
            <span className="stats-modal__empty-mark" aria-hidden="true">CR</span>
            <p>No {gameName} matches recorded yet.</p>
            <small>Finish a match and your record will appear here.</small>
          </div>
        ) : (
          <div className="stats-table">
            <div className="stats-table__header">
              <span>Name</span><span>Played</span><span>Won</span><span>Win %</span><span>{averageLabel}</span>
            </div>
            {rows.map(({ name, stats }) => (
              <div key={name} className="stats-table__row">
                <span className="stats-table__name">{name}</span>
                <span>{stats.gamesPlayed}</span>
                <span>{stats.gamesWon}</span>
                <span>{stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%</span>
                <span>{stats.gamesPlayed > 0 ? Math.round(stats.totalPoints / stats.gamesPlayed) : 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
