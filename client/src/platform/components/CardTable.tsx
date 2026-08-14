import { memo, useMemo } from 'react';
import {
  buildSeatLayout,
  playAreaFor,
  dealDelay,
  dealingOrderFromDealer,
  type SeatPosition,
} from '../table/seatLayout';
import { Seat, type SeatPlayer } from './Seat';
import { DealerToken } from './DealerToken';
import { PlayingCard, type CardData } from './PlayingCard';
import './CardTable.css';

export interface PlayedSetView {
  playerId: string;
  cards: CardData[];
  /** Marks the winning set once a sub-round is decided. */
  winning?: boolean;
  /**
   * True only for a set that has just been played in this session, so it
   * animates in from its owner's seat. Sets restored after a reconnect leave
   * this false and simply appear where they belong - old plays are never
   * replayed.
   */
  arriving?: boolean;
}

export interface CardTableProps {
  /** Clockwise seating order. Authoritative, from the server. */
  players: SeatPlayer[];
  /** The local player. Always rendered in the bottom seat. */
  selfId: string | null;
  dealerId: string | null;
  /** Whose turn it is, if anyone's. */
  activePlayerId?: string | null;
  /** Cards currently on the felt. */
  playedSets?: PlayedSetView[];
  /** True while cards are flying out from the deck. */
  dealing?: boolean;
  /** How many cards each player receives. Drives the dealing animation.
   *  Cards dealt here are ALWAYS face down - this component is never given
   *  card data, so it cannot reveal a hand. */
  dealCardsEach?: number;
  /** Shown in the middle of the table when nothing is played yet. */
  centreLabel?: string;
  /**
   * True when centreLabel specifically announces the local player's own
   * turn (as opposed to a passive "Waiting for X" notice). Confirmed on
   * staging: the label's usual quiet, low-opacity treatment made "Your
   * turn" easy to miss and made it compete visually with the top-centre
   * seat rather than reading as its own signal. Game-specific copy
   * ("Your turn" vs "Waiting for…") stays owned by the caller; this platform
   * component only needs to know which visual treatment to use.
   */
  centreLabelEmphasis?: boolean;
  children?: React.ReactNode;
}

/**
 * The shared table. Every game renders into this - Hazari's four seats,
 * Kitti's two to five, Teen Patti's up to nine - so the room feels like one
 * place rather than three separate apps.
 *
 * The felt is the dominant element by design: seats sit on it, cards land on
 * it, and there are no rectangular panels competing with it.
 */
export const CardTable = memo(function CardTable({
  players,
  selfId,
  dealerId,
  activePlayerId,
  playedSets = [],
  dealing = false,
  dealCardsEach = 0,
  centreLabel,
  centreLabelEmphasis = false,
  children,
}: CardTableProps) {
  const layout = useMemo(
    () => buildSeatLayout(players.map((p) => p.playerId), selfId),
    [players, selfId]
  );

  const dealerSeat: SeatPosition | undefined = dealerId ? layout[dealerId] : undefined;

  // Temporal dealing order: starts at the dealer and proceeds clockwise,
  // matching the server. Seat POSITIONS are untouched by this.
  const dealingOrder = useMemo(
    () => dealingOrderFromDealer(players.map((p) => p.playerId), dealerId),
    [players, dealerId]
  );

  return (
    <div className="table">
      {/* Wooden surround. Purely decorative, so hidden from assistive tech. */}
      <div className="table__wood" aria-hidden="true" />

      <div className="table__felt">
        <div className="table__felt-texture" aria-hidden="true" />
        <div className="table__light" aria-hidden="true" />

        {/* Centre: the deck during dealing, otherwise the played sets. */}
        <div className="table__centre">
          {dealing && (
            <div className="table__deck" aria-hidden="true">
              <span className="table__deck-card" />
              <span className="table__deck-card" />
              <span className="table__deck-card" />
            </div>
          )}
          {!dealing && playedSets.length === 0 && centreLabel && (
            <p
              className={`table__centre-label${centreLabelEmphasis ? ' is-emphasis' : ''}`}
            >
              {centreLabel}
            </p>
          )}
        </div>

        {/* The deal: face-down cards travelling from the deck to each seat,
            one at a time round the table, in the same order the server dealt
            them. Purely cosmetic - no card data reaches this component. */}
        {dealing && dealCardsEach > 0 &&
          dealingOrder.map((playerId, dealIndex) => {
            const seat = layout[playerId];
            if (!seat) return null;
            const target = playAreaFor(seat);
            return Array.from({ length: dealCardsEach }).map((_, cardIndex) => (
              <div
                key={`deal-${playerId}-${cardIndex}`}
                className="table__dealt"
                style={
                  {
                    left: `${target.x}%`,
                    top: `${target.y}%`,
                    '--deal-from-x': `${50 - target.x}%`,
                    '--deal-from-y': `${50 - target.y}%`,
                    // Timing follows the DEALING order (dealer first,
                    // then clockwise) - not the seat array order - so the
                    // animation matches the order the server actually dealt.
                    '--deal-delay': `${dealDelay(cardIndex, dealIndex, dealingOrder.length, false)}ms`,
                    '--deal-tilt': `${((cardIndex * 13 + dealIndex * 7) % 9) - 4}deg`,
                  } as React.CSSProperties
                }
                aria-hidden="true"
              >
                <PlayingCard faceDown size="sm" />
              </div>
            ));
          })}

        {/* Played sets, each landing in front of the seat that threw them. */}
        {playedSets.map((set) => {
          const seat = layout[set.playerId];
          if (!seat) return null;
          const area = playAreaFor(seat);
          return (
            <div
              key={set.playerId}
              className={[
                'table__played',
                set.winning && 'is-winning',
                set.arriving && 'is-arriving',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                {
                  left: `${area.x}%`,
                  top: `${area.y}%`,
                  // Travel origin: the seat that threw the set. For the local
                  // player that is the bottom seat, so their cards rise from
                  // their own hand; for everyone else it is their own seat.
                  '--play-from-x': `${seat.x - area.x}%`,
                  '--play-from-y': `${seat.y - area.y}%`,
                } as React.CSSProperties
              }
            >
              {set.cards.map((card, i) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="sm"
                  highlighted={set.winning}
                  /* Small deterministic tilt so a thrown set looks placed by
                     hand rather than snapped to a grid. */
                  tilt={((i * 7) % 5) - 2}
                />
              ))}
            </div>
          );
        })}

        {/* Seats. */}
        {players.map((player) => {
          const seat = layout[player.playerId];
          if (!seat) return null;
          return (
            <Seat
              key={player.playerId}
              player={player}
              position={seat}
              isDealer={player.playerId === dealerId}
              isActive={player.playerId === activePlayerId}
            />
          );
        })}

        {dealerSeat && <DealerToken seat={dealerSeat} />}
      </div>

      {children}
    </div>
  );
});
