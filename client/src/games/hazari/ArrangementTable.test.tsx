// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ArrangementTable } from './ArrangementTable';
import { canUseArrangementAssist, type SeatOccupant } from './arrangementAssist';
import type { Card, Rank, Suit } from '../../game/types';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${suit}_${rank}` });
const human = (id: string): SeatOccupant => ({ playerId: id, isBot: false });
const bot = (id: string): SeatOccupant => ({ playerId: id, isBot: true });

const HAND: Card[] = [
  c('A', 'SPADES'), c('K', 'SPADES'), c('Q', 'SPADES'),
  c('9', 'HEARTS'), c('8', 'HEARTS'), c('7', 'HEARTS'),
  c('5', 'CLUBS'), c('4', 'CLUBS'), c('3', 'CLUBS'),
  c('J', 'DIAMONDS'), c('10', 'DIAMONDS'), c('6', 'DIAMONDS'), c('2', 'DIAMONDS'),
];

/** A well-formed server response built from the real hand. */
function serverOptions() {
  return {
    ok: true as const,
    options: [
      {
        label: 'Balanced',
        description: 'A realistic shot at winning several sets.',
        cardIdSets: [
          [HAND[0].id, HAND[1].id, HAND[2].id],
          [HAND[3].id, HAND[4].id, HAND[5].id],
          [HAND[6].id, HAND[7].id, HAND[8].id],
          [HAND[9].id, HAND[10].id, HAND[11].id, HAND[12].id],
        ] as [string[], string[], string[], string[]],
      },
    ],
  };
}

function renderScreen(overrides: Partial<Parameters<typeof ArrangementTable>[0]> = {}) {
  const props = {
    hand: HAND,
    onConfirm: vi.fn(),
    onDismiss: vi.fn(),
    submitError: null,
    canUseAssist: false,
    requestSuggestions: vi.fn(async () => serverOptions()),
    ...overrides,
  };
  render(<ArrangementTable {...props} />);
  return props;
}

beforeEach(() => {
  // The screen plays a sound and vibrates on tap; neither exists in jsdom.
  vi.stubGlobal('AudioContext', undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ============================================================================
// Suggestions must come from the server, never from local computation
// ============================================================================

describe('bot-only play requests suggestions FROM THE SERVER', () => {
  it('shows the Suggest control when assistance is permitted', () => {
    renderScreen({ canUseAssist: true });
    expect(screen.getByRole('button', { name: /suggest/i })).toBeTruthy();
  });

  it('calls the server request rather than computing anything locally', async () => {
    const props = renderScreen({ canUseAssist: true });
    fireEvent.click(screen.getByRole('button', { name: /suggest/i }));

    await waitFor(() => expect(props.requestSuggestions).toHaveBeenCalledTimes(1));
    // No arguments are passed: the server already knows whose hand it is and
    // what their score is. The client cannot influence the computation.
    expect((props.requestSuggestions as ReturnType<typeof vi.fn>).mock.calls[0]).toHaveLength(0);
  });

  it('renders the options the server returned', async () => {
    renderScreen({ canUseAssist: true });
    fireEvent.click(screen.getByRole('button', { name: /suggest/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /suggested arrangements/i })).toBeTruthy();
    });
    expect(screen.getByText('Balanced')).toBeTruthy();
  });

  it('produces NO suggestion at all if the server route is missing', () => {
    // Without a server request function there is no local fallback, because
    // the solver is not imported by this module.
    renderScreen({ canUseAssist: true, requestSuggestions: undefined });
    expect(screen.queryByRole('button', { name: /suggest/i })).toBeNull();
  });

  it('shows the server\'s refusal instead of falling back to a local solve', async () => {
    renderScreen({
      canUseAssist: true,
      requestSuggestions: vi.fn(async () => ({
        ok: false as const,
        error: 'Arrangement help is only available when you are playing against the computer.',
      })),
    });
    fireEvent.click(screen.getByRole('button', { name: /suggest/i }));

    await waitFor(() => {
      expect(screen.getByText(/only available when you are playing against the computer/i)).toBeTruthy();
    });
    // No arrangement was applied - the hand is untouched.
    expect(screen.queryByRole('dialog', { name: /suggested arrangements/i })).toBeNull();
  });

  it('discards a malformed server response rather than inventing cards', async () => {
    renderScreen({
      canUseAssist: true,
      requestSuggestions: vi.fn(async () => ({
        ok: true as const,
        options: [
          {
            label: 'Bogus',
            description: 'Contains a card that was never dealt.',
            cardIdSets: [
              ['SPADES_2', 'SPADES_3', 'SPADES_4'], // none of these are in HAND
              ['x', 'y', 'z'],
              ['p', 'q', 'r'],
              ['a', 'b', 'c', 'd'],
            ] as [string[], string[], string[], string[]],
          },
        ],
      })),
    });
    fireEvent.click(screen.getByRole('button', { name: /suggest/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not get suggestions/i)).toBeTruthy();
    });
    expect(screen.queryByText('Bogus')).toBeNull();
  });
});

// ============================================================================
// Human multiplayer: no request is ever made
// ============================================================================

describe('human multiplayer never requests suggestions', () => {
  it('renders no Suggest control at all', () => {
    renderScreen({ canUseAssist: false });
    expect(screen.queryByRole('button', { name: /suggest/i })).toBeNull();
  });

  it('never calls the server suggestion route', () => {
    const props = renderScreen({ canUseAssist: false });
    // Every button on the screen - none of them triggers a suggestion.
    for (const btn of screen.getAllByRole('button')) fireEvent.click(btn);
    expect(props.requestSuggestions).not.toHaveBeenCalled();
  });

  it('exposes no hidden alternate route to an arrangement', () => {
    renderScreen({ canUseAssist: false });
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/suggest/i);
    expect(text).not.toMatch(/aggressive|balanced alternative/i);
  });

  it('withdraws suggestions already on screen if a human joins mid-hand', async () => {
    const props = {
      hand: HAND,
      onConfirm: vi.fn(),
      onDismiss: vi.fn(),
      submitError: null,
      canUseAssist: true,
      requestSuggestions: vi.fn(async () => serverOptions()),
    };
    const { rerender } = render(<ArrangementTable {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /suggest/i }));
    await waitFor(() => expect(screen.getByText('Balanced')).toBeTruthy());

    // A human takes a bot's seat: assistance is withdrawn.
    rerender(<ArrangementTable {...props} canUseAssist={false} />);
    expect(screen.queryByText('Balanced')).toBeNull();
    expect(screen.queryByRole('button', { name: /suggest/i })).toBeNull();
  });
});

// ============================================================================
// Sorting stays client-side and available against humans
// ============================================================================

describe('sorting remains fully client-side against human opponents', () => {
  const blocked = [human('me'), human('a'), human('b'), human('c')];

  it('all three sort controls are present when assistance is blocked', () => {
    expect(canUseArrangementAssist(blocked, 'me')).toBe(false);
    renderScreen({ canUseAssist: false });
    expect(screen.getByRole('button', { name: 'Rank' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Suit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dealt' })).toBeTruthy();
  });

  it('sorting never contacts the server', () => {
    const props = renderScreen({ canUseAssist: false });
    fireEvent.click(screen.getByRole('button', { name: 'Suit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dealt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rank' }));
    expect(props.requestSuggestions).not.toHaveBeenCalled();
  });

  it('sorting reorders the visible hand without changing which cards are held', () => {
    renderScreen({ canUseAssist: false });
    const cardsFor = () =>
      screen.getAllByRole('img', { hidden: true }).map((el) => el.getAttribute('aria-label'));

    const before = [...cardsFor()].sort();
    fireEvent.click(screen.getByRole('button', { name: 'Suit' }));
    const after = [...cardsFor()].sort();
    expect(after).toEqual(before);
    expect(after.length).toBe(13);
  });

  it('sort selection is announced through aria-pressed', () => {
    renderScreen({ canUseAssist: false });
    fireEvent.click(screen.getByRole('button', { name: 'Suit' }));
    expect(screen.getByRole('button', { name: 'Suit' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Rank' }).getAttribute('aria-pressed')).toBe('false');
  });
});

// ============================================================================
// Manual arrangement is unaffected by the restriction
// ============================================================================

describe('manual arranging works normally when assistance is blocked', () => {
  it('confirm stays disabled until the arrangement is valid', () => {
    renderScreen({ canUseAssist: false });
    const confirm = screen.getByRole('button', { name: /confirm hand/i }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('a card can be picked up and placed into a set', () => {
    renderScreen({ canUseAssist: false });
    // Pick up the first card in hand.
    const firstCard = screen.getAllByRole('button', { name: /of (spades|hearts|diamonds|clubs)/i })[0];
    fireEvent.click(firstCard);
    // Place it into Set 1.
    const target = screen.getAllByRole('button', { name: /place selected card into Set 1/i })[0];
    fireEvent.click(target);
    expect(screen.getByText(/12 left/i)).toBeTruthy();
  });
});
