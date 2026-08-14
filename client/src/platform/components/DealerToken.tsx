import { memo } from 'react';
import { type SeatPosition } from '../table/seatLayout';
import './DealerToken.css';

export interface DealerTokenProps {
  seat: SeatPosition;
}

/**
 * The dealer button - a small brass-edged disc that sits beside the dealer's
 * seat and slides across the felt when the deal passes on.
 *
 * It is positioned slightly inside the seat, toward the table centre, so it
 * reads as sitting on the felt in front of the dealer rather than pinned to
 * their avatar. Movement is a plain CSS transition on left/top, so React only
 * re-renders when the dealer actually changes.
 */
export const DealerToken = memo(function DealerToken({ seat }: DealerTokenProps) {
  const CENTRE = 50;
  const INSET = 0.2;
  const x = seat.x + (CENTRE - seat.x) * INSET;
  const y = seat.y + (CENTRE - seat.y) * INSET;

  return (
    <div
      className="dealer-token"
      style={{ left: `${x}%`, top: `${y}%` }}
      role="img"
      aria-label="Dealer button"
    >
      <span className="dealer-token__face" aria-hidden="true">
        D
      </span>
    </div>
  );
});
