import { useEffect, useState } from 'react';
import { PlayingCard, type CardData } from './PlayingCard';
import './DealerDrawReveal.css';

const DEALER_DRAW_FIRST_ROUND_MS = 900;
const DEALER_DRAW_TIE_ROUND_MS = 900;
const DEALER_DRAW_SETTLE_MS = 800;

export function dealerDrawRevealDuration(roundCount: number): number {
  if (roundCount <= 0) return 0;
  return DEALER_DRAW_FIRST_ROUND_MS
    + Math.max(0, roundCount - 1) * DEALER_DRAW_TIE_ROUND_MS
    + DEALER_DRAW_SETTLE_MS;
}

export interface DealerDrawRoundView {
  contenders: string[];
  draws: { playerId: string; card: CardData }[];
}

export function DealerDrawReveal({
  rounds,
  dealerId,
  nameOf,
}: {
  rounds: DealerDrawRoundView[];
  dealerId: string;
  nameOf: (playerId: string) => string;
}) {
  const [roundIndex, setRoundIndex] = useState(0);
  const roundCount = rounds.length;
  const roundSignature = rounds.map((round) => round.draws.map((draw) => `${draw.playerId}:${draw.card.id}`).join('|')).join('>');

  useEffect(() => {
    setRoundIndex(0);
    if (roundCount <= 1) return;

    const timers = Array.from({ length: roundCount - 1 }, (_, index) =>
      setTimeout(() => setRoundIndex(index + 1), DEALER_DRAW_FIRST_ROUND_MS + index * DEALER_DRAW_TIE_ROUND_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [roundSignature, roundCount]);

  const currentRound = rounds[Math.min(roundIndex, rounds.length - 1)];
  if (!currentRound) return null;

  const isFinalRound = roundIndex === rounds.length - 1;
  const nextContenders = rounds[roundIndex + 1]?.contenders ?? [];
  const highlightedPlayers = isFinalRound ? new Set([dealerId]) : new Set(nextContenders);

  return (
    <aside className="dealer-draw" aria-live="polite" aria-label="Initial dealer draw">
      <div className="dealer-draw__copy">
        <span>{roundIndex === 0 ? 'Drawing for dealer' : `Tie redraw ${roundIndex}`}</span>
        <strong>{isFinalRound ? `${nameOf(dealerId)} deals first` : 'High cards tied — redraw'}</strong>
        <small>
          {isFinalRound
            ? 'Highest card · Ace high'
            : `${nextContenders.map(nameOf).join(' & ')} draw again`}
        </small>
      </div>

      <div className="dealer-draw__cards" key={roundIndex}>
        {currentRound.draws.map(({ playerId, card }, index) => {
          const highlighted = highlightedPlayers.has(playerId);
          return (
            <div
              key={`${roundIndex}-${playerId}-${card.id}`}
              className={`dealer-draw__card${highlighted ? ' is-dealer' : ''}`}
              style={{ '--dealer-card-index': index } as React.CSSProperties}
            >
              <PlayingCard card={card} size="sm" highlighted={highlighted} />
              <span>{nameOf(playerId)}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
