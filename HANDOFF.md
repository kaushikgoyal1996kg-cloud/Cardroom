# HANDOFF — read this first

**This file is the entry point for every new session.** It exists because
conversation context resets and the repository must be the source of truth.

---

## What this project is

A private card room for roughly ten friends and family. No real money
anywhere, by design. Hazari and Kitti are the current live/playable games.
Teen Patti and Poker have substantial hidden engine/session/socket/client
implementations in the current WIP, but both remain deliberately gated as
Coming Soon until the combined release suite and device QA are green.

| Game | Status |
|---|---|
| **Hazari** | Playable core with premium shell, optional virtual board, bots and table-scoped voice. Release 1.5 still needs full suite/device QA. |
| **Kitti** | Playable online with optional computer seats, bot-only arrangement suggestions, virtual board and reconnect. Release 1.5 still needs full suite/device QA. |
| **Teen Patti** | Hidden combined-update implementation: 22 runtime-ready variants, Variant/Surprise tables, Mutual Show, retained 5-card discards, reconnect-safe history/stats and Friendly Assist. Still `networkPlayable: false`. |
| **Poker** | Hidden Texas/PLO4/PLO5/PLO6/Short Deck engine + session/socket/client runtime, private setup, Dealer Choice/rotation, history/stats and reconnect/privacy hardening. Still `networkPlayable: false`. |

**Production deployment is BLOCKED.** The old, previously-deployed Hazari app
remains the working version for the family and is untouched and unaffected by
any of this.

### Current development WIP — 2026-08-18

The active development line is **ahead of Release 1.5.1**. It includes the
premium Card Room identity/doorway-table logo, physical Hazari/Kitti hand
arrangements, radial table utilities, Hazari dismissal/equality corrections,
authoritative live history across all games, the hidden Teen Patti/Poker
runtimes above, and a whole-app reconnect/leave/privacy audit. Recent audit
fixes include the client `main.tsx` startup wiring, stale Dealer Choice
sequence protection, historical participant-name retention and Poker settle
leave during reconnect rehydration.

The complete normal npm/Vitest/Vite/Android gate has **not** been rerun on
this WIP because this environment currently cannot resolve `registry.npmjs.org`
(`EAI_AGAIN`). Dependency-light whole client/server source+test graph compiles
and focused runtime harnesses are used as interim checks only; they do not
replace the release gate.

**Staging now exists**, deployed after this document was first written:

| Piece | URL |
|---|---|
| Netlify client (staging) | https://cardroom-staging.netlify.app |
| Render server (staging) | https://cardroom-staging-server.onrender.com |

The two are confirmed connected (`ALLOWED_ORIGINS` on Render points at the
Netlify staging URL; `/health` responds). A **first-pass real-device QA
pass** has been done on one Android phone, portrait and landscape, covering
Home, Lobby, Arrangement and the Hazari Table screens — see
`SESSION_CHANGELOG.md` for the dated entry and `STAGING-CHECKLIST.md` for
exactly which boxes that pass does and does not justify ticking. This was
**not** a run through the full checklist (no iPhone, no reconnection drills,
no full match) — most of `STAGING-CHECKLIST.md` is still unverified.

---

## Last fully-run accepted baseline

This is the newest repository baseline for which all six normal verification
commands were actually green (see the 2026-08-16 Bug 5 correction entry). It
**predates** the Release 1 premium/Kitti working-copy changes below.

| Check | Result |
|---|---|
| server `vitest run` | 310 passed |
| server `tsc -p . --noEmit` | clean |
| server `npm run build` | success |
| client `vitest run` | 377 passed |
| client `tsc -p tsconfig.app.json --noEmit` | clean |
| client `npm run build` | success |

### Current Release 1.5.1 working-copy checkpoint — 2026-08-17

The historical table above is **not** a verification of the current Release 1.5.1 working copy. The current environment cannot restore the project's complete npm dependency tree, so full Vitest/typecheck/Vite/Android builds have not been rerun here. Release 1.5 adds optional Hazari/Kitti virtual boards, backend-issued Metered TURN, Kitti computer seats with bot-only server-authoritative suggestions, mixed-game/voice isolation coverage, expanded avatar medallions and lobby lifecycle hardening on top of the Release 1.4 premium shell. The current 1.5.1 working copy also hardens both bot controllers at the shared scheduler boundary: one pending bot timer per table/session, deterministic human-like pacing, active-bot `Thinking…` feedback, and unique premium computer identities after remove/re-add; Hazari's card-choice/arrangement rules remain unchanged. Dependency-light Kitti solver/max-table harnesses have passed during this line; the newest source/import/CSS sweep is recorded in `SESSION_CHANGELOG.md`. Teen Patti and Poker both remain server-gated `networkPlayable: false`. Unlike the historical checkpoint, the current WIP contains real hidden server engines/session adapters/socket contracts and client routes for both; neither may be exposed until the complete release gate passes.

