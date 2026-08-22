# KITTI — agreed specification

**Kitti is implemented as the second playable game, after Hazari and before Teen Patti.**

This file is the agreed rule specification and remains the authority for Kitti.
The core engine, multiplayer controller and client flow now implement the rules
below. Optional bots and both consensual room-session play-money modes are implemented.

Status key: ✅ implemented · ⛔ not implemented

---

## Table

- **2–5 players** ✅
- Bots optional, not required ✅
- **9 cards** per player ✅
- Arranged into **three groups of 3** ✅

---

## Dealer and dealing ✅

- **Initial dealer** by one-card highest draw. Ace high. Tied highest players
  redraw.
- Dealer **rotates clockwise** each round.
- Cards dealt **one at a time clockwise, starting from the dealer**.
- The **first hand is led by the player immediately clockwise (left) of the
  dealer**.

---

## Ongoing round flow ✅

- After a Kitti round result, the next scheduled round is **dealt automatically** after the short result pause.
- If the match enters sudden death, each required sudden-death round also starts automatically.
- The host does not have to press a Next/Deal button between rounds.
- Automatic dealing stops at **MATCH_COMPLETE**; starting a completely new match remains an explicit table choice.

---

## Arrangement ✅

Three groups of three, ordered **strictly strongest → weakest**:

- Group 1 strongest
- Group 2 next
- Group 3 weakest

Any other ordering is **invalid**.

---

## Reveal and play ✅

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

**Exact tie:** the **later thrower wins**. ✅

---

## Round winner ✅

- **First player to win two hands wins the round.**
- The third hand **may still be revealed** after the round is mathematically
  decided.
- **No sweep bonus.**

### Three-different-winners decider ✅

If Hands 1, 2 and 3 are won by three different players:

- Only those **three hand-winners** receive **3 fresh cards** each.
- They play **one deciding 3-card hand**.
- The **Hand 3 winner leads** the decider.
- Normal hand ranking applies.
- Exact tie → later thrower wins.
- Because ties resolve, **only one decider is ever needed**.
- The decider's winner takes the round.

---

## Match ✅

- **10 scheduled rounds.**
- Standings count **rounds won**, not individual hands.
- Most round wins after Round 10 wins the match.

### Tie for first

- Only the **tied leaders** participate.
- Everyone else becomes a **spectator and can watch**.
- Tied leaders play full normal **9-card sudden-death rounds**.
- Continue until one match winner remains.

### Optional Round Boot table mode ✅

Round Boot is a separate host-selected play-money mode; it does not replace or
change the normal 10-round match above.

- The host proposes a positive whole-number virtual boot (for example 10), and
  every human participant must accept before Start. Bots auto-accept.
- Every seated participant contributes one boot before each deal.
- The first player to win two of that deal's three hands wins the accumulated
  pot. No fixed 10-round target or overall match winner applies.
- If three different players win Hands 1, 2 and 3 (a 1–1–1 result), there is no
  fresh-card decider in Round Boot mode. The pot stays on the board, every seat
  contributes the boot again, and the next deal starts automatically.
- After a two-hand winner receives the accumulated pot, the next automatic deal
  begins with a fresh one-boot-per-seat pot.
- Exact ties inside an individual hand still use the locked later-thrower rule.
- This remains room-session virtual accounting only, with no cash value.

---

## Play money ✅

**No real money.** Optional play-money board:

- Host proposes a virtual amount.
- **All participating human players must unanimously accept.**
- Bots may auto-accept.
- Each participant contributes the amount.
- The **overall match winner** receives the full virtual pot.
- In optional **Round Boot** mode, the per-deal carry/payout rules above apply
  instead of waiting for a 10-round match winner.
- The current implementation keeps room-session P/L only. A persistent play-money wallet across app sessions is **not implemented**.

---

## Current implementation status

Implemented and wired online:

- 2–5 player rooms and 9-card dealing.
- Initial one-card dealer draw with tied-high redraws.
- Dealer-first clockwise dealing; player clockwise from dealer leads Hand 1.
- Strict strongest → weakest arrangement validation.
- Hand 1 → Hand 2 → Hand 3 flow; previous hand winner leads next.
- Exact ties awarded to the later thrower.
- Immediate round win once a player takes two hands.
- Three-different-winner fresh-card decider.
- 10 scheduled rounds, standings by rounds won, tied-leader sudden death.
- `KittiSession`, `kitti:*` socket controller, private/public state split, reconnect restoration.
- Mobile client arrangement, dealing, shared table, hand reveal, round summary and winner screens.
- Optional Kitti computer seats: bots auto-ready, arrange/play only their own cards, obey normal turn/decider rules and never join voice. Shared scheduler hardening keeps at most one pending bot tick per table/session and uses deterministic presentation pacing; this changes no Kitti move/ranking rule.
- Server-authoritative arrangement suggestion for a human only when every opponent at the table is a bot; any real human opponent disables/refuses assistance.

Still pending:

- Any persistent play-money wallet across app sessions.
- Full real-device QA across the supported Android/iPhone matrix.

The server registry is now `networkPlayable: true` for Kitti. Do not revert it to
false unless Kitti is intentionally being disabled for a release.
