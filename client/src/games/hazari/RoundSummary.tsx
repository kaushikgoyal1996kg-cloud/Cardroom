import { useGame } from '../../lib/GameStore';
import { PlayingCard } from '../../platform/components/PlayingCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import './RoundSummary.css';

const SET_LABELS = ['Set 1', 'Set 2', 'Set 3', 'Set 4'];

/**
 * End-of-round summary, in the card-room language.
 *
 * Migration only: no scoring or round logic changed. Everything the legacy
 * screen showed is still here - per-set breakdown with the cards played,
 * round points, cumulative scores, next dealer, and the host's Next Round
 * control - reorganised so the round winner reads first and the detail sits
 * underneath rather than in a stack of panels.
 */
export function RoundSummary() {
  const { room, lastRoundResult, gameState, myPlayerId, startNextRound } = useGame();
  // Defensive fallback, not the primary guard - see RoomLobby.tsx's comment
  // on the same pattern.
  if (!room || !lastRoundResult || !gameState) {
    return (
      <div className="waiting-screen">
        <LoadingSpinner message="Returning to Cardroom…" />
      </div>
    );
  }

  const nameOf = (pid: string) => room.players.find((p) => p.playerId === pid)?.name ?? pid;
  const isHost = room.players.find((p) => p.playerId === myPlayerId)?.isHost ?? false;
  const total = Object.values(lastRoundResult.pointsThisRound).reduce((a, b) => a + b, 0);

  // Highest scorer this round - the headline. Purely presentational; derived
  // from the server's own pointsThisRound, never recomputed.
  const roundLeader = [...room.players].sort(
    (a, b) =>
      (lastRoundResult.pointsThisRound[b.playerId] ?? 0) -
      (lastRoundResult.pointsThisRound[a.playerId] ?? 0)
  )[0];

  const standings = [...room.players].sort(
    (a, b) =>
      (lastRoundResult.cumulativeScores[b.playerId] ?? 0) -
      (lastRoundResult.cumulativeScores[a.playerId] ?? 0)
  );

  return (
    <div className="rsum">
      <div className="rsum__scroll">
        <header className="rsum__head">
          {lastRoundResult.dismissed ? (
            <>
              <p className="rsum__eyebrow">Round {lastRoundResult.roundNumber}</p>
              <h1 className="rsum__title">Hand dismissed</h1>
              <p className="rsum__note">
                {lastRoundResult.dismissalReason === 'SIX_PAIRS'
                  ? 'A player held six pairs.'
                  : 'A player held no possible sequence.'}{' '}
                Nobody scores this round.
              </p>
            </>
          ) : (
            <>
              <p className="rsum__eyebrow">Round {lastRoundResult.roundNumber}</p>
              <h1 className="rsum__title">
                {roundLeader ? nameOf(roundLeader.playerId) : 'Round'} takes the round
              </h1>
              <p className="rsum__note">
                {lastRoundResult.pointsThisRound[roundLeader?.playerId ?? ''] ?? 0} of {total}{' '}
                points
              </p>
            </>
          )}
        </header>

        {/* Per-set breakdown: the permanent record of who won each set and
            what was played, kept from the legacy screen. */}
        {!lastRoundResult.dismissed && (
          <section className="rsum__sets" aria-label="Set by set">
            {lastRoundResult.subRounds.map((sr) => (
              <article key={sr.setIndex} className="rset">
                <div className="rset__bar">
                  <span className="rset__label">{SET_LABELS[sr.setIndex]}</span>
                  <span className="rset__outcome">
                    <strong>{nameOf(sr.winnerId)}</strong>
                    <span className="rset__points">+{sr.pointsAwarded}</span>
                  </span>
                </div>
                {sr.wasTie && <p className="rset__tie">Tied — last throw took it</p>}

                <ul className="rset__players" role="list">
                  {sr.playedSets.map((ps) => {
                    const won = ps.playerId === sr.winnerId;
                    return (
                      <li key={ps.playerId} className={`rset__player${won ? ' is-winner' : ''}`}>
                        <span className="rset__player-name">
                          {nameOf(ps.playerId)}
                          {won && <span className="rset__won"> · won</span>}
                        </span>
                        <span className="rset__cards">
                          {ps.cards.map((c) => (
                            <PlayingCard key={c.id} card={c} size="sm" highlighted={won} />
                          ))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </section>
        )}

        {/* Round points, then cumulative. Both kept from the legacy screen. */}
        {!lastRoundResult.dismissed && (
          <section className="rsum__scores" aria-label="Points this round">
            <h2 className="rsum__scores-title">This round</h2>
            <ul className="score-list" role="list">
              {room.players.map((p) => (
                <li key={p.playerId} className="score-list__row">
                  <span className="score-list__name">{p.name}</span>
                  <span className="score-list__value">
                    {lastRoundResult.pointsThisRound[p.playerId] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rsum__scores" aria-label="Cumulative score">
          <h2 className="rsum__scores-title">Match score</h2>
          <ul className="score-list" role="list">
            {standings.map((p, i) => (
              <li key={p.playerId} className="score-list__row">
                <span className="score-list__name">
                  <span className="score-list__rank" aria-hidden="true">
                    {i + 1}
                  </span>
                  {p.name}
                </span>
                <span className="score-list__value score-list__value--major">
                  {lastRoundResult.cumulativeScores[p.playerId] ?? 0}
                </span>
              </li>
            ))}
          </ul>
          <p className="rsum__dealer">Next deal: {nameOf(gameState.dealerId)}</p>
        </section>
      </div>

      <div className="rsum__actions">
        {isHost ? (
          <button type="button" className="btn btn--primary rsum__next" onClick={startNextRound}>
            Next round
          </button>
        ) : (
          <p className="rsum__waiting" role="status">
            Waiting for the host to deal the next round…
          </p>
        )}
      </div>
    </div>
  );
}