**Verify these yourself. Do not trust them blindly.**

Counts legitimately *increase* as work continues — a higher number is normal
and fine. What matters is that the suite is **green**. If tests **fail**, or
if counts are *lower* than recorded here, or if the working tree contains
files nobody mentioned, something is wrong: stop and report before building
on it. That exact situation has already occurred once in this project's
history and cost a session.

---

## Startup procedure — every session, no exceptions

1. Read this file.
2. Read `PROJECT_STATE.md` — what actually exists right now.
3. Read `ARCHITECTURE.md` — how the pieces fit.
4. Read the relevant rules file (`RULES_HAZARI.md`, `RULES_KITTI.md`,
   `RULES_TEEN_PATTI.md`).
5. For UI work, read `DESIGN_SYSTEM.md`.
6. Inspect the actual source files you intend to touch. Read before writing.
7. Run the baseline suite before any substantial change, so you can tell your
   breakage from pre-existing breakage.
8. **If the tree has unexplained changes, or counts differ unexpectedly:
   STOP and report.** Do not silently absorb work of unknown origin.
9. Do not rely on memory from another session. This repository is the truth.
10. Before packaging a new baseline, update this file and
    `SESSION_CHANGELOG.md`.

A practical note on patching: when editing existing files programmatically,
**assert that your search pattern actually matched**. A silent no-op patch has
already shipped a "completed" feature that was never wired.

---

## Locked decisions — do not casually undo

Each of these was a deliberate choice, several after finding real bugs.

**Architecture**
- The room/platform layer is game-agnostic and must not import any game engine.
- A table belongs to exactly one game, fixed at creation, never changed.
- The Hazari engine stays isolated behind the `GameSession` adapter. It is
  covered by the original 152 tests and must not be rewritten.
- Server is authoritative for all multiplayer state.

**Fairness** (game-integrity, not a card rule)
- Arrangement suggestions are computed **server-side only**.
- **No** arrangement assistance when any real human opponent is present.
- Mixed human/bot rooms are also blocked — one human opponent is enough.
- Neutral Rank / Suit / Dealt sorting stays allowed.
- The routed Arrangement screen must contain **no local solver path**, and the
  solver must not reach the production bundle.
- A real Socket.IO integration test proves the endpoint cannot be bypassed by
  emitting the event by hand.

**Reliability**
- Stale bot timers are guarded by **session identity**, not just room code.
- Startup/config failures surface a real error screen, never a blank page.

**Presentation**
- The local player is always anchored at the bottom seat.
- Dealing order begins at the authoritative dealer and proceeds clockwise.
- Reconnect/restoration must not replay dealing or historical play-travel
  animations.
- Mobile safe-area and VisualViewport work must be preserved.

**Product**
- Teen Patti maximum is 9 players.
- Kitti is implemented **before** Teen Patti.
- Old rollback screens (`PlayTable.tsx`, `ArrangementScreen.tsx`, legacy
  `RoundSummary`/`WinnerScreen`) stay in the tree but **unrouted**.
- No real-money mechanics anywhere, ever.

---

## Known technical debt

- **Bug 5's real diagnosis, corrected 2026-08-16 (later): it was never
  RoundSummary. It was the per-set reveal sheet.** Two full rounds of
  "end-of-hand scroll" fixes were applied to `RoundSummary.css`/`.tsx` -
  the screen shown once, after a round's 4th set AND the round itself
  resolve. Real-device feedback eventually clarified the actual bug: on
  Android PWA in short landscape, the screen that wouldn't scroll was
  `.reveal` (`HazariTable.css`/`.tsx`) - the per-SET result sheet shown
  after EVERY set (1, 2, 3, and 4 - one shared component, not a
  different one for the last set). RoundSummary, per that same
  feedback, was already working correctly. **The mental model to hold
  onto:** Hazari plays 4 sets per round; after each set, `.reveal`
  appears inline within `HazariTable` (it never unmounts `HazariTable` -
  see `App.tsx`'s `PLAYING_STATES`, which includes all four
  `REVEALING_SET_N` states); only after the 4th set's reveal AND the
  round's own completion does the screen actually swap to RoundSummary.
  If a future report describes "the result screen doesn't scroll" again,
  identify WHICH of these two components it actually is before touching
  either - don't assume based on which one was fixed last time.
  `.reveal__sheet` now uses the identical bounded-shell + JS-measured-
  height pattern as RoundSummary/WinnerScreen (`--js-vh` via
  `useVisualViewport()`), for the same reliability reasons - see below.
