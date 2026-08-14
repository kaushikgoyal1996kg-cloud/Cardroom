# TEEN PATTI — agreed specification

**Teen Patti comes after Kitti.**

This file is the agreed rule specification. The great majority is **not yet
implemented**. The final section lists where the existing engine conflicts with
this spec — **documented, not resolved. No code was changed.**

Status key: ✅ implemented · 🟡 partial · ⛔ not implemented

**No real money. No deposits, withdrawals, cash-out or payment path, ever.**

---

## Table and session

- **Maximum 9 players.** ✅
- **No fixed round count** — play continues until players stop. ⛔

## Dealer ⛔

- **First dealer** by one-card highest draw. Ace high. Redraw ties.
- **Next round's dealer is the previous round's winner.** *(Not clockwise
  rotation.)*

---

## Play money ⛔

Host configures:

- starting play-money balance
- per-round board / boot
- base blind
- max blind

**Board / boot:** all active players contribute at the start of each round.
Consensual host-proposed setup, as agreed for Hazari and Kitti.

**Top-ups:** players may top up **during a round**, with **no maximum**.

**P&L:** maintain a live per-player table profit and loss. When a player
leaves, settle their table account against the current session state.

---

## Betting ⛔ (a different model from the current engine)

- Players are **blind** or **seen**.
- **Seen amount = 2× the current blind.**
- **Blind progression uses doubling steps**, capped at the host-defined max.
  Example: base 20, max 60 → 20 → 40 → 60.
- **Maximum 3 blind chances.** After the third blind turn, the next turn is
  treated as **seen** even if the player chooses not to look.
- A player may voluntarily become seen earlier.
- **Once seen, a player cannot return to blind.**
- **Pack** is allowed on any turn.

### Compulsory sideshow ⛔

- Available **only when all remaining active players are seen** — and then it
  is **compulsory**.
- Normal play proceeds **clockwise**.
- Sideshow comparison runs **anticlockwise**: the current player compares with
  the nearest active player anticlockwise.
- The **weaker hand packs**.
- **Exact tie → the sideshow initiator packs.**

### Final two ⛔

- The two may **mutually agree to an open show at no extra cost**.
- Otherwise betting continues, and either may initiate a showdown.
- A **showdown costs the normal current seen amount**.
- **Exact equal hands split the pot equally.**

---

## Hand ranking ✅ (evaluator exists)

Strongest to weakest:

1. **Trail**
2. **Pure Sequence**
3. **Sequence**
4. **Colour**
5. **Pair**
6. **High Card**

**Sequence order:** A-K-Q highest, then **A-2-3**, then K-Q-J, Q-J-10, downward.

**2-3-5 has no special status.**

**Tie-breaks:** within a category by rank; pair by pair rank then kicker;
colour and high card by highest, then second, then third. Suit is never used.

---

## Dealer-selected variant framework ⛔

Nothing of this exists. It is the largest single piece of future work.

The dealer may select:

- the variant
- the number of cards dealt
- the number and instruction for cards to discard or select
- compatible joker modifiers
- target-number rules where applicable

**Dealer choices must be locked before they could be changed after seeing
useful information.**

**Every player must be able to open a "How to Play This Variant" explanation
during the round.**

Design note for T1: model variants as **data** (a descriptor of deal count,
discard rule, joker rule, evaluation override) rather than branching code.

### Confirmed variants

**Classic** — normal Teen Patti.

**Muflis / Lowball** — ranking completely reversed; the weakest normal hand
wins, and within a category the lower combination wins. 2-3-5 has no special
rule.

**Best of Four** — deal 4, automatically evaluate the best 3-card hand.

The framework permits other deal counts where compatible.

### Joker variants

**Standard Joker** — reveal one random undealt card; all cards of that rank
are wild. Wild cards may substitute rank and suit to make the strongest legal
hand.

**Lowest Card Joker** — the player's lowest-ranked card is wild. If the lowest
rank is a pair, both are wild.

**Highest Card Joker** — as above, with the highest rank.

**AK47** — A, K, 4 and 7 are wild.

**Pairs Are Jokers** — if the dealt cards contain a pair, both cards of that
rank are wild. In larger-card variants multiple pairs may become wild unless
discarded by the declared round rule.

**Named rank + Little** (e.g. *K Little*, *Q Little*) — the named rank is wild
and the player's lowest card is also wild. The framework may support
equivalent named ranks.

**Random-pack joker** — reveal a random card from the undealt pack; all cards
of that rank are wild.

