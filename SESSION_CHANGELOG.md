# SESSION CHANGELOG

Append-only. **Add new entries at the top.** Never rewrite history — if an
earlier entry was wrong, add a correction entry saying so.

Purpose: a fresh session can see what changed recently, what was decided and
why, without any conversation context.

---

## Entry format

```markdown
## YYYY-MM-DD — <short task name>

- **Model:** Opus / Sonnet
- **Baseline before:** server NNN, client NNN
- **Task:** one or two sentences
- **Files changed:** grouped, important ones only
- **Decisions:** anything a future session must not casually undo
- **Tests after:** server NNN, client NNN + what was added
- **New debt:** anything knowingly left behind
- **Baseline status:** accepted / superseded / rejected
```

---

## 2026-08-17 — Release 1.5 source-integrity gate

- **Source parse:** 173 TypeScript/TSX/MTS source and test files parse with zero syntax diagnostics.
- **CSS:** 41 client source stylesheets pass structural brace validation.
- **Imports:** 566 actual relative import/export/require edges resolve; comments and example strings are excluded from the scan.
- **Kitti solver:** dependency-light compiled harness found valid strict strongest→weakest arrangements for 200 random nine-card deals with zero failures.
- **Kitti max bot table:** dependency-light compiled 1-human + 4-bot round reached `ROUND_COMPLETE` with one authoritative round history entry and without the bot controller touching the human arrangement.
- **Rule-engine safety:** Release 1.5 `server/src/games/hazari/gameEngine.ts`, Hazari `rules.ts`, Kitti `engine.ts` and Kitti `rules.ts` are byte-for-byte identical to Release 1.4. Bot/suggestion/play-money/TURN changes are outside those authoritative rule files.
- **Not claimed:** full Vitest/package typecheck/Vite/Capacitor/Gradle verification still cannot run in this environment because the complete npm dependency tree is unavailable. The historical server 310 / client 377 run remains the last fully-run accepted baseline.

---

## 2026-08-17 — Release 1.5 play money, secure TURN, Kitti computers and fairness

- **Model:** GPT-5.6 Sol.
- **Baseline before:** last fully-run accepted suite remains server 310 / client 377;
  current environment still cannot restore the complete npm dependency tree.
- **Play money:** added the optional consensual room-session virtual board/pot to
  both Hazari and Kitti. Host proposes; every human must accept; computer seats
  auto-accept; contributions lock only after Start succeeds; authoritative match
  winner receives the pot exactly once; cumulative virtual P/L survives Play Again.
  It has no cash value and no deposit/withdrawal/conversion path.
- **Kitti computer seats:** Kitti now supports optional bots within its 2–5 player
  cap. Host can add and remove computer seats before Start. Bots auto-ready, use
  only their own cards, build a valid strongest→weakest 3–3–3 arrangement, play
  only on their authoritative turn, participate in the three-winner decider, and
  never join voice. A one-human + four-bot compiled round completed successfully.
- **Kitti bot-only Suggest:** added a server-authoritative arrangement suggestion
  path. It is available only when every opponent is a bot; any real human opponent
  disables the UI and the real Socket.IO endpoint independently refuses a forged
  request. Suggested card IDs are limited to the requester's own nine-card hand.
- **Bot lifecycle:** voluntary host Leave Table may still convert that engine seat
  to a bot, but room-level host authority transfers to the first remaining human so
  Next Round / Play Again cannot deadlock behind a bot host. Temporary disconnects
  still do NOT transfer host rights. Disconnected humans are not allowed to remain
  Ready for lobby Start.
- **TURN:** added backend-issued short-lived Metered TURN configuration using only
  `METERED_DOMAIN` and `METERED_SECRET_KEY` on the server. No long-lived TURN
  credential is compiled into browser/APK code. Direct/STUN remains the normal
  first path and STUN-only fallback is retained if Metered is unavailable. One
  temporary ~4-hour credential is cached per table until shortly before expiry to
  minimise credential churn on the free Metered plan.
- **Voice/multi-game isolation:** added/expanded real Socket.IO coverage with a live
  Hazari room and live Kitti room concurrently: room/game state, optional virtual
  boards and voice signalling stay table-scoped; Hazari voice remains usable after
  Play Again.
- **Avatars:** expanded the allow-list/picker with a premium Card Room set (panther,
  eagle, wolf, dragon, owl, stallion, bull, fox, diamond, shield, spade and others)
  and medallion-style seat/picker presentation while retaining the existing choices.
- **Smoke-test maintenance:** updated stale command-line socket smoke scripts from
  pre-migration event/list-table protocols so they remain useful after deployment.
- **Manual/dependency-light verification:** Kitti suggestion solver found a valid
  strict arrangement for 200 random nine-card deals; a compiled max-table scenario
  with one human + four bots completed a round. Full Vitest/Vite/Android verification
  is still required before this becomes an accepted baseline.
- **Production:** unchanged. The old live `haazari` Render service/repository must
  remain untouched; Release 1.5 belongs in the separate existing `Cardroom` repo and
  its staging/new backend after verification.

---

## 2026-08-17 — Release 1.4 full premium product audit

- **Scope:** audited the routed Release 1 experience from cold launch through
  profile, game selection, invitation, lobby, arrangement, dealing, live table,
  results, Settings/Rules/Stats/History, voice/chat, reconnect, deliberate exit,
  offline/update/install states and the native Android wrapper. **No Hazari or
  Kitti game rule was changed.**
- **Multi-game identity:** removed Hazari as the default/pre-selected game. The
  selector now opens neutral, gives Hazari and Kitti equal playable weight, and
  presents Teen Patti/Poker as contextual Coming Soon entries without dead fake
  Play/Create controls.
- **Navigation hierarchy:** a true cold launch still starts at Welcome. Deliberate
  Leave/Return from a room sets a one-shot `sessionStorage` marker and returns
  directly to **The Card Room** selector; the active-seat home peek has its own
  premium return pass rather than reusing the old landing screen.
- **Shared invitations:** replaced the legacy Hazari-looking invite entry with a
  Card Room invitation screen that identifies the game and reuses saved player
  identity. Native invite generation now uses `VITE_PUBLIC_APP_URL` and refuses
  localhost/loopback URLs, preventing Capacitor's internal `https://localhost`
  origin from being shared to another player.
- **Identity/profile:** upgraded PlayerProfile to the same entrance language and
  brought Back to the 44px touch minimum.
- **Support/transient UI:** migrated loading/reconnect, Settings, Rules, Stats,
  History, Hazari confirmed-hand waiting and Kitti waiting/spectator states into
  the same opaque wood/brass/felt language. Removed browser alerts and legacy
  green/glass utility styling from routed Release 1 flows.
- **Stats/history correctness:** local stats are now game-scoped; legacy Hazari
  stats migrate into the Hazari bucket. Kitti records its own match wins/scores
  and has Kitti-specific round history instead of opening Hazari data.
- **Hazari result presentation:** RoundSummary no longer arbitrarily names the
  first player as sole leader when multiple players share the top round score;
  tied top scores are presented as shared. Scoring itself is unchanged.
- **Celebration:** Hazari/Kitti winner presentation now shares restrained
  brass/ivory/wood/felt confetti rather than the old ruby/sapphire palette.
- **Voice/chat/chrome:** expanded the shared vector icon language; retained emoji
  only where it is actual reaction content. Voice/reconnect behavior from the
  previous release line is preserved.
- **PWA/native shell:** standardized visible branding to **The Card Room**;
  removed `maximum-scale=1` from the viewport; bumped service-worker shell cache
  to `cardroom-v2`; service-worker update UI is hidden while a room is live and
  suppressed entirely in native builds; install prompts are also native-aware.
- **Android branding:** added `@capacitor/assets` workflow support and
  `client/assets/icon.png`; `android:init` now generates Android launcher/splash
  resources after creating/configuring the native project.
- **Native release QA:** Android release instructions now explicitly test branded
  launcher/splash, public invite sharing, single-seat reconnect, direct return to
  Card Room and suppression of PWA UI during live native play.
- **Regression coverage added in this audit line:** one-shot Card Room return,
  per-game stats + legacy migration, public/native-safe invite URL generation,
  and updated entry-flow expectations, in addition to the earlier single-seat
  reconnect coverage.
- **Source-level verification:** 159 TS/TSX source/test files transpile with zero
  syntax diagnostics; all 40 CSS files pass structural brace validation.
- **Not claimed:** the current environment still cannot restore the complete npm
  dependency tree, so the new/full Vitest suites, package typechecks, Vite build,
  Capacitor resource generation and Gradle APK build have **not** been run here.
  The historical 310 server / 377 client pass counts remain the last fully-run
  accepted suite, not a verification of Release 1.4.
- **Production:** unchanged and blocked. The old live family app remains the
  rollback path.

---

## 2026-08-17 — Premium Release 1 hardening; Kitti edge audit and visual unification

