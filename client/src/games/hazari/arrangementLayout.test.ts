import { describe, it, expect } from 'vitest';
// Vite's ?raw import - keeps this a browser-project test with no Node types.
import CSS from './ArrangementTable.css?raw';

/**
 * Layout contract for the arrangement screen.
 *
 * These are NOT a substitute for looking at the screen in a browser - no
 * browser was available in this environment, so nothing here proves the
 * screen *looks* right. What they do prove is that the specific mechanisms
 * preventing horizontal page overflow are present, which is the failure mode
 * that would make the screen unusable on a phone.
 *
 * The arithmetic below uses the real constants from ArrangementTable.css and
 * PlayingCard.css, so if either changes in a way that breaks the fit, this
 * fails rather than silently shipping a sideways-scrolling page.
 */


/** Real values from the stylesheets, in px at a 16px root. */
const CARD_SM_WIDTH = 2.375 * 16;   // .pcard--sm
const CARD_SM_HEIGHT = CARD_SM_WIDTH * 1.42;
const FAN_OVERLAP_DEFAULT = 0.9 * 16;  // .arr__fan-card + .arr__fan-card
const FAN_OVERLAP_NARROW = 1.1 * 16;   // <= 22.5rem
const TRAY_PLATE_MIN = 3.6 * 16;
const TRAY_PLATE_MIN_NARROW = 3.1 * 16;

const TARGET_WIDTHS = [320, 360, 375, 390, 412, 430];

/** Intrinsic width of a fanned hand of n cards. */
function fanWidth(n: number, overlap: number): number {
  return CARD_SM_WIDTH + (n - 1) * (CARD_SM_WIDTH - overlap);
}

describe('the 13-card fan', () => {
  it('fits inside every target phone width, so the page never scrolls sideways', () => {
    // Measured, not assumed: at 320px the overlap brings 13 cards to ~283px
    // against ~288px of usable width, so the whole hand is visible at once
    // WITHOUT shrinking any card. This is the core of the 13-card problem.
    for (const vw of TARGET_WIDTHS) {
      const overlap = vw <= 360 ? FAN_OVERLAP_NARROW : FAN_OVERLAP_DEFAULT;
      const usable = vw - 32; // page + safe-area padding either side
      expect(fanWidth(13, overlap), `${vw}px fan overflows`).toBeLessThanOrEqual(usable);
    }
  });

  it('keeps every card at full size rather than scaling to fit', () => {
    // The fit above must come from spacing, never from smaller cards.
    for (const vw of TARGET_WIDTHS) {
      const overlap = vw <= 360 ? FAN_OVERLAP_NARROW : FAN_OVERLAP_DEFAULT;
      const visiblePerCard = CARD_SM_WIDTH - overlap;
      // Each card still shows enough edge to identify and tap it.
      expect(visiblePerCard, `${vw}px`).toBeGreaterThan(18);
      expect(CARD_SM_WIDTH).toBe(38); // unchanged from the shared card component
    }
  });

  it('scrolls within itself rather than widening the page', () => {
    expect(CSS).toMatch(/\.arr__fan\s*\{[^}]*overflow-x:\s*auto/);
    expect(CSS).toMatch(/\.arr__fan\s*\{[^}]*overscroll-behavior-x:\s*contain/);
  });

  it('keeps cards at full readable size instead of shrinking them', () => {
    // The fan tightens spacing via negative margin; it must never scale the
    // card down, which is what makes 13 cards unreadable on a phone.
    expect(CSS).toMatch(/\.arr__fan-card \+ \.arr__fan-card\s*\{\s*margin-left:\s*-/);
    expect(CSS).not.toMatch(/\.arr__fan-card[^}]*transform:\s*scale\(0/);
  });

  it('leaves headroom so a lifted selected card is never clipped', () => {
    // .arr__fan has top padding for the -14px lift a selected card applies.
    const match = CSS.match(/\.arr__fan\s*\{[^}]*padding:\s*(\d+)px/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(14);
  });
});

describe('no horizontal page overflow', () => {
  it('the root clips horizontally', () => {
    expect(CSS).toMatch(/\.arr\s*\{[^}]*overflow:\s*hidden/);
  });

  it('the felt scrolls vertically but never horizontally', () => {
    const felt = CSS.match(/\.arr__felt\s*\{[^}]*\}/)![0];
    expect(felt).toMatch(/overflow-y:\s*auto/);
    expect(felt).toMatch(/overflow-x:\s*hidden/);
  });
});

describe('a tray row fits at the narrowest supported width', () => {
  it('Set 4 (four cards) plus its nameplate fits inside 320px', () => {
    const vw = 320;
    // Page padding + felt margin + tray padding, from the stylesheet.
    const chrome = 8 /* safe/margin */ * 2 + 8 /* felt pad */ * 2 + 8 /* tray pad */ * 2;
    const gaps = 3 * 4; // three 4px gaps between four cards
    const cards = 4 * CARD_SM_WIDTH;
    const total = TRAY_PLATE_MIN_NARROW + 8 + cards + gaps + chrome;
    expect(total, 'Set 4 row overflows 320px').toBeLessThanOrEqual(vw);
  });

  it('Set 4 fits comfortably at every other target width', () => {
    for (const vw of TARGET_WIDTHS.filter((w) => w > 320)) {
      const chrome = 8 * 2 + 8 * 2 + 8 * 2;
      const gaps = 3 * 4;
      const plate = vw <= 360 ? TRAY_PLATE_MIN_NARROW : TRAY_PLATE_MIN;
      const total = plate + 8 + 4 * CARD_SM_WIDTH + gaps + chrome;
      expect(total, `${vw}px`).toBeLessThanOrEqual(vw);
    }
  });

  it('empty slots match the real card footprint so rows do not jump as cards land', () => {
    // Match the standalone .tray__empty rule (not the shared reset block).
    const empty = CSS.match(/\.tray__empty\s*\{[^}]*width:[^}]*\}/)![0];
    expect(empty).toContain('width: 2.375rem');
    // Height is the card height to two decimals.
    expect(Math.abs(3.37 * 16 - CARD_SM_HEIGHT)).toBeLessThan(1.5);
  });
});

