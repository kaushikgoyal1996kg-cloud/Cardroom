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
