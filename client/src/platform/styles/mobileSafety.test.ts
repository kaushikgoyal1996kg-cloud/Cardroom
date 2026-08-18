import { describe, it, expect } from 'vitest';
import APP_CSS from '../../App.css?raw';
import APP_TSX from '../../App.tsx?raw';
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
import WELCOME_CSS from '../components/Welcome.css?raw';
import PROFILE_CSS from '../components/PlayerProfile.css?raw';
import RULES_TSX from '../../components/RulesModal.tsx?raw';
import STATS_TSX from '../../components/StatsModal.tsx?raw';
import TUTORIAL_TSX from '../../components/TutorialModal.tsx?raw';
import SETTINGS_TSX from '../../components/SettingsModal.tsx?raw';
import HISTORY_TSX from '../../components/RoundHistoryModal.tsx?raw';
import GLOBAL_CSS from '../../styles/global.css?raw';
import TABLE_CSS from '../../games/hazari/HazariTable.css?raw';
import KITTI_TABLE_CSS from '../../games/kitti/KittiTable.css?raw';
import KITTI_ARR_CSS from '../../games/kitti/KittiArrangement.css?raw';
import TEEN_PATTI_TABLE_CSS from '../../games/teenpatti/TeenPattiTable.css?raw';
import TEEN_PATTI_RULES_TSX from '../../games/teenpatti/TeenPattiRulesSheet.tsx?raw';
import TEEN_PATTI_VARIANT_CHOICE_CSS from '../../games/teenpatti/TeenPattiVariantChoice.css?raw';
import TEEN_PATTI_VARIANT_CHOICE_TSX from '../../games/teenpatti/TeenPattiVariantChoice.tsx?raw';
import TEEN_PATTI_RESULT_CSS from '../../games/teenpatti/TeenPattiResult.css?raw';
import TEEN_PATTI_RESULT_TSX from '../../games/teenpatti/TeenPattiRoundSummary.tsx?raw';
import POKER_VARIANT_CHOICE_CSS from '../../games/poker/PokerVariantChoice.css?raw';
import POKER_RUNTIME_CSS from '../../games/poker/PokerRuntimeView.css?raw';
import POKER_RUNTIME_TSX from '../../games/poker/PokerRuntimeView.tsx?raw';
import POKER_TABLE_TSX from '../../games/poker/PokerTable.tsx?raw';
import POKER_TABLE_CSS from '../../games/poker/PokerTable.css?raw';
import GAME_STORE_TSX from '../../lib/GameStore.tsx?raw';
import TABLE_CONTROLS_CSS from '../../components/TableControls.css?raw';

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

  it('both migrated screens are a BOUNDED shell (height, not min-height), governed by a JS-measured viewport height with a CSS dvh/vh fallback', () => {
    // Regression (Bug 5, confirmed on real Android PWA staging - THREE
    // TIMES now: a fixed-height/nested-scroll shell, then a normal-page-
    // flow/sticky-footer redesign, both confirmed still failing -
    // "physical vertical swiping does NOT scroll the result content" on
    // both). The THIRD structure goes back to a bounded shell (per this
    // retest's own explicit direction: "stop relying on page scroll"),
    // but no longer trusts CSS `dvh` alone - `--js-vh` is set inline by
    // RoundSummary.tsx/WinnerScreen.tsx from `useVisualViewport()`, a
    // JS measurement of the real, current viewport
    // (`window.visualViewport`/`window.innerHeight`), not a CSS unit
    // whose accuracy in Android PWA standalone mode has already cost two
    // rounds of this bug. `100vh`/`100dvh` remain as the pre-mount
    // fallback via `var(--js-vh, 100dvh)`.
    const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
    const ruleBody = (css: string, selector: string) => {
      const withoutComments = stripComments(css);
      const start = withoutComments.indexOf(`${selector} {`);
      if (start === -1) throw new Error(`no rule found for ${selector}`);
      const openBrace = withoutComments.indexOf('{', start);
      const closeBrace = withoutComments.indexOf('\n}', openBrace); // flat rule, no nesting - first close wins
      return withoutComments.slice(openBrace, closeBrace);
    };
    for (const [name, block] of [
      ['RoundSummary', ruleBody(RSUM_CSS, '.rsum')],
      ['WinnerScreen', ruleBody(WIN_CSS, '.winner')],
    ] as const) {
      for (const prop of ['height', 'max-height']) {
        // Match the property at the START of a declaration only (a
        // leading word boundary that isn't preceded by "max-" when
        // checking `height`), so `height:` and `max-height:` are counted
        // separately rather than the `height:` regex also matching the
        // tail end of every `max-height:` line.
        const re = new RegExp(`(?:^|;)\\s*${prop}:\\s*100(v|dv)h`, 'g');
        const lines = [...block.matchAll(re)];
        expect(lines.length, `${name}: expected both a 100vh and a 100dvh ${prop} fallback line`).toBe(2);
        expect(lines[0][1], `${name}: ${prop}'s 100vh must come first (the fallback)`).toBe('v');
        expect(lines[1][1], `${name}: ${prop}'s 100dvh must come second`).toBe('dv');
      }
      expect(block, `${name}: must be governed by the JS-measured height, with dvh as its fallback`).toMatch(
        /(?:^|;)\s*height:\s*var\(--js-vh,\s*100dvh\)/
      );
      expect(block, `${name}: must also cap max-height at the JS-measured value`).toMatch(
        /max-height:\s*var\(--js-vh,\s*100dvh\)/
      );
      // The min-height-only pattern from the SECOND (page-scroll) attempt
      // must not come back - this shell must be a hard bound again, not a
      // floor that lets the page itself grow taller.
      expect(block, `${name}: must not be min-height-only (that was the page-scroll attempt)`).not.toMatch(
        /^\s*min-height:/m
      );
    }
  });

  it('both migrated screens clip the shell and scroll internally - exactly ONE scroll region, not the page', () => {
    // Per this retest's explicit direction: "Do NOT depend on: document/
    // body scroll... an overflow-y:auto declaration with no proven
    // bounded parent." The shell (.rsum/.winner) clips its own overflow
    // (overflow: hidden) BECAUSE its scroll-region child
    // (.rsum__scroll/.winner__scroll) is the one intended scroller, with
    // its own flex: 1 1 auto + min-height: 0 + overflow-y: auto - the
    // classic, well-defined "bounded flex column, one scrolling child"
    // shape, not page flow.
    const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
    const ruleBody = (css: string, selector: string) => {
      const withoutComments = stripComments(css);
      const start = withoutComments.indexOf(`${selector} {`);
      if (start === -1) throw new Error(`no rule found for ${selector}`);
      const openBrace = withoutComments.indexOf('{', start);
      const closeBrace = withoutComments.indexOf('\n}', openBrace);
      return withoutComments.slice(openBrace, closeBrace);
    };
    for (const [name, css, shellSel, scrollSel] of [
      ['RoundSummary', RSUM_CSS, '.rsum', '.rsum__scroll'],
      ['WinnerScreen', WIN_CSS, '.winner', '.winner__scroll'],
    ] as const) {
      const shell = ruleBody(css, shellSel);
      expect(shell, `${name}: shell must clip - the scroll child below is the intended scroller`).toMatch(
        /overflow:\s*hidden/
      );
      expect(shell, `${name}: shell must be a flex column`).toMatch(/display:\s*flex/);
      expect(shell, `${name}: shell must be flex-direction: column`).toMatch(/flex-direction:\s*column/);

      const scroll = rule(css, scrollSel);
      expect(scroll, `${name}: scroll region must be flex: 1 1 auto`).toMatch(/flex:\s*1\s+1\s+auto/);
      expect(scroll, `${name}: scroll region must have min-height: 0 (the classic flex-child overflow gotcha)`).toMatch(
        /min-height:\s*0/
      );
      expect(scroll, `${name}: scroll region must be the one that scrolls`).toMatch(/overflow-y:\s*auto/);
      expect(scroll, `${name}: scroll region must not scroll horizontally`).toMatch(/overflow-x:\s*hidden/);
      expect(scroll, `${name}: must explicitly permit vertical pan gestures`).toMatch(/touch-action:\s*pan-y/);
    }
  });

  it("both migrated screens' action/footer rows stay within the shell's own bounds, outside the scroll region", () => {
    // Per this retest: "footer... stays within modal bounds... is either
    // fixed/sticky inside the shell or outside the scroll body". This
    // structure chose "outside the scroll body": .rsum__actions/
    // .winner__actions are plain flex-column siblings AFTER the
    // flex: 1 1 auto scroll region, so they always keep their own natural
    // height and can never be pushed off-screen or clipped by content
    // inside the scroll region - the scroll region only ever gets
    // whatever space is left over once these rows take theirs.
    const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
    const ruleBody = (css: string, selector: string) => {
      const withoutComments = stripComments(css);
      const start = withoutComments.indexOf(`${selector} {`);
      if (start === -1) throw new Error(`no rule found for ${selector}`);
      const openBrace = withoutComments.indexOf('{', start);
      const closeBrace = withoutComments.indexOf('\n}', openBrace);
      return withoutComments.slice(openBrace, closeBrace);
    };
    for (const [name, css, selector] of [
      ['RoundSummary', RSUM_CSS, '.rsum__actions'],
      ['WinnerScreen', WIN_CSS, '.winner__actions'],
    ] as const) {
      const body = ruleBody(css, selector);
      // Must NOT be flex: 1 (that would let it compete with the scroll
      // region for space) and must NOT be position: sticky/fixed (it
      // does not need to be - it is already outside the scrolling
      // element entirely, so it can never scroll out of view).
      expect(body, `${name}: action row must not claim flex growth`).not.toMatch(/flex:\s*1/);
      expect(body, `${name}: action row must not be sticky - it's already outside the scroll region`).not.toMatch(
        /position:\s*sticky/
      );
    }
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
// The per-set reveal sheet (Bug 5, CLARIFIED 2026-08-16)
//
// Two prior rounds of "end-of-hand scroll" fixes targeted RoundSummary,
// which turned out never to be the actually-broken screen. Hazari plays 4
// SETS per round; after EACH set (1-4, the same component every time) a
// separate per-set result sheet (`.reveal`, HazariTable.tsx/css) appears -
// THIS is the screen real-device testing found unscrollable. RoundSummary
// (checked above) is a different, separate component shown once, after the
// round's 4th set AND the round itself resolve, and was not touched here.
// ============================================================================

describe('the per-set reveal sheet has its own bounded scroll structure, separate from RoundSummary', () => {
  const ruleBody = (css: string, selector: string) => {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule found for ${selector}`);
    const openBrace = css.indexOf('{', start);
    const closeBrace = css.indexOf('\n}', openBrace);
    return css.slice(openBrace, closeBrace);
  };

  it('.reveal__sheet is bounded (max-height, governed by the JS-measured viewport) and clips - .reveal__body is the one intended scroller', () => {
    const sheet = ruleBody(TABLE_CSS, '.reveal__sheet');
    expect(sheet, 'must cap height, not grow unbounded').toMatch(/max-height:\s*calc\(var\(--js-vh,\s*100dvh\)/);
    expect(sheet, 'must clip its own overflow - .reveal__body is the intended scroller').toMatch(
      /overflow:\s*hidden/
    );
    expect(sheet, 'must be a flex column so header/body/footer stack predictably').toMatch(/display:\s*flex/);
  });

  it('.reveal__body is the ONE scroll region - flex: 1 1 auto, min-height: 0, overflow-y: auto, vertical pan explicitly permitted', () => {
    const body = ruleBody(TABLE_CSS, '.reveal__body');
    expect(body).toMatch(/flex:\s*1\s+1\s+auto/);
    expect(body, 'the classic flex-child overflow gotcha').toMatch(/min-height:\s*0/);
    expect(body).toMatch(/overflow-y:\s*auto/);
    expect(body).toMatch(/overflow-x:\s*hidden/);
    expect(body, 'must explicitly permit vertical pan gestures').toMatch(/touch-action:\s*pan-y/);
  });

  it('.reveal__title (header) and the Continue button (footer) are NOT part of the scroll region - fixed cross-axis rows', () => {
    const title = ruleBody(TABLE_CSS, '.reveal__title');
    expect(title, 'header must not grow/shrink - fixed size, always visible').toMatch(/flex:\s*0\s+0\s+auto/);
    const btnRule = ruleBody(TABLE_CSS, '.reveal__sheet .btn');
    expect(btnRule, 'footer button must not grow/shrink - fixed size, always reachable').toMatch(
      /flex:\s*0\s+0\s+auto/
    );
  });

  it('the reveal overlay itself uses inset: 0 (not height: 100dvh) - already the reliable half of this component', () => {
    // .reveal (the fixed backdrop) was never the broken part - inset: 0
    // on a position: fixed element pins directly to the true viewport
    // without depending on a dvh calculation the way .reveal__sheet's own
    // bound does. Confirms this wasn't accidentally changed while fixing
    // the sheet.
    const overlay = ruleBody(TABLE_CSS, '.reveal');
    expect(overlay).toMatch(/position:\s*fixed/);
    expect(overlay).toMatch(/inset:\s*0/);
  });
});

// ============================================================================
// Premium table chrome contracts
// ============================================================================

describe('premium table chrome stays compact and non-glass', () => {
  it('active game overlays and the shared table utility hub do not use backdrop blur', () => {
    for (const [name, css] of [
      ['Hazari', TABLE_CSS],
      ['Kitti', KITTI_TABLE_CSS],
      ['Teen Patti', TEEN_PATTI_TABLE_CSS],
      ['Table controls', TABLE_CONTROLS_CSS],
      ['Shared rules modal', MODAL_CSS],
      ['Legacy shared play surfaces', PLAY_CSS],
    ] as const) {
      expect(css, `${name}: glass/backdrop blur must not return`).not.toMatch(/(?:-webkit-)?backdrop-filter:\s*blur\(/);
    }
  });

  it('the shared table launcher and radial actions preserve full touch targets', () => {
    const launcher = rule(TABLE_CONTROLS_CSS, '.table-controls__launcher');
    const action = rule(TABLE_CONTROLS_CSS, '.table-controls__action');
    for (const [name, block] of [['launcher', launcher], ['action', action]] as const) {
      expect(block, `${name}: width must use the shared touch minimum`).toMatch(/width:\s*max\(var\(--touch-min\)/);
      expect(block, `${name}: height must use the shared touch minimum`).toMatch(/height:\s*max\(var\(--touch-min\)/);
    }
  });

  it('Chat, Voice, Settings and Exit are radial actions, not four independently fixed table buttons', () => {
    expect(TABLE_CONTROLS_CSS).toMatch(/\.table-controls__wheel\s*\{/);
    for (const action of ['chat', 'voice', 'settings', 'exit']) {
      expect(TABLE_CONTROLS_CSS, `${action}: missing radial coordinate`).toMatch(
        new RegExp(`\\.table-controls__action--${action}\\s*\\{[^}]*--wheel-(?:x|y):`)
      );
    }
  });


  it('Kitti short-landscape keeps medium cards and fits them by overlap instead of shrinking them', () => {
    expect(KITTI_ARR_CSS, 'do not override the shared PlayingCard width inside Kitti arrangement').not.toMatch(/--pcard-w\s*:/);
    const landscape = KITTI_ARR_CSS.slice(KITTI_ARR_CSS.indexOf('@media (orientation: landscape) and (max-height: 30rem)'));
    expect(landscape).toMatch(/grid-template-columns:\s*repeat\(5,\s*2\.4rem\)/);
  });

  it('Kitti short-landscape gives the felt more room than the old oversized side rail', () => {
    const landscape = KITTI_TABLE_CSS.slice(KITTI_TABLE_CSS.lastIndexOf('@media (orientation: landscape) and (max-height: 30rem)'));
    expect(landscape).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*clamp\(12\.25rem,\s*30vw,\s*17rem\)/);
    expect(landscape).toMatch(/\.kitti-table-screen__table \.table\s*\{[^}]*max-height:\s*min\(76dvh,\s*20rem\)/);
  });

  it('Teen Patti utility and top-up controls keep a full touch target on narrow phones', () => {
    expect(TEEN_PATTI_TABLE_CSS).toMatch(/\.tp-hand__money button\s*\{[^}]*min-height:\s*var\(--touch-min\)/);
    const narrow = TEEN_PATTI_TABLE_CSS.slice(TEEN_PATTI_TABLE_CSS.indexOf('@media (max-width: 430px)'));
    expect(narrow).toMatch(/\.tp-table-screen__rules\s*\{[^}]*min-height:\s*var\(--touch-min\)/);
  });

  it('Teen Patti Friendly Assist never sits inside the player hand/action rail', () => {
    expect(TEEN_PATTI_TABLE_CSS).toMatch(/--tp-player-rail-reserve:\s*10rem/);
    expect(TEEN_PATTI_TABLE_CSS).toMatch(/\.tp-friendly-incoming\s*\{[^}]*bottom:\s*calc\(var\(--safe-bottom\) \+ var\(--tp-player-rail-reserve\)/);
    const landscape = TEEN_PATTI_TABLE_CSS.slice(TEEN_PATTI_TABLE_CSS.indexOf('@media (orientation: landscape) and (max-height: 30rem)'));
    expect(landscape).toMatch(/--tp-side-rail:\s*clamp\(17rem,\s*34vw,\s*23rem\)/);
    expect(landscape).toMatch(/\.tp-friendly-incoming\s*\{[^}]*left:\s*calc\(var\(--safe-left\)[^}]*right:\s*calc\(var\(--safe-right\) \+ var\(--tp-side-rail\)/);
  });

  it('hub-launched Chat and Voice panels anchor below the circular utility control instead of the old bottom FAB stack', () => {
    expect(CHAT_CSS).toMatch(/\.chat-panel\.is-table-utility\s*\{[^}]*top:\s*calc\(env\(safe-area-inset-top/);
    expect(VOICE_CSS).toMatch(/\.voice-call-panel\.is-table-utility\s*\{[^}]*top:\s*calc\(env\(safe-area-inset-top/);
  });

  it('Teen Patti Settings → Rules reuses the server-fed in-round variant sheet instead of a stale static guide', () => {
    expect(APP_TSX).toMatch(/room\.gameId === 'TEEN_PATTI' && teenPattiState/);
    expect(APP_TSX).toMatch(/<TeenPattiRulesSheet state=\{teenPattiState\}/);
    expect(TEEN_PATTI_RULES_TSX).toMatch(/state\.variantName/);
    expect(TEEN_PATTI_RULES_TSX).toMatch(/state\.variantHelp/);
    expect(TEEN_PATTI_RULES_TSX).toMatch(/state\.variantDealCount/);
  });

  it('Teen Patti dealer-choice screen is a real reconnect-safe route with mobile bounds', () => {
    expect(APP_TSX).toMatch(/state === 'AWAITING_VARIANT'/);
    expect(APP_TSX).toMatch(/<TeenPattiVariantChoice \/>/);
    expect(TEEN_PATTI_VARIANT_CHOICE_TSX).toMatch(/nextVariantChooserId/);
    expect(TEEN_PATTI_VARIANT_CHOICE_TSX).toMatch(/variantPolicy\.variants/);
    expect(TEEN_PATTI_VARIANT_CHOICE_CSS).toMatch(/height:\s*var\(--js-vh,\s*100dvh\)/);
    expect(TEEN_PATTI_VARIANT_CHOICE_TSX).toMatch(/useVisualViewport/);
    expect(TEEN_PATTI_VARIANT_CHOICE_TSX).toMatch(/'--js-vh': `\$\{viewportHeight\}px`/);
    expect(TEEN_PATTI_VARIANT_CHOICE_CSS).toMatch(/max-height:\s*52dvh/);
    expect(TEEN_PATTI_VARIANT_CHOICE_CSS).toMatch(/env\(safe-area-inset-bottom\)/);
  });



  it('Teen Patti live/result shells use the real VisualViewport height instead of trusting Android PWA dvh alone', () => {
    expect(TEEN_PATTI_TABLE_CSS).toMatch(/height:\s*var\(--js-vh,\s*100dvh\)/);
    expect(TEEN_PATTI_TABLE_CSS).toMatch(/max-height:\s*calc\(var\(--js-vh,\s*100dvh\)/);
    expect(APP_TSX).toMatch(/<TeenPattiTable/);
    expect(TEEN_PATTI_RESULT_CSS).toMatch(/height:\s*var\(--js-vh,\s*100dvh\)/);
    expect(TEEN_PATTI_RESULT_CSS).toMatch(/max-height:\s*var\(--js-vh,\s*100dvh\)/);
    expect(TEEN_PATTI_RESULT_TSX).toMatch(/useVisualViewport/);
    expect(TEEN_PATTI_RESULT_TSX).toMatch(/'--js-vh': `\$\{viewportHeight\}px`/);
  });

  it('Poker runtime supplies the JS VisualViewport height expected by its --app-height CSS contract', () => {
    expect(POKER_RUNTIME_CSS).toMatch(/height:\s*var\(--app-height,\s*100dvh\)/);
    expect(POKER_RUNTIME_TSX).toMatch(/useVisualViewport/);
    expect(POKER_RUNTIME_TSX).toMatch(/'--app-height': `\$\{viewportHeight\}px`/);
  });

  it('Teen Patti keeps the felt mounted while a matching private snapshot is between packets', () => {
    const teenRoute = APP_TSX.slice(APP_TSX.indexOf("} else if (room.gameId === 'TEEN_PATTI') {"), APP_TSX.indexOf("} else if (room.gameId === 'POKER') {"));
    expect(teenRoute).toMatch(/state === 'BETTING'[\s\S]*<TeenPattiTable/);
    expect(teenRoute).not.toMatch(/AWAITING_REFERENCE_ASSIGNMENT'\) && teenPattiPrivate/);
    expect(TEEN_PATTI_TABLE_CSS).toMatch(/\.tp-actions__status/);
  });

  it('Poker hand-complete retires the live hand/action rail before bankroll/result furniture appears', () => {
    expect(POKER_RUNTIME_TSX).toMatch(/showLocalPanel=\{state\.state !== 'HAND_COMPLETE'\}/);
    expect(POKER_TABLE_TSX).toMatch(/showLocalPanel && <section className="poker-local"/);
    expect(POKER_TABLE_CSS).toMatch(/\.poker-table-screen\.is-result \.table\s*\{[^}]*padding-bottom:/);
  });

  it('hidden-game lobby setup changes are never socket-buffered through reconnect restoration', () => {
    for (const marker of [
      'Reconnect before changing Teen Patti table settings.',
      'Reconnect before accepting Teen Patti table settings.',
      'Reconnect before changing Poker table settings.',
      'Reconnect before accepting Poker table settings.',
    ]) {
      expect(GAME_STORE_TSX).toContain(marker);
    }
    expect(GAME_STORE_TSX.match(/if \(actionsGatedRef\.current\)/g)?.length ?? 0).toBeGreaterThanOrEqual(20);
  });

  it('dealer-choice screens reserve the shared circular hub instead of letting it cover configuration controls', () => {
    expect(TEEN_PATTI_VARIANT_CHOICE_CSS).toMatch(/var\(--top-fab-reserve\)/);
    expect(POKER_VARIANT_CHOICE_CSS).toMatch(/var\(--top-fab-reserve\)/);
  });

  it('result/loading screens retire table utilities while dealer-choice remains a guarded active-game screen', () => {
    expect(APP_TSX).toMatch(/screenKey !== 'round-summary'/);
    expect(APP_TSX).toMatch(/screenKey !== 'winner'/);
    expect(APP_TSX).toMatch(/screenKey !== 'loading'/);
    expect(APP_TSX).toMatch(/case 'variant-choice':[\s\S]*room\?\.gameId === 'TEEN_PATTI'/);
    expect(APP_TSX).toMatch(/activeRoomSurfaceKey/);
    expect(APP_TSX).toMatch(/setActiveTableUtility\(null\);[\s\S]*setShowRules\(false\);[\s\S]*setShowStats\(false\);[\s\S]*setShowRoundHistory\(false\);/);
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

  /**
   * The gap the reserve must ALSO clear above .arr__actions: the sort
   * control (.arr__hand-bar, "Your cards … Rank Suit Dealt") together with
   * the fan of cards sitting directly beneath it - confirmed on real
   * Android PWA staging as the voice/chat FAB stack covering "Dealt"
   * (SESSION_CHANGELOG.md, "Bug 3").
   *
   * The real DOM order (verified against ArrangementTable.tsx's actual JSX,
   * not assumed from the stylesheet) bottom-to-top above .arr__actions is:
   *   .arr__fan (the fanned cards) THEN .arr__hand-bar (the sortbar row).
   * Both sit between the rail and the sortbar, so BOTH must be counted -
   * an earlier version of this function counted only the sortbar row plus
   * .arr__hand's own top padding (which is on the far side of the sortbar
   * from the rail, and so irrelevant here), omitting the fan entirely. The
   * fan is by far the largest term (~80px, one small card plus its
   * padding), so that omission undershot the true figure substantially.
   *
   * This DOES vary by orientation: .arr__fan's own padding is smaller in
   * landscape (`padding-top: 14px; padding-bottom: var(--space-1)`) than
   * portrait's base `padding: 18px 0 var(--space-2)` - verified directly
   * against ArrangementTable.css, not assumed. The sortbar row itself
   * (.arr__hand-bar) is untouched by the landscape rule, so that part is
   * identical in both orientations. Mirrors hazariRail()'s existing
   * orientation parameter for the same reason.
   */
  function arrangementFanAndSortbar(orientation: 'portrait' | 'landscape'): number {
    const fanPaddingTop = orientation === 'landscape' ? 14 : 18; // .arr__fan padding, not a token
    const fanPaddingBottom = orientation === 'landscape' ? SPACE_1 : SPACE_2; // .arr__fan padding
    const fanHeight = fanPaddingTop + CARD_SM_H + fanPaddingBottom;
    const sortbarPadding = 2; // .sortbar { padding: 2px }, not a token
    const sortbarBtnMinHeight = 30; // .sortbar__btn { min-height: 30px }, not a token
    const handBarMarginBottom = SPACE_1; // .arr__hand-bar { margin-bottom: var(--space-1) }
    const sortbarRow = sortbarBtnMinHeight + sortbarPadding * 2 + handBarMarginBottom;
    return fanHeight + sortbarRow;
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

  it('the PORTRAIT reserve clears the Arrangement rail AND the fan/sort control above it', () => {
    expect(reserveFor('arranging', 'portrait')).toBeGreaterThanOrEqual(
      arrangementRail() + arrangementFanAndSortbar('portrait')
    );
  });

  it('the LANDSCAPE reserve clears the compact Hazari rail', () => {
    // Regression: an earlier version dropped the reserve entirely in
    // landscape, putting the toggle on top of "Play" after a rotation.
    const reserve = reserveFor('playing', 'landscape');
    expect(reserve).toBeGreaterThan(0);
    expect(reserve).toBeGreaterThanOrEqual(hazariRail('landscape'));
  });

  it('the LANDSCAPE reserve clears the Arrangement rail AND the fan/sort control above it', () => {
    // .arr__actions is NOT compacted in landscape, so that part of the
    // requirement is the same as portrait - but .arr__fan's own padding IS
    // smaller in landscape, so this must NOT reuse the portrait figure
    // verbatim.
    const reserve = reserveFor('arranging', 'landscape');
    expect(reserve).toBeGreaterThan(0);
    expect(reserve).toBeGreaterThanOrEqual(arrangementRail() + arrangementFanAndSortbar('landscape'));
  });

  it('the landscape Arrangement reserve is not needlessly larger than portrait requires', () => {
    // Regression: an earlier version of this reserve applied the PORTRAIT
    // fan padding (18px/8px top/bottom) to landscape too, over-reserving by
    // 8px. Not unsafe on its own, but a real discrepancy between the
    // reserve and what the layout actually needs - this pins landscape
    // strictly below portrait instead of allowing it to silently drift
    // back to the same (wrong-for-landscape) figure.
    const portraitRequirement = arrangementRail() + arrangementFanAndSortbar('portrait');
    const landscapeRequirement = arrangementRail() + arrangementFanAndSortbar('landscape');
    expect(landscapeRequirement).toBeLessThan(portraitRequirement);
    expect(reserveFor('arranging', 'landscape')).toBeLessThan(reserveFor('arranging', 'portrait'));
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
  it('welcome adapts', () => expect(WELCOME_CSS).toMatch(LANDSCAPE));
  it('the player profile sheet adapts', () => expect(PROFILE_CSS).toMatch(LANDSCAPE));

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
