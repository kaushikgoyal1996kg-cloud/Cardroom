import { useState } from 'react';
import { useGame } from '../../lib/GameStore';
import { PlayingCard } from '../../platform/components/PlayingCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useVisualViewport } from '../../platform/lib/useVisualViewport';
import './TeenPattiResult.css';

const REASON_LABEL = {
  LAST_STANDING: 'Last player standing',
  PAID_SHOWDOWN: 'Showdown',
  MUTUAL_OPEN_SHOW: 'Mutual Show',
} as const;

export function TeenPattiRoundSummary() {
  const { room, myPlayerId, teenPattiState, lastTeenPattiRoundResult, startNextTeenPattiRound, topUpTeenPatti, gameError, clearGameError, goToHomeScreen } = useGame();
  const { viewportHeight } = useVisualViewport();
  const [topUpAmount, setTopUpAmount] = useState('');
  if (!room || !teenPattiState || !lastTeenPattiRoundResult) {
    return <div className="waiting-screen"><LoadingSpinner message="Preparing Teen Patti result…" /></div>;
  }

  const result = lastTeenPattiRoundResult;
  const isHost = room.players.find((player) => player.playerId === myPlayerId)?.isHost ?? false;
  const nameOf = (id: string) => room.players.find((player) => player.playerId === id)?.name
    ?? room.playerDirectory?.[id]?.name
    ?? 'Player';
  const me = teenPattiState.players.find((player) => player.playerId === myPlayerId);
  const underfunded = teenPattiState.players.filter((player) => player.chips < teenPattiState.tableConfig.bootAmount);
  const winnerText = result.winnerIds.length > 1
    ? `${result.winnerIds.map(nameOf).join(' & ')} split the pot`
    : `${nameOf(result.winnerIds[0])} wins`;

  return (
    <main className="tp-result" style={viewportHeight ? ({ '--js-vh': `${viewportHeight}px` } as React.CSSProperties) : undefined}>
      <section className="tp-result__hero">
        <p className="tp-result__eyebrow">Round {result.roundNumber} · {REASON_LABEL[result.reason]}</p>
        <h1>{winnerText}</h1>
        <p className="tp-result__pot">Pot awarded <strong>{result.potAwarded}</strong></p>
      </section>

      {result.showdown && (
        <section className="tp-result__showdown" aria-label="Showdown cards">
          {result.showdown.map((entry) => {
            const won = result.winnerIds.includes(entry.playerId);
            return (
              <article key={entry.playerId} className={`tp-result__hand${won ? ' is-winner' : ''}`}>
                <div>
                  <span>{nameOf(entry.playerId)}{won ? ' · won' : ''}</span>
                  <small>{entry.description}</small>
                </div>
                <div className="tp-result__cards">
                  {entry.cards.map((card) => <PlayingCard key={card.id} card={card} size="sm" highlighted={won} />)}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="tp-result__balances" aria-label="Table balances and profit loss">
        {teenPattiState.players.map((player) => (
          <div key={player.playerId}>
            <span>{nameOf(player.playerId)}</span>
            <strong>{player.chips}</strong>
            <small className={player.profitLoss >= 0 ? 'is-positive' : 'is-negative'}>
              P/L {player.profitLoss >= 0 ? '+' : ''}{player.profitLoss}
            </small>
          </div>
        ))}
      </section>

      <footer className="tp-result__actions">
        {underfunded.length > 0 && (
          <p className="tp-result__funding-note">
            Next boot needs {teenPattiState.tableConfig.bootAmount}. Waiting on {underfunded.map((player) => nameOf(player.playerId)).join(', ')} to top up.
          </p>
        )}
        {me && (
          <div className="tp-result__topup">
            <input
              aria-label="Top up play-money amount"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              placeholder="Top up amount"
            />
            <button
              className="btn"
              type="button"
              disabled={!Number.isInteger(Number(topUpAmount)) || Number(topUpAmount) <= 0}
              onClick={() => {
                const amount = Number(topUpAmount);
                if (!Number.isInteger(amount) || amount <= 0) return;
                topUpTeenPatti(amount);
                setTopUpAmount('');
              }}
            >
              Add play money
            </button>
          </div>
        )}
        {isHost ? (
          <button className="btn btn-primary" type="button" onClick={startNextTeenPattiRound} disabled={underfunded.length > 0}>Deal next round</button>
        ) : (
          <p>Waiting for the host to deal the next round…</p>
        )}
        <button className="btn btn-ghost" type="button" onClick={goToHomeScreen}>Card Room</button>
        <small>Next dealer: {result.winnerIds.length === 1 ? nameOf(result.winnerIds[0]) : nameOf(teenPattiState.dealerId)}</small>
      </footer>

      {gameError && <button type="button" className="tp-result__error" onClick={clearGameError}>{gameError}</button>}
    </main>
  );
}