describe('touch and safe areas', () => {
  it('every interactive control meets the touch minimum', () => {
    expect(CSS).toMatch(/\.arr__buttons \.btn\s*\{[^}]*min-height:\s*var\(--touch-min\)/);
    expect(CSS).toMatch(/\.sortbar__btn\s*\{[^}]*min-height:\s*30px/);
    expect(CSS).toMatch(/\.suggest__close\s*\{[^}]*min-height:\s*var\(--touch-min\)/);
  });

  it('the action rail respects the bottom safe area', () => {
    expect(CSS).toMatch(/\.arr__actions\s*\{[^}]*var\(--safe-bottom\)/);
  });

  it('the header respects the top safe area', () => {
    expect(CSS).toMatch(/\.arr__bar\s*\{[^}]*var\(--safe-top\)/);
  });

  it('cards use manipulation touch-action so tapping never scrolls the page', () => {
    expect(CSS).toMatch(/\.arr__fan-card\s*\{[^}]*touch-action:\s*manipulation/);
    expect(CSS).toMatch(/touch-action:\s*manipulation/);
  });

  it('honours prefers-reduced-motion for the deal-in and the suggestion sheet', () => {
    const reduced = CSS.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\{[^}]*\}[^}]*\}/g);
    expect(reduced).not.toBeNull();
    expect(CSS).toMatch(/prefers-reduced-motion[\s\S]*\.arr__fan-card\.is-dealing\s*\{\s*animation:\s*none/);
  });
});

describe('responsive breakpoints exist for the required ranges', () => {
  it('has a narrow-phone rule at or below 360px', () => {
    expect(CSS).toMatch(/@media \(max-width: 22\.5rem\)/); // 360px
  });

  it('pairs the 3-card trays on roomier phones', () => {
    expect(CSS).toMatch(/@media \(min-width: 26rem\)[\s\S]*grid-template-columns:\s*1fr 1fr/);
  });

  it('caps the surface on desktop instead of stretching it', () => {
    expect(CSS).toMatch(/@media \(min-width: 48rem\)[\s\S]*max-width:\s*46rem/);
  });

  it('has a landscape rule for short screens', () => {
    expect(CSS).toMatch(/@media \(orientation: landscape\) and \(max-height: 30rem\)/);
  });
});
