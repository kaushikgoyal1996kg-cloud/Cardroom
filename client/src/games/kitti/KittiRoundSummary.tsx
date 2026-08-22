import { useGame } from '../../lib/GameStore';
import { PlayingCard } from '../../platform/components/PlayingCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useVisualViewport } from '../../platform/lib/useVisualViewport';
import './KittiResult.css';

export function KittiRoundSummary() {
  const { room, myPlayerId, lastKittiRoundResult, kittiState, goToHomeScreen } = useGame();
  const { viewportHeight } = useVisualViewport();
  if (!room || !lastKittiRoundResult || !kittiState) {
    return <div className="waiting-screen"><LoadingSpinner message="Preparing round result…" /></div>;
  }

  const result = lastKittiRoundResult;
  const nameOf = (id: string | null) => room.players.find((p) => p.playerId === id)?.name ?? 'Player';
  const isRoundBoot = kittiState.mode === 'ROUND_BOOT';
  const carried = result.potCarried || result.winnerId === null;
  const standings = [...room.players].sort((a, b) => (result.roundsWon[b.playerId] ?? 0) - (result.roundsWon[a.playerId] ?? 0));

  return (
    <main className="kres" style={viewportHeight ? ({ '--js-vh': `${viewportHeight}px` } as React.CSSProperties) : undefined}>
      <div className="kres__scroll">
        <header className="kres__head">
          <p className="kres__eyebrow">{isRoundBoot ? `Round Boot · Deal ${result.roundNumber}` : result.suddenDeath ? 'Sudden death' : `Round ${result.roundNumber} of 10`}</p>
          <h1>{carried ? 'Pot carries to the next deal' : `${nameOf(result.winnerId)} wins the round`}</h1>
          <p>{carried
            ? 'Three different hand winners — every seat adds the boot again.'
            : isRoundBoot
              ? 'Two hand wins take the full accumulated pot.'
              : `${result.roundsWon[result.winnerId!]} round win${result.roundsWon[result.winnerId!] === 1 ? '' : 's'} overall`}</p>
        </header>

        <section className="kres__hands" aria-label="Hand results">
          {result.hands.map((hand) => (
            <article className="kres-hand" key={hand.handIndex}>
              <div className="kres-hand__bar">
                <span>Hand {hand.handIndex + 1}</span>
                <strong>{nameOf(hand.winnerId)} won</strong>
              </div>
              {hand.wasTie && <p className="kres-hand__tie">Exact tie — later throw took the hand</p>}
              <div className="kres-hand__players">
                {hand.played.map((play) => (
                  <div key={play.playerId} className={`kres-hand__player${play.playerId === hand.winnerId ? ' is-winner' : ''}`}>
                    <span>{nameOf(play.playerId)}</span>
                    <div>{play.cards.map((card) => <PlayingCard key={card.id} card={card} size="sm" highlighted={play.playerId === hand.winnerId} />)}</div>
                  </div>
                ))}
              </div>
            </article>
          ))}

          {result.decider && (
            <article className="kres-hand is-decider">
              <div className="kres-hand__bar"><span>Three-winner decider</span><strong>{nameOf(result.decider.winnerId)} won</strong></div>
              {result.decider.wasTie && <p className="kres-hand__tie">Exact tie — later throw took the decider</p>}
              <div className="kres-hand__players">
                {result.decider.played.map((play) => (
                  <div key={play.playerId} className={`kres-hand__player${play.playerId === result.decider!.winnerId ? ' is-winner' : ''}`}>
                    <span>{nameOf(play.playerId)}</span>
                    <div>{play.cards.map((card) => <PlayingCard key={card.id} card={card} size="sm" highlighted={play.playerId === result.decider!.winnerId} />)}</div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </section>

        {!isRoundBoot && <section className="kres__standings">
          <h2>Match standings</h2>
          {standings.map((player, index) => (
            <div key={player.playerId} className={`kres__standing${player.playerId === result.winnerId ? ' is-round-winner' : ''}`}>
              <span>{index + 1}</span>
              <strong>{player.name}{player.playerId === myPlayerId ? ' · You' : ''}</strong>
              <b>{result.roundsWon[player.playerId] ?? 0}</b>
            </div>
          ))}
        </section>}

        {kittiState.suddenDeath && (
          <p className="kres__sudden">The scheduled 10 rounds are tied. Only the tied leaders continue; everyone else remains at the table to watch.</p>
        )}
      </div>

      <footer className="kres__actions">
        <p role="status">{isRoundBoot
          ? carried ? 'Boot is being added and the next deal starts automatically…' : 'Fresh boot deal starts automatically…'
          : kittiState.suddenDeath ? 'Sudden-death round dealing automatically…' : 'Next round dealing automatically…'}</p>
        <button type="button" className="btn btn-ghost" onClick={goToHomeScreen}>Card Room</button>
      </footer>
    </main>
  );
}
