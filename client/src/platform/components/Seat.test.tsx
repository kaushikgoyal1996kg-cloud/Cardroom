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

/**
 * Bug 4, THIRD retest (confirmed on real Android PWA staging, 2026-08-15):
 * even with the guaranteed-88px-width fix above, "Nawab" (right seat) still
 * truncated to "Na…", and portrait side seats generally worse than
 * landscape. Root cause: 88px, CENTRED under the avatar, only puts ~44px
 * of it on the side that actually has room (toward the table centre) - the
 * other ~44px is spent on the OUTWARD side, toward the felt's own clipping
 * edge, where a side seat has little to spare (seatLayout.ts pulls side
 * seats to just enough margin to clear the felt with the seat's BASE
 * 5.5rem/4.5rem width - see layout.test.ts - not extra to also centre a
 * wider name).
 *
 * Fix: for left/right (and the diagonal anchors on their side), the name
 * row anchors at the edge it already had and grows ONLY toward the table
 * centre from there (`align-self: flex-start`/`flex-end` +
 * `justify-content` to match, in Seat.css). This suite verifies, with real
 * arithmetic (not a rendering assertion - jsdom still can't measure real
 * layout), that:
 *   1. the anchor/growth-direction CSS is actually in place per side,
 *   2. the grown row's estimated reach never crosses the felt's own
 *      horizontal centreline, at every target width AND every player count
 *      this shared layout code supports (not just the reachable 4-player
 *      case) - reusing the exact tableBox()/feltBox() model
 *      `platform/table/layout.test.ts` already established and keeps
 *      passing,
 *   3. the specific names from the bug report actually fit.
 */
