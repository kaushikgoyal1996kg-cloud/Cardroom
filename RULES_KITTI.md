# KITTI — agreed specification

**Kitti is the next game to implement, after Hazari and before Teen Patti.**

This file is the agreed rule specification. Most of it is **not yet
implemented**. The final section lists exactly where the existing engine
conflicts with this spec — **those conflicts have been documented, not
resolved. No code was changed.**

Status key: ✅ implemented · ⛔ not implemented

---

## Table

- **2–5 players** ✅
- Bots optional, not required ⛔
- **9 cards** per player ✅
- Arranged into **three groups of 3** ✅

---

## Dealer and dealing ⛔

- **Initial dealer** by one-card highest draw. Ace high. Tied highest players
  redraw.
- Dealer **rotates clockwise** each round.
- Cards dealt **one at a time clockwise, starting from the dealer**.
- The **first hand is led by the player immediately clockwise (left) of the
  dealer**.

---

## Arrangement ⛔ (validation exists, ordering does not)

Three groups of three, ordered **strictly strongest → weakest**:

- Group 1 strongest
- Group 2 next
- Group 3 weakest

Any other ordering is **invalid**.

---

## Reveal and play ⛔

Groups are played in order: **Group 1, then Group 2, then Group 3.**

- First lead follows the dealer/turn structure above.
- **The winner of each hand leads the next hand.**

---

## Hand ranking ✅ (evaluator exists)

Strongest to weakest:

1. **Trial** (three of a kind)
2. **Pure Sequence**
3. **Sequence**
4. **Colour** (flush)
5. **Pair**
6. **High Card**

**Trial:** AAA highest → KKK → … → 222.

**Pure Sequence and Sequence** share the same order:
A-K-Q highest, then **A-2-3**, then K-Q-J, Q-J-10, and downward.

**2-3-5 has no special status.** ✅

**Pair:** pair rank first, then kicker. AAK > AAQ; KKA > QQA.

**Colour / High Card:** highest card, then second, then third.

**Exact tie:** the **later thrower wins**. ⛔ *(engine currently flags ties as
unresolved rather than resolving them)*

---

## Round winner ⛔

- **First player to win two hands wins the round.**
- The third hand **may still be revealed** after the round is mathematically
  decided.
- **No sweep bonus.**

### Three-different-winners decider ⛔

If Hands 1, 2 and 3 are won by three different players:

- Only those **three hand-winners** receive **3 fresh cards** each.
- They play **one deciding 3-card hand**.
- The **Hand 3 winner leads** the decider.
- Normal hand ranking applies.
- Exact tie → later thrower wins.
- Because ties resolve, **only one decider is ever needed**.
- The decider's winner takes the round.

---

## Match ⛔

- **10 scheduled rounds.**
- Standings count **rounds won**, not individual hands.
- Most round wins after Round 10 wins the match.

### Tie for first

- Only the **tied leaders** participate.
- Everyone else becomes a **spectator and can watch**.
- Tied leaders play full normal **9-card sudden-death rounds**.
- Continue until one match winner remains.

---

## Play money ⛔

**No real money.** Optional play-money board:

- Host proposes a virtual amount.
- **All participating human players must unanimously accept.**
- Bots may auto-accept.
- Each participant contributes the amount.
- The **overall match winner** receives the full virtual pot.
- A persistent play-money wallet across matches is **planned**.

---

## Mismatches with the current engine

Found by inspecting `server/src/games/kitti/` against this spec. **Nothing has
been changed.** Resolve these deliberately in phase K1 (see `ROADMAP.md`).

### 1. Group ordering is not enforced — **conflict**

`validateKittiArrangement` explicitly does **not** require strongest→weakest,
and there is a passing test asserting a reversed arrangement is currently
valid:

> *"does NOT enforce strongest-to-weakest ordering, because that rule is
> unconfirmed"*

The spec now **requires** it. K1 must add enforcement **and update that test**,
which currently asserts the opposite of the agreed rule.

### 2. Dealing order starts after the dealer — **conflict**

The spec says cards are dealt "starting from the dealer". Kitti uses
`platform/cards/index.ts`, whose `seatingOrderFromDealer` returns
`slice(idx + 1)` — starting with the player **after** the dealer.

Hazari's own copy uses `slice(idx)` — starting **at** the dealer.

The two helpers genuinely differ. K1 must decide which Kitti follows and make
it explicit. Note the client mirror `dealingOrderFromDealer` follows the
**Hazari** convention.

### 3. Tie resolution not implemented — **gap**

`compareGroup` reports `tied: true` and lists `topPlayerIds` rather than
resolving. The spec resolves by later thrower, which requires throw order the
engine does not currently track.

### 4. Scoring, rounds and match — **gap**

`scoreRound()` deliberately throws; `KITTI_SCORING_CONFIRMED` is `false`.
None of first-to-two-hands, 10 rounds, standings by rounds won, the decider or
sudden-death exists.

### 5. `UNRESOLVED_RULES` is now stale — **housekeeping**

It lists `GROUP_ORDERING`, `SCORING`, `WIN_CONDITION`, `TIE_RESOLUTION` and
`STARTING_PLAYER` as unanswered. **All five are answered by this document.**
K1 should implement them and then flip `KITTI_SCORING_CONFIRMED`.

### 6. Turn order, leading, dealer draw, bots, play money — **gaps**

None exist. The engine has no concept of a turn, a lead or a round.

### 7. Not network-playable — **expected**

`networkPlayable: false` in the registry; no controller, no UI, no `kitti:*`
events. Rooms cannot be created. This is correct until K2.

---

## What actually exists today

| Piece | Status |
|---|---|
| 2–5 players, 9 cards, three groups of 3 | ✅ |
| 2-3-5 not special | ✅ |
| Sequence hierarchy incl. A-2-3 second | ✅ |
| Arrangement validation (sizes, ownership, duplicates) | ✅ |
| Per-group comparison and ranking | ✅ |
| Dealer rotation helper | ✅ clockwise |
| Everything else in this document | ⛔ |

19 tests, covering only what exists.
