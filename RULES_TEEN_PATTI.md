# TEEN PATTI — agreed specification

**Teen Patti comes after Kitti.**

This file is the agreed rule specification and authority for the four-game
release candidate. Teen Patti is network-playable on staging, including the
runtime-ready variant table, live join/reconnect, settlement and mobile table
flow described below. Production still waits for final staging QA.

Status key: ✅ implemented · 🟡 partial · ⛔ not implemented

**No real money. No deposits, withdrawals, cash-out or payment path, ever.**

---

## Table and session

- **Maximum 9 players.** ✅
- **No fixed round count** — play continues until players stop. ✅
- **No host Deal Next Round button between ordinary rounds.** After the result-reading pause, the server advances automatically. If the next round genuinely needs dealer variant/configuration or a player top-up for boot, it pauses only for that required action and then continues automatically. ✅

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

### Sideshow ✅

- Sideshow becomes available **only when at least three active players remain and all of them are seen**.
- It is **never compulsory merely because everyone is seen**. Normal Chaal and Pack remain available until the current player actually chooses Sideshow.
- Normal play proceeds **clockwise**.
- Sideshow comparison runs **anticlockwise**: the current player compares with the nearest active player anticlockwise.
- The **weaker hand packs**.
- **Exact tie → the sideshow initiator packs.**

### Mutual Show / final show ✅

- **Mutual Show is available whenever at least two active players remain, including 3+ players.**
- Any active player may propose it. The request is **free** and does not itself place another bet.
- Cards are opened only if **every currently active player accepts the same proposal**.
- While the request is pending, betting pauses on the exact current turn. If any eligible player declines, the request is cancelled and betting resumes from that unchanged turn.
- On unanimous acceptance, all active hands are revealed and compared. The strongest hand wins; tied strongest hands **split the pot equally**.
- If Mutual Show is not agreed, normal betting continues. The separate **paid showdown** remains a final-two action and costs the current seen amount.

---

## Ongoing round flow ✅

- A completed Teen Patti round advances to the next round **automatically** after the result pause.
- There is no host-only **Deal next round** requirement.
- The automatic transition pauses only for a genuine required action, such as the next dealer choosing/configuring a variant or a player topping up enough play money for the next boot. Once that requirement is satisfied, the deal continues automatically.
- Starting an entirely new table/session after players have ended the session remains an explicit choice.

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
data. The current four-game release runtime paths are network-enabled after
release gate**. Unsupported variants are rejected explicitly rather than
silently behaving like Classic; a descriptor alone never makes a variant
playable.

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

**K Little / Q Little / J Little** — these are three separate selectable variants, not one configurable Named Little mode. In **K Little**, Kings are wild; in **Q Little**, Queens are wild; in **J Little**, Jacks are wild. “Little” is the player's lowest remaining rank other than the fixed named rank; if that Little rank is duplicated, every card of that rank is wild. If every dealt card is already the fixed named rank, there is no additional Little rank.

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

Reveal two random undealt reference cards and keep both visible throughout the hand. **There is no assignment prompt after the deal and no prompt merely because a player becomes Seen.** Players may mentally evaluate both possibilities while betting normally.

Only when that player's hand must actually be compared in a **Sideshow** or **Show/Showdown** does the game present the two possible resulting joker sets:

- **Option A** — first reference supplies Up + Down; second reference supplies Same.
- **Option B** — second reference supplies Up + Down; first reference supplies Same.

The player chooses one option privately. The game clearly shows that player the joker set they selected, then locks that choice for the rest of that hand and resolves the comparison. Other players do not receive the private selection except the comparison result/reveals required by normal Teen Patti rules.

### 5-card retained-discard structures

**Runtime status:** 🟢 hidden/runtime-ready behind the Teen Patti four-game release.

The round dealer configures the 5-card structure **before the deal** and chooses one of:

- discard 1 lowest + 1 highest
- discard 2 lowest
- discard 2 highest

