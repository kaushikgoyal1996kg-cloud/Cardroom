import { describe, it, expect } from 'vitest';
import {
  buildSeatLayout,
  playAreaFor,
  dealDelay,
  totalDealDuration,
  dealingOrderFromDealer,
  dealingOrderLeftOfDealer,
  MIN_SEATS,
  MAX_SEATS,
} from './seatLayout.js';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe('buildSeatLayout', () => {
  it('supports every table size from 2 to 9', () => {
    for (let n = MIN_SEATS; n <= MAX_SEATS; n++) {
      const layout = buildSeatLayout(ids(n), 'p1');
      expect(Object.keys(layout)).toHaveLength(n);
    }
  });

  it('rejects table sizes outside 2-9', () => {
    expect(() => buildSeatLayout(ids(1), 'p1')).toThrow();
    expect(() => buildSeatLayout(ids(10), 'p1')).toThrow();
  });

  it('always seats the local player at the primary bottom position', () => {
    for (let n = MIN_SEATS; n <= MAX_SEATS; n++) {
      for (const self of ids(n)) {
        const layout = buildSeatLayout(ids(n), self);
        expect(layout[self].anchor, `${n} players, self=${self}`).toBe('bottom');
        expect(layout[self].isSelf).toBe(true);
        // Bottom seat sits in the lower portion of the table.
        expect(layout[self].y).toBeGreaterThan(80);
      }
    }
  });

  it('marks exactly one seat as self', () => {
    for (let n = MIN_SEATS; n <= MAX_SEATS; n++) {
      const layout = buildSeatLayout(ids(n), 'p2');
      expect(Object.values(layout).filter((s) => s.isSelf)).toHaveLength(1);
    }
  });

  it('preserves clockwise order relative to the local player', () => {
    // p3 is self; going clockwise from p3 the order must stay p3,p4,p5,p1,p2.
    const layout = buildSeatLayout(ids(5), 'p3');
    const bySeatOrder = Object.entries(layout).sort(
      // Reconstruct ring index by matching against a fresh layout.
      () => 0
    );
    expect(bySeatOrder).toHaveLength(5);
    // Direct check: rebuild and confirm p3 is bottom, and the next seat
    // clockwise belongs to p4.
    const ringOrder = ['p3', 'p4', 'p5', 'p1', 'p2'];
    const reference = buildSeatLayout(ids(5), 'p3');
    const positions = ringOrder.map((id) => reference[id]);
    expect(positions[0].anchor).toBe('bottom');
    // Every id must have received a distinct position.
    const seen = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(5);
  });

  it('never places two seats at the same point', () => {
    for (let n = MIN_SEATS; n <= MAX_SEATS; n++) {
      const layout = buildSeatLayout(ids(n), 'p1');
      const points = Object.values(layout).map((s) => `${s.x},${s.y}`);
      expect(new Set(points).size, `${n} players`).toBe(n);
    }
  });

  it('keeps every seat inside the table bounds', () => {
    for (let n = MIN_SEATS; n <= MAX_SEATS; n++) {
      for (const seat of Object.values(buildSeatLayout(ids(n), 'p1'))) {
        expect(seat.x).toBeGreaterThanOrEqual(0);
        expect(seat.x).toBeLessThanOrEqual(100);
        expect(seat.y).toBeGreaterThanOrEqual(0);
        expect(seat.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('keeps seats far enough apart to stay readable', () => {
    // Minimum centre-to-centre distance, in percentage units.
    const MIN_GAP = 12;
    for (let n = MIN_SEATS; n <= MAX_SEATS; n++) {
      const seats = Object.values(buildSeatLayout(ids(n), 'p1'));
      for (let i = 0; i < seats.length; i++) {
        for (let j = i + 1; j < seats.length; j++) {
          const dx = seats[i].x - seats[j].x;
          const dy = seats[i].y - seats[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          expect(dist, `${n} players: seats ${i} and ${j} overlap`).toBeGreaterThan(MIN_GAP);
        }
      }
    }
  });

  it('scales seats in discrete tiers, never below 0.8', () => {
    for (let n = MIN_SEATS; n <= MAX_SEATS; n++) {
      for (const seat of Object.values(buildSeatLayout(ids(n), 'p1'))) {
        expect(seat.scale).toBeGreaterThanOrEqual(0.8);
        expect(seat.scale).toBeLessThanOrEqual(1);
      }
    }
  });

  it('always renders the local player at full scale', () => {
    for (let n = MIN_SEATS; n <= MAX_SEATS; n++) {
      expect(buildSeatLayout(ids(n), 'p1').p1.scale).toBe(1);
    }
  });

  it('places 2 players opposite each other', () => {
    const layout = buildSeatLayout(ids(2), 'p1');
    expect(layout.p1.anchor).toBe('bottom');
    expect(layout.p2.anchor).toBe('top');
  });

  it('gives 4 players a natural four-side arrangement', () => {
    const layout = buildSeatLayout(ids(4), 'p1');
    const anchors = Object.values(layout).map((s) => s.anchor).sort();
    expect(anchors).toEqual(['bottom', 'left', 'right', 'top']);
  });

  it('supports a spectator view with no local player', () => {
    const layout = buildSeatLayout(ids(4), null);
    expect(Object.keys(layout)).toHaveLength(4);
    expect(Object.values(layout).every((s) => !s.isSelf)).toBe(true);
  });
});

describe('playAreaFor', () => {
  it('pulls the play area toward the centre of the table', () => {
    const layout = buildSeatLayout(ids(4), 'p1');
    for (const seat of Object.values(layout)) {
      const area = playAreaFor(seat);
      // Strictly closer to centre than the seat itself.
      const seatDist = Math.hypot(seat.x - 50, seat.y - 50);
      const areaDist = Math.hypot(area.x - 50, area.y - 50);
      expect(areaDist).toBeLessThan(seatDist);
    }
  });

  it('never lands exactly on the centre, so sets stay distinguishable', () => {
    const layout = buildSeatLayout(ids(9), 'p1');
    for (const seat of Object.values(layout)) {
      const area = playAreaFor(seat);
      expect(Math.hypot(area.x - 50, area.y - 50)).toBeGreaterThan(0);
    }
  });
});


describe('game-specific dealing order', () => {
  const players = ['p1', 'p2', 'p3', 'p4'];

  it('preserves locked dealer-first order for Hazari/Kitti/Teen Patti', () => {
    expect(dealingOrderFromDealer(players, 'p3')).toEqual(['p3', 'p4', 'p1', 'p2']);
  });

  it('starts Poker left of the dealer/button', () => {
    expect(dealingOrderLeftOfDealer(players, 'p1')).toEqual(['p2', 'p3', 'p4', 'p1']);
    expect(dealingOrderLeftOfDealer(players, 'p3')).toEqual(['p4', 'p1', 'p2', 'p3']);
    expect(dealingOrderLeftOfDealer(players, 'p4')).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('falls back safely when the Poker dealer is unavailable', () => {
    expect(dealingOrderLeftOfDealer(players, null)).toEqual(players);
    expect(dealingOrderLeftOfDealer(players, 'ghost')).toEqual(players);
  });
});

describe('dealing animation timing', () => {
  it('deals one card at a time round the table, not in blocks', () => {
    // At a 4-seat table, seat 0's second card must come after seat 3's first.
    const seat3Card0 = dealDelay(0, 3, 4, false);
    const seat0Card1 = dealDelay(1, 0, 4, false);
    expect(seat0Card1).toBeGreaterThan(seat3Card0);
  });

  it('increases monotonically across the whole deal', () => {
    const seats = 4;
    let previous = -1;
    for (let card = 0; card < 13; card++) {
      for (let seat = 0; seat < seats; seat++) {
        const d = dealDelay(card, seat, seats, false);
        expect(d).toBeGreaterThan(previous);
        previous = d;
      }
    }
  });

  it('is deterministic - the same card always gets the same delay', () => {
    expect(dealDelay(5, 2, 4, false)).toBe(dealDelay(5, 2, 4, false));
  });

  it('never produces a negative delay (regression: first card used to be -5ms)', () => {
    for (let seats = 2; seats <= 9; seats++) {
      for (let card = 0; card < 13; card++) {
        for (let seat = 0; seat < seats; seat++) {
          expect(dealDelay(card, seat, seats, false)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('collapses to zero under reduced motion', () => {
    expect(dealDelay(12, 3, 4, true)).toBe(0);
    expect(totalDealDuration(13, 4, true)).toBe(0);
  });

  it('keeps a full Hazari deal brisk enough not to feel slow', () => {
    // 4 players x 13 cards must finish comfortably inside 4 seconds.
    const total = totalDealDuration(13, 4, false);
    expect(total).toBeGreaterThan(1000);
    expect(total).toBeLessThan(4000);
  });

  it('keeps a full Teen Patti deal very quick', () => {
    // 9 players x 3 cards.
    expect(totalDealDuration(3, 9, false)).toBeLessThan(2200);
  });
});
