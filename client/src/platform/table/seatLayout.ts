// ============================================================================
// PLATFORM - Seat layout engine
//
// One reusable system that positions 2-9 seats around a single oval table,
// shared by Hazari (always 4), Kitti (2-5) and Teen Patti (2-9).
//
// Design rules this encodes:
//   - the local player always occupies the primary bottom seat
//   - seat positions are chosen per player count, not by shrinking a fixed
//     ring until it stops being readable
//   - opponents are distributed so the table stays visually balanced and no
//     two seats collide
//   - seat scale steps down in discrete, readable tiers rather than
//     continuously, so a 9-player table is compact but still legible
//
// Positions are percentages of the table container (0-100), so the whole
// thing is resolution independent and drives plain CSS transforms.
// ============================================================================

export interface SeatPosition {
  /** Horizontal centre, as a percentage of table width. */
  x: number;
  /** Vertical centre, as a percentage of table height. */
  y: number;
  /** Which edge of the table this seat sits against - drives label placement
   *  and the direction cards travel when this player throws. */
  anchor: 'bottom' | 'top' | 'left' | 'right' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Relative seat scale. Steps in tiers so text never becomes unreadable. */
  scale: number;
  /** True for the local player's own seat. */
  isSelf: boolean;
}

export const MIN_SEATS = 2;
export const MAX_SEATS = 9;

/**
 * Hand-tuned seat rings. Each entry is the full set of positions for that
 * player count, with index 0 ALWAYS being the local player's bottom seat.
 * Tuning these by hand rather than generating them from an ellipse formula
 * is deliberate: a formula spaces seats evenly in angle, which bunches them
 * awkwardly at the narrow ends of an oval and pushes them off the felt.
 *
 * X positions re-derived 2026-08-15 (Bug 4 retest): the PREVIOUS margin
 * check (platform/table/layout.test.ts) compared a seat's footprint against
 * `.table`'s own box, but `.table` has its own 1.4%/1.2% padding around
 * `.table__felt` (CardTable.css) - the actual clipping boundary
 * (`overflow: hidden` lives on `.table__felt`, not `.table`) - and the test
 * never subtracted it. Redone against the felt's real width, several seats
 * came out with essentially NO margin, and several were measurably
 * NEGATIVE (as much as -9.75px) at realistic phone widths - confirmed on
 * real Android PWA staging as the right-side seat's identity clipped by
 * the felt's own edge, not just crowded internally. Every anchor below at
 * >18% (opponent scale 1), >17.2% (scale 0.9, 5-6 players) or >16% (scale
 * 0.8, 7-9 players) from the nearest felt edge already had a real margin
 * and is untouched; only anchors that were actually inside that threshold
 * were pulled in, and only just enough to clear it with a small buffer -
 * this is a margin fix, not a re-layout, so it changes as little of the
 * existing hand-tuned shape as the arithmetic allows.
 */
