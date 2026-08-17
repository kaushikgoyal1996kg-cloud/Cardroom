// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { DealerDrawReveal, dealerDrawRevealDuration, type DealerDrawRoundView } from './DealerDrawReveal';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const oneRound: DealerDrawRoundView[] = [{
  contenders: ['p1', 'p2', 'p3', 'p4'],
  draws: [
    { playerId: 'p1', card: { id: 'd1', rank: 'K', suit: 'SPADES' } },
    { playerId: 'p2', card: { id: 'd2', rank: 'A', suit: 'HEARTS' } },
    { playerId: 'p3', card: { id: 'd3', rank: '7', suit: 'CLUBS' } },
    { playerId: 'p4', card: { id: 'd4', rank: '10', suit: 'DIAMONDS' } },
  ],
}];

const nameOf = (id: string) => ({ p1: 'Anchal', p2: 'Kaushik', p3: 'Bimal', p4: 'Arvind' }[id] ?? id);

describe('DealerDrawReveal', () => {
  it('keeps the dealer choice visible long enough to read before the normal deal', () => {
    expect(dealerDrawRevealDuration(0)).toBe(0);
    expect(dealerDrawRevealDuration(1)).toBe(1700);
    expect(dealerDrawRevealDuration(2)).toBe(2600);
  });

  it('shows the authoritative high-card winner without exposing hand cards', () => {
    render(<DealerDrawReveal rounds={oneRound} dealerId="p2" nameOf={nameOf} />);
    expect(screen.getByText('Drawing for dealer')).toBeTruthy();
    expect(screen.getByText('Kaushik deals first')).toBeTruthy();
    expect(screen.getByText('Highest card · Ace high')).toBeTruthy();
  });

  it('visibly resolves a tied high-card draw before announcing the dealer', () => {
    vi.useFakeTimers();
    const tied: DealerDrawRoundView[] = [
      {
        ...oneRound[0],
        draws: [
          { playerId: 'p1', card: { id: 't1', rank: 'A', suit: 'SPADES' } },
          { playerId: 'p2', card: { id: 't2', rank: 'A', suit: 'HEARTS' } },
          { playerId: 'p3', card: { id: 't3', rank: '7', suit: 'CLUBS' } },
          { playerId: 'p4', card: { id: 't4', rank: '10', suit: 'DIAMONDS' } },
        ],
      },
      {
        contenders: ['p1', 'p2'],
        draws: [
          { playerId: 'p1', card: { id: 'r1', rank: '9', suit: 'SPADES' } },
          { playerId: 'p2', card: { id: 'r2', rank: 'Q', suit: 'HEARTS' } },
        ],
      },
    ];

    render(<DealerDrawReveal rounds={tied} dealerId="p2" nameOf={nameOf} />);
    expect(screen.getByText('High cards tied — redraw')).toBeTruthy();
    expect(screen.getByText('Anchal & Kaushik draw again')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText('Tie redraw 1')).toBeTruthy();
    expect(screen.getByText('Kaushik deals first')).toBeTruthy();
  });
});
