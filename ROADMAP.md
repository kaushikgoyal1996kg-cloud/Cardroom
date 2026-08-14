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

Hazari is feature-complete enough for staging.

**No real browser or device QA has ever happened.** That is the gate.

---

## Next

### 1. Staging-only deployment — *requires explicit owner approval*
Deploy backend then frontend per `DEPLOYMENT.md`. Production stays blocked and
the old live app stays untouched.

### 2. Real-device QA
Work through `STAGING-CHECKLIST.md` on real phones. Look hardest at: dealing
timing, play-travel visibility, the two migrated result screens, chat with the
keyboard open, and reconnect behaviour.

### 3. Fix findings
Expect timing and spacing adjustments. Most live in one place —
`seatLayout.ts` for animation timing, `tokens.css` for FAB reserves.

### 4. Kitti — phases below
### 5. Teen Patti — phases below
### 6. Production, only after approval

---

## Kitti implementation phases

Read `RULES_KITTI.md` first. The agreed spec **conflicts with the current
engine** in several places; K1 exists to resolve that deliberately.

**K1 — Spec freeze and engine reconciliation.**
Reconcile the engine against the agreed spec. Known conflicts: strongest→
weakest ordering is currently *not* enforced; ties are flagged rather than
resolved; the platform dealing helper starts *after* the dealer while the spec
says *at* the dealer. Update `UNRESOLVED_RULES`, flip `KITTI_SCORING_CONFIRMED`
only when genuinely true. Tests alongside each rule.
*Opus. Rules work.*

**K2 — Server controller and session.**
`KittiSession` adapter, factory case, `networkPlayable: true`, `kitti:*`
events, private/public state split. Round and match structure: first to two
hands wins the round; ten rounds; standings by rounds won.
*Opus. Multiplayer state.*

**K3 — Arrangement and client flow.**
Nine cards into three groups of three, strictly strongest→weakest. Reuse
`ArrangementTable`'s language; do **not** fork `PlayingCard`.
*Sonnet once K1/K2 are settled.*

**K4 — Gameplay table.**
Three sequential hands on the shared `CardTable`, 2–5 seats. Reuse the seat
ring and play-travel.
*Sonnet.*

**K5 — Decider, bots, reconnect, play money.**
The three-different-winners decider. Bots optional. Reconnect restoring
groups and hand results. Consensual play-money board.
*Opus for the decider and reconnect.*

**K6 — Integration, mobile, QA.**
Widths 320–430, landscape, safe areas, full-match tests.
*Sonnet.*

---

## Teen Patti implementation phases

Read `RULES_TEEN_PATTI.md`. The agreed spec conflicts substantially with the
current engine — betting model, dealer rotation, sideshow, and an entire
variant framework that does not exist.

**T1 — Authoritative rule and variant model.**
Reconcile the betting model: blind doubling to a host-defined max, seen = 2×
current blind, max three blind chances then forced seen. Dealer = previous
round winner, not clockwise. Design the variant descriptor (cards dealt,
discard rules, joker modifiers, target-number rules) as data, not branches.
*Opus. The hardest design work in the project.*

**T2 — Betting and session engine.**
Rework the engine to T1. Compulsory sideshow when all remaining players are
seen, comparison anticlockwise, tie → initiator packs. Final-two mutual show.
*Opus.*

**T3 — Server controller and protocol.**
`TeenPattiSession`, `teenpatti:*` events, up to 9 seats, per-player table P&L,
mid-round top-ups.
*Opus.*

**T4 — Classic client table.**
Up to 9 seats on the shared table. Blind/seen/chaal/pack/show controls.
*Sonnet.*

**T5 — Variant framework and UI.**
Dealer selection locked before information is revealed. A "How to play this
variant" panel every player can open mid-round.
*Opus for the engine, Sonnet for the UI.*

**T6 — Play-money system.**
Host-configured balances, consensual board, live P&L, settle on leave.
Persistent wallet if pursued.
*Opus.*

**T7 — Bots, reconnect, integration, mobile.**
*Mixed.*

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