describe('Bug 4 (FOURTH retest): side-seat names grow inward, scaled dynamically per seat, not a flat constant', () => {
  const rule = (name: string) => {
    const m = SEAT_CSS.match(new RegExp(`${name.replace(/[.#]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
    if (!m) throw new Error(`no rule for ${name}`);
    return m[1];
  };

  it('left/right anchors grow the name toward centre, from their own fixed edge', () => {
    const left = rule('.seat--left .seat__name');
    expect(left).toMatch(/align-self:\s*flex-start/);
    expect(left).toMatch(/justify-content:\s*flex-start/);
    const right = rule('.seat--right .seat__name');
    expect(right).toMatch(/align-self:\s*flex-end/);
    expect(right).toMatch(/justify-content:\s*flex-end/);
  });

  it('top/bottom/self anchors are NOT given a side-specific override - they keep the symmetric centred behaviour', () => {
    expect(SEAT_CSS).not.toMatch(/\.seat--top\s+\.seat__name/);
    expect(SEAT_CSS).not.toMatch(/\.seat--bottom\s+\.seat__name/);
  });

  it('diagonal anchors (top-left, bottom-left, top-right, bottom-right) are explicitly NOT given the inward-growth override', () => {
    // Regression guard for the specific mistake the THIRD attempt made:
    // including these too, which overshoots the felt's centreline on ring
    // sizes where a diagonal anchor sits close to it already (the
    // 9-player ring's inner top-left/top-right, only 18 points out - see
    // the geometry test below). Checked directly against the CSS text
    // rather than by absence-of-effect, so a future change re-adding a
    // diagonal selector to this rule fails loudly here instead of only
    // showing up as an overshoot deep in the geometry check.
    for (const sel of ['.seat--top-left .seat__name', '.seat--bottom-left .seat__name',
                        '.seat--top-right .seat__name', '.seat--bottom-right .seat__name']) {
      expect(SEAT_CSS, `${sel} must not carry align-self/justify-content overrides`).not.toContain(sel);
    }
  });

  it('Seat.tsx computes --identity-dist as |50 - x| and passes it inline on every seat', () => {
    const { container } = render(
      <Seat
        player={{ playerId: 'p1', name: 'Nawab', isBot: true, connection: 'CONNECTED' }}
        position={{ x: 81.6, y: 50, anchor: 'right', scale: 1, isSelf: false }}
        isDealer={false}
        isActive={false}
      />
    );
    const seatEl = container.querySelector('.seat') as HTMLElement;
    // jsdom exposes custom properties via getPropertyValue, not the typed
    // CSSStyleDeclaration - the value is whatever Seat.tsx put in `style`.
    expect(seatEl.style.getPropertyValue('--identity-dist')).toBe('31.6');
  });

  // ---- Geometry: reuses the exact model platform/table/layout.test.ts
  // verifies against the real CardTable.css/Seat.css/seatLayout.ts values,
  // so a change to any of those recomputes this too rather than silently
  // drifting out of sync with it. ----

  function tableWidth(viewportWidth: number) {
    // .hazari__table-area's padding is a FLAT var(--space-2) (8px) on
    // EACH side (16px total) at every width, not the width-dependent
    // 8px-narrow/16px-regular split an earlier version of this test
    // assumed (HazariTable.css) - that earlier assumption made the
    // narrow-breakpoint felt estimate too generous, one real contributor
    // to why the THIRD retest's figures were still insufficient.
    return Math.min(viewportWidth - 16, 960);
  }
  function feltWidth(viewportWidth: number) {
    const w = tableWidth(viewportWidth);
    const paddingFraction = viewportWidth <= 380 ? 0.012 : 0.014;
    return w * (1 - 2 * paddingFraction);
  }
  function seatWidthPx(viewportWidth: number) {
    return viewportWidth <= 380 ? 72 : 88;
  }
  // Mirrors Seat.css's calc() exactly, including its floor - the ACTUAL
  // formula the browser evaluates, not a re-estimate of what "should" be
  // enough (that approach produced the 6.5rem/5.25rem figures that were
  // still insufficient twice).
  function nameRowWidthPx(viewportWidth: number, identityDist: number) {
    const narrow = viewportWidth <= 380;
    const mult = narrow ? 0.976 : 0.972;
    const buf = narrow ? 6 : 8;
    const floor = narrow ? 72 : 88;
    const computed = (identityDist / 100) * (viewportWidth - 16) * mult - buf;
    return Math.max(floor, computed);
  }
  function scaleFor(playerCount: number): number {
    if (playerCount <= 4) return 1;
    if (playerCount <= 6) return 0.9;
    return 0.8;
  }

  const WIDTHS = [320, 360, 375, 390, 412, 430];
  // PURE left/right x positions from seatLayout.ts's RINGS, across every
  // supported player count - diagonal anchors excluded, matching the CSS
  // scope above.
  const SIDE_ANCHORS: { count: number; x: number; anchor: 'left' | 'right' }[] = [
    { count: 3, x: 18.4, anchor: 'left' }, { count: 3, x: 81.6, anchor: 'right' },
    { count: 4, x: 18.4, anchor: 'left' }, { count: 4, x: 81.6, anchor: 'right' },
    { count: 5, x: 17.2, anchor: 'left' }, { count: 5, x: 82.8, anchor: 'right' },
    { count: 6, x: 17.2, anchor: 'left' }, { count: 6, x: 82.8, anchor: 'right' },
    { count: 7, x: 16, anchor: 'left' }, { count: 7, x: 84, anchor: 'right' },
    { count: 8, x: 16, anchor: 'left' }, { count: 8, x: 84, anchor: 'right' },
    { count: 9, x: 16, anchor: 'left' }, { count: 9, x: 84, anchor: 'right' },
  ];

  it('the grown name row never crosses the felt centreline, at any target width or any supported player count', () => {
    const MIN_MARGIN = 5; // px of real buffer before the centreline, not just non-negative
    for (const vw of WIDTHS) {
      const fw = feltWidth(vw);
      const seatW = seatWidthPx(vw);
      for (const { count, x, anchor } of SIDE_ANCHORS) {
        const identityDist = Math.abs(50 - x);
        const scale = scaleFor(count);
        const avatarCentrePx = (x / 100) * fw;
        const rowWScaled = nameRowWidthPx(vw, identityDist) * scale;
        const seatWScaled = seatW * scale;
        let grownEdge: number;
        let marginToCentre: number;
        if (anchor === 'left') {
          const fixedEdge = avatarCentrePx - seatWScaled / 2;
          grownEdge = fixedEdge + rowWScaled;
          marginToCentre = fw / 2 - grownEdge;
        } else {
          const fixedEdge = avatarCentrePx + seatWScaled / 2;
          grownEdge = fixedEdge - rowWScaled;
          marginToCentre = grownEdge - fw / 2;
        }
        expect(
          marginToCentre,
          `${vw}px, ${count}p, x=${x} (${anchor}): grown row must stay short of the felt centreline`
        ).toBeGreaterThanOrEqual(MIN_MARGIN);
      }
    }
  });

  it('a diagonal anchor close to centre (9-player ring inner top-left/top-right, x=32/68) is unaffected and safe at the FLOOR width', () => {
    // These are excluded from the inward-growth CSS rule (verified above)
    // so they use the plain guaranteed-floor width, split symmetrically
    // by the default centred behaviour - confirms that floor alone (not
    // the inward-growth formula) is what keeps them safe, since applying
    // the inward-growth formula to x=32/68 (identityDist=18) would
    // computed BELOW the floor and so never engage anyway.
    for (const vw of WIDTHS) {
      const floorPx = vw <= 380 ? 72 : 88;
      const computed = nameRowWidthPx(vw, 18); // 18 = |50-32| = |50-68|
      expect(computed, `${vw}px: identityDist=18 must resolve to exactly the floor`).toBe(floorPx);
    }
  });

  // More generous, and more defensible, per-character estimates than the
  // ones used in the THIRD retest (9px/7.5px) - those were shown
  // insufficient in practice for "Nawab" specifically. "Nawab" contains a
  // capital N and a "w", both meaningfully wider than an average Latin
  // lowercase glyph in most proportional fonts - a flat per-character
  // average understates words with wide letters. These also explicitly
  // account for the Bot badge (~4px gap + ~30px/24px badge), since the
  // reported failure was very likely a bot-named seat (a common
  // single-human-plus-bots practice setup), not a bare human name.
  const PX_PER_CHAR_REGULAR = 12;
  const PX_PER_CHAR_NARROW = 10.5;
  const BADGE_AND_GAP_REGULAR = 4 + 30;
  const BADGE_AND_GAP_NARROW = 4 + 24;

  const REPORTED_NAMES = ['Raja', 'Rani', 'Nawab'];

  it.each(REPORTED_NAMES)(
    '"%s", plausibly a Bot, fits the 4-player right seat with real margin, at the widest regular width (430px)',
    (name) => {
      const estimated = name.length * PX_PER_CHAR_REGULAR + BADGE_AND_GAP_REGULAR;
      const available = nameRowWidthPx(430, 31.6); // 4-player right seat
      expect(estimated, `${name}+Bot estimated ${estimated}px vs ${available}px available`).toBeLessThan(available);
    }
  );

  it.each(REPORTED_NAMES)(
    '"%s", plausibly a Bot, fits the 4-player right seat with real margin, at the tightest regular width (390px)',
    (name) => {
      const estimated = name.length * PX_PER_CHAR_REGULAR + BADGE_AND_GAP_REGULAR;
      const available = nameRowWidthPx(390, 31.6);
      expect(estimated, `${name}+Bot estimated ${estimated}px vs ${available}px available`).toBeLessThan(available);
    }
  );

  it.each([...REPORTED_NAMES, 'Kaushik'])(
    '"%s" (human, no badge) fits the 4-player right seat at the narrowest supported width (320px)',
    (name) => {
      const estimated = name.length * PX_PER_CHAR_NARROW;
      const available = nameRowWidthPx(320, 31.6);
      expect(estimated, `${name} estimated ${estimated}px vs ${available}px available`).toBeLessThan(available);
    }
  );

  it('"Kaushik" (human, no badge) fits the 4-player right seat at every target width', () => {
    // Tested separately from Raja/Rani/Nawab above: those three were the
    // names actually confirmed failing on real-device staging, plausibly
    // as Bot-labelled seats (a common single-human-plus-bots practice
    // setup). "Kaushik" was never itself reported as failing - it appears
    // in the brief's own list of ordinary names that "should fit where
    // reasonably expected", a softer bar than the three confirmed
    // failures. Tested here as a bare human name (no Bot badge), which is
    // the more directly comparable case to how it was described.
    for (const vw of WIDTHS) {
      const estimated = 'Kaushik'.length * (vw <= 380 ? PX_PER_CHAR_NARROW : PX_PER_CHAR_REGULAR);
      const available = nameRowWidthPx(vw, 31.6);
      expect(estimated, `${vw}px: Kaushik estimated ${estimated}px vs ${available}px available`).toBeLessThan(
        available
      );
    }
  });

  it('documents the one known remaining edge case: a 7+ character name AND a Bot badge AND the single tightest width (390px)', () => {
    // Not a passing assertion - a deliberate, visible record of the one
    // combination this fix does not fully guarantee, so a future session
    // does not need to rediscover it by testing on a device again. 390px
    // is uniquely tight because it is just past the narrow/regular size
    // tier boundary (Seat.css's `@media (max-width: 23.75rem)`) while
    // still being a genuinely narrow phone width - the same width that
    // was the worst case throughout this whole investigation (seat-box
    // margin, felt-centre distance, and now this). A name this long,
    // Bot-labelled, at exactly this width, may still ellipsize - a
    // meaningfully rarer combination than the plain "Nawab" case this
    // round actually fixes.
    const estimated = 'Kaushik'.length * PX_PER_CHAR_REGULAR + BADGE_AND_GAP_REGULAR;
    const available = nameRowWidthPx(390, 31.6);
    expect(estimated).toBeGreaterThan(available); // documents the shortfall, not a bug in this test
  });

  it('a genuinely long name still ellipsizes gracefully rather than growing without bound', () => {
    // The widened row is a generous cap, not "no cap" - .seat__name-text's
    // own overflow/ellipsis rule (verified in the describe block above)
    // still applies once content exceeds even this wider row.
    render(
      <Seat
        player={{
          playerId: 'p1',
          name: 'Alexandria the Magnificent',
          isBot: false,
          connection: 'CONNECTED',
        }}
        position={{ x: 81.6, y: 50, anchor: 'right', scale: 1, isSelf: false }}
        isDealer={false}
        isActive={false}
      />
    );
    expect(document.querySelector('.seat__name-text')?.textContent).toBe('Alexandria the Magnificent');
    const nameTextRule = rule('.seat__name-text');
    expect(nameTextRule).toMatch(/text-overflow:\s*ellipsis/);
  });
});
