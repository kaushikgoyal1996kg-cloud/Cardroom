# TEEN PATTI — agreed specification

**Teen Patti comes after Kitti.**

This file is the agreed rule specification. The **Classic** engine and hidden
multiplayer/client groundwork now implement a substantial part of it, but Teen
Patti remains **Coming Soon** and deliberately cannot be entered from the game
selector. Non-Classic variant execution and the complete leave/settlement/mobile
release flow are still pending. The rules below remain the authority; status
markers describe implementation only.

Status key: ✅ implemented · 🟡 partial · ⛔ not implemented

**No real money. No deposits, withdrawals, cash-out or payment path, ever.**

---

## Table and session

- **Maximum 9 players.** ✅
- **No fixed round count** — play continues until players stop. ✅

## Dealer ✅

- **First dealer** by one-card highest draw. Ace high. Redraw ties.
- **Next round's dealer is the previous round's winner.** *(Not clockwise
  rotation.)*

---

## Play money 🟡

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

## Betting ✅ (Classic engine core)

- Players are **blind** or **seen**.
- **Seen amount = 2× the current blind.**
- **Blind progression uses doubling steps**, capped at the host-defined max.
  Example: base 20, max 60 → 20 → 40 → 60.
- **Maximum 3 blind chances.** After the third blind turn, the next turn is
  treated as **seen** even if the player chooses not to look.
- A player may voluntarily become seen earlier.
- **Once seen, a player cannot return to blind.**
- **Pack** is allowed on any turn.

### Compulsory sideshow ✅

- Available **only when all remaining active players are seen** — and then it
  is **compulsory**.
- Normal play proceeds **clockwise**.
- Sideshow comparison runs **anticlockwise**: the current player compares with
  the nearest active player anticlockwise.
- The **weaker hand packs**.
- **Exact tie → the sideshow initiator packs.**

### Final two ✅

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

## Dealer-selected variant framework 🟡

The descriptor/configuration framework exists and the rules are represented as
data. **Only Classic is runtime-enabled today.** Unsupported variants are
rejected explicitly rather than silently behaving like Classic. Live execution
of the variants below remains future work.

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

## Implementation status and remaining gaps

The original partial engine conflicted with this specification in several
places. The Classic rewrite has resolved the core betting/dealer/sideshow
conflicts below, but Teen Patti is still deliberately gated as **Coming Soon**.

### Classic core now matches the agreed rules ✅

- host-configured starting balance, boot, base blind and max blind; the proposed
  setup must be accepted by every seated player before Start
- first dealer by Ace-high one-card draw with redraws for ties
- previous unique round winner becomes dealer when the **next** round starts
- blind doubles in steps to the configured maximum
- exactly three blind turns, then forced **seen betting status** without
  automatically revealing the player's cards
- seen amount = 2× current blind; once seen, never blind again
- pack on any turn where it is otherwise legal
- compulsory sideshow when all remaining players (>2) are seen, using the nearest
  active player anticlockwise; exact tie makes the initiator pack
- final-two mutual free open show, or paid showdown at the current seen amount
- exact showdown ties split the pot
- no fixed number of rounds
- explicit See keeps dealt cards private until the player actually looks
- positive whole-number play-money top-ups with no maximum and live table P/L

### Play-money/session exit 🟡

Top-up, funding and live P/L exist in the Classic engine and protocol. The
**settle-on-leave / dynamic active-session removal flow is not finished**. Do not
reuse Hazari's `room:leaveTable` for Teen Patti: that event converts a Hazari seat
to a bot and is not this game's agreed exit behaviour. Teen Patti must remain
gated until its own settlement-safe leave path is implemented and tested.

### Variant framework 🟡

Descriptors/configuration exist for the agreed variants, including their deal
counts, discard/joker/target metadata and in-round help text. **Classic is the
only runtime-enabled variant.** Attempting to configure an unsupported variant
throws/refuses instead of falling back to Classic. The actual joker, discard,
Muflis, Best-of-Four, assumed-third and Closest-to-N evaluators still need to be
implemented.

### Network/session/client 🟡

`TeenPattiSession`, `teenpatti:*` setup/state/private/action/top-up/next-round
events, reconnect result restoration, a hidden Classic shared-table UI and a
round-summary/top-up flow now exist. Private dealt cards are never placed in the
public state. The server registry deliberately remains `networkPlayable: false`,
so none of this is release-reachable yet.

### Release work still required ⛔

- Teen Patti-specific settle-on-leave and room/player lifecycle
- full reconnect/multi-device/socket integration tests for the new flow
- real-device mobile/rotation/keyboard/voice QA with up to 9 seats
- runtime implementations and UI for the non-Classic variants
- final product-level play-money consent/settlement polish

---

## What actually exists today

| Piece | Status |
|---|---|
| Maximum 9 players + hand ranking/sequence order | ✅ |
| Initial dealer draw + previous-winner next dealer | ✅ Classic core |
| Boot, blind doubling/cap, three-blind force-seen, chaal, pack | ✅ Classic core |
| Compulsory sideshow + final-two shows + exact-tie split | ✅ Classic core |
| Card privacy / explicit See | ✅ |
| Host setup proposal + unanimous acceptance | ✅ server flow |
| Top-up + live P/L | 🟡 engine/protocol/UI; leave settlement pending |
| Variant descriptors + “How to play” data | 🟡 Classic runtime only |
| `TeenPattiSession` + `teenpatti:*` protocol | 🟡 built behind disabled registry |
| Hidden Classic table + round summary | 🟡 built, not release-enabled |
| Teen Patti-specific settle-on-leave | ⛔ |
| Full variant execution | ⛔ |
| Registry | ✅ deliberately `networkPlayable: false` |

The repository test suite has **not** been rerun in the current constrained
environment; do not treat these status markers as a new verified test baseline.