The dealer also chooses the compatible joker rule for that round. The joker applies to the final active three cards; Card Room jokers remain fully wild in **both rank and suit**.

All five originally dealt cards stay with the player for the entire hand. The required two cards are only **marked discarded**; they are never returned to the pack. Only the three non-discarded cards are ranked.

If the discard boundary contains equal-ranked physical cards, **the player chooses which actual card to discard**. Suit never breaks that choice automatically because the physical choice can change the resulting hand (for example, preserving or breaking a Pure Sequence). A blind player can make the required choice among eligible facedown card positions without seeing card identities.

At sideshow or showdown, all five originally dealt cards are revealed and the two retained discards are visibly identified. Discarded cards have **no comparison value and no tie-break value**; an exact tie between the active three-card hands follows the normal Teen Patti tie/split rule for that show context.

### 2-card assumed-third

**Runtime status:** 🟢 hidden/runtime-ready behind the Teen Patti four-game release. The server automatically chooses the strongest legal assumed card while enforcing the restriction below; it never uses a rank strictly between the two real ranks.

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
that round**. If two players finish at exactly the same numerical distance from
the target, that comparison is an exact tie; the normal Teen Patti tie rule for
the relevant sideshow/final-show context applies rather than inventing another
target-number tiebreak.

The server may select Closest to N first (fixed table, rotation or Surprise Me),
but **no boot is charged and no cards are dealt until that round's dealer has
locked the 3-digit target and the reorder/no-reorder declaration**. Reconnect
restores this pending configuration state.

### Revolving Joker — locked

The round begins with **three undealt reference cards face-up on the board**.
Every card matching any of those three ranks is wild.

Whenever a player **packs/folds for any reason**, that player's complete
three-card hand is revealed and **replaces** the current board joker references.
The previous three reference ranks immediately stop being jokers; joker ranks
never accumulate. If another player later packs, that newer packed hand replaces
them again. A sideshow loser (who is automatically packed) and an in-hand player
leave that is treated as a pack use the same rule.

The server owns every replacement and broadcasts the same current three
reference cards to all remaining players. Reconnect restores the exact current
references.

### Surprise Me / Random Variant — locked table + dealer option

**Surprise Me is not a joker mechanic.** The host first chooses the
**approved Surprise Me variant pool** from the variants that are runtime-ready
for this table. Random selection is always server-authoritative, common to the
whole table and reconnect-safe; no client can force or reroll the random result.

Two supported uses are locked:

1. **Surprise Me Table** — a dedicated table format. Before **every hand**, the
   server randomly selects one complete Teen Patti variant from the host-approved
   pool.
2. **Dealer Choice → Surprise Me** — on a normal Dealer Choice Variant Table,
   the dealer may press **Surprise Me** instead of naming a variant. The server
   then randomly selects the actual variant from that same host-approved pool.

Only fully runtime-ready variants may enter either pool. If the server randomly
selects a variant that still requires dealer parameters for that round (for
example Closest to N target/reordering), no boot is charged and no cards are
dealt until the round dealer supplies those required settings.

### Explicitly out of scope

**Do not implement:** Joker Hunt, 999, Stud-style Teen Patti.

---

## Implementation status and remaining gaps

The original partial engine conflicted with this specification in several
places. The Classic rewrite has resolved the core betting/dealer/sideshow
conflicts below; Teen Patti is network-enabled in the four-game release candidate.

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
- optional sideshow when at least three remaining players are all seen, using the nearest
  active player anticlockwise; exact tie makes the initiator pack
- free unanimous Mutual Show with any 2+ active players; paid showdown remains final-two at the current seen amount
- exact showdown ties split the pot
- no fixed number of rounds
- explicit See keeps dealt cards private until the player actually looks
- positive whole-number play-money top-ups with no maximum and live table P/L

### Play-money/session exit 🟡

Top-up, funding and live P/L exist in the Teen Patti engine/protocol, and a
Teen-Patti-specific **permanent settle-on-leave / dynamic active-session removal
flow is implemented.** It does not reuse Hazari's bot-takeover
`room:leaveTable` semantics. Production deployment still waits for staging reconnect/multi-device and real-device QA.

