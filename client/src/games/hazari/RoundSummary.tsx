import { useGame } from '../../lib/GameStore';
import { PlayingCard } from '../../platform/components/PlayingCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useVisualViewport } from '../../platform/lib/useVisualViewport';
import './RoundSummary.css';

const SET_LABELS = ['Set 1', 'Set 2', 'Set 3', 'Set 4'];

/**
 * End-of-round summary, in the card-room language.
 *
 * Migration only: no scoring or round logic changed. Everything the legacy
 * screen showed is still here - per-set breakdown with the cards played,
 * round points, cumulative scores, next dealer, and automatic next-round
 * control - reorganised so the round winner reads first and the detail sits
 * underneath rather than in a stack of panels. Ongoing rounds advance
 * automatically; only a completed game needs a new-match decision.
 */
export function RoundSummary() {
  const { room, lastRoundResult, gameState, goToHomeScreen } = useGame();
  // A JS-measured viewport height, not just CSS `dvh` - see .rsum's own
  // comment in RoundSummary.css for why (Bug 5, 2026-08-15 THIRD
  // real-device retest: `dvh` alone was not reliable enough in Android
  // PWA standalone mode across two previous attempts). `viewportHeight`
  // falls back to `window.innerHeight` on browsers with no
  // `visualViewport` at all, and to 0 during SSR/pre-mount - the `|| 0`
  // guard below means the CSS `dvh` fallback in the custom property's own
  // `var(..., 100dvh)` default governs until a real measurement exists.
  const { viewportHeight } = useVisualViewport();
  // Defensive fallback, not the primary guard - see RoomLobby.tsx's comment
  // on the same pattern.
  if (!room || !lastRoundResult || !gameState) {
    return (
      <div className="waiting-screen">
        <LoadingSpinner message="Returning to the Card Room…" />
      </div>
    );
  }

  const nameOf = (pid: string) => room.players.find((p) => p.playerId === pid)?.name ?? pid;
  const total = Object.values(lastRoundResult.pointsThisRound).reduce((a, b) => a + b, 0);

  // Highest score this round - presentation only. Hazari awards points per
  // sub-round; it does not define a separate round-win tiebreak. If multiple
  // players share the top round score, say so instead of inventing a single
  // winner from seat order.
  const topRoundScore = Math.max(
    ...room.players.map((p) => lastRoundResult.pointsThisRound[p.playerId] ?? 0)
  );
  const roundLeaders = room.players.filter(
    (p) => (lastRoundResult.pointsThisRound[p.playerId] ?? 0) === topRoundScore
  );

  const standings = [...room.players].sort(
    (a, b) =>
      (lastRoundResult.cumulativeScores[b.playerId] ?? 0) -
      (lastRoundResult.cumulativeScores[a.playerId] ?? 0)
  );

  return (
    <div
      className="rsum"
      style={viewportHeight ? ({ '--js-vh': `${viewportHeight}px` } as React.CSSProperties) : undefined}
    >
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
                {roundLeaders.length === 1
                  ? `${nameOf(roundLeaders[0].playerId)} scored most`
                  : 'Top score shared'}
              </h1>
              <p className="rsum__note">
                {roundLeaders.length === 1
                  ? `${topRoundScore} of ${total} points this round`
                  : `${roundLeaders.map((p) => nameOf(p.playerId)).join(' · ')} — ${topRoundScore} points each`}
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
        <p className="rsum__waiting" role="status">
          Next round dealing automatically…
        </p>
        <button type="button" className="btn btn-ghost rsum__card-room" onClick={goToHomeScreen}>
          Card Room
        </button>
      </div>
    </div>
  );
}
