// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../game/types';
import { KittiArrangement } from './KittiArrangement';

const hand: Card[] = [
  { id: 'AS', rank: 'A', suit: 'SPADES' },
  { id: 'AH', rank: 'A', suit: 'HEARTS' },
  { id: 'AC', rank: 'A', suit: 'CLUBS' },
  { id: 'KS', rank: 'K', suit: 'SPADES' },
  { id: 'QS', rank: 'Q', suit: 'SPADES' },
  { id: 'JS', rank: 'J', suit: 'SPADES' },
  { id: '9H', rank: '9', suit: 'HEARTS' },
  { id: '7C', rank: '7', suit: 'CLUBS' },
  { id: '4D', rank: '4', suit: 'DIAMONDS' },
];

const suggestedIds: [string[], string[], string[]] = [
  ['AS', 'AH', 'AC'],
  ['KS', 'QS', 'JS'],
  ['9H', '7C', '4D'],
];

afterEach(cleanup);

describe('KittiArrangement bot-only assistance', () => {
  it('renders no Suggest control when assistance is unavailable', () => {
    render(<KittiArrangement hand={hand} onConfirm={vi.fn()} canSuggest={false} onSuggest={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /suggest arrangement/i })).toBeNull();
  });

  it('requests a server suggestion and applies the returned own-card groups', async () => {
    const onSuggest = vi.fn().mockResolvedValue({ ok: true, cardIdGroups: suggestedIds });
    const onConfirm = vi.fn();
    render(<KittiArrangement hand={hand} onConfirm={onConfirm} canSuggest onSuggest={onSuggest} />);

    fireEvent.click(screen.getByRole('button', { name: /suggest arrangement/i }));
    await waitFor(() => expect(onSuggest).toHaveBeenCalledTimes(1));

    const confirm = screen.getByRole('button', { name: /confirm arrangement/i });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].map((group: Card[]) => group.map((card) => card.id))).toEqual(suggestedIds);
  });

  it('surfaces a server refusal instead of computing anything locally', async () => {
    const onSuggest = vi.fn().mockResolvedValue({ ok: false, error: 'Arrangement help is only available when you are playing against the computer.' });
    render(<KittiArrangement hand={hand} onConfirm={vi.fn()} canSuggest onSuggest={onSuggest} />);

    fireEvent.click(screen.getByRole('button', { name: /suggest arrangement/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/only available when you are playing against the computer/i);
  });
});
