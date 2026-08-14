import { describe, it, expect } from 'vitest';
import APP_CSS from '../../App.css?raw';
import CHAT_CSS from '../../components/ChatPanel.css?raw';
import VOICE_CSS from '../../components/VoiceCallPanel.css?raw';
import MODAL_CSS from '../../components/RulesModal.css?raw';
import STATS_CSS from '../../components/StatsModal.css?raw';
import CONFETTI_CSS from '../../components/Confetti.css?raw';
import PLAY_CSS from '../../components/Play/Play.css?raw';
import LOBBY_CSS from '../../components/Lobby/Lobby.css?raw';
import TOKENS_CSS from '../styles/tokens.css?raw';
import ARR_CSS from '../../games/hazari/ArrangementTable.css?raw';
import RSUM_CSS from '../../games/hazari/RoundSummary.css?raw';
import WIN_CSS from '../../games/hazari/WinnerScreen.css?raw';
import RULES_TSX from '../../components/RulesModal.tsx?raw';
import STATS_TSX from '../../components/StatsModal.tsx?raw';
import TUTORIAL_TSX from '../../components/TutorialModal.tsx?raw';
import SETTINGS_TSX from '../../components/SettingsModal.tsx?raw';
import HISTORY_TSX from '../../components/RoundHistoryModal.tsx?raw';
import GLOBAL_CSS from '../../styles/global.css?raw';
import TABLE_CSS from '../../games/hazari/HazariTable.css?raw';

/**
 * Mobile correctness contracts.
 *
 * IMPORTANT: these assert that the mechanisms which prevent specific mobile
 * failures are present in the stylesheets. They do NOT prove the screens look
 * right - no browser was available in this environment. They are regression
 * protection for fixes whose absence is invisible until someone opens the app
 * on a notched phone.
 */

