import { describe, it, expect } from 'vitest';
import { buildSeatLayout } from './seatLayout';

/**
 * Geometry checks at the phone widths this app actually targets.
 *
 * These are arithmetic, not rendering: they verify that the seat ring plus
 * the seat's own footprint stays inside the table box at each width. They
 * cannot replace opening the app on a real handset, and are not claimed to.
 */

/** `.table`'s own box for a given viewport width, per CardTable.css. */
function tableBox(viewportWidth: number) {
  // .table is width:100% of a padded column, capped at 60rem, aspect 4/5
  // (3/4 below 380px).
  const horizontalPadding = viewportWidth <= 380 ? 8 : 16;
  const width = Math.min(viewportWidth - horizontalPadding, 960);
  const ratio = viewportWidth <= 380 ? 4 / 3 : 5 / 4;
  return { width, height: width * ratio };
}

/**
 * `.table__felt`'s box - the box seats are actually POSITIONED as a
 * percentage of, and the one that actually clips (`.table__felt {
 * overflow: hidden }`, CardTable.css).
 *
 * Bug 4 (confirmed on real Android PWA staging, 2026-08-15 retest): this
 * function did not previously exist - every check below compared a seat's
 * footprint against `tableBox()` alone. But `.table` has its own
 * `padding: 1.4%` (1.2% below 380px) around the felt, so the felt is
 * narrower/shorter than `.table` by that padding on every side - a real
 * gap this suite never subtracted. Combined with the old `slack: 16`
 * below (which assumed a forgiving "wood surround" a seat could safely
 * hang over into - there isn't one; the felt clips immediately at its own
 * edge), several seats that this suite reported as safely inside the
 * table were measurably OUTSIDE the felt's real clipping boundary -
 * confirmed on staging as the right-side seat's name clipped by the felt
 * edge itself, not merely crowded internally.
 */
function feltBox(viewportWidth: number) {
  const box = tableBox(viewportWidth);
  const paddingFraction = viewportWidth <= 380 ? 0.012 : 0.014; // .table's own padding: 1.2%/1.4%
  return {
    width: box.width * (1 - 2 * paddingFraction),
    height: box.height * (1 - 2 * paddingFraction),
  };
}

/** Seat footprint in px, per Seat.css. */
function seatSize(viewportWidth: number, scale: number) {
  const width = viewportWidth <= 380 ? 72 : 88; // 4.5rem / 5.5rem
  const height = viewportWidth <= 380 ? 62 : 74;
  return { width: width * scale, height: height * scale };
}

const WIDTHS = [320, 360, 375, 390, 412, 430];

describe('seat geometry at target phone widths', () => {
  for (const vw of WIDTHS) {
    describe(`${vw}px`, () => {
      it('keeps every seat fully inside the FELT (the actual clipping boundary) at every supported count', () => {
        const box = feltBox(vw);
        for (let n = 2; n <= 9; n++) {
          const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
          const layout = buildSeatLayout(ids, 'p1');

          for (const [pid, seat] of Object.entries(layout)) {
            const size = seatSize(vw, seat.scale);
            const centreX = (seat.x / 100) * box.width;
            const centreY = (seat.y / 100) * box.height;

            const left = centreX - size.width / 2;
            const right = centreX + size.width / 2;
            const top = centreY - size.height / 2;
            const bottom = centreY + size.height / 2;

            // No forgiving slack here: `.table__felt` clips at its own
            // edge (overflow: hidden), immediately, with no margin of its
            // own to hang over into first - a seat's footprint must be
            // FULLY inside it, full stop.
            expect(left, `${vw}px ${n}p ${pid} off left`).toBeGreaterThanOrEqual(0);
            expect(right, `${vw}px ${n}p ${pid} off right`).toBeLessThanOrEqual(box.width);
            expect(top, `${vw}px ${n}p ${pid} off top`).toBeGreaterThanOrEqual(0);
            expect(bottom, `${vw}px ${n}p ${pid} off bottom`).toBeLessThanOrEqual(box.height);
          }
        }
      });

      it('gives every non-centred seat a real horizontal safety margin, not just barely-positive', () => {
        // A seat sitting exactly ON the felt boundary technically "fits"
        // per the check above, but leaves zero room for the imprecision
        // any real browser/device rendering adds on top of this idealized
        // arithmetic (subpixel rounding, actual font metrics, etc.) -
        // exactly the gap that let Bug 4 through the FIRST time this
        // margin was tightened (12/88, 2026-08-14) despite passing what
        // was, at the time, this same style of check. A minimum real
        // margin, not just non-negative, is the actual invariant that
        // matters.
        const box = feltBox(vw);
        const MIN_MARGIN = 10;
        for (let n = 2; n <= 9; n++) {
          const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
          const layout = buildSeatLayout(ids, 'p1');
          for (const [pid, seat] of Object.entries(layout)) {
            if (seat.x === 50) continue; // centred seats aren't at edge risk
            const size = seatSize(vw, seat.scale);
            const centreX = (seat.x / 100) * box.width;
            const left = centreX - size.width / 2;
            const right = centreX + size.width / 2;
            const margin = Math.min(left, box.width - right);
            expect(margin, `${vw}px ${n}p ${pid} horizontal margin`).toBeGreaterThanOrEqual(MIN_MARGIN);
          }
        }
      });

      it('never overlaps two seats at the Hazari table', () => {
        const box = feltBox(vw);
        const layout = buildSeatLayout(['p1', 'p2', 'p3', 'p4'], 'p1');
        const seats = Object.values(layout).map((s) => ({
          x: (s.x / 100) * box.width,
          y: (s.y / 100) * box.height,
          ...seatSize(vw, s.scale),
        }));

        for (let i = 0; i < seats.length; i++) {
          for (let j = i + 1; j < seats.length; j++) {
            const a = seats[i];
            const b = seats[j];
            const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
            const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2;
            expect(overlapX && overlapY, `${vw}px: seats ${i}/${j} overlap`).toBe(false);
          }
        }
      });

      it('leaves usable room in the centre for played cards', () => {
        const box = feltBox(vw);
        // The narrowest gap between the top and bottom seat edges must still
        // fit at least one small card (~38px tall plus breathing room).
        const layout = buildSeatLayout(['p1', 'p2', 'p3', 'p4'], 'p1');
        const bottom = layout.p1;
        const top = Object.values(layout).find((s) => s.anchor === 'top')!;
        const bottomEdge =
          (bottom.y / 100) * box.height - seatSize(vw, bottom.scale).height / 2;
        const topEdge = (top.y / 100) * box.height + seatSize(vw, top.scale).height / 2;
        expect(bottomEdge - topEdge).toBeGreaterThan(120);
      });
    });
  }
});

describe('desktop does not stretch', () => {
  it('caps the table width regardless of viewport size', () => {
    expect(tableBox(2560).width).toBe(960);
    expect(tableBox(1440).width).toBe(960);
  });
});
