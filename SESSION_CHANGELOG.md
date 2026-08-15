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
