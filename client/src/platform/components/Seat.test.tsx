// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Seat } from './Seat';
import type { SeatPosition } from '../table/seatLayout';
import SEAT_CSS from './Seat.css?raw';

/**
 * Bug 4 (confirmed on real Android PWA staging): player names clipped
 * unpredictably and the Bot badge crowded into them. Root cause: `.seat__name`
 * was `display: flex` with `text-overflow: ellipsis` applied to the
 * CONTAINER, but the player's name was a bare text node sitting as a flex
 * item alongside the Bot tag - ellipsis does not reliably apply that way in
 * flexbox (a well-documented CSS gotcha, not a guess); the browser just
 * hard-clips both flex items unpredictably once the row overflows.
 *
 * jsdom does not compute real layout/truncation, so this can't literally
 * assert "the text visually truncates" - what it CAN verify, and what
 * actually matters for this to work at all, is (a) the correct DOM shape
 * (name text and Bot tag are separate flex siblings, not one merged text
 * run) and (b) the CSS actually applies overflow/ellipsis/min-width:0 to
 * the name text specifically, not to the row.
 */

const basePosition: SeatPosition = { x: 90, y: 50, anchor: 'right', scale: 1, isSelf: false };

afterEach(cleanup);

describe('Seat name / Bot badge composition', () => {
  it('renders the name text in its own element, separate from the Bot tag', () => {
    render(
      <Seat
        player={{ playerId: 'p1', name: 'Alexandria the Magnificent', isBot: true, connection: 'CONNECTED' }}
        position={basePosition}
        isDealer={false}
        isActive={false}
      />
    );

    const nameEl = document.querySelector('.seat__name-text');
    expect(nameEl).not.toBeNull();
    expect(nameEl!.textContent).toBe('Alexandria the Magnificent');

    const tagEl = document.querySelector('.seat__tag--bot');
    expect(tagEl).not.toBeNull();
    expect(tagEl!.textContent).toBe('Bot');

    // Structurally separate siblings, not one nested inside the other -
    // nesting would defeat the CSS fix (only a flex ITEM can independently
    // ellipsis; a descendant of one can't shrink the item around it).
    expect(nameEl!.parentElement).toBe(tagEl!.parentElement);
    expect(nameEl!.contains(tagEl)).toBe(false);
    expect(tagEl!.contains(nameEl)).toBe(false);
  });

  it('a human player (no Bot tag) still gets the name wrapped for truncation', () => {
    render(
      <Seat
        player={{ playerId: 'p1', name: 'Kaushik', isBot: false, connection: 'CONNECTED' }}
        position={basePosition}
        isDealer={false}
        isActive={false}
      />
    );
    expect(document.querySelector('.seat__name-text')?.textContent).toBe('Kaushik');
    expect(document.querySelector('.seat__tag--bot')).toBeNull();
  });

  it('the full name is still present in the accessible screen-reader summary, even though it is visually truncatable', () => {
    render(
      <Seat
        player={{ playerId: 'p1', name: 'Alexandria the Magnificent', isBot: true, connection: 'CONNECTED' }}
        position={basePosition}
        isDealer={false}
        isActive={false}
      />
    );
    expect(screen.getByText(/Alexandria the Magnificent, computer player/)).toBeTruthy();
  });

  it('.seat__name-text (not the row) carries overflow/ellipsis/white-space, with min-width:0 so it can actually shrink', () => {
    const rule = (name: string) => {
      const m = SEAT_CSS.match(new RegExp(`${name.replace(/[.#]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
      if (!m) throw new Error(`no rule for ${name}`);
      return m[1];
    };

    const nameTextRule = rule('.seat__name-text');
    expect(nameTextRule).toMatch(/overflow:\s*hidden/);
    expect(nameTextRule).toMatch(/text-overflow:\s*ellipsis/);
    expect(nameTextRule).toMatch(/white-space:\s*nowrap/);
    // The specific, easy-to-forget fix: flex items default to
    // min-width: auto, which silently prevents them from ever shrinking
    // past their content's natural width - defeating ellipsis entirely.
    expect(nameTextRule).toMatch(/min-width:\s*0/);

    // The ROW must NOT carry these - that was the actual bug, and leaving
    // them there again would silently reintroduce it even with the text
    // properly wrapped.
    const rowRule = rule('.seat__name');
    expect(rowRule).not.toMatch(/text-overflow/);
  });

  it('the Bot tag keeps a fixed size and is never the one asked to shrink', () => {
    const m = SEAT_CSS.match(/\.seat__tag\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/flex:\s*0\s+0\s+auto/);
  });
});