### Friendly Assist / Watch & Suggest

**Runtime status:** 🟢 private-table social layer in the four-game release candidate.

The host may enable Friendly Assist for a private table. After a player packs, that folded player may request permission to watch **one** still-active player's cards for the remainder of that hand. No card is revealed until the target explicitly accepts.

After acceptance, only that coach receives the consenting player's private cards, retained 5-card discard marks and private Two-Reference role assignment where relevant. The coach may privately suggest **Play, Pack, Sideshow or Show**, but suggestions never execute an action. The active player always remains the only authority over their own betting action and may revoke the assist at any time.

A coach cannot switch to a second active player's hand after seeing one player's cards in the same hand. Accepting while blind changes the consenting active player to **seen betting status** because hand information can now be communicated, although their own cards may remain visually closed until they press See. Requests are hand-bound so delayed network messages cannot create a new assist session in a later round.

### Variant framework 🟡

Descriptors/configuration exist for the agreed variants, including their deal
counts, discard/joker/target metadata and in-round help text. Classic, Muflis,
Best of Four, Standard/Lowest/Highest Joker, AK47, Pairs Are Jokers,
Random-Pack Joker, Up–Down–Same, Up–Down, Down Only, **Revolving Joker**,
**Two-Reference Joker**, all three **5-card retained-discard families**, **2 Cards · Assume the Third**, **Closest to N**, **K Little**, **Q Little** and **J Little** are runtime-enabled. **Surprise Me** is implemented as server-random selection over the host-approved runtime-ready pool, both for a dedicated Surprise Me Table and as a Dealer Choice option; if it lands on a dealer-configured variant such as Closest to N or a 5-card family, the round pauses before boot/deal for that dealer's required configuration. Unsupported variants still throw/refuse instead of falling back to Classic.

### Network/session/client 🟡

`TeenPattiSession`, `teenpatti:*` setup/state/private/action/top-up/next-round
events, reconnect result restoration, the shared-table UI and a
round-summary/top-up flow now exist. Private dealt cards are never placed in the
public state. The server registry deliberately remains `networkPlayable: false`,
so none of this is release-reachable yet.

### Release work still required ⛔

- full reconnect/multi-device coverage for Teen Patti-specific settle-on-leave and room/player lifecycle
- full reconnect/multi-device/socket integration tests for the new flow
- real-device mobile/rotation/keyboard/voice QA with up to 9 seats
- final product-level play-money consent/settlement polish

---

## What actually exists today

| Piece | Status |
|---|---|
| Maximum 9 players + hand ranking/sequence order | ✅ |
| Initial dealer draw + previous-winner next dealer | ✅ Classic core |
| Boot, blind doubling/cap, three-blind force-seen, chaal, pack | ✅ Classic core |
| Optional all-seen sideshow + 2+ player Mutual Show + final-two paid showdown + exact-tie split | ✅ Classic core |
| Card privacy / explicit See | ✅ |
| Host setup proposal + unanimous acceptance | ✅ server flow |
| Top-up + live P/L | 🟡 engine/protocol/UI plus permanent settle-on-leave built behind gate; release QA pending |
| Variant descriptors + “How to play” data | 🟡 22 runtime-ready variants/modes behind disabled release gate |
| `TeenPattiSession` + `teenpatti:*` protocol | 🟡 built behind disabled registry |
| Hidden Classic table + round summary | 🟡 built, not release-enabled |
| Teen Patti-specific settle-on-leave | 🟡 implemented behind gate; integration/device QA pending |
| Full variant execution | 🟡 all 20 approved runtime variants/modes are implemented behind the disabled release gate; full package/device release verification remains pending |
| Registry | ✅ deliberately `networkPlayable: false` |

The repository test suite has **not** been rerun in the current constrained
environment; do not treat these status markers as a new verified test baseline.
