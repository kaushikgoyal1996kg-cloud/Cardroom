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

The live Release 1.5.1 track remains intentionally safe: **Hazari + Kitti are
playable; Teen Patti + Poker are shown as Coming Soon.** The WIP is much newer:
Teen Patti has 19 hidden runtime-ready variants/social flows and Poker has a hidden
authoritative network/runtime path for Texas, PLO4/5/6 and Short Deck. Neither
hidden game may be enabled until the combined release gate below passes. The native
Capacitor scaffolding is present, but this runtime cannot restore npm packages and
does not provide the Android SDK.

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

### 4. Finish the combined hidden-game release audit
Teen Patti feature work is substantially complete behind the gate (22 runtime-ready
variants, Surprise Me, Mutual Show, retained 5-card discards, Friendly Assist,
history/stats/settlement). Poker's authoritative hidden runtime is also integrated.
Finish cross-game lifecycle/reconnect/privacy/mobile checks and only resolve rule
items that are explicitly locked; never invent a missing house rule.

### 5. Run the real release gate
On a machine with working npm/Android tooling: full server Vitest + build, full
client Vitest + TypeScript + Vite build, Capacitor/Gradle build, then multi-phone
portrait/landscape/reconnect/voice/TURN and all-variant regression. Fix every
regression before changing either hidden game's `networkPlayable` gate.

### 6. Production only after approval
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
to Classic. Runtime execution now exists for Classic, Muflis, Best of Four,
Standard/Lowest/Highest Joker, AK47, Pairs Are Jokers, Random-Pack Joker,
Revolving Joker, Up–Down–Same, Up–Down, Down Only and Closest to N; unfinished house variants stay disabled rather than approximated.

**T2 — Classic betting/session engine — core implemented, full suite pending.**
Compulsory sideshow, anticlockwise opponent selection, initiator-packs-on-tie,
unanimous Mutual Show for 2+ active players (including 3+), card privacy and stable result→next-dealer timing are
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

**T5 — Variant execution and UI — substantially implemented behind gate.**
Dealer selection is locked before information is revealed. Single Variant and
Variant Table policies support Dealer Choice, Fixed Rotation or **Surprise Me**;
Dealer Choice waits before boot/cards. The host chooses the runtime-ready variant pool; a dedicated Surprise Me Table makes a server-owned random selection from that pool every hand, and Dealer Choice may also invoke Surprise Me from the same approved pool. Two-Reference Joker, 2 Cards · Assume the Third and the three retained **5-card discard families** are runtime-ready behind the gate. Every player gets server-authored in-round “How to Play” text. The hidden catalogue now has **22 runtime-ready variants**. Five-card families pause before boot/deal for the round dealer to select the compatible joker rule; equal-ranked physical discard candidates belong to the player, all five cards remain retained, and discarded cards never rank or break ties. Closest to N uses the same dealer configuration gate for target + reorder declaration, including when Surprise Me selects it. **K Little, Q Little and J Little** are separate runtime-ready options; the generic Named Rank + Little picker is no longer used.

**Friendly Assist / Watch & Suggest** is implemented as an optional host-enabled private-table social layer: only folded players may request access, the target must consent, one target may be coached per hand, cards/suggestions stay private, and suggestions never execute actions.

**T6 — Play-money/P&L product flow — substantially implemented behind gate.**
Host-configured balances, unanimous setup acceptance, live P&L, unlimited positive
top-up and Teen Patti-specific permanent settle-on-leave now exist. Leaving a live
round behaves as a pack while committed play-money remains in the pot; the seat is
released rather than converted to Hazari's bot-takeover path. Full integration and
mobile QA remain pending. No real-money path is permitted.

**T7 — reconnect, integration and mobile — partial groundwork, release QA pending.**
Round-result/state restoration and authoritative leave exist, and betting actions
now require the exact server sequence to reject delayed/double-tapped stale input.
Full active-session reconnect scenarios, multi-device integration, complete normal
repository suites/builds and 2–9 seat real-device QA remain blockers. Teen Patti
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
