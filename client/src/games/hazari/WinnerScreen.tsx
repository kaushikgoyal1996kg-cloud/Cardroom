import { useGame } from '../../lib/GameStore';
import { AvatarBadge } from '../../components/Lobby/AvatarPicker';
import { Confetti } from '../../components/Confetti';
import { LoadingSpinner } from '../../components/LoadingSpinner';
// Shares .score-list with the round summary, so the two screens read as a pair.
import './RoundSummary.css';
import './WinnerScreen.css';

/**
 * Match winner, in the card-room language.
 *
 * Migration only: winner determination is untouched and comes straight from
 * the server's winnerInfo. Everything the legacy screen offered is preserved
 * - winner, final scores, Play Again (host), Return to Lobby, and the
 * non-host waiting message. Confetti is kept but restrained.
 */
export function WinnerScreen() {
  const { room, myPlayerId, winnerInfo, leaveSession, playAgain } = useGame();
  // Defensive fallback, not the primary guard - see RoomLobby.tsx's comment
  // on the same pattern.
  if (!room || !winnerInfo) {
    return (
      <div className="waiting-screen">
        <LoadingSpinner message="Returning to Cardroom…" />
      </div>
    );
  }

  const me = room.players.find((p) => p.playerId === myPlayerId);
  const isHost = me?.isHost ?? false;
  const winner = room.players.find((p) => p.playerId === winnerInfo.winnerId);
  const iWon = winnerInfo.winnerId === myPlayerId;

  const standings = [...room.players].sort(
    (a, b) => (winnerInfo.finalScores[b.playerId] ?? 0) - (winnerInfo.finalScores[a.playerId] ?? 0)
  );

  return (
    <div className="winner">
      <Confetti />
      {/* A single warm pool of light over the winner, rather than flashing
          effects. This is the one celebratory flourish on the screen. */}
      <div className="winner__lamp" aria-hidden="true" />

      <div className="winner__scroll">
        <header className="winner__head">
          <p className="winner__eyebrow">Match complete</p>

          {winner && (
            <div className="winner__avatar">
              <AvatarBadge avatar={winner.avatar} size="lg" />
            </div>
          )}

          <h1 className="winner__name">{winner?.name ?? 'Winner'}</h1>
          <p className="winner__score">
            <span className="winner__score-value">
              {winnerInfo.finalScores[winnerInfo.winnerId] ?? 0}
            </span>
            <span className="winner__score-label"> points</span>
          </p>
          {iWon && <p className="winner__you">You won the match</p>}
        </header>

        <section className="winner__standings" aria-label="Final scores">
          <h2 className="winner__standings-title">Final scores</h2>
          <ul className="score-list" role="list">
            {standings.map((p, i) => (
              <li
                key={p.playerId}
                className={`score-list__row${p.playerId === winnerInfo.winnerId ? ' is-winner' : ''}`}
              >
                <span className="score-list__name">
                  <span className="score-list__rank" aria-hidden="true">
                    {i + 1}
                  </span>
                  <AvatarBadge avatar={p.avatar} size="sm" />
                  {p.name}
                  {p.playerId === winnerInfo.winnerId && (
                    <span className="winner__tag"> · winner</span>
                  )}
                </span>
                <span className="score-list__value score-list__value--major">
                  {winnerInfo.finalScores[p.playerId] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="winner__actions">
        {isHost && (
          <button type="button" className="btn btn--primary" onClick={playAgain}>
            Play again
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={leaveSession}>
          Return to lobby
        </button>
        {!isHost && (
          <p className="winner__waiting" role="status">
            Waiting for the host to start a new game…
          </p>
        )}
      </div>
    </div>
  );
}