### Rank-relative joker variants

Reference a random undealt card.

- **Up–Down–Same** — reference rank, one above and one below are wild.
- **Up–Down** — one above and one below are wild; the reference itself is not.
- **Down-only** — one rank below is wild.

**Wraparound applies:** Ace up = 2, Ace down = King, King up = Ace,
2 down = Ace.

### Two-reference-card joker

Reveal two random undealt reference cards. Each player **independently**
assigns one reference to Up/Down and the other to Same-rank.

- Cannot choose Same for both.
- Cannot choose Up/Down for both.

### 5-card discard structures

The dealer may deal 5 and require:

- discard 1 lowest + 1 highest
- discard 2 lowest
- discard 2 highest

These may combine with compatible joker rules.

### 2-card assumed-third

Deal 2 actual cards. The player may **assume any third card**, rank and suit,
to form the strongest legal 3-card hand.

**Restriction:** the assumed rank cannot lie strictly between the two actual
ranks. Example: holding 2 and 4, the player cannot assume a 3.

### Closest to N

A generalised numerical target variant. The dealer chooses any exactly
**3-digit** target — 555, 777, 786, etc.

Card values: **2–9 = face value**; **10, J, Q, K = 0**; **Ace = 0 or 1,
whichever is advantageous**.

The player forms a 3-digit value from selected cards. The closest numerical
value to the target wins.

Whether players may **reorder** selected cards is **declared by the dealer for
that round**.

### Explicitly out of scope

**Do not implement:** Joker Hunt, 999, Stud-style Teen Patti.

---

## Mismatches with the current engine

Found by inspecting `server/src/games/teenpatti/` against this spec. **Nothing
has been changed.** Resolve deliberately in phases T1–T2.

### 1. Betting model differs — **conflict**

Current: `BLIND_MULTIPLIERS: [1, 2]` and `SEEN_MULTIPLIERS: [2, 4]` — the
player chooses a multiple of the current stake each turn.

Spec: blind **doubles** in steps to a host-defined max (20 → 40 → 60), and
seen is **2× the current blind**. These are different mechanics, not different
numbers.

### 2. Blind limit differs — **conflict**

Current `MAX_BLIND_ROUNDS: 4`. Spec says **3** blind chances, then forced seen.

### 3. Pot limit vs compulsory sideshow — **conflict**

Current `POT_LIMIT: 1000` forces a showdown when the pot is reached. This was
added to stop a measured **599-turn** all-blind round, since a blind player
cannot call a show.

The spec has **no pot limit**; termination comes from the 3-blind cap and
compulsory sideshow. Once T2 implements those, the pot limit should be
reconsidered — but **do not remove it before the replacement exists**, or the
599-turn problem returns.

### 4. Sideshow not implemented — **gap**

`SIDE_SHOW_ENABLED: false` and there is no sideshow logic at all. The spec
makes it compulsory when all remaining players are seen, compared
anticlockwise.

### 5. Dealer rotation differs — **conflict**

Current: `rotateDealer()` moves clockwise. Spec: **the previous round's winner
deals next.**

### 6. Host configuration missing — **gap**

`BOOT_AMOUNT: 10` and `STARTING_CHIPS: 1000` are fixed constants. The spec has
the host configure starting balance, board, base blind and max blind.

### 7. No play-money system — **gap**

No P&L, no top-ups, no settle-on-leave, no consensual board.

### 8. No variant framework — **gap**

None of it exists. Only Classic behaviour is implemented.

### 9. Final-two mutual show — **gap**

Showdown exists and costs 2× the stake (which matches "normal current seen
amount"). A **free mutually-agreed open show** does not exist.

### 10. Matches the spec ✅

- Maximum 9 players
- Hand ranking and sequence order, including A-2-3 second
- Exact ties split the pot equally
- No real money anywhere

### 11. Not network-playable — **expected**

`networkPlayable: false`; no controller, no UI, no `teenpatti:*` events.
Correct until T3.

---

## What actually exists today

| Piece | Status |
|---|---|
| Max 9 players | ✅ |
| Hand ranking + sequence order | ✅ |
| Boot collection, blind/seen, chaal, pack | 🟡 different model |
| Show, showdown, pot split | 🟡 |
| Chip conservation, server authority, duplicate-action guards | ✅ |
| Dealer rotation | 🟡 clockwise, spec says winner |
| Everything else in this document | ⛔ |

24 tests, covering only what exists.
