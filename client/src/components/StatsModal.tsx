import { useGame } from '../lib/GameStore';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './RulesModal.css';
import './StatsModal.css';

interface Props { onClose: () => void; }

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

export function StatsModal({ onClose }: Props) {
  const { getStats, room, myPlayerId, teenPattiState, pokerState } = useGame();
  if (!room) return null;

  const isMatchGame = room.gameId === 'HAZARI' || room.gameId === 'KITTI';
  const gameName = room.gameId === 'HAZARI'
    ? 'Hazari'
    : room.gameId === 'KITTI'
      ? 'Kitti'
      : room.gameId === 'TEEN_PATTI'
        ? 'Teen Patti'
        : 'Poker';

  if (!isMatchGame) {
    const sessionRows = room.gameId === 'TEEN_PATTI'
      ? (teenPattiState?.players ?? []).map((player) => ({
          playerId: player.playerId,
          name: room.players.find((seat) => seat.playerId === player.playerId)?.name ?? 'Former player',
          balance: player.chips,
          profitLoss: player.profitLoss,
          wins: player.roundsWon,
          topUps: player.topUps,
        }))
      : (pokerState?.players ?? []).map((player) => ({
          playerId: player.playerId,
          name: room.players.find((seat) => seat.playerId === player.playerId)?.name ?? 'Former player',
          balance: player.stack,
          profitLoss: pokerState ? player.stack - (pokerState.tableConfig.startingStack + player.topUps) : 0,
          wins: player.handsWon,
          topUps: player.topUps,
        }));

    return (
      <div className="rules-overlay" onClick={onClose}>
        <div className="rules-panel panel" onClick={(e) => e.stopPropagation()}>
          <div className="rules-panel__header">
            <div><p className="rules-panel__eyebrow">{gameName}</p><h2>Table Stats</h2></div>
            <button className="rules-close btn btn-ghost" onClick={onClose} aria-label="Close stats"><ChromeIcon name="close" /></button>
          </div>

          <p className="text-muted stats-modal__note">
            Current-table figures only. All chips are virtual play money; nothing here represents a deposit, withdrawal, or cash balance.
          </p>

          {sessionRows.length === 0 ? (
            <div className="stats-modal__empty">
              <span className="stats-modal__empty-mark" aria-hidden="true">CR</span>
              <p>Table stats will appear once players are seated.</p>
            </div>
          ) : (
            <div className="stats-session-table" role="table" aria-label={`${gameName} current table stats`}>
              <div className="stats-session-table__row stats-session-table__header" role="row">
                <span>Player</span>
                <span>{room.gameId === 'POKER' ? 'Stack' : 'Balance'}</span>
                <span>P/L</span>
                <span>{room.gameId === 'POKER' ? 'Hands' : 'Rounds'}</span>
              </div>
              {sessionRows.map((row) => (
                <div
                  key={row.playerId}
                  className={`stats-session-table__row${row.playerId === myPlayerId ? ' is-me' : ''}`}
                  role="row"
                >
                  <span className="stats-session-table__player">
                    {row.name}{row.playerId === myPlayerId ? ' · You' : ''}
                    {row.topUps > 0 ? <small>+{row.topUps} virtual top-up</small> : null}
                  </span>
                  <strong>{row.balance}</strong>
                  <strong className={row.profitLoss >= 0 ? 'is-positive' : 'is-negative'}>{signed(row.profitLoss)}</strong>
                  <strong>{row.wins}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const rows = getStats(room.gameId);
  const averageLabel = room.gameId === 'KITTI' ? 'Avg rounds' : 'Avg pts';

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-panel panel" onClick={(e) => e.stopPropagation()}>
        <div className="rules-panel__header">
          <div><p className="rules-panel__eyebrow">{gameName}</p><h2>Your Stats</h2></div>
          <button className="rules-close btn btn-ghost" onClick={onClose} aria-label="Close stats"><ChromeIcon name="close" /></button>
        </div>

        <p className="text-muted stats-modal__note">Stored privately on this device. Each Card Room game keeps its own completed-match record.</p>

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