- **Model:** GPT-5.6 Sol.
- **Baseline before:** current checkpoint only; full npm suite still unavailable in this environment because dependencies cannot be restored from the registry. No new pass count is claimed.
- **Task:** harden the Hazari + Kitti first-APK working copy, unify the premium private-card-room presentation, and close static/type/release-gating gaps before packaging source. Game rules remain locked.
- **Premium presentation:** redesigned Welcome and four-game selector; Hazari/Kitti are live and Teen Patti/Poker are polished Coming Soon. Refined shared wood/brass/felt table, ivory cards/card backs, dealing motion, RoomLobby, Kitti arrangement/table/results, chat/voice materials, and Hazari shell styling while preserving fragile Hazari mobile geometry/reserve contracts.
- **Kitti ceremony + edge flow:** first Kitti deal now visibly presents the authoritative initial high-card dealer draw (including redraw-tie note) before the normal dealer-first deal. A deterministic harness revalidated ten scheduled rounds, 5–5 tie, leaders-only sudden death Round 11, and final winner. Permanent regression coverage was added for that match path.
- **Kitti correctness fixes:** a 2–0 round ends competitively after Hand 2; completed round number/dealer remain frozen until the next deal starts; reveal-key null narrowing was corrected; privacy tests keep confirmed/unplayed groups hidden and reveal only thrown cards.
- **Room/voice hardening:** Lobby share now captures stable room/game values; TURN build variables are declared in `vite-env.d.ts`; prior stale-leave and voice reconnect hardening remains intact.
- **Bug 6:** server real-Socket.IO dismissal regression + client dismissed-summary/Next Round regression remain in the Release 1 working copy. No Hazari dismissal rule changed.
- **Release gating:** authoritative server registry has Hazari/Kitti `networkPlayable: true`, Teen Patti `false`; Poker is not a server GameId. Home buttons additionally refuse Play/Create for Coming Soon entries.
- **Static verification:** 39 changed TS/TSX files pass TypeScript syntax/transpile parsing; 16 changed CSS files have balanced structure; Kitti dependency-light engine compiles standalone; deterministic Kitti harness passes; credential scan found only empty/example TURN variable declarations.
- **Environment limitation:** Chromium now exists, but the client has no usable React/Vite dependency tree and no `dist`, so the redesigned UI still cannot be honestly rendered from this working copy here. `npm install` has timed out; no APK has been generated.
- **Real-device gate:** still required for Bug 5 physical reveal scrolling, Bug 6 dismissal, Kitti 2–5 player layout/full match, voice/microphone permission, Back, reconnect, portrait/landscape and upgrade-over-existing APK.
- **Baseline status:** **release-source candidate only, not a verified APK baseline.** Production remains blocked.

---

## 2026-08-17 — Hazari + Kitti Android test-track checkpoint; Kitti online core, Bug 6 coverage, native scaffolding

- **Model:** GPT-5.6 Sol.
- **Baseline before:** repository documentation recorded server 310 / client 377.
  This session could **not independently rerun that baseline**: the extracted ZIP
  does not contain usable installed dependencies, npm registry access times out
  in this environment, and no Android SDK/Gradle tooling is installed. Treat the
  old counts as the last documented baseline, not as a newly verified result.
- **Release decision:** first Android test track is deliberately **Hazari + Kitti
  playable**. Teen Patti and Poker are **Coming Soon**. Teen Patti remains a real
  but disabled registry game; Poker is client-catalogue presentation only and is
  deliberately not a server `GameId`.
- **Kitti:** replaced the old incomplete/contradictory engine path with the
  agreed authoritative rules: 2–5 players, 9 cards, Ace-high dealer draw with
  redraw ties, dealer-first clockwise deal, player clockwise from dealer leads
  hand 1, strict strongest→weakest arrangement, later thrower wins exact hand
  ties, previous hand winner leads, first player to two hands wins immediately,
  three-different-winners fresh 3-card decider, ten scheduled rounds and sudden
  death among tied leaders. Round/dealer state now stays visually on the
  completed round until the next deal actually begins. Added `KittiSession`,
  `kitti:*` protocol/private-public state, online room wiring and the Kitti
  arrangement/dealing/table/result/winner client flow. Reconnect/result restore
  is wired; sudden-death spectators no longer retain/render stale prior-round
  private cards.
- **Hazari Bug 6:** added a deterministic real-Socket.IO regression path for
  dismissal: force a dismissible six-pair hand only inside the test, emit the
  real dismissal event, assert zero points, same room/seat retained, and next
  deal succeeds. No dismissal rule was changed.
- **Cross-game lifecycle/reconnect:** result/winner payloads are restored to a
  reconnecting socket without replaying celebration side effects. Lobby Leave
  now removes the server seat/subscriptions rather than only clearing client
  state, closing a stale-room resurrection path.
- **Voice:** tightened signalling to actual in-call participants and bounded
  payloads; disconnect/leave cleanup avoids stale buffered leave events;
  speaking indicators are explicitly cleared when a peer is torn down.
- **Teen Patti groundwork (still disabled):** Classic engine rewritten toward
  the agreed rules: capped blind progression, three blind turns then forced
  seen-betting status without auto-revealing cards, seen = 2× current blind,
  compulsory anticlockwise sideshow with initiator losing exact ties, final-two
  mutual no-cost open show, and winner→next-dealer timing. Added data-driven
  variant descriptors, lobby setup proposal/acceptance model, session/protocol
  groundwork. Non-Classic runtime variants and the release-ready client table
  are still pending; registry remains `networkPlayable: false`.
- **Premium/client presentation:** opening experience, game selector, card/table
  styling and dealing presentation have been refined. The selector is compact
  for four titles: Hazari/Kitti live, Teen Patti/Poker Coming Soon. User has
  explicitly allowed redesign of all presentation/UX while game rules remain
  locked.
- **Android scaffolding:** added Capacitor configuration, Android scripts,
  microphone-manifest patcher, native Back bridge into the existing history
  guard, `ANDROID_RELEASE.md`, and a manual-only GitHub Actions workflow that
  runs server/client tests + builds before producing a debug APK artifact.
  Bundled content uses `https://localhost`, so
  staging Render must explicitly include that origin alongside Netlify in
  `ALLOWED_ORIGINS`; do not use `*`. Actual APK generation is **not possible in
  this environment** because npm registry access and the Android SDK are absent.
- **Verification performed here:** targeted TypeScript transpile/syntax checks on
  modified TS/TSX; pure Kitti and Teen Patti engine smoke checks were run during
  implementation for critical flows. This is **not equivalent** to the full
  Vitest/typecheck/build baseline and must not be reported as such.
- **Real-device gate:** Hazari full flow, Kitti 2/3-player + decider, voice and
  voice notes, native Back, portrait/landscape, reconnect, Bug 5 physical reveal
  scrolling and Bug 6 dismissal must be checked on the first APK before wider
  sharing.
- **New debt / deliberately pending:** Kitti optional bots and consensual virtual
  board; Hazari virtual board; Teen Patti full client/variants/P&L/mobile QA;
  Poker implementation/spec. `package-lock.json` cannot be regenerated until
  npm access is available.
- **Baseline status:** **checkpoint only, not a verified release baseline.** Do
  not deploy production from this state until dependencies are installed, the
  full suites/builds are green, and real-device APK QA passes.

---

## 2026-08-16 (later) — Bug 5 diagnosis corrected: the per-set reveal sheet, not RoundSummary, was the actually-broken screen

- **Model:** Sonnet
- **Context:** Real-device feedback clarified that the prior TWO rounds of
  "end-of-hand scroll" fixes had been applied to the wrong component.
  Hazari plays 4 SETS per round. After EACH set (1, 2, 3, and 4 - the
  SAME component every time, not a different one for the last set), a
  per-set result sheet appears showing that set's four hands, the winner,
  and the points awarded. RoundSummary (the screen both prior rounds
  actually fixed) is a SEPARATE component, shown once, only after the
  round's 4th set AND the round itself resolve - and was, per this
  round's own real-device confirmation, never actually broken.
- **Investigation (as required, before editing):** traced the runtime
  flow for all four `REVEALING_SET_N` game states (`types.ts`,
  server-side) through to the client. `App.tsx` places all four
  `REVEALING_SET_N` states inside `PLAYING_STATES`, meaning `HazariTable`
  stays mounted through every one of them - RoundSummary is only reached
  once `gameState.state` becomes `ROUND_COMPLETE`/`DISMISSED_ROUND`,
  which happens strictly after `REVEALING_SET_4`. The per-set result
  itself is rendered INLINE by `HazariTable.tsx` as `.reveal` - a
  `position: fixed` bottom sheet (`role="dialog"`), driven by
  `gameState.subRoundResultsThisRound`'s latest entry, auto-dismissing
  after 3.2s or on a "Continue" tap. This is genuinely ONE shared
  component for all four sets - there is no separate "set 4" variant.
- **Root cause:** `.reveal__sheet` had no height bound and no scroll
  mechanism at all - not a wrong one, none. `height: auto` with nothing
  capping it against the available viewport meant content taller than
  the visible space simply extended past the top of a `position: fixed`
  overlay with nothing to scroll it back into view. `.reveal` itself
  (the fixed backdrop, `inset: 0`) was already fine - it pins directly to
  the true viewport without depending on any `dvh` calculation, unlike
  its child.
- **Fix:** restructured `.reveal__sheet` into the same bounded-shell +
  JS-measured-height pattern proven for RoundSummary/WinnerScreen earlier
  today: `display: flex; flex-direction: column`, `max-height:
  calc(var(--js-vh, 100dvh) - 64px)` (the `-64px` keeps it reading as a
  rising sheet with headroom, not a full-screen takeover), `overflow:
  hidden`. Added a new `.reveal__body` wrapper around the content that
  actually grows with player count (the tie note, the hand-by-hand
  breakdown, the points line) - `flex: 1 1 auto; min-height: 0;
  overflow-y: auto; overflow-x: hidden; touch-action: pan-y`. The title
  (header) and Continue button (footer) stay outside `.reveal__body` as
  fixed-size flex rows, always visible regardless of scroll position.
  `HazariTable.tsx` now also calls `useVisualViewport()` (the same
  existing hook reused for RoundSummary/WinnerScreen) and passes
  `--js-vh` inline on `.reveal`, inherited down to `.reveal__sheet`.
- **RoundSummary/WinnerScreen were NOT touched this round** - confirmed
  by hash diff. Their own bounded-shell fix from earlier today is
  preserved exactly as it was.
