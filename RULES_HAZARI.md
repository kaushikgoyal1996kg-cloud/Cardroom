# HAZARI — implemented rules

**This is the authority for how Hazari behaves, extracted from the engine and
its tests. Do not change these rules.** They are covered by the original 152
tests that predate all platform work.

Everything below is **implemented and tested** unless explicitly marked
`PLANNED`.

Source: `server/src/games/hazari/` — `rules.ts`, `hands.ts`,
`fourCardRanking.ts`, `arrangement.ts`, `dismissal.ts`, `scoring.ts`,
`turnOrder.ts`, `gameEngine.ts`.

---

## Table

- Exactly **4 players**. Not a range — a game cannot start with any other count.
- **13 cards** each, from a standard 52-card deck.
- The full deck is worth **360 points**, which is the total available per round.

---

## Dealer and dealing

- **Initial dealer** is chosen by a one-card highest draw
  (`determineInitialDealer` in `deck.ts`). Ace high. Tied highest players
  redraw, repeatedly if necessary — it never falls back to a suit ranking.
  The authoritative draw rounds are now included in the public game state and
  shown as a presentation ceremony before the first 13-card deal; this changes
  no dealer-selection rule and exposes no hidden hand cards.
- **Dealer rotates clockwise** each round, including after a dismissed round.
- Cards are dealt **one at a time clockwise, starting at the dealer**
  (`seatingOrderFromDealer` uses `slice(idx)`, i.e. the dealer receives the
  first card).

---

## Arrangement

Each player splits their 13 cards into **four sets of 3 / 3 / 3 / 4**.

Sets must be ordered **strongest → weakest**: Set 1 ≥ Set 2 ≥ Set 3 ≥ Set 4.
An arrangement violating this is rejected. The server re-validates every
submission; client validation is convenience only.

---

## Hand ranking — three-card sets

Strongest to weakest:

1. **Trail** (three of a kind)
2. **Pure Sequence** (straight flush)
3. **Sequence** (straight, mixed suits)
4. **Colour** (flush)
5. **Pair**
6. **High Card**

### Sequence order

A-K-Q is highest, then **A-2-3**, then K-Q-J, Q-J-10, and downward to 4-3-2.
No wraparound: K-A-2 and A-2-4 are not sequences.

Implementation note: A-2-3 is valued 13.5, placing it strictly between K-Q-J
(13) and A-K-Q (14) without a separate category.

### Tie-breaks

Within a category, by rank. Pair compares pair rank first, then kicker.
**Suit is never a tiebreaker** — two hands of identical ranks compare exactly
equal, and the caller resolves it (see Ties below).

---

## Hand ranking — the four-card set

Documented in `rules.ts` as an **assumption**, a Teen-Patti-inspired extension:

Four of a Kind > Straight Flush (4-run, one suit) > Flush (4 same suit) >
Straight (4-run, mixed) > Three of a Kind + kicker > Two Pair > One Pair >
High Card. Rank-based tiebreaks within category.

Isolated in `fourCardRanking.ts` so the methodology can be swapped without
touching anything else.

---

## Turn order and play

- A round is four **sub-rounds**, one per set index, played in order:
  Set 1, Set 2, Set 3, Set 4.
- **Starting player for Set 1:** the player immediately clockwise of the
  dealer (`STARTING_PLAYER_RULE: 'LEFT_OF_DEALER'`, configurable to `'DEALER'`).
- Play proceeds clockwise from the leader.
- The **winner of a sub-round leads the next one**.

---

## Scoring

- Card values: **A, K, Q, J, 10 = 10 points**; **9 down to 2 = 5 points**.
- The whole deck totals **360 points** per round.
- The winner of a sub-round takes the points of **all cards played in it**.
- Cumulative scores carry across rounds.
- **First to 1,000 points wins the match** (`WINNING_SCORE: 1000`).

---

## Ties

An exact tie between sets of identical strength is resolved by **last throw**:
the player who played later takes it. Suit is never used.

> **OPEN RULE QUESTION.** If two players finish a round tied at exactly the
> same score of 1000+, `checkGameWinner` currently picks whichever appears
> first in the player list. The code acknowledges this is unspecified. The
> owner has not answered whether it should be a shared victory or a
> sudden-death round. **Do not invent an answer.**

---

## Dismissal

Two conditions make a player **eligible** to dismiss their hand:

1. **No Possible Sequence** — no arrangement of the 13 cards can produce any
   set containing a Sequence, Pure Sequence or Trail.
2. **Six Pairs** — the raw 13-card hand contains at least six pairs.

Rules:

- Eligibility is verified **server-side** before a dismissal is honoured.
- Dismissal is **optional** — an eligible player may play the round normally.
- Dismissal is **whole-round, not per-player**. Nobody folds mid-round; every
  player always plays every set.
- If invoked, the **entire round is voided for all four players**: no
  sub-rounds are scored, everyone receives 0 for that round, cumulative scores
  are untouched.
- The **dealer still rotates** before the next deal.

---

## Reconnection

- A disconnected player keeps their seat for **3 minutes**
  (`RECONNECT_WINDOW_MS`, now in `platform/rooms/sessionConfig.ts` — it is a
  network concern, not a game rule).
- Restores identity, room, seat, private cards, arranged groups, score,
  dealer, turn, round and game status.
- **The host is not transferred on disconnect.** The seat is held and they
  resume as host.
- Opponents' hidden cards are never exposed.

---

## Bots

- Hazari supports bots, always labelled **`Bot`**. They are never presented as
  human.
- Bots arrange from **their own 13 cards only** using the server arrangement
  solver; they never receive or inspect an opponent's hidden hand.
- Bot actions verify current game state before acting.
- At most **one bot action timer per table/session** is pending at a time, so
  near-simultaneous human confirmations cannot make computer actions burst
  together.
- Bot timing is deliberately paced for presentation (arrangement slightly
  slower than an ordinary throw) with deterministic variation; this changes no
  legal move or scoring rule.
- Scheduled ticks are bound to the **session** they were scheduled for, so a
  stale tick cannot mutate a later game.

---

## Arrangement assistance fairness

A **game-integrity product rule**, not a card rule.

- A player with **any real human opponent** gets no automatic arrangement
  assistance.
- **Mixed rooms are also blocked** — one human opponent among bots is enough.
- Only a fully bot opponent set permits assistance.
- Suggestions are computed **server-side**; the endpoint re-derives eligibility
  from authoritative room state and refuses before computing anything.
- A seat abandoned via "Leave Table" becomes a bot and stops counting as a
  human opponent.
- Neutral **Rank / Suit / Dealt Order sorting remains available** to everyone.
  Sorting reorders a flat list; it never chooses the four sets.

---

## Play money ✅

The optional room-session play-money board is implemented for Hazari. It does
**not** replace or alter Hazari's point scoring: the match is still won at
1,000 points exactly as above. The board is an optional virtual side ledger
for the match and has no cash value.

The implemented rule:

- The **host proposes** a virtual play-money board amount.
- **All participating human players must unanimously accept** the proposed
  amount.
- **Bots may auto-accept** where applicable.
- Each participating player **contributes the agreed virtual amount**.
- The **overall Hazari match winner receives the full virtual pot**.

### Hard limits — play money only

- **No real-money deposits.**
- **No withdrawals.**
- **No cash-out.**
- **No payment processing.**
- **No conversion of virtual balances into real currency.**

These are absolute and apply to every game in this project. The current
implementation keeps only room-session P/L; there is no persistent wallet. See
`RULES_KITTI.md` for the equivalent Kitti specification, which this mirrors.

**No real money, ever.**
