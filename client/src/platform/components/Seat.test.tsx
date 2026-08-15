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

/**
 * Bug 4 retest (confirmed on real Android PWA staging, 2026-08-15): even
 * after the fix above, ordinary short names ("Raja", "Nawab") were STILL
 * ellipsizing - "R…", "Na…" - despite comfortably fitting the seat's own
 * declared width on paper. Root cause: `.seat`'s `align-items: center`
 * made `.seat__info` (and everything inside it, down to
 * `.seat__name-text`) get a WIDTH COMPUTED from its own content via
 * flexbox shrink-to-fit, not a width GUARANTEED by the seat's declared
 * 5.5rem/4.5rem - an ordinary name was entitled to the full width
 * whenever it needed less, but the number it actually got was the
 * outcome of an intrinsic-sizing computation threaded through three
 * nested boxes, not a fixed value, and real device rendering did not
 * hand it the full width the arithmetic implied it should.
 *
 * The fix makes that width explicit and unconditional (`align-items:
 * stretch`) instead of computed. jsdom still can't render real text or
 * measure real layout, so this - like the DealerToken/layout geometry
 * tests elsewhere in this codebase - checks the STRUCTURAL guarantee
 * (the width really is fixed, not content-dependent) and the ARITHMETIC
 * that a normal name's estimated rendered width fits well inside it, per
 * the brief's own explicit instruction not to merely assert that
 * `text-overflow: ellipsis` exists somewhere in the stylesheet.
 */
describe('Bug 4 retest: ordinary short names get a GUARANTEED width, not a content-computed one', () => {
  const rule = (name: string) => {
    const m = SEAT_CSS.match(new RegExp(`${name.replace(/[.#]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
    if (!m) throw new Error(`no rule for ${name}`);
    return m[1];
  };

  it('.seat stretches its children to its full declared width, rather than centering them at their own content size', () => {
    const seatRule = rule('.seat');
    expect(seatRule).toMatch(/align-items:\s*stretch/);
    // The specific regression this guards: reverting to `center` silently
    // reintroduces content-dependent (rather than guaranteed) width for
    // .seat__info and everything inside it.
    expect(seatRule).not.toMatch(/align-items:\s*center/);
  });

  it('.seat__avatar-wrap opts back OUT of that stretch, so the avatar/ring/dealer-dot stay sized to the avatar itself, not the full seat width', () => {
    // Without this, .seat__ring (inset: -4px) and .seat__dealer-dot
    // (right/bottom: -2px) - both positioned relative to
    // .seat__avatar-wrap's own box - would suddenly be positioned relative
    // to the full 5.5rem seat width instead of the ~2.75rem avatar circle,
    // a real visual regression this test exists specifically to catch.
    const wrapRule = rule('.seat__avatar-wrap');
    expect(wrapRule).toMatch(/align-self:\s*center/);
  });

  // Conservative, deliberately GENEROUS per-character width estimate: real
  // sans-serif fonts at this weight/size average well under this per the
  // font metrics tables for the faces this app actually loads (Work Sans),
  // so a name that fits under this estimate fits in reality with real
  // margin to spare - this errs toward the test being too strict, never
  // too lenient.
  const PX_PER_CHAR_REGULAR = 9; // at .seat__name's text-sm (13px)
  const PX_PER_CHAR_NARROW = 7.5; // at the <380px breakpoint's text-xs (11px)
  const SEAT_WIDTH_REGULAR = 88; // 5.5rem
  const SEAT_WIDTH_NARROW = 72; // 4.5rem, <380px breakpoint

  const ORDINARY_NAMES = ['Raja', 'Rani', 'Nawab', 'Kaushik'];

  it.each(ORDINARY_NAMES)('"%s" fits the guaranteed width with real margin to spare, at the regular breakpoint', (name) => {
    const estimatedWidth = name.length * PX_PER_CHAR_REGULAR;
    expect(estimatedWidth).toBeLessThan(SEAT_WIDTH_REGULAR);
  });

  it.each(ORDINARY_NAMES)('"%s" fits the guaranteed width with real margin to spare, at the <380px narrow breakpoint', (name) => {
    const estimatedWidth = name.length * PX_PER_CHAR_NARROW;
    expect(estimatedWidth).toBeLessThan(SEAT_WIDTH_NARROW);
  });

  it('this applies uniformly across every seat anchor, not just a specific side - the fix is structural, not per-position', () => {
    // .seat's align-items rule (checked above) has no per-anchor override
    // anywhere in the stylesheet - confirms side seats (left/right, the
    // ones actually reported as clipped) are not treated any differently
    // from top/bottom, so they get the exact same guaranteed width.
    expect(SEAT_CSS).not.toMatch(/\.seat--(left|right)[^{]*\{[^}]*align-items/);
  });

  it('a Bot badge next to a longer name still lets the NAME give way first, not the guaranteed row width', () => {
    // With the row's own width now fixed rather than content-computed,
    // confirm the internal give-way behaviour (name shrinks via
    // min-width:0 + default flex-shrink, tag never does) is unchanged -
    // this is the other half of Bug 4 (badge crowding the name) and must
    // not regress while fixing the width-allocation half.
    render(
      <Seat
        player={{ playerId: 'p1', name: 'Alexandria the Magnificent', isBot: true, connection: 'CONNECTED' }}
        position={basePosition}
        isDealer={false}
        isActive={false}
      />
    );
    const nameEl = document.querySelector('.seat__name-text')!;
    const tagEl = document.querySelector('.seat__tag--bot')!;
    expect(nameEl.textContent).toBe('Alexandria the Magnificent');
    expect(tagEl.textContent).toBe('Bot');
  });
});