- **Tests:** new `reveal.test.tsx` (9 tests) - genuine component-level
  coverage rendering `HazariTable` with a mocked game store at each of
  `REVEALING_SET_1` through `REVEALING_SET_4`, confirming: the same
  `.reveal`/`.reveal__sheet`/`.reveal__body` structure renders for every
  set (not four different implementations); the DOM order is header →
  scrollable body → footer button; `--js-vh` is correctly wired; the
  Continue button dismisses independent of scroll position; and,
  explicitly, that `HazariTable` never renders `.rsum` itself (RoundSummary
  is App.tsx's job once the screen swaps, not something `.reveal`
  rendering could trigger) - the specific regression guard for the
  confusion this bug's diagnosis went through twice. Added parallel
  CSS-level checks to `mobileSafety.test.ts` (4 new tests) for the same
  structural invariants, matching the established pattern for
  RoundSummary/WinnerScreen. Every new/changed assertion proven
  meaningful by reverting the corresponding code and confirming failure,
  then restoring it - including deliberately removing the `.reveal__body`
  wrapper and confirming two tests catch its absence.
- **Files changed:** `client/src/games/hazari/HazariTable.css` (`.reveal`
  restructure), `client/src/games/hazari/HazariTable.tsx` (`.reveal__body`
  wrapper + `useVisualViewport()` wiring), `client/src/games/hazari/
  reveal.test.tsx` (new), `client/src/platform/styles/mobileSafety.test.ts`
  (4 new tests). Nothing else - confirmed by hash diff: RoundSummary,
  WinnerScreen, and every Bug 1-4 file from earlier today are untouched.
- **Decisions:**
  - Recorded explicitly, for both `SESSION_CHANGELOG.md` and
    `HANDOFF.md`, that the correct mental model is "one shared per-set
    reveal component for all 4 sets" rather than "a different screen for
    set 4" - the framing that led to two rounds of fixing the wrong
    component.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 310/310 (unchanged). Client 377/377 (364
  baseline + 9 new `reveal.test.tsx` + 4 new `mobileSafety.test.ts`
  checks). All four remaining commands clean.
- **New debt:** none knowingly introduced. **Bug 5 (the per-set reveal
  fix) is NOT real-device verified** by this session. Given this bug's
  history (two prior fixes to the wrong component, each confirmed clean
  by a full test suite at the time), do not mark it passed until the
  owner has specifically scrolled the Set 1, 2, or 3 result sheet in a
  short landscape viewport and confirmed the lower hands are reachable.
- **Baseline status:** accepted, pending real-device retest.

---

## 2026-08-16 — Third real-device retest: Bugs 1-3 confirmed PASS; Bug 4 (side-seat names) and Bug 5 (result-screen scroll) genuinely fixed

- **Model:** Sonnet
- **Context:** Bugs 1 (backgrounding), 2 (Leave Table), and 3 (Arrangement
  FAB) are now OWNER-VERIFIED REAL-DEVICE PASS on the Android PWA. Per
  instruction, neither their code nor their tests were touched this
  session - confirmed by hash diff at the end (zero server files changed;
  zero client files outside the Bug 4/5 scope changed). Bugs 4 and 5
  remained open, each with new, more specific real-device detail.