- **A clean local test suite has now THREE TIMES not been sufficient
  evidence that a mobile fix actually works — 2026-08-16, updated.** Three
  rounds in a row for the end-of-hand/set scroll problem (RoundSummary
  twice, chasing the wrong component; the actual culprit,
  `.reveal`, only found on the fourth attempt): a fixed-height/nested-
  scroll shell, then a normal-page-flow/sticky-footer redesign, both fully
  arithmetic/test-verified in this environment (no browser access) and
  both confirmed still failing on the next real-device retest -
  "physical vertical swiping does NOT scroll the result content" on both,
  a stronger symptom than either round's own theory (dvh inaccuracy,
  nested-scroll-capture unreliability) fully explains on its own - and
  which, with hindsight, was ALSO partly explained by simply fixing the
  wrong screen. **The advice this note used to give - "prefer normal page
  scroll and `position: sticky`, they have a long boring track record" -
  was itself wrong, or at least insufficient; that exact pattern is what
  failed the SECOND time.** Do not treat either "bounded shell with
  nested scroll" or "page flow with sticky footer" as the safe, proven
  choice - both have independently failed real-device testing once. The
  current structure (both RoundSummary/WinnerScreen and now `.reveal`)
  additionally uses a JS-measured viewport height
  (`useVisualViewport()`) rather than trusting CSS `dvh` alone, and has
  NOT yet been confirmed on a real device either - see
  `SESSION_CHANGELOG.md`'s "Bug 5 diagnosis corrected" entry. Treat "the
  arithmetic checks out and the suite is green" as necessary, not
  sufficient, for anything involving viewport units, nested scroll
  regions, touch-gesture handling, or precise pixel geometry on a real
  phone - this has now been true three times in a row.
- **Rendered browser/device verification is still incomplete.** A Chromium binary
  is now present in this environment, unlike the older sessions recorded below,
  but the frontend dependency tree is incomplete and cannot currently be restored
  from npm. Therefore no full current Release 1.5.1 browser render or APK/device pass
  has been completed here. A **first-pass manual Android QA round** happened on an
  older staging build
  (see above), which found confirmed layout issues on Home, Lobby,
  Arrangement and Table (portrait and landscape) — but that pass was done by
  the owner, on one device, and did not cover iPhone/Safari, reconnection,
  a full match, or most of `STAGING-CHECKLIST.md`. Treat any visual claim not
  traceable to that dated owner QA, or to a subsequent one, as still
  unverified. This remains the single largest open risk.
- Dealing and play-travel **timing** needs human judgement on a device.
  Constants live in `client/src/platform/table/seatLayout.ts`.
- **RoundSummary/WinnerScreen: bounded shell, governed by a JS-measured
  height, not CSS `dvh` alone - confirmed NOT the real Bug 5, kept as
  precautionary hardening.** History, in order: (1) fixed `height:100dvh`
  + `overflow:hidden` shell with a nested `overflow-y:auto` scroll region
  - failed real-device testing. (2) normal page flow (`min-height`) with
  a `position:sticky` action bar - ALSO failed real-device testing
  ("swiping does NOT scroll"). (3) current: back to a bounded shell
  (`height: var(--js-vh, 100dvh)`, `overflow:hidden`, ONE
  `flex:1 1 auto; min-height:0; overflow-y:auto; touch-action:pan-y`
  scroll child, action row a plain sibling AFTER it, not nested inside
  and not sticky) - `--js-vh` set inline by `RoundSummary.tsx`/
  `WinnerScreen.tsx` from `useVisualViewport()` (an existing hook,
  `platform/lib/useVisualViewport.ts`, previously used only for keyboard
  avoidance). **Later clarified: RoundSummary was never actually the
  broken screen** - the real Bug 5 was `.reveal` (see the entry above).
  This structure is kept anyway (not reverted) since (a) it's a
  strictly more robust pattern than what it replaced regardless, and
  (b) reverting untested work for its own sake adds risk for no benefit.
  If a future session is tempted to simplify RoundSummary/WinnerScreen
  back to either of the two prior approaches: don't, without a real
  device in hand - both have independently, provably failed already.
  `.reveal` (`HazariTable.css`) now shares the identical
  `--js-vh`/bounded-shell pattern, for the same reasons. Release 1.4 also
  removes the old `maximum-scale=1` viewport restriction that had been
  flagged as an upstream touch/scroll risk. That change is **not claimed
  as the Bug 5 fix** until the reveal sheet is physically swiped on the
  new Android APK; preserve the bounded-shell hardening until that test.
