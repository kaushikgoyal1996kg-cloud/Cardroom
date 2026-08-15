# CARDROOM ENTRY + IDENTITY + NAVIGATION REPORT

**Date:** 2026-08-15
**Not deployed.** Kitti not started, per explicit instruction.

---

## A note before the rest of this report

Partway through this task, several files were found already changed or
created with content this session had not written — one of them
(`PlayerProfile.tsx`) directly contradicted an explicit prior message
stating it had *not* been created yet. This is the second such occurrence
in this project (the first, over PWA/CSS files, is recorded in
`SESSION_CHANGELOG.md`'s 2026-08-14 entry). Per the project's own standing
instruction to stop and report rather than build on unexplained changes,
work paused and every affected file was independently reviewed — diffed,
checked for correctness, cross-referenced against this session's own code,
and checked for risk to reconnect/session identity and Back behavior —
before continuing. Full detail is in `SESSION_CHANGELOG.md`'s 2026-08-15
entry; the short version: ten of eleven files were verified correct and
kept as found, one (`App.tsx`) had a real gap that was fixed, and one
apparent problem (`PROJECT_STATE.md`'s date) turned out not to be a problem
at all — `2026-08-15` is genuinely today, confirmed with the time tool.
This session still cannot explain how the content came to exist.

---

## Entry experience

**First-time flow:** Launch → `Welcome` (brand, one button: **Enter
Cardroom**) → `PlayerProfile` (compact sheet: name + avatar, nothing else)
→ **THE CARD ROOM** (`Home.tsx`, unchanged game selector).

**Returning-user flow:** Launch → `Welcome` (now showing the saved avatar
and name, plus **Continue as `<name>`** and a quiet **Change profile**
link) → one tap → **THE CARD ROOM**. Welcome is always shown first, for
both first-time and returning visitors, matching the brief exactly rather
than skipping it for returning users.

**Invite links** (`?join=...`) bypass Welcome entirely and keep the
existing `Landing` flow, completely untouched — including the invite/
reconnect-race protection from the previous session. This was a deliberate
scope boundary: the brief's Parts 1–6 describe a normal launch, and Part 8
specifically warns to be careful around that existing race fix.

## Persistent identity

- **What is stored:** `{ profileId, name, avatar }` under the existing
  `haazari_identity_v1` localStorage key (`lib/identity.ts`).
- **Where:** `localStorage`, same as before this task — no new storage
  mechanism introduced.
- **Stable ID generation:** `crypto.randomUUID()`, with a fallback for
  older WebViews without it. Generated once; kept across profile edits
  (`saveIdentity` preserves the existing `profileId` unless there wasn't
  one). An identity saved *before* `profileId` existed is migrated in
  place on next read, not treated as "no profile."
- **Separation from reconnect/session identity:** `profileId` lives in a
  different localStorage key (`haazari_identity_v1`) than `GameStore`'s
  reconnect token (`haazari_session_v1`), and neither module reads or
  writes the other's key — verified both by code inspection and by
  dedicated tests in `identity.test.ts` that corrupt/clear one and confirm
  the other is unaffected. `profileId` is never sent to the server.

## Profile editing

- Reachable from `Welcome`'s "Change profile" link and from a small
  profile control in THE CARD ROOM's own header (Part 6's "small avatar/
  profile control in the global shell/header").
- Opens the same `PlayerProfile` sheet used for first-time setup,
  pre-filled with the current name/avatar. Saving keeps the same
  `profileId`.
- **Restrictions during active rooms:** there is no profile-editing control
  anywhere inside the Lobby or at the table — editing is only reachable
  from the two pre-room locations above. This satisfies "defer editing
  during an active room" by construction (nothing to guard against, since
  the control doesn't exist there) rather than needing added guard logic,
  and avoids any speculative multiplayer change.

## Premium design

**New:** `Welcome.tsx`/`.css`, `PlayerProfile.tsx`/`.css`,
`ConfirmDialog.tsx`/`.css`. **Changed:** `Home.tsx`/`.css` (header gains an
avatar, "Change name" → "Profile"), `HomeScreen.tsx` (owns the Welcome →
Profile → CardRoom stage machine).

Welcome and Profile share Home's exact lamp/backdrop treatment, Cinzel
display type, and brass/wood palette — quieter (fewer elements) but not a
second visual theme. `PlayerProfile` reuses the shared `AvatarPicker`
structurally but repaints its legacy gold/dark-green colors to the
card-room palette via a scoped override, the same technique already
established for `RoomLobby` — `Landing`'s own avatar step deliberately
keeps its legacy look, untouched.

## Android/PWA Back behavior

| Screen | Back behavior |
|---|---|
| Welcome (true root) | Not intercepted — default Back/exit proceeds normally. |
| THE CARD ROOM | Returns to Welcome. |
| *("Hazari Home")* | No separate screen exists — see note below. |
| Profile sheet | Returns to wherever it was opened from (Welcome, or THE CARD ROOM if opened from its header) — not always Welcome. |
| Room Lobby | Blocked; shows **Leave this room? Stay/Leave**. Leave calls the same `leaveSession()` the visible Leave button uses. |
| Arrangement / dealing / an active hand | Blocked; same dialog with the bot-takeover wording, calling the same `leaveTable()` **Leave Table** in Settings already uses. |
| Round Summary / Winner | Absorbed — no dialog, no exit, no navigation. The screen's own buttons remain the way forward. |
| home-return (peeked at Home while still in a room) | Calls `returnToGame()` directly — undoes the peek, no confirmation needed. |
| Browser mode | Same guard, same behavior — it isn't Android/PWA-specific. |

**Note on "Hazari Home":** the brief's back-navigation table names this as
a screen distinct from "THE CARD ROOM." It doesn't exist as a separate
screen in this codebase — `Home.tsx` already shows all three games with
their own inline actions (Play/Create/Join) on one screen; there's no
drill-down. Treated as the same screen as THE CARD ROOM for Back purposes;
documented rather than inventing a screen that would serve no purpose.

**History architecture:** `lib/useBackGuard.ts`, a shared hook — explicitly
not a second router. It observes a `screenKey` the caller already computed
(the existing plain conditional chains in `App.tsx` and `HomeScreen.tsx`)
and keeps one browser/PWA history entry in step with it. Two independent
call sites (`App.tsx` for room-level screens, `HomeScreen.tsx` for
entry-level screens) hand off cleanly via `disabled: screenKey === 'home'`,
so exactly one is ever intercepting Back. A screen returns `'root'` (no
interception), `'handled'` (a safe state change already made, syncs via
history *replace*), or `'blocked'` (cancels the pop — used both for
confirmation dialogs and for absorbing a press with no sensible
destination). A confirmed Leave calls `consumeAsBack()` immediately before
the resulting state change, so the history sync replaces the blocked entry
rather than stacking a new one on top of it.

**How accidental abandonment is prevented:** every guarded screen's
"Leave" path calls the exact same function the screen's own visible Leave
button already calls — no new leave/reconnect logic was introduced.
Additionally (found during forensic review, not part of the original
implementation): a confirmation dialog opened by Back is automatically
dismissed if the room's status changes for a reason *other* than that
dialog's own confirm/cancel — e.g. the host starts the game while another
player has a stale Lobby leave-confirm open — rather than risk showing
stale wording or calling the wrong leave function.

**True-root exit behavior:** the very first screen shown each page-load
uses `history.replaceState` rather than `pushState`, so Back from Welcome
(or an invite link's own landing, if that's how the app was entered)
returns to whatever was open before the app loaded — normal exit, not
trapped. No indefinite fake history entries are pushed; each guarded
screen adds at most one entry, cancelled or replaced as appropriate.

## PWA compatibility

- **Browser mode / standalone mode:** identity loads from `localStorage`,
  which is shared across both — no `display-mode` gating anywhere that
  could affect it (checked).
- **Saved identity in installed PWA:** works via the same `localStorage`
  key, no PWA-specific code needed or added.
- **Offline:** not changed by this task. `useInstallPrompt.ts`/
  `InstallBanner.tsx` needed no changes — reused as-is inside `Welcome`.
- **Update/service-worker compatibility:** `manifest.webmanifest`,
  `sw.js`, `UpdateBanner.tsx`, `offline.html`, and the Socket.IO/
  cross-origin bypass are all untouched — confirmed via the full file diff
  against the previous session's delivered zip; none of them appear in the
  changed-file list.

## Files changed

**New:** `client/src/lib/useBackGuard.ts` (+`.test.ts`),
`client/src/lib/identity.test.ts`,
`client/src/components/ConfirmDialog.tsx` (+`.css`),
`client/src/platform/components/Welcome.tsx` (+`.css`),
`client/src/platform/components/PlayerProfile.tsx` (+`.css`),
`client/src/App.backGuard.test.tsx`,
`client/src/platform/components/HomeScreen.entryFlow.test.tsx`.

**Changed:** `client/src/lib/identity.ts`, `client/src/App.tsx`,
`client/src/platform/components/Home.tsx` (+`.css`),
`client/src/platform/components/HomeScreen.tsx` (+`.test.tsx`),
`client/src/platform/styles/mobileSafety.test.ts`.

**Docs:** `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `PROJECT_STATE.md`,
`SESSION_CHANGELOG.md`, `STAGING-CHECKLIST.md`.

No server file changed.

## Verification

- Client: `npm test` → **284/284 passed** (17 files) — 245 baseline + 9
  (`identity.test.ts`) + 8 (`useBackGuard.test.ts`) + 12
  (`HomeScreen.entryFlow.test.tsx`) + 8 (`App.backGuard.test.tsx`) + 2 new
  cases in `mobileSafety.test.ts`. `tsc -b` clean. `npm run build` clean.
- Server: `npm test` → **307/307 passed** (19 files, unchanged — no server
  file was touched). `tsc --noEmit` clean. `npm run build` clean.

## Still requires real-device QA

No real device or browser exists in this environment — this remains the
single largest open risk, unchanged from every previous report on this
project. `STAGING-CHECKLIST.md` sections 11–12 (new, added this task) list:

- Android Back from THE CARD ROOM, Welcome, the profile sheet, the Lobby,
  during Arrangement, during an active hand, on Round Summary/Winner.
- True-root Back/exit behavior specifically.
- Rapid repeated Back presses producing no duplicate dialog, leave, or
  room join.
- PWA relaunch after a full close, confirming saved identity shows
  "Continue as `<name>`" rather than setup again.
- Profile edit, then relaunch, confirming the edit persisted.
- The same checks in an ordinary browser tab, not just the installed PWA —
  behavior is expected to match but hasn't been confirmed to.
- Whether Back being silently absorbed (Round Summary/Winner) reads as
  "nothing happened" or as unresponsive — flagged as new debt, no visible
  feedback exists for that case today.

No claim is made that any Back-button behavior has been verified on a real
Android device or installed PWA — everything above is implemented and unit
-tested against jsdom/synthetic `popstate` events only.

## Redeploy instructions

Not deployed. To push this to the existing staging environment:

1. Commit and push to the `Cardroom` GitHub repo's staging branch.
2. Netlify rebuilds `client/` — this redeploy is client-only, no server
   changes are included.
3. Render's `server/` deployment is unaffected and does not need a rebuild.
4. After deploy, work through `STAGING-CHECKLIST.md` sections 11–12 on a
   real Android device (both an ordinary Chrome tab and the installed PWA)
   before considering any of this verified.
5. Do not delete or touch the old, separate, previously-live Hazari
   deployment — unaffected and out of scope, per standing instruction.