const RINGS: Record<number, Omit<SeatPosition, 'isSelf' | 'scale'>[]> = {
  2: [
    { x: 50, y: 88, anchor: 'bottom' },
    { x: 50, y: 12, anchor: 'top' },
  ],
  3: [
    { x: 50, y: 88, anchor: 'bottom' },
    { x: 18.4, y: 30, anchor: 'left' },
    { x: 81.6, y: 30, anchor: 'right' },
  ],
  4: [
    { x: 50, y: 88, anchor: 'bottom' },
    // Left/right seats previously sat at 12/88 (pulled in from an even
    // earlier 10/90 - see git history / SESSION_CHANGELOG.md). Still not
    // enough: `.table__felt` (the actual clipping boundary) is narrower
    // than `.table` by its own padding, which the check that produced
    // 12/88 did not subtract - see the ring-level comment above. 18.4/81.6
    // is the first value actually re-derived against the felt itself.
    { x: 18.4, y: 50, anchor: 'left' },
    { x: 50, y: 12, anchor: 'top' },
    { x: 81.6, y: 50, anchor: 'right' },
  ],
  5: [
    { x: 50, y: 90, anchor: 'bottom' },
    { x: 17.2, y: 62, anchor: 'left' },
    { x: 24, y: 16, anchor: 'top-left' },
    { x: 76, y: 16, anchor: 'top-right' },
    { x: 82.8, y: 62, anchor: 'right' },
  ],
  6: [
    { x: 50, y: 90, anchor: 'bottom' },
    { x: 17.2, y: 68, anchor: 'left' },
    { x: 17.2, y: 26, anchor: 'top-left' },
    { x: 50, y: 10, anchor: 'top' },
    { x: 82.8, y: 26, anchor: 'top-right' },
    { x: 82.8, y: 68, anchor: 'right' },
  ],
  7: [
    { x: 50, y: 91, anchor: 'bottom' },
    { x: 16, y: 80, anchor: 'bottom-left' },
    { x: 16, y: 46, anchor: 'left' },
    { x: 28, y: 12, anchor: 'top-left' },
    { x: 72, y: 12, anchor: 'top-right' },
    { x: 84, y: 46, anchor: 'right' },
    { x: 84, y: 80, anchor: 'bottom-right' },
  ],
  8: [
    { x: 50, y: 91, anchor: 'bottom' },
    { x: 17, y: 82, anchor: 'bottom-left' },
    { x: 16, y: 55, anchor: 'left' },
    { x: 16, y: 22, anchor: 'top-left' },
    { x: 50, y: 9, anchor: 'top' },
    { x: 84, y: 22, anchor: 'top-right' },
    { x: 84, y: 55, anchor: 'right' },
    { x: 83, y: 82, anchor: 'bottom-right' },
  ],
  9: [
    { x: 50, y: 91.5, anchor: 'bottom' },
    { x: 19, y: 85, anchor: 'bottom-left' },
    { x: 16, y: 62, anchor: 'left' },
    { x: 16, y: 30, anchor: 'top-left' },
    { x: 32, y: 9, anchor: 'top-left' },
    { x: 68, y: 9, anchor: 'top-right' },
    { x: 84, y: 30, anchor: 'top-right' },
    { x: 84, y: 62, anchor: 'right' },
    { x: 81, y: 85, anchor: 'bottom-right' },
  ],
};

/**
 * Seat scale tiers. Discrete steps, not a continuous shrink - the brief is
 * explicit that seats must not just get smaller until unreadable.
 */
function scaleForCount(count: number, isSelf: boolean): number {
  if (isSelf) return 1;
  if (count <= 4) return 1;
  if (count <= 6) return 0.9;
  return 0.8;
}

/**
 * Builds the seat ring for a table.
 *
 * @param playerIds  Seating order, clockwise. Order is authoritative and comes
 *                   from the server - this function never reorders it.
 * @param selfId     The local player. Rotated to the bottom seat. Pass null
 *                   for a spectator view, which keeps the server order as-is.
 */
export function buildSeatLayout(
  playerIds: string[],
  selfId: string | null
): Record<string, SeatPosition> {
  const count = playerIds.length;
  if (count < MIN_SEATS || count > MAX_SEATS) {
    throw new Error(`Seat layout supports ${MIN_SEATS}-${MAX_SEATS} players, got ${count}`);
  }

  const ring = RINGS[count];
  if (!ring) throw new Error(`No seat ring defined for ${count} players`);

  // Rotate the clockwise seating order so the local player lands at index 0
  // (the bottom seat) while everyone's relative clockwise order is preserved.
  const selfIndex = selfId ? playerIds.indexOf(selfId) : -1;
  const ordered =
    selfIndex >= 0
      ? [...playerIds.slice(selfIndex), ...playerIds.slice(0, selfIndex)]
      : [...playerIds];

  const layout: Record<string, SeatPosition> = {};
  ordered.forEach((pid, i) => {
    const isSelf = pid === selfId;
    layout[pid] = {
      ...ring[i],
      scale: scaleForCount(count, isSelf),
      isSelf,
    };
  });

  return layout;
}

