import { memo } from 'react';
import './PlayingCard.css';

export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';
export type Rank =
  | 'A' | 'K' | 'Q' | 'J' | '10'
  | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface CardData {
  suit: Suit;
  rank: Rank;
  id: string;
}

const SUIT_GLYPH: Record<Suit, string> = {
  SPADES: '\u2660',
  HEARTS: '\u2665',
  DIAMONDS: '\u2666',
  CLUBS: '\u2663',
};

const SUIT_NAME: Record<Suit, string> = {
  SPADES: 'spades',
  HEARTS: 'hearts',
  DIAMONDS: 'diamonds',
  CLUBS: 'clubs',
};

const RANK_NAME: Record<Rank, string> = {
  A: 'ace', K: 'king', Q: 'queen', J: 'jack', '10': 'ten',
  '9': 'nine', '8': 'eight', '7': 'seven', '6': 'six',
  '5': 'five', '4': 'four', '3': 'three', '2': 'two',
};

function isRed(suit: Suit): boolean {
  return suit === 'HEARTS' || suit === 'DIAMONDS';
}

export interface PlayingCardProps {
  card?: CardData;
  /** Face down. `card` is not required, and must not be supplied by the
   *  server for an opponent's hidden card. */
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  disabled?: boolean;
  /** Small rotation in degrees, for a natural scattered look on the felt. */
  tilt?: number;
  onClick?: () => void;
  /** Marks a winning set at the end of a sub-round. */
  highlighted?: boolean;
  style?: React.CSSProperties;
}

/**
 * A single playing card.
 *
 * Legibility rules, from the brief:
 *   - the rank is the loudest element, readable at a glance on a 320px phone
 *   - the suit is a clear glyph, never a decorative flourish
 *   - state is never communicated by colour alone: a selected card also
 *     lifts, and a winning card also gets a visible brass frame
 */
export const PlayingCard = memo(function PlayingCard({
  card,
  faceDown = false,
  size = 'md',
  selected = false,
  disabled = false,
  tilt = 0,
  onClick,
  highlighted = false,
  style,
}: PlayingCardProps) {
  const interactive = !!onClick && !disabled;

  const classes = [
    'pcard',
    `pcard--${size}`,
    faceDown ? 'pcard--back' : 'pcard--face',
    selected && 'is-selected',
    highlighted && 'is-highlighted',
    disabled && 'is-disabled',
    interactive && 'is-interactive',
    card && `is-${SUIT_NAME[card.suit]}`,
  ]
    .filter(Boolean)
    .join(' ');

  const cardStyle = tilt
    ? ({ ...style, '--pcard-tilt': `${tilt}deg` } as React.CSSProperties)
    : style;

  if (faceDown || !card) {
    return (
      <div
        className={classes}
        style={cardStyle}
        aria-hidden="true"
      >
        <div className="pcard__back-pattern" />
      </div>
    );
  }

  const red = isRed(card.suit);
  const label = `${RANK_NAME[card.rank]} of ${SUIT_NAME[card.suit]}`;
  const glyph = SUIT_GLYPH[card.suit];

  const content = (
    <>
      <span className="pcard__corner pcard__corner--tl" aria-hidden="true">
        <span className="pcard__rank">{card.rank}</span>
        <span className="pcard__suit">{glyph}</span>
      </span>
      <span className="pcard__pip" aria-hidden="true">
        {glyph}
      </span>
      <span className="pcard__corner pcard__corner--br" aria-hidden="true">
        <span className="pcard__rank">{card.rank}</span>
        <span className="pcard__suit">{glyph}</span>
      </span>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={`${classes} ${red ? 'is-red' : 'is-black'}`}
        style={cardStyle}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`${classes} ${red ? 'is-red' : 'is-black'}`}
      style={cardStyle}
      role="img"
      aria-label={label}
    >
      {content}
    </div>
  );
});
