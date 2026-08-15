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
 * It is nudged slightly toward the table centre, so it reads as sitting on
 * the felt in front of the dealer rather than pinned exactly to their
 * avatar. The nudge is a small FIXED pixel amount (see `--dealer-pull` in
 * DealerToken.css), not a percentage of the felt: this component only
 * decides the DIRECTION (toward centre, per axis - `dirX`/`dirY` below),
 * and CSS applies the actual distance via `transform: translate()`,
 * scaled by `--seat-scale` and the narrow-phone breakpoint exactly like the
 * token's own size already is.
 *
 * This matters because Seat/DealerToken position everything as a percentage
 * of the felt, but the felt's PIXEL size varies enormously across the
 * supported range (a 320px phone up to the 60rem/72dvh desktop cap) while
 * the avatar and name text stay fixed-px. A percentage-based pull that looks
 * right on a phone becomes tens of pixels on a larger table - big enough to
 * land the token on top of a seat's own name label for any anchor whose
 * "toward centre" direction is downward in screen space (`top`, `top-left`,
 * `top-right` - the direction the name text itself renders below every
 * avatar, all anchors, per Seat.css). Re-derived on real geometry, not
 * estimated - see SESSION_CHANGELOG.md "Bug 4" for the numbers.
 */
export const DealerToken = memo(function DealerToken({ seat }: DealerTokenProps) {
  const CENTRE = 50;
  const dirX = Math.sign(CENTRE - seat.x);
  const dirY = Math.sign(CENTRE - seat.y);

  return (
    <div
      className="dealer-token"
      style={{
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        '--dealer-pull-dir-x': dirX,
        '--dealer-pull-dir-y': dirY,
        '--seat-scale': seat.scale,
      } as React.CSSProperties}
      role="img"
      aria-label="Dealer button"
    >
      <span className="dealer-token__face" aria-hidden="true">
        D
      </span>
    </div>
  );
});