/**
 * Where cards should fly from/to for a given seat, as a percentage point.
 * Pulled slightly toward the table centre so cards land on the felt in front
 * of a player rather than on top of their avatar.
 */
export function playAreaFor(seat: SeatPosition): { x: number; y: number } {
  const CENTRE = 50;
  const PULL = 0.42; // fraction of the way from the seat toward the centre
  return {
    x: seat.x + (CENTRE - seat.x) * PULL,
    y: seat.y + (CENTRE - seat.y) * PULL,
  };
}

/**
 * Per-card delay for the dealing animation, in milliseconds.
 * Deals one card at a time round the table, matching how the server actually
 * deals, with a small natural jitter so it does not feel mechanical.
 *
 * @param reducedMotion When true, everything lands immediately.
 */
export function dealDelay(
  cardIndex: number,
  seatIndex: number,
  seatCount: number,
  reducedMotion: boolean
): number {
  if (reducedMotion) return 0;
  const PER_CARD_MS = 55;
  const order = cardIndex * seatCount + seatIndex;
  // Deterministic jitter (no Math.random) so a re-render never reshuffles
  // timings mid-animation and makes cards visibly jump. Kept non-negative:
  // a negative delay is invalid for a CSS/WAAPI animation and would make the
  // very first card of the deal appear instantly instead of flying out.
  const jitter = (order * 37) % 11;
  return order * PER_CARD_MS + jitter;
}

/** Total time the full deal takes, so callers can schedule what comes next. */
export function totalDealDuration(
  cardsEach: number,
  seatCount: number,
  reducedMotion: boolean
): number {
  if (reducedMotion) return 0;
  const CARD_FLIGHT_MS = 380;
  return dealDelay(cardsEach - 1, seatCount - 1, seatCount, false) + CARD_FLIGHT_MS;
}

/**
 * The order in which players receive cards, for the dealing animation.
 *
 * MIRRORS THE SERVER EXACTLY. Hazari's authoritative
 * `seatingOrderFromDealer` in server/src/games/hazari/deck.ts starts AT the
 * dealer and proceeds clockwise:
 *
 *     [...players.slice(dealerIndex), ...players.slice(0, dealerIndex)]
 *
 * so the dealer receives the first card. Keep the two in step - if the server
 * ever changes, this must change with it, or the animation will show a
 * different order from the one that actually happened.
 *
 * NOTE: this affects TIMING ONLY. Seat positions come from buildSeatLayout
 * and are unaffected, so the local player stays anchored at the bottom
 * whoever is dealing.
 */
export function dealingOrderFromDealer(
  playersClockwise: string[],
  dealerId: string | null
): string[] {
  if (!dealerId) return [...playersClockwise];
  const idx = playersClockwise.indexOf(dealerId);
  // An unknown dealer must not break the ceremony; fall back to table order.
  if (idx === -1) return [...playersClockwise];
  return [...playersClockwise.slice(idx), ...playersClockwise.slice(0, idx)];
}

/**
 * Poker-style dealing order: the first card goes to the first active seat
 * clockwise AFTER the dealer/button, then continues clockwise.
 *
 * This is intentionally separate from `dealingOrderFromDealer`. Hazari,
 * Kitti and Teen Patti are locked to their existing dealer-first ceremony;
 * Poker's authoritative engine starts left of the button. Keeping separate
 * helpers makes it much harder for a shared-table refactor to change one
 * game's dealing semantics by accident.
 */
export function dealingOrderLeftOfDealer(
  playersClockwise: string[],
  dealerId: string | null
): string[] {
  if (!dealerId) return [...playersClockwise];
  const idx = playersClockwise.indexOf(dealerId);
  if (idx === -1) return [...playersClockwise];
  const first = (idx + 1) % playersClockwise.length;
  return [...playersClockwise.slice(first), ...playersClockwise.slice(0, first)];
}