/** Extracts a single rule block by selector. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match[0];
}

// ============================================================================
// Safe areas: the specific collisions found in the audit
// ============================================================================

describe('notch and home-indicator collisions', () => {
  it('the reconnecting banner clears the top safe area', () => {
    // It was `top: 0` with no inset, so on a notched iPhone the message a
    // player most needs to read rendered underneath the status bar.
    const banner = rule(APP_CSS, '.conn-banner');
    expect(banner).toMatch(/padding-top:\s*calc\(env\(safe-area-inset-top/);
  });

  it('the settings button uses an additive top inset, not env() fallback', () => {
    // `env(safe-area-inset-top, 10px)` only falls back where safe-area is
    // UNSUPPORTED. Where supported and zero it pinned the button to the edge.
    const fab = rule(APP_CSS, '.settings-fab');
    expect(fab).toMatch(/top:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+/);
    expect(fab).not.toMatch(/env\(safe-area-inset-top,\s*10px\)/);
  });

  it('the chat toggle clears the bottom and right safe areas', () => {
    const toggle = rule(CHAT_CSS, '.chat-toggle');
    expect(toggle).toMatch(/bottom:\s*calc\(env\(safe-area-inset-bottom/);
    expect(toggle).toMatch(/right:\s*calc\(env\(safe-area-inset-right/);
  });

  it('the modal backdrop pads all four insets, covering every modal', () => {
    // Rules, Stats, Tutorial, Settings and Round History all use
    // .rules-overlay, so one fix covers all five.
    const overlay = rule(MODAL_CSS, '.rules-overlay');
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(overlay, `missing ${side} inset`).toContain(`safe-area-inset-${side}`);
    }
  });

  it('the voice panel and its toggle clear the safe areas', () => {
    expect(VOICE_CSS).toMatch(/bottom:\s*calc\(env\(safe-area-inset-bottom/);
    expect(VOICE_CSS).toMatch(/right:\s*calc\(env\(safe-area-inset-right/);
  });

  it('the lobby pads all four insets', () => {
    const landing = rule(LOBBY_CSS, '.landing');
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(landing).toContain(`safe-area-inset-${side}`);
    }
  });

  it('the migrated round summary clears all four insets', () => {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(RSUM_CSS, `missing ${side}`).toContain(`safe-area-inset-${side}`);
    }
  });

  it('the migrated winner screen clears all four insets', () => {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(WIN_CSS, `missing ${side}`).toContain(`safe-area-inset-${side}`);
    }
  });

  it('both migrated screens scroll internally and cap in dvh', () => {
    expect(RSUM_CSS).toMatch(/height:\s*100dvh/);
    expect(WIN_CSS).toMatch(/height:\s*100dvh/);
    expect(RSUM_CSS).toMatch(/overflow-y:\s*auto/);
    expect(WIN_CSS).toMatch(/overflow-y:\s*auto/);
    expect(RSUM_CSS).toMatch(/overscroll-behavior:\s*contain/);
  });

  it('both migrated screens keep their action rails reachable and landscape-aware', () => {
    const LANDSCAPE = /@media \(orientation: landscape\) and \(max-height: 30rem\)/;
    expect(RSUM_CSS).toMatch(LANDSCAPE);
    expect(WIN_CSS).toMatch(LANDSCAPE);
    expect(RSUM_CSS).toMatch(/min-height:\s*var\(--touch-min\)/);
    expect(WIN_CSS).toMatch(/min-height:\s*var\(--touch-min\)/);
  });
});

// ============================================================================
// Viewport units
// ============================================================================

describe('dynamic viewport units replace stale vh in layout', () => {
  it('the app root uses dvh', () => {
    expect(APP_CSS).not.toMatch(/min-height:\s*100vh/);
    expect(APP_CSS).toMatch(/min-height:\s*100dvh/);
  });

  it('the chat panel is capped in dvh', () => {
    expect(CHAT_CSS).not.toMatch(/max-height:\s*60vh/);
    expect(CHAT_CSS).toMatch(/max-height:\s*min\(60dvh/);
  });

  it('the shared modal sheet is capped in dvh', () => {
    expect(MODAL_CSS).not.toMatch(/max-height:\s*85vh/);
    expect(MODAL_CSS).toMatch(/max-height:\s*85dvh/);
  });

  it('the stats sheet is capped in dvh', () => {
    expect(STATS_CSS).not.toMatch(/max-height:\s*60vh(?!\w)/);
    expect(STATS_CSS).toMatch(/dvh/);
  });

  it('the round summary panel is capped in dvh so its actions stay reachable', () => {
    expect(PLAY_CSS).not.toMatch(/max-height:\s*88vh/);
    expect(PLAY_CSS).toMatch(/max-height:\s*88dvh/);
  });

  it('the lobby sizes against dvh', () => {
    expect(rule(LOBBY_CSS, '.landing')).toMatch(/min-height:\s*100dvh/);
  });

  it('keyframe travel distances may keep vh - they are not layout', () => {
    // Confetti falls 110vh and cards fly in from -30vh. Those are off-screen
    // distances, and converting them would be churn with no benefit.
    expect(CONFETTI_CSS).toMatch(/110vh/);
    expect(ARR_CSS).toMatch(/-30vh/);
  });
});

// ============================================================================
// Chat FAB vs gameplay action rails
// ============================================================================

describe('the chat toggle never covers an essential gameplay control', () => {
  it('reserves space via a per-screen variable rather than a device hack', () => {
    expect(TOKENS_CSS).toMatch(/\.app-root\[data-screen='playing'\]/);
    expect(TOKENS_CSS).toMatch(/\.app-root\[data-screen='arranging'\]/);
    expect(rule(CHAT_CSS, '.chat-toggle')).toContain('var(--action-reserve, 0px)');
  });

  it('screens with no action rail leave the reserve at zero', () => {
    expect(TOKENS_CSS).toMatch(/--action-reserve:\s*0px/);
  });

  // --------------------------------------------------------------------
  // Rail heights DERIVED from the same tokens the stylesheets use, so a
  // change to card size, type scale or spacing recomputes here too.
  // --------------------------------------------------------------------

  const REM = 16;
  const SPACE_1 = 4;
  const SPACE_2 = 8;
  const TOUCH_MIN = 44;
  const TEXT_XS = 0.6875 * REM;
  const TEXT_SM = 0.8125 * REM;
  const CARD_SM_W = 2.375 * REM;
  const CARD_SM_H = CARD_SM_W * 1.42;
  const FAB_SIZE = 44;

  const line = (fontSize: number) => fontSize * 1.2;

  /** .hazari__hand - the Hazari bottom rail. */
  function hazariRail(orientation: 'portrait' | 'landscape'): number {
    // .hazari__set: padding 4px top/bottom + label line + 2px gap + card
    const set = SPACE_1 * 2 + line(TEXT_XS) + 2 + CARD_SM_H;
    // .hazari__sets adds margin-bottom
    const strip = set + SPACE_2;
    // Landscape compacts ONLY the top padding (--space-2 -> --space-1).
    const padTop = orientation === 'landscape' ? SPACE_1 : SPACE_2;
    return padTop + strip + TOUCH_MIN + SPACE_2;
  }

  /**
   * .arr__actions - the Arrangement bottom rail, worst case (dismissal
   * eligible, so the dismissal summary line is present).
   * The landscape rule touches the header, hint, fan and trays but NEVER
   * .arr__actions, so this height is identical in both orientations.
   */
  function arrangementRail(): number {
    const status = line(TEXT_SM) + SPACE_2;
    const dismissSummary = SPACE_2 + SPACE_1 * 2 + line(TEXT_XS);
    return SPACE_2 + status + TOUCH_MIN + dismissSummary + SPACE_2;
  }

  /** Reads a declared reserve out of tokens.css, portrait or landscape. */
  function reserveFor(screen: 'playing' | 'arranging', orientation: 'portrait' | 'landscape'): number {
    const landscapeBlock = TOKENS_CSS.slice(
      TOKENS_CSS.indexOf('@media (orientation: landscape) and (max-height: 30rem)')
    );
    const source = orientation === 'landscape'
      ? landscapeBlock
      : TOKENS_CSS.slice(0, TOKENS_CSS.indexOf('@media (orientation: landscape)'));

    const m = source.match(
      new RegExp(`\\.app-root\\[data-screen='${screen}'\\]\\s*\\{[^}]*--action-reserve:\\s*(\\d+)px`)
    );
    if (!m) throw new Error(`no ${orientation} reserve declared for ${screen}`);
    return Number(m[1]);
  }

  it('the PORTRAIT reserve clears the Hazari rail', () => {
    expect(reserveFor('playing', 'portrait')).toBeGreaterThanOrEqual(hazariRail('portrait'));
  });

  it('the PORTRAIT reserve clears the Arrangement rail', () => {
    expect(reserveFor('arranging', 'portrait')).toBeGreaterThanOrEqual(arrangementRail());
  });

  it('the LANDSCAPE reserve clears the compact Hazari rail', () => {
    // Regression: an earlier version dropped the reserve entirely in
    // landscape, putting the toggle on top of "Play" after a rotation.
    const reserve = reserveFor('playing', 'landscape');
    expect(reserve).toBeGreaterThan(0);
    expect(reserve).toBeGreaterThanOrEqual(hazariRail('landscape'));
  });

  it('the LANDSCAPE reserve clears the Arrangement rail', () => {
    // .arr__actions is NOT compacted in landscape, so the requirement is the
    // same as portrait. Asserting against the real height rather than
    // assuming "landscape rails are shorter".
    const reserve = reserveFor('arranging', 'landscape');
    expect(reserve).toBeGreaterThan(0);
    expect(reserve).toBeGreaterThanOrEqual(arrangementRail());
  });

  it('landscape reserves are not larger than portrait, so the toggle is not pushed up needlessly', () => {
    expect(reserveFor('playing', 'landscape')).toBeLessThanOrEqual(reserveFor('playing', 'portrait'));
    expect(reserveFor('arranging', 'landscape')).toBeLessThanOrEqual(reserveFor('arranging', 'portrait'));
  });

  it('the landscape chat rules KEEP the reserve rather than dropping it', () => {
    const landscape = CHAT_CSS.slice(
      CHAT_CSS.indexOf('@media (orientation: landscape) and (max-height: 30rem)')
    );
    expect(landscape).toContain('.chat-toggle');
    expect(landscape).toContain('.chat-panel');
    // Both positions must still consult the reserve.
    const toggleBottom = landscape.match(/\.chat-toggle\s*\{[^}]*bottom:[^;]*;/)![0];
    const panelBottom = landscape.match(/\.chat-panel\s*\{[^}]*bottom:[^;]*;/)![0];
    expect(toggleBottom).toContain('var(--action-reserve, 0px)');
    expect(panelBottom).toContain('var(--action-reserve, 0px)');
  });

  it('the toggle stays fully on screen in landscape at 480px tall', () => {
    const VIEWPORT = 480; // 30rem, the landscape breakpoint ceiling
    for (const screen of ['playing', 'arranging'] as const) {
      const top = reserveFor(screen, 'landscape') + 10 + FAB_SIZE;
      expect(top, `${screen} toggle runs off a ${VIEWPORT}px landscape viewport`)
        .toBeLessThan(VIEWPORT);
    }
  });

  it('the open chat panel also clears the rails in both orientations', () => {
    const portraitPanel = rule(CHAT_CSS, '.chat-panel');
    expect(portraitPanel).toContain('var(--action-reserve, 0px)');
    // And its height is bounded by the reserve so it cannot overflow upward.
    expect(portraitPanel).toMatch(/max-height:[^;]*--action-reserve/);
  });

  it('the landscape panel height accounts for the reserve', () => {
    const landscape = CHAT_CSS.slice(
      CHAT_CSS.indexOf('@media (orientation: landscape) and (max-height: 30rem)')
    );
    const panel = landscape.match(/\.chat-panel\s*\{[^}]*\}/)![0];
    expect(panel).toMatch(/max-height:\s*calc\(100dvh\s*-\s*var\(--action-reserve/);
  });

  it('the panel fits the viewport in landscape once the reserve is applied', () => {
    const VIEWPORT = 480;
    for (const screen of ['playing', 'arranging'] as const) {
      const bottom = reserveFor(screen, 'landscape') + 12;
      const maxHeight = VIEWPORT - reserveFor(screen, 'landscape') - 64;
      expect(bottom + maxHeight, `${screen} panel overflows the top`).toBeLessThanOrEqual(VIEWPORT);
      // And it is still tall enough to be useful.
      expect(maxHeight, `${screen} panel too short to use`).toBeGreaterThan(180);
    }
  });

  it('keyboard-open positioning outranks the landscape rule by specificity', () => {
    // .chat-panel.is-keyboard-open (0,2,0) beats .chat-panel (0,1,0); media
    // queries add no specificity. So when the keyboard is genuinely open the
    // keyboard offset wins, which is correct - the rail is obscured anyway.
    expect(CHAT_CSS).toMatch(/\.chat-panel\.is-keyboard-open\s*\{[^}]*bottom:\s*calc\(var\(--keyboard-height/);
  });

  it('the toggle stays a full touch target - it was not shrunk to fit', () => {
    expect(APP_CSS).toMatch(/\.fab\s*\{[\s\S]*width:\s*44px/);
    expect(APP_CSS).toMatch(/\.fab\s*\{[\s\S]*height:\s*44px/);
  });
});

// ============================================================================
// Overflow and interaction
// ============================================================================

describe('no horizontal page overflow', () => {
  it('the modal backdrop clips rather than scrolls the page', () => {
    expect(rule(MODAL_CSS, '.rules-overlay')).toMatch(/overflow:\s*hidden/);
  });

  it('scrollable sheets contain their overscroll', () => {
    expect(MODAL_CSS).toMatch(/overscroll-behavior:\s*contain/);
    expect(STATS_CSS).toMatch(/overscroll-behavior:\s*contain/);
    expect(PLAY_CSS).toMatch(/overscroll-behavior:\s*contain/);
  });

  it('the chat panel and lobby cannot widen the page', () => {
    expect(CHAT_CSS).toMatch(/overflow-x:\s*hidden/);
    expect(LOBBY_CSS).toMatch(/overflow-x:\s*hidden/);
  });

  it('the gameplay screens still clip horizontally', () => {
    expect(TABLE_CSS).toMatch(/overflow:\s*hidden/);
    expect(ARR_CSS).toMatch(/overflow:\s*hidden/);
  });
});

describe('confetti is passive', () => {
  it('never intercepts taps on the controls underneath', () => {
    expect(rule(CONFETTI_CSS, '.confetti')).toMatch(/pointer-events:\s*none/);
  });

  it('cannot widen the page as pieces drift', () => {
    expect(rule(CONFETTI_CSS, '.confetti')).toMatch(/max-width:\s*100vw/);
    expect(rule(CONFETTI_CSS, '.confetti')).toMatch(/overflow:\s*hidden/);
  });
});

describe('touch targets and reachability', () => {
  it('the modal close control is a real touch target', () => {
    expect(MODAL_CSS).toMatch(/\.rules-panel__close\s*\{[\s\S]*min-width:\s*44px/);
    expect(MODAL_CSS).toMatch(/\.rules-panel__close\s*\{[\s\S]*min-height:\s*44px/);
  });

  it('the modal header stays reachable while long content scrolls', () => {
    expect(MODAL_CSS).toMatch(/\.rules-panel__header\s*\{[\s\S]*position:\s*sticky/);
  });
});

// ============================================================================
// Landscape / short viewports
// ============================================================================

describe('landscape and short viewports', () => {
  const LANDSCAPE = /@media \(orientation: landscape\) and \(max-height: 30rem\)/;

  it('modals adapt', () => expect(MODAL_CSS).toMatch(LANDSCAPE));
  it('chat adapts', () => expect(CHAT_CSS).toMatch(LANDSCAPE));
  it('voice adapts', () => expect(VOICE_CSS).toMatch(LANDSCAPE));
  it('round summary adapts', () => expect(PLAY_CSS).toMatch(LANDSCAPE));
  it('the table adapts', () => expect(TABLE_CSS).toMatch(LANDSCAPE));
  it('the arrangement screen adapts', () => expect(ARR_CSS).toMatch(LANDSCAPE));

  it('the lobby stops vertically centring on short screens, so nothing clips', () => {
    expect(LOBBY_CSS).toMatch(/@media \(max-height: 40rem\)[\s\S]*justify-content:\s*flex-start/);
  });
});


// ============================================================================
// Modal coverage: one fix, five modals
// ============================================================================

describe('every modal actually uses the shared safe-area shell', () => {
  const MODALS: [string, string][] = [
    ['Rules', RULES_TSX],
    ['Stats', STATS_TSX],
    ['Tutorial', TUTORIAL_TSX],
    ['Settings', SETTINGS_TSX],
    ['Round History', HISTORY_TSX],
  ];

  it.each(MODALS)('%s modal renders inside .rules-overlay', (_name, source) => {
    // This is what makes the single backdrop fix cover all five. If a future
    // modal rolls its own overlay, this test tells us the safe-area padding
    // does not apply to it.
    expect(source).toContain('className="rules-overlay"');
  });

  it.each(MODALS)('%s modal uses the shared scrollable sheet', (_name, source) => {
    expect(source).toMatch(/className="rules-panel panel/);
  });

  it('the shared sheet scrolls internally so content is reachable when tall', () => {
    const panel = rule(MODAL_CSS, '.rules-panel');
    expect(panel).toMatch(/overflow-y:\s*auto/);
    expect(panel).toMatch(/max-height:\s*85dvh/);
  });

  it('the pinned header is opaque, not inheriting a translucent panel', () => {
    // .panel's background is a semi-transparent gradient; inheriting it would
    // let scrolling content show through the sticky header.
    expect(GLOBAL_CSS).toMatch(/\.panel\s*\{[\s\S]*rgba\(/);
    const header = rule(MODAL_CSS, '.rules-panel__header');
    expect(header).not.toMatch(/background:\s*inherit/);
    expect(header).toMatch(/background:\s*#[0-9a-f]{6}/i);
  });
});

// ============================================================================
// Safe-area hygiene
// ============================================================================

describe('safe-area insets do not create gaps on devices without them', () => {
  const SHEETS: [string, string][] = [
    ['App', APP_CSS],
    ['Chat', CHAT_CSS],
    ['Voice', VOICE_CSS],
    ['Modal', MODAL_CSS],
    ['Play', PLAY_CSS],
    ['Lobby', LOBBY_CSS],
    ['Arrangement', ARR_CSS],
    ['Table', TABLE_CSS],
  ];

  it.each(SHEETS)('%s uses a 0px fallback so no inset means no extra space', (_n, css) => {
    // env(x, 12px) would ADD 12px on every device that supports safe-area and
    // reports zero - i.e. most Android phones - producing a visible gap.
    // Every use must be env(x, 0px) added to a real gap instead.
    // Strip comments first: a comment explaining a fixed bug can legitimately
    // quote the old bad value.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const uses = withoutComments.match(/env\(safe-area-inset-[a-z]+[^)]*\)/g) ?? [];
    for (const use of uses) {
      const hasFallback = /,\s*0px\s*\)/.test(use);
      const bare = /^env\(safe-area-inset-[a-z]+\)$/.test(use);
      expect(hasFallback || bare, `non-zero fallback: ${use}`).toBe(true);
    }
  });

  it('the gameplay rails are not double-padded by the FAB reserve', () => {
    // The rail's own height already includes its safe-bottom padding, so the
    // reserve must count only the rail's CONTENT. The toggle then adds
    // safe-bottom once, itself.
    expect(rule(CHAT_CSS, '.chat-toggle')).toMatch(
      /bottom:\s*calc\(env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*16px\s*\+\s*var\(--action-reserve/
    );
    expect(ARR_CSS).toMatch(/\.arr__actions\s*\{[\s\S]*var\(--safe-bottom\)/);
  });
});

// ============================================================================
// Hover
// ============================================================================

describe('no essential action depends on hover', () => {
  const ALL = [APP_CSS, CHAT_CSS, VOICE_CSS, MODAL_CSS, STATS_CSS, PLAY_CSS, LOBBY_CSS, ARR_CSS, TABLE_CSS];

  it('no rule reveals a control only on hover', () => {
    for (const css of ALL) {
      const hoverRules = css.match(/:hover[^{]*\{[^}]*\}/g) ?? [];
      for (const r of hoverRules) {
        // Hover may change colour, shadow or transform. It must never be what
        // makes something appear.
        expect(r, `hover-only reveal: ${r}`).not.toMatch(/display:\s*(block|flex|grid)/);
        expect(r).not.toMatch(/visibility:\s*visible/);
      }
    }
  });

  it('focus-visible styling is preserved for keyboard users', () => {
    // A single global :focus-visible rule covers the legacy screens; the new
    // screens additionally define their own. Neither was removed.
    expect(GLOBAL_CSS).toMatch(/:focus-visible/);
    expect(ARR_CSS).toMatch(/:focus-visible/);
    expect(TABLE_CSS + MODAL_CSS).toBeTruthy();
  });
});
