import { describe, it, expect } from 'vitest';
import DEALER_TOKEN_TSX from './DealerToken.tsx?raw';
import DEALER_TOKEN_CSS from './DealerToken.css?raw';

/**
 * Bug 4 (confirmed on real Hazari table staging, dealer-token part): the
 * dealer token was nudged toward the table centre by a PERCENTAGE of the
 * felt's own size (20% of the distance from the seat to the centre). That
 * looks like a small nudge on paper, but the felt's pixel size varies
 * enormously across the supported range (a 320px phone up to the 60rem /
 * 72dvh desktop cap - see CardTable.css), while the avatar and name text
 * stay fixed-px (see Seat.css). At realistic sizes that "20%" pull was tens
 * of pixels - big enough to land the token on top of a seat's own name
 * label for any anchor whose "toward centre" direction is downward in
 * screen space (`top`, `top-left`, `top-right`: the SAME direction the name
 * text renders below every avatar, all anchors, per Seat.css's
 * `flex-direction: column`).
 *
 * This is arithmetic, not rendering - jsdom does not compute real layout -
 * but it is derived from the SAME real box-model constants Seat.css and
 * DealerToken.css actually declare (not re-estimated), so a change to any
 * of them recomputes this too.
 */

// ---- Seat.css constants (avatar + the gap before the name row) ----------
const AVATAR_SIZE = 2.75 * 16; // .seat__avatar { width/height: 2.75rem }
const AVATAR_SIZE_NARROW = 2.25 * 16; // <380px: .seat__avatar { width/height: 2.25rem }
const AVATAR_NAME_GAP = 0.25 * 16; // .seat { gap: var(--space-1) = 4px }, unaffected by the narrow breakpoint

// ---- DealerToken.css constants -------------------------------------------
const TOKEN_SIZE = 1.75 * 16; // .dealer-token { width/height: 1.75rem }
const TOKEN_SIZE_NARROW = 1.5 * 16; // <380px override
const PULL = 8; // --dealer-pull
const PULL_NARROW = 6; // <380px override

/**
 * Worst case: the token pulls its FULL distance along the axis the name
 * text occupies (anchors like `top`/`top-left`/`top-right` pull toward
 * centre in the SAME downward direction the name renders). Returns the gap
 * still remaining between the token's nearest edge and the name row's
 * nearest edge - must stay >= 0, i.e. no overlap.
 */
function verticalClearance(scale: number, narrow: boolean): number {
  const avatarSize = (narrow ? AVATAR_SIZE_NARROW : AVATAR_SIZE) * scale;
  const gap = AVATAR_NAME_GAP * scale;
  const tokenSize = narrow ? TOKEN_SIZE_NARROW : TOKEN_SIZE; // NOT scaled by seat.scale - a sibling of .seat, not a descendant
  const pull = (narrow ? PULL_NARROW : PULL) * scale;
  // Distance from the avatar's own centre to the boundary between the
  // avatar+gap zone and the name row = avatarSize/2 + gap.
  const boundary = avatarSize / 2 + gap;
  // The token's nearest edge to that boundary, having travelled `pull`
  // toward it from the avatar's centre.
  const tokenNearEdge = pull + tokenSize / 2;
  return boundary - tokenNearEdge;
}

describe('Bug 4: the dealer token never covers a seat\'s own name label', () => {
  // scale=1 (self, or any table of <=4), 0.9 (5-6 players), 0.8 (7-9
  // players) - see seatLayout.ts scaleForCount(). All are reachable by a
  // shared platform component even though only 4-player Hazari is live
  // today.
  const SCALES = [1, 0.9, 0.8];

  it.each(SCALES)('regular breakpoint, seat scale %s: token stays clear of the name row', (scale) => {
    expect(verticalClearance(scale, false)).toBeGreaterThanOrEqual(0);
  });

  it.each(SCALES)('narrow phone (<380px), seat scale %s: token stays clear of the name row', (scale) => {
    expect(verticalClearance(scale, true)).toBeGreaterThanOrEqual(0);
  });

  it('the pull is a fixed pixel amount, not a percentage of the felt', () => {
    // Regression: a felt-relative percentage pull is exactly what caused
    // this bug - re-introducing one would pass at small felt sizes and
    // silently fail again at large ones. DealerToken.tsx must only ever
    // emit a unit-less DIRECTION (-1/0/1) as a CSS variable; the actual
    // distance must live in DealerToken.css as a fixed px value.
    expect(DEALER_TOKEN_TSX).not.toMatch(/seat\.x\s*\+/);
    expect(DEALER_TOKEN_TSX).not.toMatch(/seat\.y\s*\+/);
    expect(DEALER_TOKEN_CSS).toMatch(/--dealer-pull:\s*\d+px/);
  });
});