- **`DealerToken`'s felt-relative positioning is a real architectural
  tension, not fully resolved — 2026-08-15.** The token (and every seat)
  is positioned as a percentage of the felt, but the felt's pixel size
  varies hugely across the supported range (a 320px phone up to the
  60rem/72dvh desktop cap in `CardTable.css`) while the avatar and name
  text stay fixed-px. That mismatch is what caused the token to land on a
  seat's own name label for centre-ward-downward anchors (`top`,
  `top-left`, `top-right`) — see `SESSION_CHANGELOG.md`'s "Bug 4" entry.
  The fix (`DealerToken.tsx`/`.css`) makes the token's *pull* a small fixed
  pixel amount instead of a felt percentage, which closes that specific
  collision arithmetically at every supported seat-scale/breakpoint
  (`DealerToken.test.tsx`). The SEAT positions themselves (`seatLayout.ts`)
  got the same category of fix on 2026-08-15 (second retest) once the
  margin check was corrected to measure against the felt rather than
  `.table` — several seats were provably outside the felt's real clipping
  boundary at common phone widths. **Update, 2026-08-16:** the SIDE-SEAT
  NAME's own width allocation (`Seat.css`) got a further version of this
  same fix - a per-seat `calc()` driven by `--identity-dist` (`Seat.tsx`,
  each seat's own real `|50-x|`), not a flat constant, specifically
  because a flat constant was tried and found UNSAFE for some
  (currently unreachable) larger ring sizes. If a future change enlarges
  any seat element or adds a reachable 5-9 player game, treat that
  pattern (measure the specific seat's own real distance in JS, don't
  guess a single constant per anchor NAME) as the template, and re-run
  `platform/table/layout.test.ts` (which measures against the felt
  correctly, and against the FELT'S real padding formula, as of
  2026-08-16 - its earlier width-dependent padding assumption was itself
  found wrong, see `SESSION_CHANGELOG.md`) before assuming percentage
  positioning is safe.
- Reconnect animation suppression closes on the existing next-tick lifecycle.
  There is **no explicit server "restoration complete" event**; a sufficiently
  delayed restoration burst could still be read as new.
- `RoomLobby` now uses the card-room visual language (`RoomLobby.css`, added
  2026-08-14) rather than the legacy palette. `Landing`/`TablesBrowser`/
  `AvatarPicker` (all still in `Lobby.css`) remain legacy for now.
- Two token systems coexist deliberately: `styles/tokens.css` (legacy) and
  `platform/styles/tokens.css` (card room). Do not merge them casually —
  legacy screens still depend on the old variables.
- The client mirrors the server's dealing-order rule in a separate copy
  (`dealingOrderFromDealer`). No shared module spans the package boundary, so
  a server change will not automatically fail a client test.
- `client/src/game/autoArrange.ts` is dead in production, retained only for the
  unrouted rollback screen and tests.
- Kitti and Teen Patti engines **conflict with the now-agreed specs** in
  several places. See the "mismatches" sections of their rules files. Nothing
  has been changed to match; the conflicts are documented, not resolved.
- **Duplicate-player-looking lobby entries — investigated 2026-08-14, not a
  single bug.** Two independent, unrelated mechanisms can both produce a
  lobby that shows the same display name twice (one seat Host/Disconnected,
  a second "(you)" Waiting):
  1. **A genuine race, now fixed**: reopening one's own invite link (or the
     same link a second time) while GameStore's automatic `room:reconnect`
     for that exact room is still in flight - realistic on Render's free-tier
     cold start, ~30s per `DEPLOYMENT.md` - could let the invite-link Join
     flow fire before the reconnect landed, creating a second player instead
     of resuming the first. `client/src/lib/GameStore.tsx`
     (`getStoredSessionRoomCode`) and `client/src/platform/components/
     HomeScreen.tsx` now detect "I already hold a token for the room this
     link points at" and show a waiting state instead of offering Join. See
     `HomeScreen.test.tsx` for the regression coverage. This is a read-only
     UI-layer check; it changes no reconnect/session/protocol behaviour.
  2. **A separate, NOT fixed, and not a bug**: `roomManager.joinRoom()`
     never checks for an existing player with the same display name before
     seating a new one (`server/src/platform/rooms/roomManager.ts`). If the
     same person opens the room on a second device/browser/incognito
     window - anywhere without the first device's `localStorage` reconnect
     token - typing the same name is, correctly, a brand new join, not a
     reconnect, and can sit alongside a still-disconnected original seat
     until its reconnect window lapses. This is the intended consequence of
     tokens (not names) being the reconnect security boundary: matching on
     name instead would let anyone claim an occupied seat just by typing its
     player's name, which is a worse bug than a confusing lobby list. Left
     as-is; documented rather than "fixed" per the investigation brief.

