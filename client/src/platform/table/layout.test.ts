import { describe, it, expect } from 'vitest';
import { buildSeatLayout } from './seatLayout';

/**
 * Geometry checks at the phone widths this app actually targets.
 *
 * These are arithmetic, not rendering: they verify that the seat ring plus
 * the seat's own footprint stays inside the table box at each width. They
 * cannot replace opening the app on a real handset, and are not claimed to.
 */

/** Table box for a given viewport width, per CardTable.css. */
function tableBox(viewportWidth: number) {
  // .table is width:100% of a padded column, capped at 60rem, aspect 4/5
  // (3/4 below 380px).
  const horizontalPadding = viewportWidth <= 380 ? 8 : 16;
  const width = Math.min(viewportWidth - horizontalPadding, 960);
  const ratio = viewportWidth <= 380 ? 4 / 3 : 5 / 4;
  return { width, height: width * ratio };
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
      it('keeps every seat fully inside the table at every supported count', () => {
        const box = tableBox(vw);
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

            // Seats may hang slightly over the felt edge onto the wood
            // surround, but must never leave the table box entirely.
            const slack = 16;
            expect(left, `${vw}px ${n}p ${pid} off left`).toBeGreaterThan(-slack);
            expect(right, `${vw}px ${n}p ${pid} off right`).toBeLessThan(box.width + slack);
            expect(top, `${vw}px ${n}p ${pid} off top`).toBeGreaterThan(-slack);
            expect(bottom, `${vw}px ${n}p ${pid} off bottom`).toBeLessThan(box.height + slack);
          }
        }
      });

      it('never overlaps two seats at the Hazari table', () => {
        const box = tableBox(vw);
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
        const box = tableBox(vw);
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
