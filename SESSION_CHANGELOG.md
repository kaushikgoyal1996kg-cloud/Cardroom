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