---

## Next recommended milestone

**Staging-only deployment plus real-device visual QA of Hazari — once the
owner explicitly approves deployment.**

Not a new feature. The work that most reduces risk right now is putting the
existing Hazari on real phones, because no amount of further coding in this
environment can retire the visual-verification debt.

**Production remains blocked** until staging QA passes. The old live app must
not be deleted. See `STAGING-CHECKLIST.md` and `MIGRATION.md`.

---

## Which model to use

**Use Opus for:** architecture; game engines and rules; complex multiplayer
state; socket and reconnect correctness; security and fairness; difficult
cross-system bugs; high-risk refactors.

**Use Sonnet for:** documentation; well-specified UI implementation; CSS;
straightforward component work; repetitive wiring; mechanical tests where the
behaviour is already defined; clearly visual staging fixes.

Avoid spending Opus on routine documentation or mechanical work — the hard
parts of this project are the engines, the fairness boundary and the reconnect
lifecycle.

---

## Other documents

| File | Purpose |
|---|---|
| `PROJECT_STATE.md` | Inventory of what exists right now |
| `ARCHITECTURE.md` | How the system is put together and why |
| `ROADMAP.md` | Completed work, next steps, session-sized phases |
| `DESIGN_SYSTEM.md` | Approved visual direction |
| `RULES_HAZARI.md` | Implemented Hazari rules, extracted from the engine |
| `RULES_KITTI.md` | Agreed/implemented Kitti rules; authoritative for playable Kitti |
| `RULES_TEEN_PATTI.md` | Agreed Teen Patti spec + mismatches with current code |
| `SESSION_CHANGELOG.md` | Append-only record of each session |
| `DEPLOYMENT.md` | How to deploy, written for a non-developer |
| `STAGING-CHECKLIST.md` | What to test on real phones |
| `MIGRATION.md` | When it is safe to retire the old version |
| `README.md` | Local setup and quick orientation |

### Multi-game rules-guide behaviour — 2026-08-17

The app must never open with Hazari rules before a game is chosen. `App.tsx` opens a game-specific slide guide only after the player actually enters Hazari or Kitti, remembered independently per game via `lib/tutorial.ts`. Settings has one `Rules & How to Play` action that opens the active game's deck. The detailed slide content lives in `client/src/platform/games/gameGuides.ts`. Do not revert to a single global `haazari_tutorial_seen_v1` gate or a hard-coded Hazari `RulesModal`.

### 2026-08-17 reconnect identity invariant

A human with a valid stored room session must never create a second seat merely because they backed out, reloaded, resumed the PWA, or reopened the app. The token reclaims the same `playerId`; that single public lobby row becomes connected/Online again. New room actions are gated while restoration is pending, and the server also refuses fresh room entry from an already-bound socket. If a stale prior socket is still alive, reconnect detaches it and a later stale disconnect must not mark the restored seat offline. Do not replace this with display-name matching: names are presentation, not identity.

### 2026-08-17 Release 1.4 premium shell invariants

- The game selector is neutral: **no game is pre-selected**. Hazari and Kitti are equal playable tables; Teen Patti and Poker are Coming Soon with no fake action buttons.
- A true cold launch starts at Welcome. A deliberate Leave/Return from a live room goes directly to The Card Room **once** via `lib/navigation.ts`; do not make players re-enter through Welcome after every table exit.
- Shared invites use the Card Room invitation screen, not legacy Hazari branding. In native builds invite URLs must come from `VITE_PUBLIC_APP_URL`; never share Capacitor's internal `https://localhost`.
- PWA install/update UI is web-only. Service-worker updates must not be offered while `room` is non-null, and native APK builds must not show web install/update prompts.
- Shared transient/support screens (loading, reconnect, Settings, Rules, Stats, History, confirmed-hand waiting, active-seat return pass) use the same premium wood/brass/felt language. Do not reintroduce the old green/glass utility theme.
- Hazari and Kitti local stats/history are game-scoped; legacy Hazari stats migrate into the Hazari bucket.
- `index.html` intentionally omits `maximum-scale=1`; do not put it back without a real accessibility/mobile reason.
