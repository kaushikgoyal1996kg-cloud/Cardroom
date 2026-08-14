import { memo, useCallback } from 'react';
import { PlayingCard, type CardData } from './PlayingCard';
import './PlayerHand.css';

export interface PlayerHandProps {
  cards: CardData[];
  /** Card ids currently selected. */
  selectedIds?: string[];
  onToggle?: (card: CardData) => void;
  disabled?: boolean;
  /** True while the deal animation is running. */
  dealing?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

/**
 * The local player's cards, fanned along the bottom of the screen.
 *
 * Touch behaviour, per the brief:
 *   - `touch-action: manipulation` on every card stops the page scrolling
 *     while a card is being tapped or dragged
 *   - selection is a tap, not a precision drag, because dragging small cards
 *     on a 320px phone is unreliable
 *   - a selected card lifts, so the state is visible without relying on colour
 *
 * Overlap is computed from the card count rather than fixed, so 13 Hazari
 * cards and 3 Teen Patti cards both sit comfortably on the same screen.
 */
export const PlayerHand = memo(function PlayerHand({
  cards,
  selectedIds = [],
  onToggle,
  disabled = false,
  dealing = false,
  size = 'md',
  label = 'Your cards',
}: PlayerHandProps) {
  const selected = new Set(selectedIds);

  const handleToggle = useCallback(
    (card: CardData) => {
      if (disabled || !onToggle) return;
      onToggle(card);
    },
    [disabled, onToggle]
  );

  // Cards overlap more as the hand grows. Below 6 cards there is room to
  // show each one whole.
  const overlap = cards.length <= 5 ? 0 : Math.min(46, 8 + (cards.length - 5) * 4);

  return (
    <div className="hand" role="group" aria-label={label}>
      <div
        className="hand__fan"
        style={{ '--hand-overlap': `${overlap}%` } as React.CSSProperties}
      >
        {cards.map((card, i) => {
          // Gentle arc: outer cards tilt slightly, like a held fan.
          const mid = (cards.length - 1) / 2;
          const tilt = cards.length > 3 ? (i - mid) * 1.6 : 0;
          const lift = cards.length > 3 ? Math.abs(i - mid) * 1.1 : 0;

          return (
            <div
              key={card.id}
              className={`hand__slot${dealing ? ' hand__slot--dealing' : ''}`}
              style={
                {
                  '--slot-index': i,
                  '--slot-lift': `${lift}px`,
                } as React.CSSProperties
              }
            >
              <PlayingCard
                card={card}
                size={size}
                tilt={tilt}
                selected={selected.has(card.id)}
                disabled={disabled}
                onClick={onToggle ? () => handleToggle(card) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