- **Bug 4 (side-seat names, "Nawab" specifically) - found and fixed a
  SECOND real bug underneath the previous session's fix:** The prior
  session's inward-anchoring fix (a flat 6.5rem/5.25rem allowance) was
  re-verified against the real geometry rather than trusted, and found
  wrong in two compounding ways:
  1. `layout.test.ts`'s felt-width formula assumed
     `.hazari__table-area`'s horizontal padding scaled with viewport width
     (8px narrow / 16px regular). It does not - it is a flat
     `var(--space-2)` (8px) on EACH side, 16px total, at every width
     (`HazariTable.css`). This made the narrow-breakpoint felt-width
     estimate too generous, directly undermining the "safe" figure it
     produced.
  2. That flat allowance was applied to diagonal anchors (`top-left` etc)
     as well as pure `left`/`right`. On larger, currently-unreachable-but-
     shared ring sizes (5-9 players), some diagonal anchors sit much
     closer to the felt's own centre already (the 9-player ring's inner
     `top-left`/`top-right`, only 18 percentage points out, vs pure
     `left`/`right`'s real >=31.6 on every ring) - a flat width generous
     enough for the reachable 4-player case would have overshot those
     anchors' centreline by 40-60px, a real, provable regression on ring
     sizes Hazari does not use today but the layout code must not break.

  **Fix:** replaced the flat constant with a per-seat, viewport-dynamic
  `calc()` in `Seat.css`, driven by a new `--identity-dist` CSS custom
  property (`Seat.tsx`, computed as `|50 - x|` from each seat's own real
  position - not guessed per anchor name, which cannot distinguish "this
  ring's left seat" from "a different ring's left seat"), floored at the
  existing guaranteed-width baseline so nothing regresses. Scoped strictly
  to pure `left`/`right` (diagonal anchors reverted to the proven-safe
  centred default - explicitly NOT part of this bug, and provably unsafe
  under the same treatment on some ring sizes). Verified arithmetically
  against every supported player count (2-9), not just the reachable one.
  **Honestly documented, not fixed:** a 7+ character name AND a Bot badge
  AND the single tightest width (390px) may still ellipsize - the
  geometrically safe ceiling at that specific combination is a few pixels
  short of what "Kaushik"-as-a-bot needs. A dedicated test
  (`Seat.test.tsx`) records this shortfall explicitly rather than either
  silently failing to guarantee it or quietly relaxing the safety margin
  to paper over it.
- **Bug 5 (end-of-hand result screen not scrollable) - THIRD structure,
  after two prior real-device failures:** This retest's own real-device
  evidence ("physical vertical swiping does NOT scroll the result
  content") ruled out BOTH prior approaches: the original fixed-height/
  nested-scroll shell, and the following session's normal-page-flow/
  sticky-footer redesign. Traced the full ancestor chain from the result
  rows to `<body>` for every mechanism the retest asked about
  (`touch-action`, JS-level `touchmove`/`preventDefault` handlers,
  `overscroll-behavior`, transformed ancestors, the viewport meta tag) -
  found no single definitive blocker via static analysis, but confirmed
  `index.html`'s viewport meta tag carries `maximum-scale=1`, a
  documented source of touch-handling side effects on some Android
  WebView versions (flagged, not fully diagnosed as causal).

  Rebuilt to the retest's own explicit required structure: a BOUNDED
  shell (not page flow) with exactly ONE internal scroll region.
  Critically, the shell's height is no longer governed by CSS `dvh`
  alone - `--js-vh` (set inline by `RoundSummary.tsx`/`WinnerScreen.tsx`)
  is a height measured directly in JS via `useVisualViewport()`, an
  EXISTING hook already used elsewhere in this app for exactly this kind
  of reliability problem (mobile keyboard avoidance), reading
  `window.visualViewport`/`window.innerHeight` rather than trusting a CSS
  unit whose accuracy in Android PWA standalone mode had already cost two
  rounds of this bug. `100vh`/`100dvh` remain as the pre-mount/no-
  `visualViewport` fallback. `.rsum__scroll`/`.winner__scroll` are
  `flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden`,
  now also explicitly `touch-action: pan-y`. The action rows
  (`.rsum__actions`/`.winner__actions`) are plain flex-column siblings
  AFTER the scroll region - not sticky, not nested inside it - so they
  keep their own natural height and can never be pushed off-screen or
  scrolled away by content inside the scroll region.

  **WinnerScreen was changed too**, for the same reason as both prior
  rounds: not an independently confirmed defect, but sharing the exact
  same shell primitive (explicitly built as RoundSummary's twin) - kept
  in step on purpose rather than left on a structure already shown twice
  to fail.

  New component-level tests (`RoundSummary.test.tsx`,
  `WinnerScreen.test.tsx`) verify the ACTUAL rendered DOM - that the
  action row is a real sibling after the scroll region, not merely that
  the right class names exist in a stylesheet - and that `--js-vh` is
  correctly wired from a mocked `useVisualViewport()`. Rewrote
  `mobileSafety.test.ts`'s CSS-level checks for the new structure. Every
  new/changed assertion across both test files was proven meaningful by
  reverting the corresponding code and confirming the test fails, then
  restoring it - including catching a second instance of the exact
  comment/regex-collision bug found in an earlier round, this time in
  this session's own new explanatory comment.

  **Honest caveat, not glossed over:** this session cannot verify on a
  real device whether physical swiping now works. Every mechanism found
  through static analysis (dvh reliability, nested-scroll-region
  assumptions) has been addressed, but "swiping does nothing at all" is a
  strong enough symptom that a genuinely different cause (the viewport
  meta tag, or something else undiscoverable without a real device)
  remains possible. Flagged explicitly in `STAGING-CHECKLIST.md` and
  `HANDOFF.md` for particularly careful re-verification, not marked as
  confidently solved.
- **Files changed:** `client/src/platform/components/Seat.css` +
  `Seat.tsx` + `Seat.test.tsx` (Bug 4), `client/src/games/hazari/
  RoundSummary.css` + `RoundSummary.tsx` + new `RoundSummary.test.tsx`,
  `client/src/games/hazari/WinnerScreen.css` + `WinnerScreen.tsx` + new
  `WinnerScreen.test.tsx` (Bug 5), `client/src/platform/styles/
  mobileSafety.test.ts` (Bug 5 tests), `client/src/platform/table/
  layout.test.ts` (padding-formula fix shared with Bug 4's geometry).
  **Nothing else touched** - confirmed by hash diff: zero server files
  changed (Bugs 1-2's reconnect/leave logic untouched), zero
  `tokens.css`/`ArrangementTable.css`/`GameStore.tsx` changes (Bug 1-3
  untouched). `seatLayout.ts`'s seat x/y positions (fixed in the prior
  session) were re-verified, not re-changed.
- **Decisions:**
  - Diagonal seat anchors were deliberately EXCLUDED from Bug 4's inward-
    growth treatment, trading a plausible-but-unproven improvement for a
    provable regression avoided on ring sizes Hazari does not use today.
  - Bug 5's redesign is recorded as a full third structure, not a tweak,
    specifically so a future session does not attempt to "fix" this again
    by tuning vh/dvh values or overflow properties within either of the
    two approaches already shown to fail on a real device.
  - Every regression-sensitive test added or rewritten this session was
    verified by deliberately breaking the corresponding code and
    confirming failure, not just by a first-try pass - consistent with
    the previous session's practice, now doubly warranted given how many
    "test-verified" conclusions in this bug's history turned out wrong on
    an actual device.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 310/310 (unchanged, rerun to confirm the
  untouched baseline). Client 364/364 (338 baseline + 5 new
  `RoundSummary.test.tsx` + 3 new `WinnerScreen.test.tsx` + 18 net new/
  rewritten in `Seat.test.tsx`, replacing the prior session's 35 with a
  corrected 35). All four remaining commands (client typecheck, client
  build, server typecheck, server build) clean.
- **New debt:** none knowingly introduced beyond what's already recorded
  in `HANDOFF.md`. **Bugs 4 and 5 are NOT real-device verified** by this
  session - both remain arithmetic/component-test-level only. Given Bug
  5's history (two prior real-device failures despite clean test suites
  each time), this is flagged with unusual emphasis in
  `STAGING-CHECKLIST.md`: a clean suite here has specifically NOT been
  sufficient evidence twice already.
- **Baseline status:** accepted, pending real-device retest of Bugs 4-5.

---

## 2026-08-15 (evening) — Second real-device retest: Bugs 1, 2, 4 & 5 genuinely fixed; Bug 3 re-verified

- **Model:** Sonnet
- **Context:** A real-device Android PWA retest of the staging build deployed
  after the previous session's checkpoint found MULTIPLE bugs still
  failing, despite that session's fixes and full test suite passing.
  Treated as authoritative: the earlier session's conclusions on Bugs 1, 2
  and 5 were each wrong or incomplete in specific, identifiable ways -
  documented below so the actual root causes are on record, not just the
  fixes.
- **Bug 1 (Android backgrounding → "You're not in a game right now") -
  genuinely re-broken, now fixed:** Root cause: a `game:error` carrying the
  raw server message `"Not currently in a room."` could arrive during the
  reconnect window - or from a stale pre-background socket cycle - and get
  shown to the player even while the table was still legitimately valid
  and restoring normally. `onGameError` in `GameStore.tsx` now treats that
  one specific message as transient/stale (not shown) whenever restoration
  is active or the client still holds a room in state at all - the
  AUTHORITATIVE "you're really out" signal is `room:reconnect`'s own
  `ok:false` branch, which already handles this correctly with a clear,
  different message. Additionally gated every gameplay-emitting action
  (`playSet`, `confirmArrangement`, `requestDismissal`, `startNextRound`,
  `requestSuggestionOptions`) so none can fire while disconnected/
  restoring - closes the complementary race where a queued/buffered emit
  (socket.io-client's own default behaviour while offline) could reach the
  server before `room:reconnect` rebinds the socket. 5 new tests in
  `backgroundReconnect.test.tsx`.
- **Bug 2 (Leave Table → stuck on branded "Loading…" indefinitely) - a
  genuine SERVER bug, found and fixed:** `room:leaveTable` converted the
  leaving player to a bot and broadcast the room update, but never
  unsubscribed that player's OWN socket from the room's Socket.IO
  channels or cleared `socket.data` - so the leaving player's client kept
  receiving `room:update`/`hazari:state` for the rest of the game (bots
  keep playing), which could race against and silently overwrite the
  `room: null` the client had just set locally, leaving `room` real but
  `myPlayerId`/`myHand`/`lastRoundResult`/`winnerInfo` all correctly
  null - matching no screen's requirements, permanently landing on
  App.tsx's catch-all "Loading…". Added `leaveSocketFromRoom()`
  (`socketHandlers.ts`, the inverse of `joinSocketToRoom`), called before
  the post-leave broadcast. New real-socket integration test
  (`leaveTable.integration.test.ts`, 3 tests) - proven meaningful by
  reverting the fix and confirming it fails, then restoring it.
- **Bug 3 (Arrangement FAB vs "Dealt") - re-verified, unchanged:**
  Re-derived the geometry from scratch again per the retest brief's
  instruction not to trust a passing test suite alone. 236px portrait /
  228px landscape (set the previous session) are still correct: required
  clearance is 230.76px / 222.76px, both comfortably covered. Additionally
  checked the OPEN voice panel (not just the collapsed toggle, which is
  all the previous session verified) - its own `bottom` offset
  (`134px + reserve`) is strictly larger than the toggle's (`76px +
  reserve`), so if the toggle clears the sort control, the panel clears it
  with even more room; no change needed.
- **Bug 4 (ordinary short names still ellipsizing, e.g. "Raja" → "R…") -
  TWO independent real bugs found and fixed:**
  1. `.seat`'s `align-items: center` gave `.seat__info` (and everything
     inside it, down to the name text) a width COMPUTED from its own
     content via flexbox shrink-to-fit, not a width GUARANTEED by the
     seat's declared 5.5rem/4.5rem. On paper an ordinary short name was
     entitled to the full width whenever it needed less - but the actual
     number handed to it was the outcome of an intrinsic-sizing
     computation threaded through three nested boxes, not a fixed value,
     and real device rendering did not hand it what the arithmetic
     implied it should. Changed to `align-items: stretch`, with
     `.seat__avatar-wrap` given `align-self: center` specifically to opt
     back out (otherwise `.seat__ring`/`.seat__dealer-dot`, positioned
     relative to that wrapper's own box, would have spread to the full
     seat width instead of hugging the avatar).
  2. Independently, re-derived the seat-to-felt geometry properly this
     time - the existing margin check (`platform/table/layout.test.ts`)
     compared a seat's footprint against `.table`'s own box, but `.table`
     has its own 1.4%/1.2% padding around `.table__felt` (CardTable.css) -
     the box that actually clips (`overflow: hidden`) - which the check
     never subtracted, and additionally allowed 16px of "slack" on the
     theory that a seat could safely hang over into a non-existent
     forgiving margin. Redone against the felt's real width: several
     seats were measurably OUTSIDE the true clipping boundary at common
     phone widths - as much as **-9.75px** (7-9 player rings) and
     **-0.38px** (the LIVE 4-player ring, at 390px - a very common phone
     width) - meaning the felt's own `overflow: hidden` was genuinely
     clipping part of the seat, name included, on real devices. Re-derived
     safe x/y positions for every ring size (2-9 players) in
     `seatLayout.ts`, moving only the anchors that actually needed it;
     rewrote `layout.test.ts` to check against the felt (not `.table`),
     drop the false "slack", and additionally require a real minimum
     margin (not just non-negative) at every target width. Both fixes
     proven independently by reverting each and confirming the
     corresponding tests fail, then restoring them. 12 new arithmetic
     tests in `Seat.test.tsx` for the width-allocation fix specifically
     (explicitly not just asserting `text-overflow: ellipsis` exists, per
     the retest brief).
- **Bug 5 (end-of-hand RoundSummary/WinnerScreen not scrollable in short
  landscape) - the previous session's fix was WRONG; redesigned from
  scratch:** The previous session concluded the CSS was already correct
  and the failing test was a false positive (a comment containing the
  literal string it was matching against) - fixed the test, reworded the
  comment, changed nothing about actual runtime behaviour. This retest's
  real-device evidence (still FAIL) proves that conclusion was wrong, or
  at least incomplete: since NO functional CSS had changed, the screen's
  real behaviour was never actually altered between the two retests.
  Rather than continue tuning the same approach a real device had now
  rejected twice, replaced the whole pattern: `.rsum`/`.winner` no longer
  pin themselves to exactly one viewport height with `overflow: hidden`
  and a nested `overflow-y: auto` scroll region - that depends on `dvh`
  computing the actual usable height correctly in Android PWA standalone
  mode (a documented rough edge that can survive as a *recognised but
  wrong* value, which no vh-then-dvh fallback cascade catches, since that
  only helps when a later declaration is dropped outright) and on a
  nested scroll region reliably keeping touch-scroll capture rather than
  the outer page (a known category of WebView inconsistency) - NEITHER of
  which this environment could ever verify, and real-device testing twice
  suggested at least one does not hold. Redesigned: `.rsum`/`.winner` now
  use `min-height` (a floor, not a ceiling) and normal flex-column flow;
  content taller than one screen simply makes the PAGE taller, and the
  browser's own universally-reliable page scroll takes over - confirmed
  nothing between here and `<body>` clips or hard-caps its own height
  (`.app-root` is `min-height`; `.screen-fade` sets none;
  `html`/`body`/`#root`'s `height: 100%` does not clip an overflowing
  child by default). `.rsum__actions`/`.winner__actions` switched from a
  fixed grid row to `position: sticky; bottom: 0`, which has been
  reliably supported in every target browser for years - "Next round"/
  "Play again" stay visually pinned to the bottom of the screen as the
  page scrolls, without depending on precise viewport-unit accuracy or a
  nested scroll region at all. Backgrounds on the action bars changed
  from a translucent gradient to solid at the lower edge, since content
  now legitimately scrolls behind them once they start sticking.
  Rewrote `mobileSafety.test.ts`'s RoundSummary/WinnerScreen tests to
  check the new invariants (min-height floor + vh-then-dvh cosmetic
  fallback, no shell-level `overflow: hidden`, sticky action bars) -
  including one MORE comment/regex collision of the exact kind the
  previous session found and fixed (this session's own explanatory
  comment for `.rsum` happened to contain the literal text
  `overflow: hidden` as prose) - stripped comments before matching, same
  established pattern. All four rewritten/new assertions proven
  meaningful by reverting the corresponding CSS and confirming failure,
  then restoring it.
- **Also fixed:** a flaky race in one of this session's own new Bug 1
  tests (`backgroundReconnect.test.tsx`) - asserted `isRestoring === false`
  immediately after `room` updated, but restoration releases on the NEXT
  TICK after the reconnect ack (`GameStore.tsx`'s own documented
  behaviour) - occasionally observed `true` depending on scheduling.
  Fixed to `await waitFor(...)` on `isRestoring` explicitly, and verified
  stable across repeated runs.
- **Files changed:** `client/src/lib/GameStore.tsx` (Bug 1),
  `client/src/lib/backgroundReconnect.test.tsx` (Bug 1 tests + flaky-test
  fix), `server/src/platform/net/socketHandlers.ts` (Bug 2),
  `server/tests/leaveTable.integration.test.ts` (new, Bug 2),
  `client/src/platform/components/Seat.css` +
  `client/src/platform/components/Seat.test.tsx` (Bug 4, width
  allocation), `client/src/platform/table/seatLayout.ts` +
  `client/src/platform/table/layout.test.ts` (Bug 4, felt-margin
  geometry), `client/src/games/hazari/RoundSummary.css` +
  `client/src/games/hazari/WinnerScreen.css` (Bug 5, redesign),
  `client/src/platform/styles/mobileSafety.test.ts` (Bug 5 tests
  rewritten). Bug 3: nothing changed, re-verified only.
- **Decisions:**
  - Bug 5 in particular is recorded as a full redesign, not a tweak,
    specifically so a future session does not attempt to "fix" this again
    by adjusting vh/dvh values or overflow properties within the OLD
    fixed-shell pattern - that pattern is not just imperfectly tuned here,
    it depends on device/browser behaviour this environment cannot verify
    and real testing has now contradicted twice.
  - Every fix in this session that could be verified by reverting it and
    confirming the corresponding test fails was verified that way, not
    just by the new test passing on the first try - given how much of
    this session was correcting a PREVIOUS session's confident-but-wrong
    conclusions, passing-on-first-try was no longer treated as sufficient
    evidence on its own.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 310/310 (307 baseline + 3 new). Client 338/338
  (326 baseline + 12 new `Seat.test.tsx` cases). All four remaining
  commands (client typecheck, client build, server typecheck, server
  build) clean. Forensic hash diff re-run against a fresh pre-session
  baseline - only the files listed above changed.
- **New debt:** none knowingly introduced. As before, **none of Bugs 1-5
  are real-device verified** by this session - all fixes are
  arithmetic/integration-test-level only, in an environment with no
  browser access. Given this is the SECOND round of real-device fixes
  where at least one prior "test-verified" conclusion turned out wrong on
  an actual device, real-device redeployment and retest matters more than
  usual here, specifically for: Bug 5's new sticky-action-bar behaviour
  (never seen rendered), Bug 4's seat/name positions at the newly
  re-derived x-values (a visible, if modest, shift from before), and
  Bug 1/2's fixes (both are timing/race-dependent by nature, the hardest
  category to fully trust from static analysis and mocked-socket tests
  alone).
- **Baseline status:** accepted.

---

## 2026-08-15 — Frozen-checkpoint verification: Bugs 1-5 (Android PWA staging)

- **Model:** Sonnet
- **Baseline before:** server 307/307, client 307/308 (1 documented failure -
  `mobileSafety.test.ts`'s RoundSummary vh/dvh check). Delivered as an
  explicitly FROZEN, immutable starting ZIP (`cardroom-checkpoint.zip`), per
  the owner's brief - not the live workspace. Independently re-verified at
  the start of this session by running all six commands before any edit;
  matched the brief exactly. Baseline file hashes recorded for every file in
  the tree before any edit, and re-diffed at the end - only the files listed
  below changed, nothing unexplained.
- **Task:** Verify five owner-confirmed Android PWA staging defects
  (Hazari Arrangement FAB overlap, Seat name/Bot-badge crowding, end-of-hand
  scroll, plus an integration review of two already-implemented fixes:
  background/reconnect and Leave/blank-screen), re-deriving each from the
  frozen source rather than trusting the checkpoint's own unverified values.
- **Bug 1 (Android background/app switching) & Bug 2 (blank screen after
  Leave) - integration review, no rewrite:** Both were personally written in
  the previous session and marked complete pending real-device retest. Read
  `GameStore.tsx`'s full reconnect lifecycle (`onConnect`/`onDisconnect`,
  the `reconnectAttemptRef` stale-ack guard, the foreground
  `visibilitychange`/`pageshow` nudge, authoritative-failure-only state
  clearing) and `App.tsx`'s full routing chain (the `screenKey` conditional
  chain, the "never route to a screen whose required state is missing"
  defensive fallback, `useBackGuard` wiring, `pendingLeaveConfirm`
  resync) against their existing test suites
  (`backgroundReconnect.test.tsx`, `App.backGuard.test.tsx`,
  `useBackGuard.test.ts`) line by line. Also confirmed server-side:
  reconnect is token-keyed (`roomManager.reconnect(token, ...)`), never by
  display name, matching `HANDOFF.md`'s standing rule. Found both correct
  as written. **No defect found; preserved exactly as in the checkpoint,
  nothing rewritten.**
- **Bug 3 (voice/call FAB overlapping "Dealt" on Hazari Arrangement) -
  found genuinely wrong, corrected:** The checkpoint's own reserve values
  (158px portrait / 150px landscape) were re-derived from scratch against
  the real DOM order in `ArrangementTable.tsx`
  (`.arr__actions` → `.arr__fan` → `.arr__hand-bar`), not assumed. The
  earlier derivation had two compounding errors: it counted `.arr__hand`'s
  own top padding (which sits on the FAR side of the sortbar from the FAB,
  irrelevant to clearing it) while omitting `.arr__fan` entirely - the
  actual fan of cards sitting BETWEEN the rail and the sortbar, and by far
  the largest term (≈80px, one small card plus its padding). Correct
  required clearance: 230.76px portrait / 222.76px landscape. **Changed**
  `platform/styles/tokens.css` to 236px / 228px (small buffer, consistent
  with the file's own existing style) and rewrote the derivation comment.
  **Changed** `mobileSafety.test.ts`: renamed `arrangementHandBar()` to
  `arrangementFanAndSortbar()`, corrected it to include the fan's own
  (orientation-dependent) padding and drop the irrelevant hand-padding
  term, and updated its three call sites. All existing ordering/ceiling
  assertions (landscape < portrait, panel fits an 480px-tall landscape
  viewport) re-verified against the new numbers before committing to them.
- **Bug 4 (player names / Bot badge clipped or crowded) - Seat.\* reviewed
  and preserved; a second, previously-unflagged defect found and fixed in
  DealerToken:** `Seat.tsx`/`Seat.css`/`Seat.test.tsx` were reviewed from
  scratch against the full requirement list (readable name, Bot badge never
  covering it, readable score/status, no excessive shrinking, intentional
  ellipsis on long names). Found correct: the name text is a genuine
  separate flex sibling from the Bot tag (not a bare text node beside it,
  which is the specific flexbox gotcha that defeats `text-overflow`), the
  Bot tag is `flex: 0 0 auto` so it's never the one asked to shrink, and
  `min-width: 0` is present on the name specifically (flex items default to
  `min-width: auto`, which otherwise blocks truncation entirely). Score and
  status render only short, fixed-length strings (`"pts"`, `"Away"`,
  `"Reconnecting"`) - confirmed against `HazariTable.tsx`'s actual props,
  not assumed - so no overflow risk there. **Kept exactly as found.**
  Independently checked the two cross-cutting requirements ("side-seat
  identities remain inside viewport" and "dealer token does not cover
  identity") arithmetically against `seatLayout.ts`'s real seat ring
  coordinates: the first was already covered by the existing
  `platform/table/layout.test.ts` (unchanged, still 19/19). The second
  was NOT - `DealerToken.tsx` pulled the token toward the table centre by
  20% of the FELT's own size, and the felt's pixel size varies enormously
  across the supported range (a 320px phone up to the 60rem/72dvh desktop
  cap - `CardTable.css`), while the avatar and name text stay fixed-px.
  At realistic sizes that "20%" was tens of pixels - for any anchor whose
  centre-ward direction is downward in screen space (`top`, `top-left`,
  `top-right` - the SAME direction every seat's name renders below its
  avatar), the token landed on top of the name label. This is reachable
  in the CURRENTLY LIVE 4-player Hazari ring (the `top` seat), not just a
  future 5-9 player case. **Changed** `DealerToken.tsx`/`DealerToken.css`:
  the component now only decides pull DIRECTION (a unit-less -1/0/1 CSS
  variable per axis); the actual distance is a small FIXED pixel amount in
  CSS (`--dealer-pull: 8px`, 6px under the narrow-phone breakpoint),
  scaled by the seat's own `--seat-scale` so it shrinks exactly as much as
  the avatar does for smaller seat tiers. **Added**
  `DealerToken.test.tsx` - arithmetic geometry checks (no rendering,
  matching this project's established style for this kind of proof) at
  every seat-scale tier (1 / 0.9 / 0.8) and both breakpoints, proving
  non-negative clearance between the token and the name row, plus a
  regression guard against ever reintroducing a felt-relative percentage
  pull.
- **Bug 5 (end-of-hand RoundSummary not scrollable in landscape) - the
  actual component identified, the actual layout re-verified correct, the
  FAILING TEST was itself buggy:** Confirmed via `App.tsx`'s routing chain
  that the screen shown after each Hazari hand/set ends (`ROUND_COMPLETE` /
  `DISMISSED_ROUND`) is `RoundSummary`; `WinnerScreen` is a different
  screen, shown only on `GAME_COMPLETE` (the overall match). Read
  `RoundSummary.css`'s `.rsum` shell in full: `display: grid;
  grid-template-rows: 1fr auto; height: 100vh; height: 100dvh; overflow:
  hidden`, with `.rsum__scroll` (`min-height: 0; overflow-y: auto`) as the
  single internal scroll region and `.rsum__actions` as the fixed second
  row - this is exactly the correct pattern (one scroll region, action
  rail always reachable, `vh`-then-`dvh` cascade so an unsupporting
  browser silently keeps the widely-supported line instead of ending up
  with no height constraint at all) and was NOT actually broken. The
  failing test (`mobileSafety.test.ts`, "both migrated screens fall back
  to 100vh before 100dvh") counted THREE height declarations instead of
  two - not because the CSS was wrong, but because the test's own
  rule-body extraction did not strip comments before matching, and
  `.rsum`'s own explanatory comment for this exact fallback happens to
  contain the literal text "height: 100dvh" as prose, inflating the
  regex's match count by one. `WinnerScreen.css`'s equivalent comment
  avoided this by construction (already phrased without repeating the
  literal property:value pair), which is why only RoundSummary's copy of
  this test failed. **Changed** `mobileSafety.test.ts`: the test's
  `ruleBody` helper now strips `/* ... */` comments before matching,
  mirroring the pattern the same file already uses in its "safe-area
  insets do not create gaps" check - this fixes a false failure on
  already-correct CSS rather than weakening any real assertion (the
  vh-then-dvh, exactly-two-declarations invariant itself is unchanged and
  still enforced). **Also changed** `RoundSummary.css`'s comment wording
  (no CSS/behaviour change) to stop spelling out the literal
  `height: 100dvh` string, matching `WinnerScreen.css`'s already-careful
  phrasing, so the underlying fragility is closed rather than only papered
  over by the test fix. **WinnerScreen was not independently broken** and
  needed no changes - its shell already correctly mirrors RoundSummary's,
  and its own comment already says so explicitly ("Precautionary
  hardening, not a claim this screen was independently confirmed
  broken").
- **Files changed:** `platform/styles/tokens.css` (Bug 3 reserve values +
  comment), `platform/styles/mobileSafety.test.ts` (Bug 3 test derivation
  fix + Bug 5 comment-stripping fix), `platform/components/DealerToken.tsx`
  + `DealerToken.css` (Bug 4 fix), `platform/components/DealerToken.test.tsx`
  (new, Bug 4 regression coverage), `games/hazari/RoundSummary.css`
  (Bug 5 comment wording only - no behaviour change). `Seat.tsx` / `Seat.css`
  / `Seat.test.tsx` reviewed and left byte-identical. No server file
  touched. Every other file in the frozen checkpoint is byte-identical to
  the upload - verified by hash diff before packaging, not assumed.
- **Decisions:**
  - Bugs 1 and 2's existing implementations are correct and were not
    rewritten, per the brief's own instruction not to redo accepted work
    without evidence of a defect - none was found.
  - The dealer-token fix (Bug 4) was not explicitly named in the owner's
    original report ("names clipped or crowded"), but is squarely inside
    the brief's own stated requirement list for this bug ("dealer token
    does not cover identity") and is reachable today in live 4-player
    Hazari (the `top` seat), not a hypothetical future case - fixed rather
    than deferred.
  - Bug 5's fix is on the TEST, with a matching but purely cosmetic CSS
    comment change - not the RoundSummary/WinnerScreen layout itself,
    which was already correct. Recorded explicitly so a future session
    does not go looking for a scrolling defect that was never really
    there.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 307/307 (unchanged, rerun to confirm). Client
  315/315 (308 baseline incl. the 1 now-fixed failure, + 7 new
  `DealerToken.test.tsx`). All four remaining commands (client typecheck,
  client build, server typecheck, server build) clean.
- **New debt:** none knowingly introduced. All five bugs are fixed and
  verified in-environment (arithmetic/test-level) only - **none of Bugs
  1-5 are real-device verified**; all five still require redeployment to
  staging and a fresh owner Android PWA QA pass covering the same
  screens/orientations as before. The dealer-token fix in particular
  changes a visual detail (a smaller, fixed-pixel nudge instead of the old
  oversized percentage one) that would benefit from a specific look on a
  real phone even though it's arithmetically proven safe.
- **Baseline status:** accepted.

---

## 2026-08-15 — Premium entry + persistent identity + Android/PWA Back navigation

- **Model:** Sonnet
- **Baseline before:** server 307, client 245 (reverified at session start —
  matched exactly; had to `npm install` in both packages since the delivered
  zip strips `node_modules`)
- **Task:** Welcome screen + compact Player Profile sheet as the app's true
  entry point, persistent local player identity (separate from the
  reconnect/session token), and Android/PWA/browser Back-button handling
  that never silently exits the app or abandons a room.
- **Unexplained tree changes — second occurrence this project, found,
  reviewed, resolved.** Mid-task, while about to create `PlayerProfile.tsx`,
  found it already existed with content contradicting this session's own
  prior message ("Not yet done: PlayerProfile.tsx"). Checked the full scope
  before continuing: `App.tsx`, `App.backGuard.test.tsx` (new),
  `Home.tsx`, `Home.css`, `HomeScreen.tsx`, `HomeScreen.test.tsx`,
  `HomeScreen.entryFlow.test.tsx` (new), `PlayerProfile.tsx` (new),
  `PlayerProfile.css` (new), `mobileSafety.test.ts`, and `PROJECT_STATE.md`
  all differed from the last delivered zip without a matching record of
  having been written this session. Per this file's own standing
  instruction (see the 2026-08-14 entry below for the first occurrence),
  stopped and reported rather than building on top of it. On instruction,
  reviewed each file independently (diff / problem / correctness / scope /
  risk to reconnect, session identity, Back behaviour, duplicate joins)
  rather than trusting or reverting wholesale:
  - `App.tsx` / `App.backGuard.test.tsx`: core implementation correct and
    verified by hand against the real screen-routing chain - correctly
    reuses `useBackGuard`/`ConfirmDialog` (this session's own earlier work)
    with matching semantics, including the non-obvious `consumeAsBack()`
    push-vs-replace mechanic. Found one real gap neither the code nor its
    tests covered: `pendingLeaveConfirm` never resynced if `screenKey`
    changed for a reason *other* than that dialog's own confirm/cancel -
    e.g. the host starting the game while a different player has a stale
    Lobby leave-confirm open, which could show wrong wording and call the
    wrong leave function. **Modified**: added an effect that dismisses a
    stale confirmation whenever `screenKey` changes underneath it, plus a
    regression test.
  - `Home.tsx` / `Home.css`: minimal, backward-compatible (`playerAvatar` is
    an optional prop), correctly reuses `AvatarBadge`. **Kept as found.**
  - `HomeScreen.tsx`: thoroughly verified - the `entryStage` state machine,
    the `profileOriginRef` contextual Back-target, and the `screen`/`return`
    restructuring (required so `useBackGuard` can be called unconditionally,
    same constraint this session had already identified independently) are
    all correct. Confirmed by hand that the invite-link/reconnect-race path
    is untouched in behaviour, only restructured from early-returns into the
    same `let screen; if/else; return screen` pattern App.tsx already uses.
    **Kept as found.**
  - `HomeScreen.test.tsx`: the one assertion this session had already
    identified as needing an update (it tested the now-superseded
    "no invite → Landing directly" behaviour) was fixed correctly, with
    reasoning distinguishing it from the invite-race tests it sits next to
    (which are untouched). **Kept as found.**
  - `HomeScreen.entryFlow.test.tsx`, `PlayerProfile.tsx/css`,
    `mobileSafety.test.ts`: verified against real component interfaces
    (including this session's own `Welcome.tsx`/`identity.ts`, not a
    fictional API), real design tokens, and real DOM behaviour rather than
    mocked-away logic - includes a genuinely non-obvious test (typing a
    name does not push a history entry per keystroke) that only makes sense
    with real understanding of `useBackGuard`'s mechanics. **Kept as
    found.**
  - `PROJECT_STATE.md`: the two new rows are dated 2026-08-15, one day
    after the last delivered zip's 2026-08-14 - flagged as a possible
    future-dated error, but `user_time_v0` confirms 2026-08-15 genuinely is
    today. **Kept as found**, not "corrected" into an actual error.
  - As before, this session cannot explain how this content came to exist
    - only that there is no record of writing any of it, and (for
    `PlayerProfile.tsx` specifically) an explicit prior message stating the
    opposite. Recorded as fact, not speculation.
- **Entry experience:** `Welcome.tsx` (true root) → `PlayerProfile.tsx`
  (first-time setup, or later editing - same component either way) →
  `Home.tsx` ("THE CARD ROOM"). Welcome always shows first on a normal
  launch, for both first-time and returning visitors, per the brief -
  returning visitors get a one-tap "Continue as `<name>`" rather than
  skipping Welcome entirely. An invite link bypasses Welcome completely and
  keeps the existing, separately-hardened `Landing` flow untouched.
- **Persistent identity:** `lib/identity.ts` gained a stable `profileId`
  (via `crypto.randomUUID()`, with a fallback), generated once and kept
  across edits. Existing saved identities (no `profileId`) are migrated
  in place on first read, not treated as "no profile." Stored under the
  same `haazari_identity_v1` key as before, entirely separate from
  `GameStore`'s `haazari_session_v1` reconnect token - neither module
  touches the other's key (see `identity.test.ts`'s dedicated separation
  tests). Not sent to the server; no account system.
- **Android/PWA Back navigation:** `lib/useBackGuard.ts`, a shared hook
  (not a second router) used independently by `App.tsx` (room-level
  screens) and `HomeScreen.tsx` (entry-level screens), handing off via
  `disabled: screenKey === 'home'` so exactly one instance is ever
  intercepting Back at a time. Lobby and an active game show a premium
  "Leave this room? Stay/Leave" (`ConfirmDialog.tsx`) that calls the exact
  same `leaveSession`/`leaveTable` the existing visible Leave buttons call
  - no new leave semantics. Round-summary/winner absorb Back rather than
  exiting unexpectedly. Welcome and an invite link's own landing are true
  roots - Back there exits normally, never trapped.
- **Files changed:** see the diff for the complete list; grouped above by
  area rather than repeated here. No server file touched.
- **Decisions:**
  - "Hazari Home" (named in the brief's Back-navigation table) has no
    separate existing screen from "THE CARD ROOM" game selector - Home.tsx
    already shows all three games with their own inline actions on one
    screen, no drill-down. Treated as the same screen for Back purposes;
    documented here rather than inventing a screen that serves no purpose.
  - Editing profile is reachable only pre-room (Welcome's "Change profile",
    THE CARD ROOM's header control) - there is no profile control inside
    Lobby or the table, which satisfies "defer editing during an active
    room" by construction rather than needing explicit guard logic.
  - Not deployed. Kitti not started, per explicit instruction.
- **Tests after:** server 307 (untouched, rerun to confirm), client 284
  (245 baseline + 9 `identity.test.ts` + 8 `useBackGuard.test.ts`, both this
  session's own + 12 `HomeScreen.entryFlow.test.tsx` + 8
  `App.backGuard.test.tsx` (7 kept as found + 1 added for the
  `pendingLeaveConfirm` fix) + 2 new `mobileSafety.test.ts` cases, of
  unexplained origin but independently verified). All four commands (server/
  client × test/typecheck, plus both builds) clean.
- **New debt:** Real-device QA entirely outstanding for all of this (same
  standing environment limitation as everything else) - see
  `STAGING-CHECKLIST.md` sections 11-12. The Back-guard's "absorb silently"
  behaviour on round-summary/winner/loading has no visible feedback at all
  when a press is swallowed; worth a real-device opinion on whether that
  reads as "nothing happened" or as unresponsive.
- **Baseline status:** accepted.

---

## 2026-08-14 — Staging deployment + first-pass Android QA (documentation reconciliation)

- **Model:** Sonnet
- **Baseline before:** server 307, client 236 (per `HANDOFF.md`/`PROJECT_STATE.md`; not independently rerun for this documentation-only entry)
- **Task:** Reconcile documentation with real-world events that happened after
  this snapshot's docs were written, and which this snapshot could not know
  about: the owner deployed a staging environment and ran a first-pass manual
  QA round on a real Android phone. No source, test, package or configuration
  files touched in this entry.
- **What actually happened (owner-reported, not performed by this session):**
  - New public GitHub repo `Cardroom` created; this audited snapshot pushed to it.
  - Render staging Web Service created from `server/`:
    `https://cardroom-staging-server.onrender.com`. `NODE_ENV=production`,
    `ALLOWED_ORIGINS=https://cardroom-staging.netlify.app`. `/health` confirmed responding.
  - Netlify staging site created from the same repo:
    `https://cardroom-staging.netlify.app`. `VITE_SERVER_URL` set to the Render
    staging address.
  - Client and server confirmed communicating over Socket.IO on staging.
  - Owner opened the staging build on one real Android phone, portrait and
    landscape, and visually reviewed Home, Lobby, Arrangement and the Hazari
    Table screens. This is the **first real-device rendering this project has
    ever had.**
  - **Production is untouched and still blocked.** The old, previously-live
    Hazari deployment is untouched, separate, and unaffected.
- **Files changed:** `HANDOFF.md`, `PROJECT_STATE.md`, `ROADMAP.md`,
  `STAGING-CHECKLIST.md` (one item ticked, scope note added), this file.
- **Decisions:**
  - The owner's supplied observations are treated as the authoritative first
    real-device test report, not as something this session verified by
    screenshot or automation — no browser/device access exists in this
    environment (confirmed again this session: Chromium/apt still blocked).
  - Only the checklist item unambiguously implied by the report ("Home screen
    opens on the staging address") was ticked. Everything else the owner's
    report touches on (Lobby, Arrangement, Table being reachable) was
    documented in prose rather than ticked, since the report was a layout
    critique, not a run through `STAGING-CHECKLIST.md` item by item.
  - This is documentation reconciliation only. The confirmed layout issues
    themselves (Home landscape clipping, Lobby portrait/landscape overlap and
    overflow, Arrangement portrait/landscape crowding, Table portrait/landscape
    collisions) are addressed in the implementation pass recorded in the next
    entry below.
- **Tests after:** unchanged — not rerun for a docs-only entry.
- **New debt:** none introduced. Existing debt (no real browser/device access
  *in this environment*, most of `STAGING-CHECKLIST.md` still unverified, no
  iPhone testing yet) remains and is now stated more precisely rather than as
  a blanket "never deployed."
- **Baseline status:** accepted — supersedes the previous "staging never
  deployed" baseline in `HANDOFF.md`/`PROJECT_STATE.md`/`ROADMAP.md`.

---

## 2026-08-14 — Mobile fixes, premium visual unification, PWA implementation

- **Model:** Sonnet
- **Baseline before:** server 307, client 236 (independently reverified at the
  start of this entry's work, before any edits — matched exactly)
- **Task:** Fix the confirmed staging mobile bugs, extend premium visual
  unification to the Lobby, and implement PWA installability, per the
  owner's staging QA report. Mid-task, this session found unexplained
  changes already present in the working tree that it had not made and
  could not initially account for; see "Unexplained tree changes" below.
- **Unexplained tree changes — found, reviewed, resolved:** Before this
  session made any of its own edits beyond documentation and two CSS
  landscape queries, six files were already different from the pristine
  upload, with content this session had not written: `tokens.css`
  (`--top-fab-reserve`), a new `RoomLobby.css`, `VoiceCallPanel.css`,
  `GameStore.tsx` (`getStoredSessionRoomCode`), `HomeScreen.tsx`, and a new
  `HomeScreen.test.tsx`. Per this file's own standing instruction, the
  session stopped and reported this rather than building on top of it. On
  the owner's instruction, each file was then reviewed independently
  (diff / problem / correctness / scope / reconnect risk) rather than
  either trusted or reverted wholesale:
  - `tokens.css`: correct and additive. **Kept as found.**
  - `GameStore.tsx` / `HomeScreen.tsx` / `HomeScreen.test.tsx`: traced by
    hand against the real `onConnect`/reconnect flow and `App.tsx`'s
    routing; the race condition it fixes is real, the fix is read-only, and
    it self-heals on both reconnect success and failure. **Kept as found**
    (see the duplicate-player entry below).
  - `VoiceCallPanel.css`: the selector fix was correct, but the landscape
    values it reactivated dropped `var(--action-reserve)` entirely — the
    exact anti-pattern `tokens.css` itself documents as already having
    caused a real collision once. **Rewritten** rather than kept as-is.
  - `RoomLobby.css`: well-built, but not wired up — `RoomLobby.tsx` still
    imported the old `Lobby.css`, whose `.room-lobby*` rules had been
    deleted in the same change, leaving the Lobby screen unstyled. Also
    still carried the legacy glassmorphism `.panel` class in the JSX
    alongside it. **Fixed and wired in**, not reverted, since the CSS itself
    was sound.
  - This session cannot explain how these six files came to be modified —
    only that its own tool calls did not do it (one relevant call, to
    `tokens.css`, is on record as having failed). Recorded here as fact,
    not speculation, for whoever reads this next.
- **Premium visual unification:** `RoomLobby` (title/code/players/actions)
  moved off the legacy gold/glassmorphism language onto card-room tokens —
  wood-panelled cards, brass accents, no `backdrop-filter`. `Landing`,
  `TablesBrowser`, `AvatarPicker` remain legacy (out of scope this pass).
  Hazari Table's centre "Your turn" label got a brass emphasis treatment,
  distinct from the passive "Waiting for X" state, for contrast (Part 3.F).
- **Mobile fixes, by confirmed issue:**
  - *Home landscape* (hero too tall, primary action clipped): `Home.css`
    landscape compaction — drops the lamp, hides the blurb/eyebrow, 3-column
    game grid. `Lobby.css`'s `.landing` (literal "Quick Match" button) got
    the same treatment as cheap insurance.
  - *Lobby portrait* (gear over title, "Add Computer Player" wrap):
    `--top-fab-reserve` clears the gear; actions are now full-width so long
    labels wrap inside their own button instead of squeezing an auto-width one.
  - *Lobby landscape* (controls below viewport): `RoomLobby.css` 2-column
    grid (title / code+players / actions / hint).
  - *Arrangement portrait* (fan overlap, gear over "13 left"):
    `--top-fab-reserve` on `.arr__bar`; fan overlap relaxed at the 375px+
    tier (was uniformly tuned for 320px up to tablet).
  - *Arrangement landscape* (board nearly cut off): `.arr` restructured
    into a 2-column grid — felt gets its own tall column instead of a row
    squeezed by hand+actions below it.
  - *Hazari Table portrait* (right player clipped): traced to real geometry —
    seats at x:10/90 with `.table__felt{overflow:hidden}` clip on nearly any
    mobile table width at full seat scale. Pulled the 4-seat ring's left/right
    to x:12/88 (`seatLayout.ts`).
  - *Hazari Table landscape* ("0/360" crowded, hand groups high): same
    `--top-fab-reserve` applied to `.hazari__bar`; `VoiceCallPanel.css`'s
    dead landscape selector fixed (see above) without reintroducing the
    dropped-reserve collision.
- **PWA:** manifest renamed Haazari → Cardroom (`name`/`short_name`), hard
  `"orientation": "portrait"` lock removed entirely, new maskable-safe
  dark/brass icon set generated from scratch (replacing a gold-casino
  "1000 HAAZARI" image) at 192/512/apple-touch sizes. Hand-written
  `public/sw.js` (no new build dependency): precaches the app shell,
  cache-first for hashed assets, network-first for `index.html`/manifest,
  and — the one non-negotiable property — bypasses everything cross-origin
  and any `/socket.io/` path before any caching logic runs, so it can never
  touch live game traffic. New versions install but wait; nothing
  auto-activates or force-reloads mid-game. `offline.html` branded fallback.
  `registerServiceWorker.ts` + `UpdateBanner.tsx` (production-only,
  dismissible, reuses `--action-reserve` so it can't sit on an action rail).
  `useInstallPrompt.ts`/`InstallBanner.tsx` needed no changes — already
  generic, no hardcoded branding.
- **Files changed:** see the full staging fix report for the complete list;
  summarized above by issue rather than repeated here.
- **Decisions:**
  - In-game copy ("Haazari"/"Hazari" as the *game name*, in `RoomLobby`,
    rules docs, etc.) was deliberately left alone — only the PWA/app-identity
    layer (manifest, `index.html` title/meta) became "Cardroom", per the brief.
  - Duplicate-player investigation (Part 8) concluded there are **two
    unrelated causes**, not one: a genuine invite-link/reconnect race (fixed,
    see above) and a separate, intentional consequence of token-based (not
    name-based) reconnect security that was **investigated and documented,
    not changed** — see `HANDOFF.md`'s "Known technical debt" for the full
    reasoning on why "fixing" the second would be worse than leaving it.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 307 (untouched, rerun to confirm), client 245
  (236 baseline + 4 in `HomeScreen.test.tsx`, already present before this
  entry + 5 new in `serviceWorker.test.ts`, added this entry). All four
  commands (server/client × test/typecheck, plus both builds) clean.
- **New debt:** `Landing`/`TablesBrowser`/`AvatarPicker` still legacy-styled
  (unification stops at `RoomLobby` this pass). PWA update/offline behavior
  is unverified on a real device/browser, same standing limitation as
  everything else in this environment. Table portrait "edge labels cramped"
  addressed via the seat-position fix but not independently re-confirmed
  beyond the geometry check that motivated it.
- **Baseline status:** accepted.

---

## 2025 — Hazari play-money documentation correction

- **Model:** Opus
- **Baseline before:** server 307, client 236
- **Task:** Documentation-only correction. `RULES_HAZARI.md` described the
  consensual play-money board as something that "may later extend to Hazari",
  which understated a settled product decision.
- **Files changed:** `RULES_HAZARI.md`, `PROJECT_STATE.md`. No source, test,
  package or configuration files touched.
- **Decisions:**
  - Hazari **is** confirmed to receive the same optional play-money board /
    pot concept as Kitti: host proposes, all human participants unanimously
    accept, bots may auto-accept, each contributes, the overall match winner
    takes the full virtual pot.
  - It remains **PLANNED and NOT IMPLEMENTED**, now stated under an explicit
    banner so it cannot be mistaken for a current rule.
  - Play money only: no deposits, withdrawals, cash-out, payment processing,
    or conversion of virtual balances into real currency. Absolute, and
    project-wide.
  - `HANDOFF.md` was inspected and left unchanged — its "no real-money
    mechanics anywhere" line is still accurate and does not conflict.
- **Tests after:** unchanged — server 307, client 236. Not rerun; a directory
  diff confirmed `server/` and `client/` are byte-identical.
- **New debt:** none.
- **Baseline status:** accepted — supersedes the previous documentation
  baseline.

---

## 2025 — Documentation and continuity pass

- **Model:** Opus
- **Baseline before:** server 307, client 236
- **Task:** Create permanent project documentation so future sessions can
  continue safely across context resets. Documentation only — no application
  or test changes.
- **Files changed:** created `HANDOFF.md`, `PROJECT_STATE.md`,
  `ARCHITECTURE.md`, `ROADMAP.md`, `DESIGN_SYSTEM.md`, `RULES_HAZARI.md`,
  `RULES_KITTI.md`, `RULES_TEEN_PATTI.md`, `SESSION_CHANGELOG.md`. No source,
  test or package files touched.
- **Decisions:**
  - `HANDOFF.md` is the single entry point for every new session.
  - Existing `README.md`, `DEPLOYMENT.md`, `STAGING-CHECKLIST.md` and
    `MIGRATION.md` were **kept and referenced rather than duplicated** — they
    are already authoritative for setup, deployment, QA and migration.
  - Kitti and Teen Patti specs were captured in full, and every conflict with
    the existing engines was **documented rather than resolved**. No engine
    code was changed to match the new specs.
- **Tests after:** unchanged — server 307, client 236. Not rerun, because a
  file-level diff confirmed only new `.md` files were added.
- **New debt:** the Kitti and Teen Patti engines now knowingly diverge from
  agreed specs. Reconciliation is scheduled as phases K1 and T1. In
  particular, a passing Kitti test asserts reversed group ordering is valid,
  which the agreed spec now forbids — that test must change in K1.
- **Baseline status:** accepted — this is the master baseline.

---

## Earlier work (reconstructed from the repository)

Recorded before this changelog existed, so dates and session boundaries are
not reliable. What follows is verifiable from the code and tests; anything
that could not be verified has been left out.

**Platform separation.** The room layer was decoupled from `HaazariGame`: a
game registry, a four-method `GameSession` boundary, a Hazari adapter wrapping
the untouched engine, and a namespaced socket protocol. `platform/rooms/` no
longer references Hazari at all.

**Premium experience.** Home screen, shared card table with a hand-tuned seat
ring for 2–9 players, brass dealer token, and the arrangement screen rebuilt
on felt.

**Mobile first.** Safe-area handling, `dvh` migration, VisualViewport keyboard
support, and a per-screen FAB reserve so fixed chrome never covers gameplay
controls.

**Hazari completion.** Startup error boundary, dealing ceremony, play-travel
animation, and migrations of RoundSummary and WinnerScreen.

**Bugs found and fixed** (each visible in the tests that now guard them):

- Production builds silently fell back to `http://localhost:3001`, giving
  players an unexplainable blank page.
- Server CORS defaulted to `*`.
- Teen Patti rounds had no forced termination — a measured 599 betting turns.
- The client computed arrangement suggestions locally, bypassing the
  server-side fairness gate entirely.
- Stale bot ticks could act on a replaced session after Play Again.
- The chat FAB could cover Confirm Hand and Play; the landscape rule then
  dropped the reserve entirely.
- `env(safe-area-inset-*, 12px)` collapsed to zero padding on Android.
- The design tokens were never imported, and requested fonts were not the ones
  loaded.
- Play-travel wiring was reported complete but had silently failed to apply —
  a patch that did not match its target and was not asserted.

**Verification discipline established:** all six commands (server tests,
typecheck, build; client tests, typecheck, build) are run before any baseline
is accepted, and several tests have been **mutation-verified** by
reintroducing the bug and confirming failure.

## 2026-08-17 — Per-game rules guides

- Removed the global Hazari tutorial-on-app-launch behaviour. The Card Room now opens as a neutral multi-game shell.
- Added authoritative, game-specific slide guides for Hazari and Kitti. The first entry into each game on a device opens that game's guide; viewed state is stored independently per game.
- Settings now exposes one `Rules & How to Play` entry, which reopens the active game's slide deck instead of showing a hard-coded Hazari rule sheet.
- Expanded the guides from short tutorial copy into detailed rule slides sourced from `RULES_HAZARI.md` / `RULES_KITTI.md`.
- Corrected the old Hazari help text that inaccurately described Set 4 as “best 3 of 4”; the engine uses the dedicated four-card ranking in `fourCardRanking.ts`.

## 2026-08-17 — Single-seat reconnect / duplicate lobby identity fix

- Fixed the lobby/session lifecycle so a recoverable player session always reclaims the existing `playerId` instead of creating a second lobby row with the same display name.
- Client entry remains gated while a stored room token is being authoritatively restored; Play/Create/Join cannot overwrite that recoverable session.
- Server now records the current socket id for seats from initial create/join/quick-match as well as reconnect.
- Reconnect returns and detaches any superseded live socket (bfcache/duplicate tab/suspended PWA) while preserving the same PlayerSlot.
- A late disconnect from a superseded socket is ignored and cannot flip the newly restored player back to Waiting/Disconnected.
- Server independently refuses a second create/join/quick-match from a socket that is already seated.
- Added `reconnectSingleSeat.integration.test.ts`, RoomManager regression coverage, and client background-reconnect coverage for the no-second-seat invariant.
- Display name is deliberately NOT used as identity; the secret room session token restores the exact seat, allowing two unrelated people to use the same display name without unsafe seat takeover.
- Lobby presence wording now distinguishes connectivity from readiness: a connected human who has not pressed Ready is shown as **Online**, not “Waiting”; only a dropped seat is **Disconnected**, and Ready remains **Ready**.

## 2026-08-17 — Release 1.5.1 Hazari/Kitti bot-quality hardening

- Audited Hazari computer play against the newer Kitti bot path without changing either game's rules or authoritative engine/ranking code.
- Fixed a shared scheduler race: multiple near-simultaneous human events could previously queue more than one bot timer for the same table. Each room now has at most one pending bot tick per game session; a replaced Play Again session cancels/supersedes the old schedule safely.
- Replaced metronomic 700ms bot pacing with deterministic action-aware pauses: arrangement takes slightly longer, ordinary throws are brisker, and Kitti deciders get a little extra pause. Variation is deterministic, so tests/replays are not made random.
- Hazari/Kitti live tables now show `Thinking…` on the active computer seat and use `<name> is thinking…` at the table centre while the server action is genuinely pending.
- New computer seats use the newer premium Card Room animal medallions. Bot identity allocation now chooses an unused name/avatar pair, so removing and re-adding a computer cannot duplicate a still-seated bot identity.
- Added Hazari bot regression coverage proving the bot's confirmed 3/3/3/4 arrangement contains only that bot's own 13 dealt cards and never arranges the human seat.
- Extended bot identity tests and lengthened the leave-table real-socket observation window to match the more natural arrangement pacing.
- Corrected a stale comment in `hazari/arrangement.ts`: Set 4 uses Hazari's dedicated four-card classifier, not a best-3-of-4 rule. No executable arrangement logic changed in that edit.
- Dependency-light audit: 1,000 random Hazari 13-card hands all produced valid suggestions; 0 invalid arrangements. With a score of 900, all 1,000 samples used the intended concentrated endgame strategy. A 250-hand timing sample measured ~20ms average suggestion time (p95 ~33ms) in this environment, comfortably below the visible bot pacing delay.
- Full Vitest/Vite/Android verification is still pending because the current environment does not contain the complete npm dependency tree.
