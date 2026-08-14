// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CardTable, type PlayedSetView } from '../../platform/components/CardTable';
import type { SeatPlayer } from '../../platform/components/Seat';
import type { CardData } from '../../platform/components/PlayingCard';
import { dealDelay, totalDealDuration, playAreaFor, buildSeatLayout } from '../../platform/table/seatLayout';

const seats: SeatPlayer[] = ['p1', 'p2', 'p3', 'p4'].map((id, i) => ({
  playerId: id,
  name: `Player ${i + 1}`,
  isBot: false,
  connection: 'CONNECTED' as const,
}));

const card = (id: string): CardData => ({
  id,
  rank: 'A',
  suit: 'SPADES',
});

afterEach(cleanup);

describe('dealing animation', () => {
  it('renders one face-down card per player per dealt card', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" dealing dealCardsEach={13} />
    );
    // 4 players x 13 cards.
    expect(container.querySelectorAll('.table__dealt')).toHaveLength(52);
  });

  it('deals nothing when not dealing', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" dealCardsEach={13} />
    );
    expect(container.querySelectorAll('.table__dealt')).toHaveLength(0);
  });

  it('shows the deck at the centre while dealing', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" dealing dealCardsEach={13} />
    );
    expect(container.querySelectorAll('.table__deck-card').length).toBeGreaterThan(0);
  });

  it('reveals NO card faces - every dealt card is face down', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" dealing dealCardsEach={13} />
    );
    // A face-up PlayingCard carries role="img" with a rank/suit label.
    for (const el of container.querySelectorAll('.table__dealt')) {
      expect(el.querySelector('.pcard--back')).not.toBeNull();
      expect(el.querySelector('[role="img"]')).toBeNull();
    }
    // And no rank text is rendered anywhere in the deal layer.
    expect(container.textContent).not.toMatch(/[AKQJ]|10/);
  });

  it('staggers cards one at a time round the table', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" dealing dealCardsEach={3} />
    );
    const delays = [...container.querySelectorAll('.table__dealt')].map((el) =>
      (el as HTMLElement).style.getPropertyValue('--deal-delay')
    );
    expect(new Set(delays).size).toBe(delays.length); // all distinct
    expect(delays.every((d) => d.endsWith('ms'))).toBe(true);
  });

  it('a full Hazari deal stays brisk', () => {
    expect(totalDealDuration(13, 4, false)).toBeLessThan(4000);
  });

  it('collapses to zero under reduced motion', () => {
    expect(dealDelay(12, 3, 4, true)).toBe(0);
    expect(totalDealDuration(13, 4, true)).toBe(0);
  });

  it('cards travel toward each seat, not all to one place', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" dealing dealCardsEach={1} />
    );
    const positions = [...container.querySelectorAll('.table__dealt')].map(
      (el) => `${(el as HTMLElement).style.left},${(el as HTMLElement).style.top}`
    );
    expect(new Set(positions).size).toBe(4);
  });
});

describe('card play travel', () => {
  const played: PlayedSetView[] = [
    { playerId: 'p2', cards: [card('a'), card('b'), card('c')], arriving: true },
  ];

  it('marks a newly arriving set so it animates', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" playedSets={played} />
    );
    expect(container.querySelector('.table__played.is-arriving')).not.toBeNull();
  });

  it('does NOT animate a set that was already on the table', () => {
    const restored: PlayedSetView[] = [
      { playerId: 'p2', cards: [card('a'), card('b'), card('c')], arriving: false },
    ];
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" playedSets={restored} />
    );
    expect(container.querySelector('.table__played')).not.toBeNull();
    expect(container.querySelector('.table__played.is-arriving')).toBeNull();
  });

  it('originates from the throwing player\'s own seat', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" playedSets={played} />
    );
    const el = container.querySelector('.table__played') as HTMLElement;
    const layout = buildSeatLayout(seats.map((s) => s.playerId), 'p1');
    const seat = layout.p2;
    const area = playAreaFor(seat);

    // The travel origin is the offset from the landing spot back to the seat.
    expect(el.style.getPropertyValue('--play-from-x')).toBe(`${seat.x - area.x}%`);
    expect(el.style.getPropertyValue('--play-from-y')).toBe(`${seat.y - area.y}%`);
  });

  it('the local player\'s set originates from the bottom seat', () => {
    const mine: PlayedSetView[] = [
      { playerId: 'p1', cards: [card('a'), card('b'), card('c')], arriving: true },
    ];
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" playedSets={mine} />
    );
    const el = container.querySelector('.table__played') as HTMLElement;
    const layout = buildSeatLayout(seats.map((s) => s.playerId), 'p1');
    expect(layout.p1.anchor).toBe('bottom');
    // Origin is below the landing area, i.e. a positive downward offset.
    const fromY = parseFloat(el.style.getPropertyValue('--play-from-y'));
    expect(fromY).toBeGreaterThan(0);
  });

  it('each set lands in front of its own seat, never stacked in one spot', () => {
    const many: PlayedSetView[] = seats.map((s) => ({
      playerId: s.playerId,
      cards: [card(`${s.playerId}-1`)],
    }));
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" playedSets={many} />
    );
    const spots = [...container.querySelectorAll('.table__played')].map(
      (el) => `${(el as HTMLElement).style.left},${(el as HTMLElement).style.top}`
    );
    expect(new Set(spots).size).toBe(4);
  });

  it('highlights the winning set', () => {
    const withWinner: PlayedSetView[] = [
      { playerId: 'p2', cards: [card('a')], winning: true },
    ];
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" playedSets={withWinner} />
    );
    expect(container.querySelector('.table__played.is-winning')).not.toBeNull();
  });
});

describe('animation is cosmetic only', () => {
  it('the dealing layer receives no card data at all', () => {
    // CardTable's dealing branch renders PlayingCard with `faceDown` and no
    // `card` prop, so there is no path by which a hand could leak here.
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" dealing dealCardsEach={13} />
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/aria-label="[a-z]+ of (spades|hearts|diamonds|clubs)"/i);
  });

  it('the table renders correctly with dealing off and no played sets', () => {
    const { container } = render(
      <CardTable players={seats} selfId="p1" dealerId="p1" centreLabel="Your turn" />
    );
    expect(screen.getByText('Your turn')).toBeTruthy();
    expect(container.querySelectorAll('.table__dealt')).toHaveLength(0);
  });
});
