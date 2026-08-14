# HANDOFF — read this first

**This file is the entry point for every new session.** It exists because
conversation context resets and the repository must be the source of truth.

---

## What this project is

A private card room for roughly ten friends and family. No real money
anywhere, by design. Three games are planned; one is built.

| Game | Status |
|---|---|
| **Hazari** | Playable flagship. Feature-complete enough for staging. |
| **Kitti** | Engine partially built. Full spec now agreed. **Next to implement.** |
| **Teen Patti** | Engine partially built. Full spec agreed. After Kitti. |

**Production deployment is BLOCKED.** The old, previously-deployed Hazari app
remains the working version for the family and is untouched and unaffected by
any of this.

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

## Verified baseline at the time this file was written

| Check | Result |
|---|---|
| server `vitest run` | 307 passed |
| server `tsc -p . --noEmit` | clean |
| server `npm run build` | success |
| client `vitest run` | 236 passed |
| client `tsc -p tsconfig.app.json --noEmit` | clean |
| client `npm run build` | success |

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

- **No automated/in-environment browser or device verification is possible.**
  Chromium download and apt are both blocked in this build environment, so no
  session working from this repo can render or screenshot anything itself.
  A **first-pass manual Android QA round** has now happened on real staging
  (see above), which found confirmed layout issues on Home, Lobby,
  Arrangement and Table (portrait and landscape) — but that pass was done by
  the owner, on one device, and did not cover iPhone/Safari, reconnection,
  a full match, or most of `STAGING-CHECKLIST.md`. Treat any visual claim not
  traceable to that dated owner QA, or to a subsequent one, as still
  unverified. This remains the single largest open risk.
- Dealing and play-travel **timing** needs human judgement on a device.
  Constants live in `client/src/platform/table/seatLayout.ts`.
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
| `RULES_KITTI.md` | Agreed Kitti spec + mismatches with current code |
| `RULES_TEEN_PATTI.md` | Agreed Teen Patti spec + mismatches with current code |
| `SESSION_CHANGELOG.md` | Append-only record of each session |
| `DEPLOYMENT.md` | How to deploy, written for a non-developer |
| `STAGING-CHECKLIST.md` | What to test on real phones |
| `MIGRATION.md` | When it is safe to retire the old version |
| `README.md` | Local setup and quick orientation |
