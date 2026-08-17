# ROADMAP

A living plan, not a history. For what happened when, see
`SESSION_CHANGELOG.md`.

---

## Completed

**Platform separation (Parts 1–3).** Game-agnostic room layer, game registry,
`GameSession` boundary with the Hazari engine wrapped rather than rewritten,
namespaced socket protocol.

**Premium experience (Parts 4–6).** Home screen, shared card table with seat
ring for 2–9, physical dealer token, redesigned arrangement screen on felt.

**Mobile first (Part 7).** Safe areas, `dvh` migration, VisualViewport keyboard
handling, per-screen FAB reserve for portrait and landscape.

**Hazari completion.** Startup error boundary, dealing ceremony, play-travel,
RoundSummary and WinnerScreen migrations, reliability tests.

**Reliability and fairness work worth remembering:**
- Server-authoritative arrangement suggestions, blocked against any human
  opponent, with a real Socket.IO integration test.
- Stale bot timers guarded by session identity.
- Teen Patti rounds could run ~599 betting turns before pot/blind limits.
- Production build silently fell back to `localhost`, producing an
  unexplainable blank page.
- Server CORS defaulted to `*`.

---

## Current checkpoint

The first Android test track is now intentionally narrow: **Hazari + Kitti are
playable; Teen Patti + Poker are shown as Coming Soon.** Kitti has moved from a
partial engine to an online playable core. The native Capacitor wrapper/source
scaffolding is present, but an APK cannot be produced in this build environment
because npm registry access and the Android SDK are unavailable here.

Production remains blocked. The old live Hazari app stays untouched. Real-device
QA is still the release gate; repository tests must also be rerun on a machine
with dependencies before this checkpoint is called a verified baseline.

---

## Next

### 1. First Android test track — Hazari + Kitti
Build a debug APK on an Android-capable machine from `ANDROID_RELEASE.md`. Add
`https://localhost` alongside the staging Netlify origin in Render
`ALLOWED_ORIGINS`, then run the first-device gate: Hazari, Kitti, voice, Back,
rotation, reconnect, Bug 5 reveal scrolling and Bug 6 dismissal.

### 2. Fix findings without changing game rules
Anything clearly broken, unsafe, inconsistent or below the premium product bar
may be corrected. Game rules are the locked layer. Keep server authority, hidden
card privacy, reconnect semantics and the game-agnostic room boundary intact.

### 3. Kitti Release 1.5 hardening and device QA
The authoritative rules, online session/controller, client arrangement/table,
round/match flow, decider, reconnect, optional computer seats, bot-only
arrangement Suggest and consensual virtual board are implemented. The remaining
gate is full repository verification plus real-device 2–5 seat/full-match QA.

### 4. Teen Patti development continues behind Coming Soon
The Classic engine/session/lobby-setup groundwork exists, but the game stays
`networkPlayable: false` until the full client table, variant execution,
play-money/P&L flow, reconnect and mobile QA are complete.

### 5. Production only after approval
Do not replace the family build until the staged/native test track has passed.

---

## Kitti implementation status

- **K1 — rules + engine reconciliation:** implemented. Strict strongest→weakest
  groups, later-throw exact ties, dealer-first deal, dealer-left first lead.
- **K2 — session/controller:** implemented. `KittiSession`, `kitti:*`, public/
  private split, ten scheduled rounds + sudden death.
- **K3 — arrangement/client flow:** implemented. Nine cards into three groups.
- **K4 — gameplay table:** implemented on the shared table for 2–5 seats.
- **K5 — decider/reconnect/bots/play money:** three-winner decider + reconnect, optional computer seats, host add/remove, bot-only Suggest, and consensual virtual board are implemented.
- **K6 — integration/mobile/QA:** source integration done; real-device/full-match
  verification remains pending.

---

## Teen Patti implementation phases

Read `RULES_TEEN_PATTI.md` first. Teen Patti remains **Coming Soon** in the
Hazari + Kitti Android test track; the entries below are development status, not
permission to enable it early.

**T1 — Authoritative rule and variant model — substantially implemented.**
Classic betting configuration now uses blind doubling capped at host max, seen =
2× current blind, and three blind chances before forced seen betting. Dealer is
the previous unique round winner. Variant descriptors are data-driven and
explicitly mark unsupported runtime variants rather than silently falling back
to Classic. Full live execution of non-Classic variants remains pending.

**T2 — Classic betting/session engine — core implemented, full suite pending.**
Compulsory sideshow, anticlockwise opponent selection, initiator-packs-on-tie,
final-two mutual open show, card privacy and stable result→next-dealer timing are
in the engine. This still needs the repository suite and broader multiplayer QA.

**T3 — Server controller and protocol — groundwork implemented behind gate.**
`TeenPattiSession`, setup/state/private/action/top-up/next-round events and
result restoration exist, but the registry remains `networkPlayable: false`.
Do not use protocol presence as a reason to expose the game.

**T4 — Classic client table — hidden core implemented.**
A shared-table Classic client exists behind the disabled registry with up to 9
seats, private face-down cards until explicit See, blind/seen/chaal/pack,
compulsory sideshow, final-two show controls, in-round help and a round summary.
It remains unreleased while lifecycle/mobile QA is incomplete.

**T5 — Variant execution and UI — pending.**
Dealer selection must be locked before information is revealed. Every player
needs an in-round “How to play this variant” panel.

**T6 — Play-money/P&L product flow — partial across engine/protocol/UI.**
Host-configured balances, unanimous setup acceptance, live P&L and top-up now
exist. The remaining critical gap is Teen Patti-specific settle-on-leave /
dynamic player lifecycle; do not substitute Hazari's bot-takeover leave path.
No real-money path is permitted.

**T7 — reconnect, integration and mobile — partial groundwork, release QA pending.**
Round-result reconnect restoration exists, but active-session leave/reconnect,
multi-device integration and 2–9 seat real-device QA remain blockers. Teen Patti
cannot leave Coming Soon until these pass.

---

## Deliberately not planned

- Real money in any form.
- Accounts, subscriptions, ads, matchmaking, microservices.
- Merging the two token systems (legacy screens depend on the old ones).
- Merging Hazari's card model into `platform/cards` — the separation is a
  safety property, not an oversight.
- Teen Patti variants explicitly removed from scope: Joker Hunt, 999,
  Stud-style Teen Patti.

---

## Model guidance

**Opus:** architecture, engines and rules, multiplayer state, socket and
reconnect correctness, fairness and security, cross-system bugs, risky
refactors.

**Sonnet:** documentation, specified UI, CSS, component work, wiring,
mechanical tests where behaviour is already defined, visual staging fixes.
