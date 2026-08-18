## 2026-08-18 — release audit continuation: Teen Patti/Poker lifecycle departure + reconnect

- Added a focused hidden-game release-audit test for the lifecycle edges most likely to corrupt a private family table immediately before/after a deal.
- **Teen Patti Dealer Choice:** if the upcoming dealer leaves/settles while the table is waiting for that dealer to choose a variant, authority transfers to a remaining player and the round can still start normally.
- **Teen Patti Friendly Assist:** accepted consent is restored from authoritative private state after reconnect, remains invisible to unrelated players, and is cleared when the next round begins.
- **Poker Dealer Choice:** if the chooser settles before selecting the hand variant, chooser authority transfers and the hand remains playable.
- **Poker dealer settlement:** a dealer who leaves after a completed hand is purged exactly once and the button advances to the correct next seated player rather than skipping/duplicating rotation.
- Direct release harness: **4/4 lifecycle scenarios pass**. Hidden-engine stress harness also completes **484 Teen Patti rounds + 250 Poker hands** without a failure on the current compiled audit tree.
- The normal full package gate is still pending: this runtime has only a partial server dependency tree, so a repository-wide `tsc`/Vitest/Vite/Capacitor/Gradle pass cannot yet be claimed. Teen Patti and Poker therefore remain intentionally `networkPlayable: false`.

## 2026-08-18 — K Little / Q Little / J Little split into direct options

- Replaced the generic **Named Rank + Little** choice with three explicit Teen Patti variants: **K Little**, **Q Little**, and **J Little**.
- The dealer/host now chooses the exact Little variant directly from the normal variant list. There is **no second K/Q/J rank-picker screen**.
- The server treats the selected face rank as fixed by the variant ID, so K Little cannot become Q/J Little through a stale or forged round configuration.
- Little semantics are unchanged: the fixed named rank is wild, and the player's lowest remaining non-matching rank is also wild; duplicated Little ranks are all wild.
- The runtime-ready Teen Patti catalogue is now **22 variants** because the former single configurable mode is represented by three direct game options.

## 2026-08-18 — release audit continuation: Named Rank + Little completion

- **Named Rank + Little promoted to runtime-ready:** dealer chooses the named wild rank before boot/deal; the named rank is fully wild, and “Little” is the lowest remaining non-named rank in each player’s hand. If that little rank is duplicated, every card of that rank is wild. If all dealt cards are already the named rank, there is no additional little rank.
- **Rule-edge correction during audit:** the first implementation selected the absolute lowest rank, which failed when the dealer-named rank itself was the lowest printed rank. The evaluator now excludes the named rank when determining Little, with focused regression cases for duplicated Little, named-rank-is-lowest and all-named-rank hands.
- **Dealer configuration/UI:** Named Rank + Little participates in the authoritative pre-deal dealer configuration gate, validates the rank server-side, resets between rounds, and exposes a mobile/short-landscape-safe A–2 rank picker.
- **Variant release set:** Teen Patti now has **20/20 approved runtime variants/modes implemented behind the release gate**. The registry remains `networkPlayable: false`; this implementation milestone does not bypass the full npm/Vitest/Vite/Capacitor/Gradle and real-device release gates.

## 2026-08-18 — release audit continuation: private-state coherence + hidden-game mobile/result hardening

- **Public/private snapshot coherence:** Teen Patti private snapshots now carry `roundNumber + sequence`; Poker private snapshots carry `handNumber + sequence`. The client exposes cards/legal actions only when those identifiers exactly match the current authoritative public snapshot. This closes the brief stale-hand/stale-action window possible between separately delivered Socket.IO public/private packets during betting, new deals, reconnect and top-up.
- **Sequence-wide private refresh after top-up:** Teen Patti and Poker top-ups advance the table sequence, so the server now refreshes every seated player's private snapshot after the new public state rather than leaving other players' legal/private models tagged to the old sequence.
- **Reconnect-safe setup controls:** Teen Patti/Poker lobby proposal and acceptance controls now fail locally while reconnect action-gating is active instead of buffering setup mutations through restoration.
- **Teen Patti no-flash coherence UX:** the physical table remains mounted if the matching private packet is momentarily between updates; private-dependent controls are replaced by `Syncing your private hand…` until the coherent packet arrives.
- **Android/PWA viewport hardening:** Teen Patti live table, dealer-variant choice and round-result shells now consume the shared `VisualViewport` height contract. Poker runtime now supplies its existing `--app-height` contract from `VisualViewport`, reducing short-landscape/browser-bar clipping risk.
- **Poker result-layer cleanup:** on `HAND_COMPLETE`, the live local hole-card/action rail is retired while the felt remains visible, leaving a smaller result/bankroll reserve so between-hand furniture cannot stack over live-action chrome.
- **Focused verification in this constrained runtime:** current hidden-game engines compile strictly; current max-seat runtime harness passes all 19 Teen Patti variants at 9 seats and Poker Texas/PLO4/PLO5/PLO6/Short Deck at their configured caps; private/public coherence harness passes; 207 TS/TSX/MTS/CTS source/test files parse with zero syntax diagnostics and 51 CSS files pass brace-structure scan.
- **Normal release gate still pending:** `node_modules` are absent and npm registry access still does not complete in this runtime, so full Vitest/Vite/Capacitor/Gradle and real-device QA are not claimed. Teen Patti/Poker remain deliberately `networkPlayable: false` until those gates are green.

## 2026-08-18 — release audit continuation: hidden-game max-seat/privacy + Poker top-up retry hardening

- **Teen Patti max-seat/runtime sweep:** added release-audit coverage that drives every one of the 19 runtime-ready Teen Patti variants at the 9-seat release ceiling, including discard and Two-Reference gates, and asserts that live public state never contains any player's private card ids.
- **Poker max-seat/runtime sweep:** added release-audit coverage for Texas Hold'em, PLO4, PLO5, PLO6 and Short Deck at each variant's configured maximum seat cap, verifying public state never carries hole cards during live play and fold-down outcomes/history do not reveal them.
- **Direct dependency-light audit passed:** privacy/reconnect harness passed; all 19 Teen Patti variants completed at normal and 9-seat audit loads; Poker completed Texas/PLO4 at 9 seats, PLO5 at 8, PLO6 at 7 and Short Deck at 6.
- **Poker top-up retry hardening:** removed a client-only `Adding…` sequence latch that could remain stuck forever if a top-up request was rejected without state advancement. Duplicate protection remains server-authoritative through `expectedSeq`, so rapid duplicate submissions still stale-reject safely without permanently disabling the bankroll control.
- **Poker selector copy:** updated the hidden Poker card copy to reflect the actual release target: Texas, Omaha 4/5/6 and 6+ Short Deck in one private table.
- **Normal release gate still blocked in this runtime:** `vitest` is not installed and `npm ping` to the registry times out, so the full npm/Vitest/Vite/Capacitor/Gradle gate is still not claimed. Teen Patti/Poker remain `networkPlayable: false` until that gate and device QA are green.

## 2026-08-18 — release audit: result restoration, accurate Poker deal ceremony and screen hygiene

- **Reconnect result restoration:** Hazari/Kitti round summaries and winner screens, Teen Patti round summaries and Poker hand results can now rebuild directly from authoritative public snapshots/history after reconnect. One-time completion events remain responsible for celebration effects/device stats, but are no longer required to avoid a Loading screen.
- **Visible result exit path:** all four result surfaces expose a restrained Card Room path that keeps the seat connected first, then reuses the existing Resume / permanent Leave-or-Settle screen instead of duplicating destructive logic.
- **Poker deal fidelity:** shared `CardTable` now supports a separate left-of-dealer cosmetic deal order. Hazari/Kitti/Teen Patti stay locked to dealer-first; Poker mirrors its authoritative engine by starting clockwise after the button and can skip sitting-out zero-stack seats without moving their physical seats. Hole cards/actions stay visually private/inactive until the ceremony completes.
- **Five-card ceremony timing:** Teen Patti `AWAITING_DISCARD` now counts as a genuinely dealt state, so 5-card hands animate immediately after the deal rather than only after discard choices transition the round to betting. Two-Reference assignment retains the same post-deal treatment.
- **Shared utility hygiene:** entering a dealing ceremony closes any open Chat/Voice panel and hides the radial hub for the brief deal, preventing a dealer-choice chat/settings surface from carrying over the physical deal animation. Teen Patti's in-round `How to play` button now routes through the same App-owned exclusive Rules surface instead of opening a second component-local modal.
- **No duplicate hand cards during dealing:** Poker and Teen Patti reserve the final local-hand footprint with invisible layout slots during the ceremony; the only visible cards are the ones physically flying from the deck. The actual private/facedown hand appears only when the ceremony completes.
- **Cross-room cleanup:** successful create/join/quick-match clears stale room/game errors and old Teen Patti/Poker settlement notices; room/view transitions clear shared modal surfaces.
- **Toolchain gate rechecked:** client/server/App dependency-light graph compiles pass. npm registry access still times out in this runtime and Vitest is not installed, so the normal full npm/Vitest/Vite/Capacitor release gate remains pending and is not claimed.

## 2026-08-18 — release-audit checkpoint: result-command sequences, reconnect leave and repository truth

- Continued the whole-app audit without changing live Release 1.5.1 or exposing Teen Patti/Poker.
- **Next-round/next-hand stale protection:** `teenpatti:startNextRound` and `poker:startNextHand` now require the exact authoritative `expectedSeq` from the completed result state. A delayed/double-tapped old result command is rejected before any new boot/blind/card mutation. The client no longer optimistically blanks Teen Patti's result before server advancement.
- **Reconnect leave regression:** added client coverage proving a Poker room that is authoritatively `IN_GAME` uses Poker settle/release from the “Your seat is still connected” screen even while `pokerState` is temporarily null during rehydration.
- **History identity regression:** added client coverage proving a departed Teen Patti/Poker participant name resolves from the public-safe room-lifetime directory instead of degrading to “Former player.”
- **Repository truth:** refreshed `HANDOFF.md`, `README.md` and `ARCHITECTURE.md`; they no longer claim Poker has no server GameId/engine or describe the current Teen Patti work as early Classic-only groundwork.
- **Broader compile surface:** complete client/server source+test graph compiles still pass with dependency stubs, and the previously-uncovered `vite.config.ts`, `capacitor.config.ts`, `avatars-tables-test.mts` and `full-flow-test.mts` also pass a strict stubbed compile.
- Full npm/Vitest/Vite/Capacitor/Gradle/device verification remains mandatory and is not claimed in this environment.

## 2026-08-18 — whole-app release audit: startup, shared chrome, Poker authority and history identity

- Continued from the 19-variant + Friendly Assist working tree; live Release 1.5.1, Render/Netlify staging and the old Haazari deployment were not modified.
- **Production-startup fix:** a stronger complete-client compile caught `main.tsx` calling imported `initializeTablePreferences` as `ReactDOM.initializeTablePreferences()` while calling an unimported `createRoot`. Corrected to import/use `createRoot` and call `initializeTablePreferences()` directly.
- **Shared radial hub/lifecycle:** one utility surface at a time; hub hides on result/loading screens; dealer-choice screens reserve the hub footprint; room/view changes clear stale Rules/Stats/History/Chat/Settings/error surfaces; Back on Teen Patti/Poker dealer-choice uses the deliberate settle/leave confirmation. Friendly Assist and contextual Teen Patti errors use a derived safe region instead of overlapping the hand/action rail.
- **Poker Dealer Choice stale protection:** `poker:chooseVariant` now carries `expectedSeq`; missing/old sequences are rejected before blinds/antes/hole cards are touched. A direct compiled harness confirms stale choice leaves state at `AWAITING_VARIANT`, pot 0 and no private cards.
- **Reconnect leave hardening:** the active-seat return screen now treats a Poker room marked `IN_GAME` as authoritative even before detailed Poker state finishes rehydrating, so Leave always uses Poker settle/release rather than generic room exit.
- **History identity:** room public state now includes a public-safe room-lifetime name/avatar directory. Teen Patti/Poker history can still name a dealer/winner/showdown participant after that live seat is permanently released. Tokens/cards/balances are never placed in this directory.
- **Registry drift fix:** Teen Patti is now `cardsPerPlayer: 'VARIES'` at the shared server registry and the Coming Soon card says `2–5 cards by variant`; the Classic constant remains 3 but shared platform metadata no longer hard-codes Classic assumptions.
- **Poker history drift fix:** completed Poker outcomes capture server-authored `variantName`; Hand History no longer re-translates historical IDs through the promotional client catalogue.
- **Stronger compile audit:** complete client source+test graph and complete server source+test graph compile with lightweight external-library stubs; focused App/server/runtime configs also pass. This audit additionally repaired stale Poker test fixtures introduced by cumulative `handsWon` / reconnect-safe `handHistory` fields.
- **Normal release gate still pending:** `npm ping` still fails with `getaddrinfo EAI_AGAIN registry.npmjs.org`, so no claim is made for full Vitest/Vite/Capacitor/Gradle verification.

## 2026-08-18 — all-game history/stats audit + Assume the Third

- Audited the Hazari/Kitti Round History bug class across hidden Teen Patti and Poker.
- Teen Patti now publishes bounded reconnect-safe round history plus cumulative per-player `roundsWon`.
- Poker now publishes bounded reconnect-safe hand history plus cumulative per-player `handsWon`; fold-down history never exposes private cards.
- Shared Settings now exposes correct Teen Patti/Poker **Table Stats** and Poker **Hand History** rather than disabling or falling through to another game.
- Client GameStore continuously rehydrates Teen Patti/Poker history from authoritative state, with event-only completion updates retained as immediate fallback.
- Made `2 Cards · Assume the Third` runtime-ready behind Coming Soon and synchronized the server/client runtime-ready catalogue at 16 variants.
- Focused strict server/client checks and direct history/privacy/counter harnesses pass. Normal npm dependency restoration remains blocked in this runtime by registry DNS `EAI_AGAIN`; no live deployment was changed.

## 2026-08-18 — WIP continuation: Two-Reference Joker + live Round History rehydration

- **Two-Reference Joker runtime:** two public board references are dealt; each player privately assigns one as the Up/Down reference and the other becomes Same-rank. Betting is gated until every remaining seated player has locked an assignment. Public state exposes only assignment completion, never another player's private role choice. Leaving during this gate keeps already committed boot in the hand and safely refreshes the remaining assignment gate.
- **Hazari Round History fix:** completed rounds are now carried in authoritative Hazari public state and rehydrated continuously on the client, so history remains available during later live rounds, after Return to Table and after reconnect.
- **Kitti Round History audited/fixed the same way:** Kitti public state now carries completed match rounds; the history sheet no longer depends on transient events received only by the current browser session.
- **Settings transition hardening:** Rules, Stats and Round History now open through one parent-owned surface transition rather than child `close + open` chaining.
- **Regression coverage:** Hazari/Kitti engine tests now assert completed rounds are present in public state; a client hydration regression verifies that an authoritative live-state snapshot replaces stale same-round browser history (including wrong IDs/zero scores), and direct runtime harnesses verify both games retain completed history after the next round is dealt.
- No Hazari/Kitti rule changes. Full npm/Vitest/Vite/device release verification is still pending.

## 2026-08-18 — WIP continuation: unanimous Mutual Show + host-approved Surprise Me

- **Mutual Show generalized:** any active Teen Patti player may propose a free show even with 3+ players remaining. The requester auto-accepts, every other active player must accept, and betting is frozen on the exact current turn until the vote resolves. Any decline cancels the vote and resumes that unchanged turn. Unanimous acceptance reveals every active hand; exact best-hand ties split the virtual pot equally. The existing final-two free mutual show remains the same flow.
- **Concurrent-vote safety:** intermediate Mutual Show acceptances keep the proposal sequence stable, so multiple phones accepting the same visible proposal do not invalidate one another through the global stale-action guard. Duplicate votes are rejected by player id; completion/decline advances authoritative state.
- **Host-approved Surprise pool:** Surprise Me no longer forces the complete runtime catalogue. At lobby setup the host chooses at least two runtime-ready variants that the server is allowed to randomize.
- **Dedicated Surprise Me Table:** server randomly chooses one complete approved variant before every hand. The result is server-owned and reconnect-safe.
- **Dealer Choice Surprise Me:** a round dealer on a normal Dealer Choice Variant Table can choose Surprise Me instead of naming a variant. The dealer triggers randomness but cannot choose or reroll the server result. If the selected variant requires dealer parameters (for example Closest to N), the same pre-deal configuration gate is used before any boot/card deal.
- **Hidden premium UI:** lobby now presents Single Variant / Variant Table / Surprise Me Table, the host-approved pool remains editable only in setup, Dealer Choice has a Surprise Me tile, the live table shows unanimous vote progress, and Surprise-selected hands are identified without changing the actual variant rules.

# SESSION CHANGELOG

## 2026-08-18 — 5-card retained-discard completion + Friendly Assist hardening

- Promoted all three locked 5-card retained-discard families to runtime-ready behind the Teen Patti Coming Soon gate: discard low+high, two lowest, or two highest.
- The round dealer chooses the compatible joker rule before boot/deal. All five physical cards stay with the player; only the active three are ranked. Card Room jokers remain fully wild in both rank and suit.
- Equal-ranked discard boundaries are a **physical player choice** rather than an automatic suit tiebreak. Blind players choose only among eligible facedown positions; seeing the five cards remains optional and changes them to seen betting as normal.
- Five-card sideshow and paid/mutual showdown reveal all five original cards and mark the two retained discards; discarded cards never contribute to ranking or break an exact tie. Added regression coverage using the `2♣ 2♠ 3♠ 4♠ 8♥` example without a joker modifier.
- Added optional host-configured **Friendly Assist / Watch & Suggest**. After packing, a player may ask one active friend for consent to privately view that player's hand and send advisory Play/Pack/Sideshow/Show suggestions. One coached target per hand; access is revocable and never auto-acts.
- Friendly Assist exposes 5-card discard marks and private Two-Reference role assignment only to the accepted coach. Accepting while blind changes the active target to seen betting status while allowing their own cards to remain visually closed until See.
- Hardened Friendly Assist requests with the authoritative round number so a delayed request from a previous hand cannot create a fresh session after reconnect/network delay.
- Hidden server/client Teen Patti runtime catalogue is now synchronized at **19** ready variants; Named Rank + Little remains intentionally gated.


## 2026-08-18 — Hazari dismissal correction: Trial does not block no-sequence dismiss

- Real-device play exposed a locked-rule regression: a 13-card deal with no possible Sequence/Pure Sequence but containing a Trial/Trail was not offered **Dismiss hand**.
- Corrected both client and server dismissal eligibility: Trial/Trail is not a sequence and does not block `NO_SEQUENCE` dismissal.
- `NO_SEQUENCE` is now derived authoritatively from the raw 13-card deal by scanning every 3-card subset for Sequence/Pure Sequence, so arrangement cannot create/hide eligibility and the dismiss option can appear immediately after the deal.
- Server still re-verifies the raw dealt cards; dismissal remains optional and still voids the whole round for all four players with 0 points and normal dealer rotation.
- Added regressions for Trial-with-no-sequence eligibility and for a real raw Sequence correctly blocking dismissal. No Hazari ranking/scoring/dealing rule changed.

Append-only. **Add new entries at the top.** Never rewrite history — if an
earlier entry was wrong, add a correction entry saying so.

Purpose: a fresh session can see what changed recently, what was decided and
why, without any conversation context.

---

## 2026-08-18 — WIP continuation: Closest to N dealer configuration + stale round-decision authority

- **Closest to N runtime path:** enabled the locked numerical-target variant behind the Teen Patti release gate. Dealer chooses an exact 3-digit target (100–999) and explicitly declares whether the three dealt cards may be reordered; 2–9 keep face value, 10/J/Q/K = 0 and each Ace may be 0 or 1 whichever is advantageous. Equal numerical distance is an exact tie and falls through to the existing Teen Patti tie rule for that comparison context.
- **Pre-deal configuration gate:** generalized `AWAITING_VARIANT` into an authoritative `CHOOSE_VARIANT` / `CONFIGURE_VARIANT` decision. A fixed table, fixed rotation or Surprise Me may select Closest to N first, but no boot is charged and no card is dealt until the actual round dealer commits target + reorder settings. Reconnect-safe public state identifies that pending decision.
- **Surprise Me integration:** the server-owned random pool now contains 14 runtime-ready variants including Closest to N. If Surprise Me lands on a variant requiring dealer parameters, it pauses at the same configuration gate rather than silently inventing settings.
- **Stale decision protection:** `teenpatti:chooseRoundVariant` now carries the exact authoritative `expectedSeq` at the client/server socket boundary. Missing/invalid sequences are rejected before engine dispatch; an old dealer choice/configuration is rejected by the engine without charging boot or dealing cards.
- **Verification in constrained runtime:** strict dependency-light Teen Patti core TypeScript compile and direct runtime harnesses cover Revolving Joker manual/sideshow/leave replacement, Closest Ace 0/1 + reorder behavior + equal-distance tie, fixed Closest pre-deal configuration, and Surprise→Closest pending configuration. Full normal npm/Vitest/Vite production verification remains a release gate.
- **Release safety:** Teen Patti/Poker remain `networkPlayable: false`; Hazari/Kitti rules, live Release 1.5.1 and the old Haazari deployment remain untouched.

## 2026-08-18 — WIP continuation: locked Revolving Joker + server-authoritative Surprise Me

- **Rule recovery completed:** the user reconfirmed the exact Card Room Revolving Joker rule. Three undealt board references begin the round. Whenever any player packs/folds, that player's complete three-card hand replaces the current references; all matching ranks become wild and the old joker ranks stop immediately. The same replacement occurs for an automatic sideshow pack and an in-hand leave treated as a pack.
- **Runtime implementation:** added `REVOLVING_JOKER` to the shared server/client variant identities and runtime catalogue. The server deals three initial board references, broadcasts them publicly, replaces them atomically on pack, and the evaluator treats every current reference rank as wild.
- **Surprise Me locked:** added `SURPRISE_ME` Variant Table rotation. It is a server-owned random whole-variant selector, not a joker rule. At the network validation boundary the pool must equal the complete runtime-ready Teen Patti catalogue, so a client cannot narrow the pool. Surprise Me deals immediately and never waits for dealer choice.
- **Premium hidden setup UI:** added a third Variant Table mode control for Surprise Me; while selected, every runtime-ready variant is visibly included and cannot be cherry-picked. Revolving Joker appears as a ready joker variant and the live/rules surfaces label its three cards as the current jokers.
- **Authority regression coverage:** added source tests plus a dependency-light runtime harness covering manual pack, leave-as-pack, sideshow pack, old-reference replacement, new-rank wild evaluation, full-pool enforcement and Surprise selection bounds/lifecycle.
- **Release safety:** Teen Patti remains `networkPlayable: false`; Hazari/Kitti rule code and all live deployments remain untouched.

## 2026-08-18 — WIP continuation: approved Card Room identity, hand-bay refinement and Teen Patti sequence gate

- **Baseline before:** `cardroom-current-work-WIP-2026-08-18-poker-network-foundation.zip`. Live Release 1.5.1, GitHub, Render/Netlify and the old Haazari deployment were not modified.
- **Approved brand identity:** replaced the bullseye-like primary seal with the user's approved third logo direction: an open private-room doorway, warm lamp and card table in dark green/black with antique gold. Added master/emblem/safe-icon assets; Welcome, Home, Player Profile, invitation arrival, offline page, loading mark, legacy shared motif and exit sheet use the new emblem. PWA launcher, Apple touch and native Android source icons are derived from the emblem so tiny icons do not rely on unreadable wordmark text.
- **PWA cache:** bumped `sw.js` shell cache to `cardroom-v3`, cached `/brand/card-room-emblem.png`, and added a source regression assertion so a future branding edit cannot silently drop the offline emblem. Live/socket traffic bypass rules are unchanged.
- **Card back identity:** removed the old concentric/eye-style legacy card-back motif and replaced it with restrained dark-green crosshatch, brass framing and a central spade. Shared secondary `CR` monograms may remain as decorative initials; they are not the primary logo.
- **Hazari/Kitti arrangement architecture:** without changing any locked ranking/validation/deal rule, grouped cards now sit in shallow physical hand bays with a slight arc/fan and selected-card lift. The remaining hand uses stronger natural overlap/perspective. Short-landscape preserves card size and fits through spacing/overlap instead of shrinking the cards.
- **Teen Patti stale-action authority:** `teenpatti:action` now requires `expectedSeq` at both client and server socket contracts. The client emits nothing without a current sequence; the server rejects missing/invalid or old sequence values before applying a bet/action. This closes the same delayed-double-tap/reconnect race already hardened in Poker.
- **Documentation correction:** current state/roadmap now reflect that Teen Patti permanent settle-on-leave and many non-Classic runtime variants are already implemented behind the gate; older historical changelog claims remain append-only history. Revolving Joker and Surprise/Random are still specification-recovery items and were not guessed.
- **Verification limitation:** source/CSS/import/static checks are rerun for this WIP below; full normal npm/Vitest/typecheck/Vite builds and real-device QA remain mandatory before deployment.
- **Baseline status:** WIP only; Teen Patti/Poker remain `networkPlayable: false`.

## 2026-08-18 — WIP continuation: authoritative Poker network/leave path and hidden premium runtime

- **Baseline before:** `cardroom-current-work-WIP-2026-08-18-variant-table.zip`. Live Release 1.5.1, GitHub deployment branches, Render/Netlify and the old Haazari deployment were not modified.
- **Poker remains hidden:** server registry now recognizes `POKER` as its own game identity/session family but deliberately keeps `networkPlayable: false`; the client high-level game route still excludes Poker and the Home catalog remains Coming Soon.
- **Dealer Choice authority:** Variant Poker Table Dealer Choice now prepares the upcoming dealer and enters `AWAITING_VARIANT` before any blind, ante or private card exists. Only that dealer can choose from the host-approved pool; the choice and deal are server-authoritative/atomic. Fixed Rotation remains available.
- **Stale action protection:** Poker public state carries an authoritative sequence number. Hidden client actions always send the exact current sequence; the socket contract now requires it and rejects missing/old sequences, preventing delayed double taps or reconnect-buffered Fold/Call/Raise actions from applying to a newer turn.
- **Poker private-table setup:** server owns config validation, strictest selected-variant seat cap, revisioning and unanimous acceptance. New joins that make an already-proposed variant pool impossible invalidate that proposal. Hidden premium UI now supports Single Game / Variant Table, Dealer Choice / Fixed Rotation, stack/blinds/ante and player-by-player consent.
- **Action clock safety:** the setup previously displayed 15–60 second clocks even though no authoritative timeout engine existed. Those controls are now disabled and the server rejects any non-zero action clock, so the product cannot silently accept a setting it does not enforce. A duplicated “Variant table” setup control was also removed.
- **Poker leave/settlement:** leaving during a live hand is an authoritative fold; already committed chips stay in the pot, the public seat disappears, settlement/P&L is returned, the room seat/socket is permanently released, and remaining players continue. If the Dealer Choice dealer leaves before the deal, dealer/chooser authority transfers to the next funded seat without charging or exposing cards. Regression tests cover both cases.
- **Hidden runtime UI:** added a server-state-to-shared-seat adapter plus `PokerRuntimeView` that renders `PokerVariantChoice` while awaiting Dealer Choice and otherwise drives the physical `PokerTable` only from authoritative public + self-private state. Fold/all-in/stack/turn status is never inferred from local action history. Hand-complete result chrome and host next-hand intent are isolated from the felt.
- **Private consensus UI:** added `PokerLobbyConsensus` so the eventual lobby can present current server proposal revision, approved variants, stacks/blinds/ante/seat cap, and per-player acceptance without trusting local draft state.
- **Type hardening:** normalized Poker fractional-bet preset typing and runtime identity mapping after a strict custom UI compile exposed readonly-union inference hazards that syntax-only checks would not catch.
- **Verification in this runtime:** strict dependency-light server Poker/platform/network compiles pass; strict hidden client GameStore/socket compile passes; strict hidden Poker UI compile passes with temporary type stubs; direct Poker leave/Dealer-Choice authority harness passed. Current `client/src` + `server/src` parser scan reports zero syntax diagnostics; CSS brace scan reports zero structural failures; all relative import edges resolve after Vite `?raw` imports are normalized.
- **Verification limitation:** full package Vitest suites, normal package typechecks and Vite production build are still pending because the complete npm dependency tree is unavailable here. Poker therefore remains unreachable/Coming Soon.

## 2026-08-18 — WIP continuation: no-shrink Kitti landscape, hub-safe utility sheets, variant-aware Teen Patti help

- **Model:** GPT-5.6 Sol.
- **Baseline before:** `cardroom-current-work-WIP-2026-08-18.zip`, continuing on top of the prior radial-control / Poker-rule WIP. Deployed Release 1.5.1, `main`, Render/Netlify staging and the old Haazari deployment remain untouched.
- **Kitti arrangement:** removed the short-landscape card-dimension override. Medium cards now keep the authoritative shared `PlayingCard` dimensions and fit the nine-card arrangement hand through controlled overlap/grid-track spacing instead of physically shrinking the cards. This protects readable ranks/suits and the requested held-hand feel.
- **Kitti live landscape:** reduced the side-rail claim and restored more usable felt/table area in short landscape. Mini played groups remain intentionally secondary-size cards, now with a slight physical fan; gameplay and strict Hand 1 > Hand 2 > Hand 3 validation are unchanged.
- **Shared table utilities:** Chat and Voice surfaces launched from the circular top-right table hub now use a dedicated top-edge utility-sheet position below the hub, instead of inheriting the legacy bottom-FAB/action-rail geometry. Standalone-launcher fallback positioning remains for non-table screens.
- **Teen Patti variant groundwork:** public state now carries the server-authoritative variant name and deal count alongside exact configuration-aware `variantHelp`. The table header, dealing ceremony, hidden-card count, card fan centring and dealing status are data-driven rather than hard-coded to Classic/three cards. A reusable `TeenPattiRulesSheet` now powers both the in-table “How to play” control and Settings → Rules, so the explanation follows the actual server round configuration.
- **Teen Patti rule-copy safety:** `describeTeenPattiRoundVariant()` includes dealer-provided configuration such as Closest-to-N target/reordering and Named Rank. Unsupported variants remain disabled rather than silently falling back to Classic. Previously discussed Revolving Joker and Surprise/Random remain specification-recovery items; their unrecovered mechanics were not guessed.
- **Poker client groundwork:** retained the pot/half-pot target helper and adaptive premium action rail from the previous WIP; no unfinished Poker route was enabled. Server GameId/release reachability remains unchanged.
- **Regression contracts:** source-level mobile tests now protect Kitti no-shrink short-landscape spacing, recovered live-table landscape width, 44px Teen Patti controls, and hub-launched Chat/Voice panel geometry.
- **Verification here:** all 193 TS/TSX/MTS/CTS files parse with zero syntax diagnostics; all 45 CSS files have balanced braces; 613 relative import edges resolve; zero direct `--pcard-w/--pcard-h` overrides remain outside `PlayingCard.css`; zero active backdrop-blur declarations remain. Dependency-light strict compiles pass for Hazari arrangement, Teen Patti core and Poker core. Harnesses pass Hazari Set 3 = Set 4 best-three equality, Teen Patti configuration-aware variant help, Poker half-pot/pot/clamped bet sizing, Texas/PLO/Short-Deck basics, Short Deck flush-over-full-house, single short all-in no-reopen + automatic board runout, and cumulative short all-ins reopening at a full-raise threshold.
- **Verification limitation:** the full client/server Vitest suites, package typechecks and Vite production build still cannot be run in this runtime because npm dependencies are not present and the registry is unavailable; an offline `npm ci` confirms the packages are not cached. Real-device portrait/landscape QA is also still required before deployment.
- **Baseline status:** continued WIP only. **No Git push or deployment performed.**

## 2026-08-18 — WIP follow-on: poker betting rights, automatic all-in runout, no-glass regression guard

- **Baseline before:** the current 2026-08-18 WIP continuation above; deployed Release 1.5.1 and the old Haazari deployment remain untouched.
- **Poker betting correctness:** added private per-player betting-right bookkeeping so an insufficient all-in raise increases the call amount without incorrectly reopening a re-raise for a player who already acted. Multiple short all-ins reopen the prior bettor only when their cumulative increase reaches a full raise; the last full raise size still determines the next legal minimum. Server-side `RAISE_TO` rejects a forged re-raise even if a client bypasses its disabled control.
- **Poker all-in flow:** when all opponents are all-in and the only remaining actionable player has nothing left to call, the engine now runs the remaining community cards automatically instead of requiring meaningless CHECK taps on flop/turn/river.
- **Poker regression coverage:** added tests for a single short all-in not reopening action, cumulative short all-ins reopening action, the legal minimum after reopening, and automatic board runout. A dependency-light compiled harness passes these scenarios in addition to Texas blinds/turn order and Short Deck forced bets/ranking.
- **Premium material cleanup:** removed remaining active `backdrop-filter: blur(...)` usage from Hazari/Kitti reveal overlays, Teen Patti rules/top-up overlays, the shared Rules modal legacy declaration and legacy shared play surfaces. Opaque room/felt/wood overlays now provide separation without glassmorphism.
- **UI regression contracts:** mobile-safety tests now explicitly protect the radial Chat/Voice/Settings/Exit structure, 44px shared touch minimum, and the no-backdrop-blur table-chrome rule.
- **Hazari dependency-light regression:** compiled the authoritative arrangement/evaluator modules and confirmed that Set 3 equal to Set 4's best-three strength is valid and produces no arrangement errors.
- **Verification limitation:** full package Vitest/typecheck/Vite production builds remain pending because this runtime still cannot restore the npm dependency tree. No deployment or Git push was performed.

## 2026-08-18 — WIP continuation: radial table utilities, physical arrangement hands, Poker rule hardening

- **Model:** GPT-5.6 Sol.
- **Baseline before:** `cardroom-current-work-WIP-2026-08-18.zip`, itself based on deployed Release 1.5.1. Live Netlify/Render staging and the old Haazari deployment were not modified.
- **Shared table controls:** replaced the rectangular secondary-control rail with the requested compact **circular/radial utility wheel**. Chat, Voice, Settings and Exit/Card Room fan out from one top-right launcher; unread-chat and mute/live voice status remain visible; Escape and outside-tap close the wheel. The existing deliberate Step away vs permanent Leave sheet is preserved. Utility scrims/sheets no longer use backdrop-filter glass styling.
- **Hazari/Kitti arrangement presentation:** kept all locked rules and arrangement validation unchanged, but made grouped cards read as small physical hands: shallow fan rotation/arc, centred trays, stronger natural fan in the unplaced hand, and 44px minimum Hazari tray targets. No gameplay assistance was added and the existing human-opponent fairness gate remains untouched.
- **Hazari rule-copy correction:** preserved the incoming WIP's authoritative Set 4 rule: strength is its best three-of-four and the unused fourth card never breaks an exact tie. A stale player-guide bullet that still said only “dedicated four-card ranking” was made explicit. Older changelog entries claiming Set 4 was *not* best-three-of-four are historical and superseded by the later locked rule/fix; they remain in the append-only log rather than being rewritten.
- **Poker UI:** repainted the new poker action/hand rail from translucent glass into opaque wood/felt/brass table materials, removed references to nonexistent `--wood-950` / `--felt-950` tokens, retained adaptive Hold'em/Omaha hole-card fanning, and kept all action targets at the shared touch minimum.
- **Poker rules:** corrected the Short Deck groundwork to the documented 6+ button-blind structure: every funded player posts the ante, the dealer/button alone posts the live button blind, and pre-flop action starts left of the button. The configured `bigBlind` amount is used as the Short Deck button blind; `smallBlind` is unused in that variant. Added a regression test for the forced-bet/action order.
- **Teen Patti continuity:** `RULES_TEEN_PATTI.md` now explicitly retains the previously discussed **Revolving Joker** and **Surprise / Random Variant** as specification-recovery items. They are intentionally not exposed at runtime until the exact final mechanics are recovered/reconfirmed; the code must not invent them or drop them.
- **Player-facing variant preview:** removed developer-facing “Engine ready / Building” badges from the Coming Soon variant gallery, upgraded its tab targets to 44px and kept the preview as a polished rules/format showcase rather than exposing implementation status. Short Deck preview copy now states the ante + button-blind structure.
- **Touch-target audit:** repaired remaining actionable 30–38px overrides in Hazari/Kitti short-landscape arrangement controls, Rules close, Chat send/mic, legacy browser-row actions and Teen Patti setup inputs. Non-interactive 38px voice participant rows were intentionally left unchanged.
- **Verification in this environment:** 190 TS/TSX/MTS/CTS files parse with zero syntax diagnostics; 45 CSS files have balanced brace structure. A dependency-light compiled Poker harness passes Texas blinds/turn order, PLO pot-limit maximum raise, Short Deck ante + button blind + first actor, and Short Deck flush-over-full-house ranking. Full Vitest/typecheck/Vite production builds remain pending because the npm dependency tree cannot be restored from the registry in this runtime.
- **Baseline status:** WIP continuation only; **not deployment-ready** until complete server/client suites and production builds run clean plus real-device portrait/landscape QA.

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

## 2026-08-17 — Release 1.5 source-integrity gate

- **Source parse:** 173 TypeScript/TSX/MTS source and test files parse with zero syntax diagnostics.
- **CSS:** 41 client source stylesheets pass structural brace validation.
- **Imports:** 566 actual relative import/export/require edges resolve; comments and example strings are excluded from the scan.
- **Kitti solver:** dependency-light compiled harness found valid strict strongest→weakest arrangements for 200 random nine-card deals with zero failures.
- **Kitti max bot table:** dependency-light compiled 1-human + 4-bot round reached `ROUND_COMPLETE` with one authoritative round history entry and without the bot controller touching the human arrangement.
- **Rule-engine safety:** Release 1.5 `server/src/games/hazari/gameEngine.ts`, Hazari `rules.ts`, Kitti `engine.ts` and Kitti `rules.ts` are byte-for-byte identical to Release 1.4. Bot/suggestion/play-money/TURN changes are outside those authoritative rule files.
- **Not claimed:** full Vitest/package typecheck/Vite/Capacitor/Gradle verification still cannot run in this environment because the complete npm dependency tree is unavailable. The historical server 310 / client 377 run remains the last fully-run accepted baseline.

---

## 2026-08-17 — Release 1.5 play money, secure TURN, Kitti computers and fairness

- **Model:** GPT-5.6 Sol.
- **Baseline before:** last fully-run accepted suite remains server 310 / client 377;
  current environment still cannot restore the complete npm dependency tree.
- **Play money:** added the optional consensual room-session virtual board/pot to
  both Hazari and Kitti. Host proposes; every human must accept; computer seats
  auto-accept; contributions lock only after Start succeeds; authoritative match
  winner receives the pot exactly once; cumulative virtual P/L survives Play Again.
  It has no cash value and no deposit/withdrawal/conversion path.
- **Kitti computer seats:** Kitti now supports optional bots within its 2–5 player
  cap. Host can add and remove computer seats before Start. Bots auto-ready, use
  only their own cards, build a valid strongest→weakest 3–3–3 arrangement, play
  only on their authoritative turn, participate in the three-winner decider, and
  never join voice. A one-human + four-bot compiled round completed successfully.
- **Kitti bot-only Suggest:** added a server-authoritative arrangement suggestion
  path. It is available only when every opponent is a bot; any real human opponent
  disables the UI and the real Socket.IO endpoint independently refuses a forged
  request. Suggested card IDs are limited to the requester's own nine-card hand.
- **Bot lifecycle:** voluntary host Leave Table may still convert that engine seat
  to a bot, but room-level host authority transfers to the first remaining human so
  Next Round / Play Again cannot deadlock behind a bot host. Temporary disconnects
  still do NOT transfer host rights. Disconnected humans are not allowed to remain
  Ready for lobby Start.
- **TURN:** added backend-issued short-lived Metered TURN configuration using only
  `METERED_DOMAIN` and `METERED_SECRET_KEY` on the server. No long-lived TURN
  credential is compiled into browser/APK code. Direct/STUN remains the normal
  first path and STUN-only fallback is retained if Metered is unavailable. One
  temporary ~4-hour credential is cached per table until shortly before expiry to
  minimise credential churn on the free Metered plan.
- **Voice/multi-game isolation:** added/expanded real Socket.IO coverage with a live
  Hazari room and live Kitti room concurrently: room/game state, optional virtual
  boards and voice signalling stay table-scoped; Hazari voice remains usable after
  Play Again.
- **Avatars:** expanded the allow-list/picker with a premium Card Room set (panther,
  eagle, wolf, dragon, owl, stallion, bull, fox, diamond, shield, spade and others)
  and medallion-style seat/picker presentation while retaining the existing choices.
- **Smoke-test maintenance:** updated stale command-line socket smoke scripts from
  pre-migration event/list-table protocols so they remain useful after deployment.
- **Manual/dependency-light verification:** Kitti suggestion solver found a valid
  strict arrangement for 200 random nine-card deals; a compiled max-table scenario
  with one human + four bots completed a round. Full Vitest/Vite/Android verification
  is still required before this becomes an accepted baseline.
- **Production:** unchanged. The old live `haazari` Render service/repository must
  remain untouched; Release 1.5 belongs in the separate existing `Cardroom` repo and
  its staging/new backend after verification.

---

## 2026-08-17 — Release 1.4 full premium product audit

- **Scope:** audited the routed Release 1 experience from cold launch through
  profile, game selection, invitation, lobby, arrangement, dealing, live table,
  results, Settings/Rules/Stats/History, voice/chat, reconnect, deliberate exit,
  offline/update/install states and the native Android wrapper. **No Hazari or
  Kitti game rule was changed.**
- **Multi-game identity:** removed Hazari as the default/pre-selected game. The
  selector now opens neutral, gives Hazari and Kitti equal playable weight, and
  presents Teen Patti/Poker as contextual Coming Soon entries without dead fake
  Play/Create controls.
- **Navigation hierarchy:** a true cold launch still starts at Welcome. Deliberate
  Leave/Return from a room sets a one-shot `sessionStorage` marker and returns
  directly to **The Card Room** selector; the active-seat home peek has its own
  premium return pass rather than reusing the old landing screen.
- **Shared invitations:** replaced the legacy Hazari-looking invite entry with a
  Card Room invitation screen that identifies the game and reuses saved player
  identity. Native invite generation now uses `VITE_PUBLIC_APP_URL` and refuses
  localhost/loopback URLs, preventing Capacitor's internal `https://localhost`
  origin from being shared to another player.
- **Identity/profile:** upgraded PlayerProfile to the same entrance language and
  brought Back to the 44px touch minimum.
- **Support/transient UI:** migrated loading/reconnect, Settings, Rules, Stats,
  History, Hazari confirmed-hand waiting and Kitti waiting/spectator states into
  the same opaque wood/brass/felt language. Removed browser alerts and legacy
  green/glass utility styling from routed Release 1 flows.
- **Stats/history correctness:** local stats are now game-scoped; legacy Hazari
  stats migrate into the Hazari bucket. Kitti records its own match wins/scores
  and has Kitti-specific round history instead of opening Hazari data.
- **Hazari result presentation:** RoundSummary no longer arbitrarily names the
  first player as sole leader when multiple players share the top round score;
  tied top scores are presented as shared. Scoring itself is unchanged.
- **Celebration:** Hazari/Kitti winner presentation now shares restrained
  brass/ivory/wood/felt confetti rather than the old ruby/sapphire palette.
- **Voice/chat/chrome:** expanded the shared vector icon language; retained emoji
  only where it is actual reaction content. Voice/reconnect behavior from the
  previous release line is preserved.
- **PWA/native shell:** standardized visible branding to **The Card Room**;
  removed `maximum-scale=1` from the viewport; bumped service-worker shell cache
  to `cardroom-v2`; service-worker update UI is hidden while a room is live and
  suppressed entirely in native builds; install prompts are also native-aware.
- **Android branding:** added `@capacitor/assets` workflow support and
  `client/assets/icon.png`; `android:init` now generates Android launcher/splash
  resources after creating/configuring the native project.
- **Native release QA:** Android release instructions now explicitly test branded
  launcher/splash, public invite sharing, single-seat reconnect, direct return to
  Card Room and suppression of PWA UI during live native play.
- **Regression coverage added in this audit line:** one-shot Card Room return,
  per-game stats + legacy migration, public/native-safe invite URL generation,
  and updated entry-flow expectations, in addition to the earlier single-seat
  reconnect coverage.
- **Source-level verification:** 159 TS/TSX source/test files transpile with zero
  syntax diagnostics; all 40 CSS files pass structural brace validation.
- **Not claimed:** the current environment still cannot restore the complete npm
  dependency tree, so the new/full Vitest suites, package typechecks, Vite build,
  Capacitor resource generation and Gradle APK build have **not** been run here.
  The historical 310 server / 377 client pass counts remain the last fully-run
  accepted suite, not a verification of Release 1.4.
- **Production:** unchanged and blocked. The old live family app remains the
  rollback path.

---

## 2026-08-17 — Premium Release 1 hardening; Kitti edge audit and visual unification

- **Model:** GPT-5.6 Sol.
- **Baseline before:** current checkpoint only; full npm suite still unavailable in this environment because dependencies cannot be restored from the registry. No new pass count is claimed.
- **Task:** harden the Hazari + Kitti first-APK working copy, unify the premium private-card-room presentation, and close static/type/release-gating gaps before packaging source. Game rules remain locked.
- **Premium presentation:** redesigned Welcome and four-game selector; Hazari/Kitti are live and Teen Patti/Poker are polished Coming Soon. Refined shared wood/brass/felt table, ivory cards/card backs, dealing motion, RoomLobby, Kitti arrangement/table/results, chat/voice materials, and Hazari shell styling while preserving fragile Hazari mobile geometry/reserve contracts.
- **Kitti ceremony + edge flow:** first Kitti deal now visibly presents the authoritative initial high-card dealer draw (including redraw-tie note) before the normal dealer-first deal. A deterministic harness revalidated ten scheduled rounds, 5–5 tie, leaders-only sudden death Round 11, and final winner. Permanent regression coverage was added for that match path.
- **Kitti correctness fixes:** a 2–0 round ends competitively after Hand 2; completed round number/dealer remain frozen until the next deal starts; reveal-key null narrowing was corrected; privacy tests keep confirmed/unplayed groups hidden and reveal only thrown cards.
- **Room/voice hardening:** Lobby share now captures stable room/game values; TURN build variables are declared in `vite-env.d.ts`; prior stale-leave and voice reconnect hardening remains intact.
- **Bug 6:** server real-Socket.IO dismissal regression + client dismissed-summary/Next Round regression remain in the Release 1 working copy. No Hazari dismissal rule changed.
- **Release gating:** authoritative server registry has Hazari/Kitti `networkPlayable: true`, Teen Patti `false`; Poker is not a server GameId. Home buttons additionally refuse Play/Create for Coming Soon entries.
- **Static verification:** 39 changed TS/TSX files pass TypeScript syntax/transpile parsing; 16 changed CSS files have balanced structure; Kitti dependency-light engine compiles standalone; deterministic Kitti harness passes; credential scan found only empty/example TURN variable declarations.
- **Environment limitation:** Chromium now exists, but the client has no usable React/Vite dependency tree and no `dist`, so the redesigned UI still cannot be honestly rendered from this working copy here. `npm install` has timed out; no APK has been generated.
- **Real-device gate:** still required for Bug 5 physical reveal scrolling, Bug 6 dismissal, Kitti 2–5 player layout/full match, voice/microphone permission, Back, reconnect, portrait/landscape and upgrade-over-existing APK.
- **Baseline status:** **release-source candidate only, not a verified APK baseline.** Production remains blocked.

---

## 2026-08-17 — Hazari + Kitti Android test-track checkpoint; Kitti online core, Bug 6 coverage, native scaffolding

- **Model:** GPT-5.6 Sol.
- **Baseline before:** repository documentation recorded server 310 / client 377.
  This session could **not independently rerun that baseline**: the extracted ZIP
  does not contain usable installed dependencies, npm registry access times out
  in this environment, and no Android SDK/Gradle tooling is installed. Treat the
  old counts as the last documented baseline, not as a newly verified result.
- **Release decision:** first Android test track is deliberately **Hazari + Kitti
  playable**. Teen Patti and Poker are **Coming Soon**. Teen Patti remains a real
  but disabled registry game; Poker is client-catalogue presentation only and is
  deliberately not a server `GameId`.
- **Kitti:** replaced the old incomplete/contradictory engine path with the
  agreed authoritative rules: 2–5 players, 9 cards, Ace-high dealer draw with
  redraw ties, dealer-first clockwise deal, player clockwise from dealer leads
  hand 1, strict strongest→weakest arrangement, later thrower wins exact hand
  ties, previous hand winner leads, first player to two hands wins immediately,
  three-different-winners fresh 3-card decider, ten scheduled rounds and sudden
  death among tied leaders. Round/dealer state now stays visually on the
  completed round until the next deal actually begins. Added `KittiSession`,
  `kitti:*` protocol/private-public state, online room wiring and the Kitti
  arrangement/dealing/table/result/winner client flow. Reconnect/result restore
  is wired; sudden-death spectators no longer retain/render stale prior-round
  private cards.
- **Hazari Bug 6:** added a deterministic real-Socket.IO regression path for
  dismissal: force a dismissible six-pair hand only inside the test, emit the
  real dismissal event, assert zero points, same room/seat retained, and next
  deal succeeds. No dismissal rule was changed.
- **Cross-game lifecycle/reconnect:** result/winner payloads are restored to a
  reconnecting socket without replaying celebration side effects. Lobby Leave
  now removes the server seat/subscriptions rather than only clearing client
  state, closing a stale-room resurrection path.
- **Voice:** tightened signalling to actual in-call participants and bounded
  payloads; disconnect/leave cleanup avoids stale buffered leave events;
  speaking indicators are explicitly cleared when a peer is torn down.
- **Teen Patti groundwork (still disabled):** Classic engine rewritten toward
  the agreed rules: capped blind progression, three blind turns then forced
  seen-betting status without auto-revealing cards, seen = 2× current blind,
  compulsory anticlockwise sideshow with initiator losing exact ties, final-two
  mutual no-cost open show, and winner→next-dealer timing. Added data-driven
  variant descriptors, lobby setup proposal/acceptance model, session/protocol
  groundwork. Non-Classic runtime variants and the release-ready client table
  are still pending; registry remains `networkPlayable: false`.
- **Premium/client presentation:** opening experience, game selector, card/table
  styling and dealing presentation have been refined. The selector is compact
  for four titles: Hazari/Kitti live, Teen Patti/Poker Coming Soon. User has
  explicitly allowed redesign of all presentation/UX while game rules remain
  locked.
- **Android scaffolding:** added Capacitor configuration, Android scripts,
  microphone-manifest patcher, native Back bridge into the existing history
  guard, `ANDROID_RELEASE.md`, and a manual-only GitHub Actions workflow that
  runs server/client tests + builds before producing a debug APK artifact.
  Bundled content uses `https://localhost`, so
  staging Render must explicitly include that origin alongside Netlify in
  `ALLOWED_ORIGINS`; do not use `*`. Actual APK generation is **not possible in
  this environment** because npm registry access and the Android SDK are absent.
- **Verification performed here:** targeted TypeScript transpile/syntax checks on
  modified TS/TSX; pure Kitti and Teen Patti engine smoke checks were run during
  implementation for critical flows. This is **not equivalent** to the full
  Vitest/typecheck/build baseline and must not be reported as such.
- **Real-device gate:** Hazari full flow, Kitti 2/3-player + decider, voice and
  voice notes, native Back, portrait/landscape, reconnect, Bug 5 physical reveal
  scrolling and Bug 6 dismissal must be checked on the first APK before wider
  sharing.
- **New debt / deliberately pending:** Kitti optional bots and consensual virtual
  board; Hazari virtual board; Teen Patti full client/variants/P&L/mobile QA;
  Poker implementation/spec. `package-lock.json` cannot be regenerated until
  npm access is available.
- **Baseline status:** **checkpoint only, not a verified release baseline.** Do
  not deploy production from this state until dependencies are installed, the
  full suites/builds are green, and real-device APK QA passes.

---

## 2026-08-16 (later) — Bug 5 diagnosis corrected: the per-set reveal sheet, not RoundSummary, was the actually-broken screen

- **Model:** Sonnet
- **Context:** Real-device feedback clarified that the prior TWO rounds of
  "end-of-hand scroll" fixes had been applied to the wrong component.
  Hazari plays 4 SETS per round. After EACH set (1, 2, 3, and 4 - the
  SAME component every time, not a different one for the last set), a
  per-set result sheet appears showing that set's four hands, the winner,
  and the points awarded. RoundSummary (the screen both prior rounds
  actually fixed) is a SEPARATE component, shown once, only after the
  round's 4th set AND the round itself resolve - and was, per this
  round's own real-device confirmation, never actually broken.
- **Investigation (as required, before editing):** traced the runtime
  flow for all four `REVEALING_SET_N` game states (`types.ts`,
  server-side) through to the client. `App.tsx` places all four
  `REVEALING_SET_N` states inside `PLAYING_STATES`, meaning `HazariTable`
  stays mounted through every one of them - RoundSummary is only reached
  once `gameState.state` becomes `ROUND_COMPLETE`/`DISMISSED_ROUND`,
  which happens strictly after `REVEALING_SET_4`. The per-set result
  itself is rendered INLINE by `HazariTable.tsx` as `.reveal` - a
  `position: fixed` bottom sheet (`role="dialog"`), driven by
  `gameState.subRoundResultsThisRound`'s latest entry, auto-dismissing
  after 3.2s or on a "Continue" tap. This is genuinely ONE shared
  component for all four sets - there is no separate "set 4" variant.
- **Root cause:** `.reveal__sheet` had no height bound and no scroll
  mechanism at all - not a wrong one, none. `height: auto` with nothing
  capping it against the available viewport meant content taller than
  the visible space simply extended past the top of a `position: fixed`
  overlay with nothing to scroll it back into view. `.reveal` itself
  (the fixed backdrop, `inset: 0`) was already fine - it pins directly to
  the true viewport without depending on any `dvh` calculation, unlike
  its child.
- **Fix:** restructured `.reveal__sheet` into the same bounded-shell +
  JS-measured-height pattern proven for RoundSummary/WinnerScreen earlier
  today: `display: flex; flex-direction: column`, `max-height:
  calc(var(--js-vh, 100dvh) - 64px)` (the `-64px` keeps it reading as a
  rising sheet with headroom, not a full-screen takeover), `overflow:
  hidden`. Added a new `.reveal__body` wrapper around the content that
  actually grows with player count (the tie note, the hand-by-hand
  breakdown, the points line) - `flex: 1 1 auto; min-height: 0;
  overflow-y: auto; overflow-x: hidden; touch-action: pan-y`. The title
  (header) and Continue button (footer) stay outside `.reveal__body` as
  fixed-size flex rows, always visible regardless of scroll position.
  `HazariTable.tsx` now also calls `useVisualViewport()` (the same
  existing hook reused for RoundSummary/WinnerScreen) and passes
  `--js-vh` inline on `.reveal`, inherited down to `.reveal__sheet`.
- **RoundSummary/WinnerScreen were NOT touched this round** - confirmed
  by hash diff. Their own bounded-shell fix from earlier today is
  preserved exactly as it was.
- **Tests:** new `reveal.test.tsx` (9 tests) - genuine component-level
  coverage rendering `HazariTable` with a mocked game store at each of
  `REVEALING_SET_1` through `REVEALING_SET_4`, confirming: the same
  `.reveal`/`.reveal__sheet`/`.reveal__body` structure renders for every
  set (not four different implementations); the DOM order is header →
  scrollable body → footer button; `--js-vh` is correctly wired; the
  Continue button dismisses independent of scroll position; and,
  explicitly, that `HazariTable` never renders `.rsum` itself (RoundSummary
  is App.tsx's job once the screen swaps, not something `.reveal`
  rendering could trigger) - the specific regression guard for the
  confusion this bug's diagnosis went through twice. Added parallel
  CSS-level checks to `mobileSafety.test.ts` (4 new tests) for the same
  structural invariants, matching the established pattern for
  RoundSummary/WinnerScreen. Every new/changed assertion proven
  meaningful by reverting the corresponding code and confirming failure,
  then restoring it - including deliberately removing the `.reveal__body`
  wrapper and confirming two tests catch its absence.
- **Files changed:** `client/src/games/hazari/HazariTable.css` (`.reveal`
  restructure), `client/src/games/hazari/HazariTable.tsx` (`.reveal__body`
  wrapper + `useVisualViewport()` wiring), `client/src/games/hazari/
  reveal.test.tsx` (new), `client/src/platform/styles/mobileSafety.test.ts`
  (4 new tests). Nothing else - confirmed by hash diff: RoundSummary,
  WinnerScreen, and every Bug 1-4 file from earlier today are untouched.
- **Decisions:**
  - Recorded explicitly, for both `SESSION_CHANGELOG.md` and
    `HANDOFF.md`, that the correct mental model is "one shared per-set
    reveal component for all 4 sets" rather than "a different screen for
    set 4" - the framing that led to two rounds of fixing the wrong
    component.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 310/310 (unchanged). Client 377/377 (364
  baseline + 9 new `reveal.test.tsx` + 4 new `mobileSafety.test.ts`
  checks). All four remaining commands clean.
- **New debt:** none knowingly introduced. **Bug 5 (the per-set reveal
  fix) is NOT real-device verified** by this session. Given this bug's
  history (two prior fixes to the wrong component, each confirmed clean
  by a full test suite at the time), do not mark it passed until the
  owner has specifically scrolled the Set 1, 2, or 3 result sheet in a
  short landscape viewport and confirmed the lower hands are reachable.
- **Baseline status:** accepted, pending real-device retest.

---

## 2026-08-16 — Third real-device retest: Bugs 1-3 confirmed PASS; Bug 4 (side-seat names) and Bug 5 (result-screen scroll) genuinely fixed

- **Model:** Sonnet
- **Context:** Bugs 1 (backgrounding), 2 (Leave Table), and 3 (Arrangement
  FAB) are now OWNER-VERIFIED REAL-DEVICE PASS on the Android PWA. Per
  instruction, neither their code nor their tests were touched this
  session - confirmed by hash diff at the end (zero server files changed;
  zero client files outside the Bug 4/5 scope changed). Bugs 4 and 5
  remained open, each with new, more specific real-device detail.
- **Bug 4 (side-seat names, "Nawab" specifically) - found and fixed a
  SECOND real bug underneath the previous session's fix:** The prior
  session's inward-anchoring fix (a flat 6.5rem/5.25rem allowance) was
  re-verified against the real geometry rather than trusted, and found
  wrong in two compounding ways:
  1. `layout.test.ts`'s felt-width formula assumed
     `.hazari__table-area`'s horizontal padding scaled with viewport width
     (8px narrow / 16px regular). It does not - it is a flat
     `var(--space-2)` (8px) on EACH side, 16px total, at every width
     (`HazariTable.css`). This made the narrow-breakpoint felt-width
     estimate too generous, directly undermining the "safe" figure it
     produced.
  2. That flat allowance was applied to diagonal anchors (`top-left` etc)
     as well as pure `left`/`right`. On larger, currently-unreachable-but-
     shared ring sizes (5-9 players), some diagonal anchors sit much
     closer to the felt's own centre already (the 9-player ring's inner
     `top-left`/`top-right`, only 18 percentage points out, vs pure
     `left`/`right`'s real >=31.6 on every ring) - a flat width generous
     enough for the reachable 4-player case would have overshot those
     anchors' centreline by 40-60px, a real, provable regression on ring
     sizes Hazari does not use today but the layout code must not break.

  **Fix:** replaced the flat constant with a per-seat, viewport-dynamic
  `calc()` in `Seat.css`, driven by a new `--identity-dist` CSS custom
  property (`Seat.tsx`, computed as `|50 - x|` from each seat's own real
  position - not guessed per anchor name, which cannot distinguish "this
  ring's left seat" from "a different ring's left seat"), floored at the
  existing guaranteed-width baseline so nothing regresses. Scoped strictly
  to pure `left`/`right` (diagonal anchors reverted to the proven-safe
  centred default - explicitly NOT part of this bug, and provably unsafe
  under the same treatment on some ring sizes). Verified arithmetically
  against every supported player count (2-9), not just the reachable one.
  **Honestly documented, not fixed:** a 7+ character name AND a Bot badge
  AND the single tightest width (390px) may still ellipsize - the
  geometrically safe ceiling at that specific combination is a few pixels
  short of what "Kaushik"-as-a-bot needs. A dedicated test
  (`Seat.test.tsx`) records this shortfall explicitly rather than either
  silently failing to guarantee it or quietly relaxing the safety margin
  to paper over it.
- **Bug 5 (end-of-hand result screen not scrollable) - THIRD structure,
  after two prior real-device failures:** This retest's own real-device
  evidence ("physical vertical swiping does NOT scroll the result
  content") ruled out BOTH prior approaches: the original fixed-height/
  nested-scroll shell, and the following session's normal-page-flow/
  sticky-footer redesign. Traced the full ancestor chain from the result
  rows to `<body>` for every mechanism the retest asked about
  (`touch-action`, JS-level `touchmove`/`preventDefault` handlers,
  `overscroll-behavior`, transformed ancestors, the viewport meta tag) -
  found no single definitive blocker via static analysis, but confirmed
  `index.html`'s viewport meta tag carries `maximum-scale=1`, a
  documented source of touch-handling side effects on some Android
  WebView versions (flagged, not fully diagnosed as causal).

  Rebuilt to the retest's own explicit required structure: a BOUNDED
  shell (not page flow) with exactly ONE internal scroll region.
  Critically, the shell's height is no longer governed by CSS `dvh`
  alone - `--js-vh` (set inline by `RoundSummary.tsx`/`WinnerScreen.tsx`)
  is a height measured directly in JS via `useVisualViewport()`, an
  EXISTING hook already used elsewhere in this app for exactly this kind
  of reliability problem (mobile keyboard avoidance), reading
  `window.visualViewport`/`window.innerHeight` rather than trusting a CSS
  unit whose accuracy in Android PWA standalone mode had already cost two
  rounds of this bug. `100vh`/`100dvh` remain as the pre-mount/no-
  `visualViewport` fallback. `.rsum__scroll`/`.winner__scroll` are
  `flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden`,
  now also explicitly `touch-action: pan-y`. The action rows
  (`.rsum__actions`/`.winner__actions`) are plain flex-column siblings
  AFTER the scroll region - not sticky, not nested inside it - so they
  keep their own natural height and can never be pushed off-screen or
  scrolled away by content inside the scroll region.

  **WinnerScreen was changed too**, for the same reason as both prior
  rounds: not an independently confirmed defect, but sharing the exact
  same shell primitive (explicitly built as RoundSummary's twin) - kept
  in step on purpose rather than left on a structure already shown twice
  to fail.

  New component-level tests (`RoundSummary.test.tsx`,
  `WinnerScreen.test.tsx`) verify the ACTUAL rendered DOM - that the
  action row is a real sibling after the scroll region, not merely that
  the right class names exist in a stylesheet - and that `--js-vh` is
  correctly wired from a mocked `useVisualViewport()`. Rewrote
  `mobileSafety.test.ts`'s CSS-level checks for the new structure. Every
  new/changed assertion across both test files was proven meaningful by
  reverting the corresponding code and confirming the test fails, then
  restoring it - including catching a second instance of the exact
  comment/regex-collision bug found in an earlier round, this time in
  this session's own new explanatory comment.

  **Honest caveat, not glossed over:** this session cannot verify on a
  real device whether physical swiping now works. Every mechanism found
  through static analysis (dvh reliability, nested-scroll-region
  assumptions) has been addressed, but "swiping does nothing at all" is a
  strong enough symptom that a genuinely different cause (the viewport
  meta tag, or something else undiscoverable without a real device)
  remains possible. Flagged explicitly in `STAGING-CHECKLIST.md` and
  `HANDOFF.md` for particularly careful re-verification, not marked as
  confidently solved.
- **Files changed:** `client/src/platform/components/Seat.css` +
  `Seat.tsx` + `Seat.test.tsx` (Bug 4), `client/src/games/hazari/
  RoundSummary.css` + `RoundSummary.tsx` + new `RoundSummary.test.tsx`,
  `client/src/games/hazari/WinnerScreen.css` + `WinnerScreen.tsx` + new
  `WinnerScreen.test.tsx` (Bug 5), `client/src/platform/styles/
  mobileSafety.test.ts` (Bug 5 tests), `client/src/platform/table/
  layout.test.ts` (padding-formula fix shared with Bug 4's geometry).
  **Nothing else touched** - confirmed by hash diff: zero server files
  changed (Bugs 1-2's reconnect/leave logic untouched), zero
  `tokens.css`/`ArrangementTable.css`/`GameStore.tsx` changes (Bug 1-3
  untouched). `seatLayout.ts`'s seat x/y positions (fixed in the prior
  session) were re-verified, not re-changed.
- **Decisions:**
  - Diagonal seat anchors were deliberately EXCLUDED from Bug 4's inward-
    growth treatment, trading a plausible-but-unproven improvement for a
    provable regression avoided on ring sizes Hazari does not use today.
  - Bug 5's redesign is recorded as a full third structure, not a tweak,
    specifically so a future session does not attempt to "fix" this again
    by tuning vh/dvh values or overflow properties within either of the
    two approaches already shown to fail on a real device.
  - Every regression-sensitive test added or rewritten this session was
    verified by deliberately breaking the corresponding code and
    confirming failure, not just by a first-try pass - consistent with
    the previous session's practice, now doubly warranted given how many
    "test-verified" conclusions in this bug's history turned out wrong on
    an actual device.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 310/310 (unchanged, rerun to confirm the
  untouched baseline). Client 364/364 (338 baseline + 5 new
  `RoundSummary.test.tsx` + 3 new `WinnerScreen.test.tsx` + 18 net new/
  rewritten in `Seat.test.tsx`, replacing the prior session's 35 with a
  corrected 35). All four remaining commands (client typecheck, client
  build, server typecheck, server build) clean.
- **New debt:** none knowingly introduced beyond what's already recorded
  in `HANDOFF.md`. **Bugs 4 and 5 are NOT real-device verified** by this
  session - both remain arithmetic/component-test-level only. Given Bug
  5's history (two prior real-device failures despite clean test suites
  each time), this is flagged with unusual emphasis in
  `STAGING-CHECKLIST.md`: a clean suite here has specifically NOT been
  sufficient evidence twice already.
- **Baseline status:** accepted, pending real-device retest of Bugs 4-5.

---

## 2026-08-15 (evening) — Second real-device retest: Bugs 1, 2, 4 & 5 genuinely fixed; Bug 3 re-verified

- **Model:** Sonnet
- **Context:** A real-device Android PWA retest of the staging build deployed
  after the previous session's checkpoint found MULTIPLE bugs still
  failing, despite that session's fixes and full test suite passing.
  Treated as authoritative: the earlier session's conclusions on Bugs 1, 2
  and 5 were each wrong or incomplete in specific, identifiable ways -
  documented below so the actual root causes are on record, not just the
  fixes.
- **Bug 1 (Android backgrounding → "You're not in a game right now") -
  genuinely re-broken, now fixed:** Root cause: a `game:error` carrying the
  raw server message `"Not currently in a room."` could arrive during the
  reconnect window - or from a stale pre-background socket cycle - and get
  shown to the player even while the table was still legitimately valid
  and restoring normally. `onGameError` in `GameStore.tsx` now treats that
  one specific message as transient/stale (not shown) whenever restoration
  is active or the client still holds a room in state at all - the
  AUTHORITATIVE "you're really out" signal is `room:reconnect`'s own
  `ok:false` branch, which already handles this correctly with a clear,
  different message. Additionally gated every gameplay-emitting action
  (`playSet`, `confirmArrangement`, `requestDismissal`, `startNextRound`,
  `requestSuggestionOptions`) so none can fire while disconnected/
  restoring - closes the complementary race where a queued/buffered emit
  (socket.io-client's own default behaviour while offline) could reach the
  server before `room:reconnect` rebinds the socket. 5 new tests in
  `backgroundReconnect.test.tsx`.
- **Bug 2 (Leave Table → stuck on branded "Loading…" indefinitely) - a
  genuine SERVER bug, found and fixed:** `room:leaveTable` converted the
  leaving player to a bot and broadcast the room update, but never
  unsubscribed that player's OWN socket from the room's Socket.IO
  channels or cleared `socket.data` - so the leaving player's client kept
  receiving `room:update`/`hazari:state` for the rest of the game (bots
  keep playing), which could race against and silently overwrite the
  `room: null` the client had just set locally, leaving `room` real but
  `myPlayerId`/`myHand`/`lastRoundResult`/`winnerInfo` all correctly
  null - matching no screen's requirements, permanently landing on
  App.tsx's catch-all "Loading…". Added `leaveSocketFromRoom()`
  (`socketHandlers.ts`, the inverse of `joinSocketToRoom`), called before
  the post-leave broadcast. New real-socket integration test
  (`leaveTable.integration.test.ts`, 3 tests) - proven meaningful by
  reverting the fix and confirming it fails, then restoring it.
- **Bug 3 (Arrangement FAB vs "Dealt") - re-verified, unchanged:**
  Re-derived the geometry from scratch again per the retest brief's
  instruction not to trust a passing test suite alone. 236px portrait /
  228px landscape (set the previous session) are still correct: required
  clearance is 230.76px / 222.76px, both comfortably covered. Additionally
  checked the OPEN voice panel (not just the collapsed toggle, which is
  all the previous session verified) - its own `bottom` offset
  (`134px + reserve`) is strictly larger than the toggle's (`76px +
  reserve`), so if the toggle clears the sort control, the panel clears it
  with even more room; no change needed.
- **Bug 4 (ordinary short names still ellipsizing, e.g. "Raja" → "R…") -
  TWO independent real bugs found and fixed:**
  1. `.seat`'s `align-items: center` gave `.seat__info` (and everything
     inside it, down to the name text) a width COMPUTED from its own
     content via flexbox shrink-to-fit, not a width GUARANTEED by the
     seat's declared 5.5rem/4.5rem. On paper an ordinary short name was
     entitled to the full width whenever it needed less - but the actual
     number handed to it was the outcome of an intrinsic-sizing
     computation threaded through three nested boxes, not a fixed value,
     and real device rendering did not hand it what the arithmetic
     implied it should. Changed to `align-items: stretch`, with
     `.seat__avatar-wrap` given `align-self: center` specifically to opt
     back out (otherwise `.seat__ring`/`.seat__dealer-dot`, positioned
     relative to that wrapper's own box, would have spread to the full
     seat width instead of hugging the avatar).
  2. Independently, re-derived the seat-to-felt geometry properly this
     time - the existing margin check (`platform/table/layout.test.ts`)
     compared a seat's footprint against `.table`'s own box, but `.table`
     has its own 1.4%/1.2% padding around `.table__felt` (CardTable.css) -
     the box that actually clips (`overflow: hidden`) - which the check
     never subtracted, and additionally allowed 16px of "slack" on the
     theory that a seat could safely hang over into a non-existent
     forgiving margin. Redone against the felt's real width: several
     seats were measurably OUTSIDE the true clipping boundary at common
     phone widths - as much as **-9.75px** (7-9 player rings) and
     **-0.38px** (the LIVE 4-player ring, at 390px - a very common phone
     width) - meaning the felt's own `overflow: hidden` was genuinely
     clipping part of the seat, name included, on real devices. Re-derived
     safe x/y positions for every ring size (2-9 players) in
     `seatLayout.ts`, moving only the anchors that actually needed it;
     rewrote `layout.test.ts` to check against the felt (not `.table`),
     drop the false "slack", and additionally require a real minimum
     margin (not just non-negative) at every target width. Both fixes
     proven independently by reverting each and confirming the
     corresponding tests fail, then restoring them. 12 new arithmetic
     tests in `Seat.test.tsx` for the width-allocation fix specifically
     (explicitly not just asserting `text-overflow: ellipsis` exists, per
     the retest brief).
- **Bug 5 (end-of-hand RoundSummary/WinnerScreen not scrollable in short
  landscape) - the previous session's fix was WRONG; redesigned from
  scratch:** The previous session concluded the CSS was already correct
  and the failing test was a false positive (a comment containing the
  literal string it was matching against) - fixed the test, reworded the
  comment, changed nothing about actual runtime behaviour. This retest's
  real-device evidence (still FAIL) proves that conclusion was wrong, or
  at least incomplete: since NO functional CSS had changed, the screen's
  real behaviour was never actually altered between the two retests.
  Rather than continue tuning the same approach a real device had now
  rejected twice, replaced the whole pattern: `.rsum`/`.winner` no longer
  pin themselves to exactly one viewport height with `overflow: hidden`
  and a nested `overflow-y: auto` scroll region - that depends on `dvh`
  computing the actual usable height correctly in Android PWA standalone
  mode (a documented rough edge that can survive as a *recognised but
  wrong* value, which no vh-then-dvh fallback cascade catches, since that
  only helps when a later declaration is dropped outright) and on a
  nested scroll region reliably keeping touch-scroll capture rather than
  the outer page (a known category of WebView inconsistency) - NEITHER of
  which this environment could ever verify, and real-device testing twice
  suggested at least one does not hold. Redesigned: `.rsum`/`.winner` now
  use `min-height` (a floor, not a ceiling) and normal flex-column flow;
  content taller than one screen simply makes the PAGE taller, and the
  browser's own universally-reliable page scroll takes over - confirmed
  nothing between here and `<body>` clips or hard-caps its own height
  (`.app-root` is `min-height`; `.screen-fade` sets none;
  `html`/`body`/`#root`'s `height: 100%` does not clip an overflowing
  child by default). `.rsum__actions`/`.winner__actions` switched from a
  fixed grid row to `position: sticky; bottom: 0`, which has been
  reliably supported in every target browser for years - "Next round"/
  "Play again" stay visually pinned to the bottom of the screen as the
  page scrolls, without depending on precise viewport-unit accuracy or a
  nested scroll region at all. Backgrounds on the action bars changed
  from a translucent gradient to solid at the lower edge, since content
  now legitimately scrolls behind them once they start sticking.
  Rewrote `mobileSafety.test.ts`'s RoundSummary/WinnerScreen tests to
  check the new invariants (min-height floor + vh-then-dvh cosmetic
  fallback, no shell-level `overflow: hidden`, sticky action bars) -
  including one MORE comment/regex collision of the exact kind the
  previous session found and fixed (this session's own explanatory
  comment for `.rsum` happened to contain the literal text
  `overflow: hidden` as prose) - stripped comments before matching, same
  established pattern. All four rewritten/new assertions proven
  meaningful by reverting the corresponding CSS and confirming failure,
  then restoring it.
- **Also fixed:** a flaky race in one of this session's own new Bug 1
  tests (`backgroundReconnect.test.tsx`) - asserted `isRestoring === false`
  immediately after `room` updated, but restoration releases on the NEXT
  TICK after the reconnect ack (`GameStore.tsx`'s own documented
  behaviour) - occasionally observed `true` depending on scheduling.
  Fixed to `await waitFor(...)` on `isRestoring` explicitly, and verified
  stable across repeated runs.
- **Files changed:** `client/src/lib/GameStore.tsx` (Bug 1),
  `client/src/lib/backgroundReconnect.test.tsx` (Bug 1 tests + flaky-test
  fix), `server/src/platform/net/socketHandlers.ts` (Bug 2),
  `server/tests/leaveTable.integration.test.ts` (new, Bug 2),
  `client/src/platform/components/Seat.css` +
  `client/src/platform/components/Seat.test.tsx` (Bug 4, width
  allocation), `client/src/platform/table/seatLayout.ts` +
  `client/src/platform/table/layout.test.ts` (Bug 4, felt-margin
  geometry), `client/src/games/hazari/RoundSummary.css` +
  `client/src/games/hazari/WinnerScreen.css` (Bug 5, redesign),
  `client/src/platform/styles/mobileSafety.test.ts` (Bug 5 tests
  rewritten). Bug 3: nothing changed, re-verified only.
- **Decisions:**
  - Bug 5 in particular is recorded as a full redesign, not a tweak,
    specifically so a future session does not attempt to "fix" this again
    by adjusting vh/dvh values or overflow properties within the OLD
    fixed-shell pattern - that pattern is not just imperfectly tuned here,
    it depends on device/browser behaviour this environment cannot verify
    and real testing has now contradicted twice.
  - Every fix in this session that could be verified by reverting it and
    confirming the corresponding test fails was verified that way, not
    just by the new test passing on the first try - given how much of
    this session was correcting a PREVIOUS session's confident-but-wrong
    conclusions, passing-on-first-try was no longer treated as sufficient
    evidence on its own.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 310/310 (307 baseline + 3 new). Client 338/338
  (326 baseline + 12 new `Seat.test.tsx` cases). All four remaining
  commands (client typecheck, client build, server typecheck, server
  build) clean. Forensic hash diff re-run against a fresh pre-session
  baseline - only the files listed above changed.
- **New debt:** none knowingly introduced. As before, **none of Bugs 1-5
  are real-device verified** by this session - all fixes are
  arithmetic/integration-test-level only, in an environment with no
  browser access. Given this is the SECOND round of real-device fixes
  where at least one prior "test-verified" conclusion turned out wrong on
  an actual device, real-device redeployment and retest matters more than
  usual here, specifically for: Bug 5's new sticky-action-bar behaviour
  (never seen rendered), Bug 4's seat/name positions at the newly
  re-derived x-values (a visible, if modest, shift from before), and
  Bug 1/2's fixes (both are timing/race-dependent by nature, the hardest
  category to fully trust from static analysis and mocked-socket tests
  alone).
- **Baseline status:** accepted.

---

## 2026-08-15 — Frozen-checkpoint verification: Bugs 1-5 (Android PWA staging)

- **Model:** Sonnet
- **Baseline before:** server 307/307, client 307/308 (1 documented failure -
  `mobileSafety.test.ts`'s RoundSummary vh/dvh check). Delivered as an
  explicitly FROZEN, immutable starting ZIP (`cardroom-checkpoint.zip`), per
  the owner's brief - not the live workspace. Independently re-verified at
  the start of this session by running all six commands before any edit;
  matched the brief exactly. Baseline file hashes recorded for every file in
  the tree before any edit, and re-diffed at the end - only the files listed
  below changed, nothing unexplained.
- **Task:** Verify five owner-confirmed Android PWA staging defects
  (Hazari Arrangement FAB overlap, Seat name/Bot-badge crowding, end-of-hand
  scroll, plus an integration review of two already-implemented fixes:
  background/reconnect and Leave/blank-screen), re-deriving each from the
  frozen source rather than trusting the checkpoint's own unverified values.
- **Bug 1 (Android background/app switching) & Bug 2 (blank screen after
  Leave) - integration review, no rewrite:** Both were personally written in
  the previous session and marked complete pending real-device retest. Read
  `GameStore.tsx`'s full reconnect lifecycle (`onConnect`/`onDisconnect`,
  the `reconnectAttemptRef` stale-ack guard, the foreground
  `visibilitychange`/`pageshow` nudge, authoritative-failure-only state
  clearing) and `App.tsx`'s full routing chain (the `screenKey` conditional
  chain, the "never route to a screen whose required state is missing"
  defensive fallback, `useBackGuard` wiring, `pendingLeaveConfirm`
  resync) against their existing test suites
  (`backgroundReconnect.test.tsx`, `App.backGuard.test.tsx`,
  `useBackGuard.test.ts`) line by line. Also confirmed server-side:
  reconnect is token-keyed (`roomManager.reconnect(token, ...)`), never by
  display name, matching `HANDOFF.md`'s standing rule. Found both correct
  as written. **No defect found; preserved exactly as in the checkpoint,
  nothing rewritten.**
- **Bug 3 (voice/call FAB overlapping "Dealt" on Hazari Arrangement) -
  found genuinely wrong, corrected:** The checkpoint's own reserve values
  (158px portrait / 150px landscape) were re-derived from scratch against
  the real DOM order in `ArrangementTable.tsx`
  (`.arr__actions` → `.arr__fan` → `.arr__hand-bar`), not assumed. The
  earlier derivation had two compounding errors: it counted `.arr__hand`'s
  own top padding (which sits on the FAR side of the sortbar from the FAB,
  irrelevant to clearing it) while omitting `.arr__fan` entirely - the
  actual fan of cards sitting BETWEEN the rail and the sortbar, and by far
  the largest term (≈80px, one small card plus its padding). Correct
  required clearance: 230.76px portrait / 222.76px landscape. **Changed**
  `platform/styles/tokens.css` to 236px / 228px (small buffer, consistent
  with the file's own existing style) and rewrote the derivation comment.
  **Changed** `mobileSafety.test.ts`: renamed `arrangementHandBar()` to
  `arrangementFanAndSortbar()`, corrected it to include the fan's own
  (orientation-dependent) padding and drop the irrelevant hand-padding
  term, and updated its three call sites. All existing ordering/ceiling
  assertions (landscape < portrait, panel fits an 480px-tall landscape
  viewport) re-verified against the new numbers before committing to them.
- **Bug 4 (player names / Bot badge clipped or crowded) - Seat.\* reviewed
  and preserved; a second, previously-unflagged defect found and fixed in
  DealerToken:** `Seat.tsx`/`Seat.css`/`Seat.test.tsx` were reviewed from
  scratch against the full requirement list (readable name, Bot badge never
  covering it, readable score/status, no excessive shrinking, intentional
  ellipsis on long names). Found correct: the name text is a genuine
  separate flex sibling from the Bot tag (not a bare text node beside it,
  which is the specific flexbox gotcha that defeats `text-overflow`), the
  Bot tag is `flex: 0 0 auto` so it's never the one asked to shrink, and
  `min-width: 0` is present on the name specifically (flex items default to
  `min-width: auto`, which otherwise blocks truncation entirely). Score and
  status render only short, fixed-length strings (`"pts"`, `"Away"`,
  `"Reconnecting"`) - confirmed against `HazariTable.tsx`'s actual props,
  not assumed - so no overflow risk there. **Kept exactly as found.**
  Independently checked the two cross-cutting requirements ("side-seat
  identities remain inside viewport" and "dealer token does not cover
  identity") arithmetically against `seatLayout.ts`'s real seat ring
  coordinates: the first was already covered by the existing
  `platform/table/layout.test.ts` (unchanged, still 19/19). The second
  was NOT - `DealerToken.tsx` pulled the token toward the table centre by
  20% of the FELT's own size, and the felt's pixel size varies enormously
  across the supported range (a 320px phone up to the 60rem/72dvh desktop
  cap - `CardTable.css`), while the avatar and name text stay fixed-px.
  At realistic sizes that "20%" was tens of pixels - for any anchor whose
  centre-ward direction is downward in screen space (`top`, `top-left`,
  `top-right` - the SAME direction every seat's name renders below its
  avatar), the token landed on top of the name label. This is reachable
  in the CURRENTLY LIVE 4-player Hazari ring (the `top` seat), not just a
  future 5-9 player case. **Changed** `DealerToken.tsx`/`DealerToken.css`:
  the component now only decides pull DIRECTION (a unit-less -1/0/1 CSS
  variable per axis); the actual distance is a small FIXED pixel amount in
  CSS (`--dealer-pull: 8px`, 6px under the narrow-phone breakpoint),
  scaled by the seat's own `--seat-scale` so it shrinks exactly as much as
  the avatar does for smaller seat tiers. **Added**
  `DealerToken.test.tsx` - arithmetic geometry checks (no rendering,
  matching this project's established style for this kind of proof) at
  every seat-scale tier (1 / 0.9 / 0.8) and both breakpoints, proving
  non-negative clearance between the token and the name row, plus a
  regression guard against ever reintroducing a felt-relative percentage
  pull.
- **Bug 5 (end-of-hand RoundSummary not scrollable in landscape) - the
  actual component identified, the actual layout re-verified correct, the
  FAILING TEST was itself buggy:** Confirmed via `App.tsx`'s routing chain
  that the screen shown after each Hazari hand/set ends (`ROUND_COMPLETE` /
  `DISMISSED_ROUND`) is `RoundSummary`; `WinnerScreen` is a different
  screen, shown only on `GAME_COMPLETE` (the overall match). Read
  `RoundSummary.css`'s `.rsum` shell in full: `display: grid;
  grid-template-rows: 1fr auto; height: 100vh; height: 100dvh; overflow:
  hidden`, with `.rsum__scroll` (`min-height: 0; overflow-y: auto`) as the
  single internal scroll region and `.rsum__actions` as the fixed second
  row - this is exactly the correct pattern (one scroll region, action
  rail always reachable, `vh`-then-`dvh` cascade so an unsupporting
  browser silently keeps the widely-supported line instead of ending up
  with no height constraint at all) and was NOT actually broken. The
  failing test (`mobileSafety.test.ts`, "both migrated screens fall back
  to 100vh before 100dvh") counted THREE height declarations instead of
  two - not because the CSS was wrong, but because the test's own
  rule-body extraction did not strip comments before matching, and
  `.rsum`'s own explanatory comment for this exact fallback happens to
  contain the literal text "height: 100dvh" as prose, inflating the
  regex's match count by one. `WinnerScreen.css`'s equivalent comment
  avoided this by construction (already phrased without repeating the
  literal property:value pair), which is why only RoundSummary's copy of
  this test failed. **Changed** `mobileSafety.test.ts`: the test's
  `ruleBody` helper now strips `/* ... */` comments before matching,
  mirroring the pattern the same file already uses in its "safe-area
  insets do not create gaps" check - this fixes a false failure on
  already-correct CSS rather than weakening any real assertion (the
  vh-then-dvh, exactly-two-declarations invariant itself is unchanged and
  still enforced). **Also changed** `RoundSummary.css`'s comment wording
  (no CSS/behaviour change) to stop spelling out the literal
  `height: 100dvh` string, matching `WinnerScreen.css`'s already-careful
  phrasing, so the underlying fragility is closed rather than only papered
  over by the test fix. **WinnerScreen was not independently broken** and
  needed no changes - its shell already correctly mirrors RoundSummary's,
  and its own comment already says so explicitly ("Precautionary
  hardening, not a claim this screen was independently confirmed
  broken").
- **Files changed:** `platform/styles/tokens.css` (Bug 3 reserve values +
  comment), `platform/styles/mobileSafety.test.ts` (Bug 3 test derivation
  fix + Bug 5 comment-stripping fix), `platform/components/DealerToken.tsx`
  + `DealerToken.css` (Bug 4 fix), `platform/components/DealerToken.test.tsx`
  (new, Bug 4 regression coverage), `games/hazari/RoundSummary.css`
  (Bug 5 comment wording only - no behaviour change). `Seat.tsx` / `Seat.css`
  / `Seat.test.tsx` reviewed and left byte-identical. No server file
  touched. Every other file in the frozen checkpoint is byte-identical to
  the upload - verified by hash diff before packaging, not assumed.
- **Decisions:**
  - Bugs 1 and 2's existing implementations are correct and were not
    rewritten, per the brief's own instruction not to redo accepted work
    without evidence of a defect - none was found.
  - The dealer-token fix (Bug 4) was not explicitly named in the owner's
    original report ("names clipped or crowded"), but is squarely inside
    the brief's own stated requirement list for this bug ("dealer token
    does not cover identity") and is reachable today in live 4-player
    Hazari (the `top` seat), not a hypothetical future case - fixed rather
    than deferred.
  - Bug 5's fix is on the TEST, with a matching but purely cosmetic CSS
    comment change - not the RoundSummary/WinnerScreen layout itself,
    which was already correct. Recorded explicitly so a future session
    does not go looking for a scrolling defect that was never really
    there.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 307/307 (unchanged, rerun to confirm). Client
  315/315 (308 baseline incl. the 1 now-fixed failure, + 7 new
  `DealerToken.test.tsx`). All four remaining commands (client typecheck,
  client build, server typecheck, server build) clean.
- **New debt:** none knowingly introduced. All five bugs are fixed and
  verified in-environment (arithmetic/test-level) only - **none of Bugs
  1-5 are real-device verified**; all five still require redeployment to
  staging and a fresh owner Android PWA QA pass covering the same
  screens/orientations as before. The dealer-token fix in particular
  changes a visual detail (a smaller, fixed-pixel nudge instead of the old
  oversized percentage one) that would benefit from a specific look on a
  real phone even though it's arithmetically proven safe.
- **Baseline status:** accepted.

---

## 2026-08-15 — Premium entry + persistent identity + Android/PWA Back navigation

- **Model:** Sonnet
- **Baseline before:** server 307, client 245 (reverified at session start —
  matched exactly; had to `npm install` in both packages since the delivered
  zip strips `node_modules`)
- **Task:** Welcome screen + compact Player Profile sheet as the app's true
  entry point, persistent local player identity (separate from the
  reconnect/session token), and Android/PWA/browser Back-button handling
  that never silently exits the app or abandons a room.
- **Unexplained tree changes — second occurrence this project, found,
  reviewed, resolved.** Mid-task, while about to create `PlayerProfile.tsx`,
  found it already existed with content contradicting this session's own
  prior message ("Not yet done: PlayerProfile.tsx"). Checked the full scope
  before continuing: `App.tsx`, `App.backGuard.test.tsx` (new),
  `Home.tsx`, `Home.css`, `HomeScreen.tsx`, `HomeScreen.test.tsx`,
  `HomeScreen.entryFlow.test.tsx` (new), `PlayerProfile.tsx` (new),
  `PlayerProfile.css` (new), `mobileSafety.test.ts`, and `PROJECT_STATE.md`
  all differed from the last delivered zip without a matching record of
  having been written this session. Per this file's own standing
  instruction (see the 2026-08-14 entry below for the first occurrence),
  stopped and reported rather than building on top of it. On instruction,
  reviewed each file independently (diff / problem / correctness / scope /
  risk to reconnect, session identity, Back behaviour, duplicate joins)
  rather than trusting or reverting wholesale:
  - `App.tsx` / `App.backGuard.test.tsx`: core implementation correct and
    verified by hand against the real screen-routing chain - correctly
    reuses `useBackGuard`/`ConfirmDialog` (this session's own earlier work)
    with matching semantics, including the non-obvious `consumeAsBack()`
    push-vs-replace mechanic. Found one real gap neither the code nor its
    tests covered: `pendingLeaveConfirm` never resynced if `screenKey`
    changed for a reason *other* than that dialog's own confirm/cancel -
    e.g. the host starting the game while a different player has a stale
    Lobby leave-confirm open, which could show wrong wording and call the
    wrong leave function. **Modified**: added an effect that dismisses a
    stale confirmation whenever `screenKey` changes underneath it, plus a
    regression test.
  - `Home.tsx` / `Home.css`: minimal, backward-compatible (`playerAvatar` is
    an optional prop), correctly reuses `AvatarBadge`. **Kept as found.**
  - `HomeScreen.tsx`: thoroughly verified - the `entryStage` state machine,
    the `profileOriginRef` contextual Back-target, and the `screen`/`return`
    restructuring (required so `useBackGuard` can be called unconditionally,
    same constraint this session had already identified independently) are
    all correct. Confirmed by hand that the invite-link/reconnect-race path
    is untouched in behaviour, only restructured from early-returns into the
    same `let screen; if/else; return screen` pattern App.tsx already uses.
    **Kept as found.**
  - `HomeScreen.test.tsx`: the one assertion this session had already
    identified as needing an update (it tested the now-superseded
    "no invite → Landing directly" behaviour) was fixed correctly, with
    reasoning distinguishing it from the invite-race tests it sits next to
    (which are untouched). **Kept as found.**
  - `HomeScreen.entryFlow.test.tsx`, `PlayerProfile.tsx/css`,
    `mobileSafety.test.ts`: verified against real component interfaces
    (including this session's own `Welcome.tsx`/`identity.ts`, not a
    fictional API), real design tokens, and real DOM behaviour rather than
    mocked-away logic - includes a genuinely non-obvious test (typing a
    name does not push a history entry per keystroke) that only makes sense
    with real understanding of `useBackGuard`'s mechanics. **Kept as
    found.**
  - `PROJECT_STATE.md`: the two new rows are dated 2026-08-15, one day
    after the last delivered zip's 2026-08-14 - flagged as a possible
    future-dated error, but `user_time_v0` confirms 2026-08-15 genuinely is
    today. **Kept as found**, not "corrected" into an actual error.
  - As before, this session cannot explain how this content came to exist
    - only that there is no record of writing any of it, and (for
    `PlayerProfile.tsx` specifically) an explicit prior message stating the
    opposite. Recorded as fact, not speculation.
- **Entry experience:** `Welcome.tsx` (true root) → `PlayerProfile.tsx`
  (first-time setup, or later editing - same component either way) →
  `Home.tsx` ("THE CARD ROOM"). Welcome always shows first on a normal
  launch, for both first-time and returning visitors, per the brief -
  returning visitors get a one-tap "Continue as `<name>`" rather than
  skipping Welcome entirely. An invite link bypasses Welcome completely and
  keeps the existing, separately-hardened `Landing` flow untouched.
- **Persistent identity:** `lib/identity.ts` gained a stable `profileId`
  (via `crypto.randomUUID()`, with a fallback), generated once and kept
  across edits. Existing saved identities (no `profileId`) are migrated
  in place on first read, not treated as "no profile." Stored under the
  same `haazari_identity_v1` key as before, entirely separate from
  `GameStore`'s `haazari_session_v1` reconnect token - neither module
  touches the other's key (see `identity.test.ts`'s dedicated separation
  tests). Not sent to the server; no account system.
- **Android/PWA Back navigation:** `lib/useBackGuard.ts`, a shared hook
  (not a second router) used independently by `App.tsx` (room-level
  screens) and `HomeScreen.tsx` (entry-level screens), handing off via
  `disabled: screenKey === 'home'` so exactly one instance is ever
  intercepting Back at a time. Lobby and an active game show a premium
  "Leave this room? Stay/Leave" (`ConfirmDialog.tsx`) that calls the exact
  same `leaveSession`/`leaveTable` the existing visible Leave buttons call
  - no new leave semantics. Round-summary/winner absorb Back rather than
  exiting unexpectedly. Welcome and an invite link's own landing are true
  roots - Back there exits normally, never trapped.
- **Files changed:** see the diff for the complete list; grouped above by
  area rather than repeated here. No server file touched.
- **Decisions:**
  - "Hazari Home" (named in the brief's Back-navigation table) has no
    separate existing screen from "THE CARD ROOM" game selector - Home.tsx
    already shows all three games with their own inline actions on one
    screen, no drill-down. Treated as the same screen for Back purposes;
    documented here rather than inventing a screen that serves no purpose.
  - Editing profile is reachable only pre-room (Welcome's "Change profile",
    THE CARD ROOM's header control) - there is no profile control inside
    Lobby or the table, which satisfies "defer editing during an active
    room" by construction rather than needing explicit guard logic.
  - Not deployed. Kitti not started, per explicit instruction.
- **Tests after:** server 307 (untouched, rerun to confirm), client 284
  (245 baseline + 9 `identity.test.ts` + 8 `useBackGuard.test.ts`, both this
  session's own + 12 `HomeScreen.entryFlow.test.tsx` + 8
  `App.backGuard.test.tsx` (7 kept as found + 1 added for the
  `pendingLeaveConfirm` fix) + 2 new `mobileSafety.test.ts` cases, of
  unexplained origin but independently verified). All four commands (server/
  client × test/typecheck, plus both builds) clean.
- **New debt:** Real-device QA entirely outstanding for all of this (same
  standing environment limitation as everything else) - see
  `STAGING-CHECKLIST.md` sections 11-12. The Back-guard's "absorb silently"
  behaviour on round-summary/winner/loading has no visible feedback at all
  when a press is swallowed; worth a real-device opinion on whether that
  reads as "nothing happened" or as unresponsive.
- **Baseline status:** accepted.

---

## 2026-08-14 — Staging deployment + first-pass Android QA (documentation reconciliation)

- **Model:** Sonnet
- **Baseline before:** server 307, client 236 (per `HANDOFF.md`/`PROJECT_STATE.md`; not independently rerun for this documentation-only entry)
- **Task:** Reconcile documentation with real-world events that happened after
  this snapshot's docs were written, and which this snapshot could not know
  about: the owner deployed a staging environment and ran a first-pass manual
  QA round on a real Android phone. No source, test, package or configuration
  files touched in this entry.
- **What actually happened (owner-reported, not performed by this session):**
  - New public GitHub repo `Cardroom` created; this audited snapshot pushed to it.
  - Render staging Web Service created from `server/`:
    `https://cardroom-staging-server.onrender.com`. `NODE_ENV=production`,
    `ALLOWED_ORIGINS=https://cardroom-staging.netlify.app`. `/health` confirmed responding.
  - Netlify staging site created from the same repo:
    `https://cardroom-staging.netlify.app`. `VITE_SERVER_URL` set to the Render
    staging address.
  - Client and server confirmed communicating over Socket.IO on staging.
  - Owner opened the staging build on one real Android phone, portrait and
    landscape, and visually reviewed Home, Lobby, Arrangement and the Hazari
    Table screens. This is the **first real-device rendering this project has
    ever had.**
  - **Production is untouched and still blocked.** The old, previously-live
    Hazari deployment is untouched, separate, and unaffected.
- **Files changed:** `HANDOFF.md`, `PROJECT_STATE.md`, `ROADMAP.md`,
  `STAGING-CHECKLIST.md` (one item ticked, scope note added), this file.
- **Decisions:**
  - The owner's supplied observations are treated as the authoritative first
    real-device test report, not as something this session verified by
    screenshot or automation — no browser/device access exists in this
    environment (confirmed again this session: Chromium/apt still blocked).
  - Only the checklist item unambiguously implied by the report ("Home screen
    opens on the staging address") was ticked. Everything else the owner's
    report touches on (Lobby, Arrangement, Table being reachable) was
    documented in prose rather than ticked, since the report was a layout
    critique, not a run through `STAGING-CHECKLIST.md` item by item.
  - This is documentation reconciliation only. The confirmed layout issues
    themselves (Home landscape clipping, Lobby portrait/landscape overlap and
    overflow, Arrangement portrait/landscape crowding, Table portrait/landscape
    collisions) are addressed in the implementation pass recorded in the next
    entry below.
- **Tests after:** unchanged — not rerun for a docs-only entry.
- **New debt:** none introduced. Existing debt (no real browser/device access
  *in this environment*, most of `STAGING-CHECKLIST.md` still unverified, no
  iPhone testing yet) remains and is now stated more precisely rather than as
  a blanket "never deployed."
- **Baseline status:** accepted — supersedes the previous "staging never
  deployed" baseline in `HANDOFF.md`/`PROJECT_STATE.md`/`ROADMAP.md`.

---

## 2026-08-14 — Mobile fixes, premium visual unification, PWA implementation

- **Model:** Sonnet
- **Baseline before:** server 307, client 236 (independently reverified at the
  start of this entry's work, before any edits — matched exactly)
- **Task:** Fix the confirmed staging mobile bugs, extend premium visual
  unification to the Lobby, and implement PWA installability, per the
  owner's staging QA report. Mid-task, this session found unexplained
  changes already present in the working tree that it had not made and
  could not initially account for; see "Unexplained tree changes" below.
- **Unexplained tree changes — found, reviewed, resolved:** Before this
  session made any of its own edits beyond documentation and two CSS
  landscape queries, six files were already different from the pristine
  upload, with content this session had not written: `tokens.css`
  (`--top-fab-reserve`), a new `RoomLobby.css`, `VoiceCallPanel.css`,
  `GameStore.tsx` (`getStoredSessionRoomCode`), `HomeScreen.tsx`, and a new
  `HomeScreen.test.tsx`. Per this file's own standing instruction, the
  session stopped and reported this rather than building on top of it. On
  the owner's instruction, each file was then reviewed independently
  (diff / problem / correctness / scope / reconnect risk) rather than
  either trusted or reverted wholesale:
  - `tokens.css`: correct and additive. **Kept as found.**
  - `GameStore.tsx` / `HomeScreen.tsx` / `HomeScreen.test.tsx`: traced by
    hand against the real `onConnect`/reconnect flow and `App.tsx`'s
    routing; the race condition it fixes is real, the fix is read-only, and
    it self-heals on both reconnect success and failure. **Kept as found**
    (see the duplicate-player entry below).
  - `VoiceCallPanel.css`: the selector fix was correct, but the landscape
    values it reactivated dropped `var(--action-reserve)` entirely — the
    exact anti-pattern `tokens.css` itself documents as already having
    caused a real collision once. **Rewritten** rather than kept as-is.
  - `RoomLobby.css`: well-built, but not wired up — `RoomLobby.tsx` still
    imported the old `Lobby.css`, whose `.room-lobby*` rules had been
    deleted in the same change, leaving the Lobby screen unstyled. Also
    still carried the legacy glassmorphism `.panel` class in the JSX
    alongside it. **Fixed and wired in**, not reverted, since the CSS itself
    was sound.
  - This session cannot explain how these six files came to be modified —
    only that its own tool calls did not do it (one relevant call, to
    `tokens.css`, is on record as having failed). Recorded here as fact,
    not speculation, for whoever reads this next.
- **Premium visual unification:** `RoomLobby` (title/code/players/actions)
  moved off the legacy gold/glassmorphism language onto card-room tokens —
  wood-panelled cards, brass accents, no `backdrop-filter`. `Landing`,
  `TablesBrowser`, `AvatarPicker` remain legacy (out of scope this pass).
  Hazari Table's centre "Your turn" label got a brass emphasis treatment,
  distinct from the passive "Waiting for X" state, for contrast (Part 3.F).
- **Mobile fixes, by confirmed issue:**
  - *Home landscape* (hero too tall, primary action clipped): `Home.css`
    landscape compaction — drops the lamp, hides the blurb/eyebrow, 3-column
    game grid. `Lobby.css`'s `.landing` (literal "Quick Match" button) got
    the same treatment as cheap insurance.
  - *Lobby portrait* (gear over title, "Add Computer Player" wrap):
    `--top-fab-reserve` clears the gear; actions are now full-width so long
    labels wrap inside their own button instead of squeezing an auto-width one.
  - *Lobby landscape* (controls below viewport): `RoomLobby.css` 2-column
    grid (title / code+players / actions / hint).
  - *Arrangement portrait* (fan overlap, gear over "13 left"):
    `--top-fab-reserve` on `.arr__bar`; fan overlap relaxed at the 375px+
    tier (was uniformly tuned for 320px up to tablet).
  - *Arrangement landscape* (board nearly cut off): `.arr` restructured
    into a 2-column grid — felt gets its own tall column instead of a row
    squeezed by hand+actions below it.
  - *Hazari Table portrait* (right player clipped): traced to real geometry —
    seats at x:10/90 with `.table__felt{overflow:hidden}` clip on nearly any
    mobile table width at full seat scale. Pulled the 4-seat ring's left/right
    to x:12/88 (`seatLayout.ts`).
  - *Hazari Table landscape* ("0/360" crowded, hand groups high): same
    `--top-fab-reserve` applied to `.hazari__bar`; `VoiceCallPanel.css`'s
    dead landscape selector fixed (see above) without reintroducing the
    dropped-reserve collision.
- **PWA:** manifest renamed Haazari → Cardroom (`name`/`short_name`), hard
  `"orientation": "portrait"` lock removed entirely, new maskable-safe
  dark/brass icon set generated from scratch (replacing a gold-casino
  "1000 HAAZARI" image) at 192/512/apple-touch sizes. Hand-written
  `public/sw.js` (no new build dependency): precaches the app shell,
  cache-first for hashed assets, network-first for `index.html`/manifest,
  and — the one non-negotiable property — bypasses everything cross-origin
  and any `/socket.io/` path before any caching logic runs, so it can never
  touch live game traffic. New versions install but wait; nothing
  auto-activates or force-reloads mid-game. `offline.html` branded fallback.
  `registerServiceWorker.ts` + `UpdateBanner.tsx` (production-only,
  dismissible, reuses `--action-reserve` so it can't sit on an action rail).
  `useInstallPrompt.ts`/`InstallBanner.tsx` needed no changes — already
  generic, no hardcoded branding.
- **Files changed:** see the full staging fix report for the complete list;
  summarized above by issue rather than repeated here.
- **Decisions:**
  - In-game copy ("Haazari"/"Hazari" as the *game name*, in `RoomLobby`,
    rules docs, etc.) was deliberately left alone — only the PWA/app-identity
    layer (manifest, `index.html` title/meta) became "Cardroom", per the brief.
  - Duplicate-player investigation (Part 8) concluded there are **two
    unrelated causes**, not one: a genuine invite-link/reconnect race (fixed,
    see above) and a separate, intentional consequence of token-based (not
    name-based) reconnect security that was **investigated and documented,
    not changed** — see `HANDOFF.md`'s "Known technical debt" for the full
    reasoning on why "fixing" the second would be worse than leaving it.
  - Not deployed. Staging/production untouched, per standing instruction.
- **Tests after:** server 307 (untouched, rerun to confirm), client 245
  (236 baseline + 4 in `HomeScreen.test.tsx`, already present before this
  entry + 5 new in `serviceWorker.test.ts`, added this entry). All four
  commands (server/client × test/typecheck, plus both builds) clean.
- **New debt:** `Landing`/`TablesBrowser`/`AvatarPicker` still legacy-styled
  (unification stops at `RoomLobby` this pass). PWA update/offline behavior
  is unverified on a real device/browser, same standing limitation as
  everything else in this environment. Table portrait "edge labels cramped"
  addressed via the seat-position fix but not independently re-confirmed
  beyond the geometry check that motivated it.
- **Baseline status:** accepted.

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

## 2026-08-17 — Per-game rules guides

- Removed the global Hazari tutorial-on-app-launch behaviour. The Card Room now opens as a neutral multi-game shell.
- Added authoritative, game-specific slide guides for Hazari and Kitti. The first entry into each game on a device opens that game's guide; viewed state is stored independently per game.
- Settings now exposes one `Rules & How to Play` entry, which reopens the active game's slide deck instead of showing a hard-coded Hazari rule sheet.
- Expanded the guides from short tutorial copy into detailed rule slides sourced from `RULES_HAZARI.md` / `RULES_KITTI.md`.
- Corrected the old Hazari help text that inaccurately described Set 4 as “best 3 of 4”; the engine uses the dedicated four-card ranking in `fourCardRanking.ts`.

## 2026-08-17 — Single-seat reconnect / duplicate lobby identity fix

- Fixed the lobby/session lifecycle so a recoverable player session always reclaims the existing `playerId` instead of creating a second lobby row with the same display name.
- Client entry remains gated while a stored room token is being authoritatively restored; Play/Create/Join cannot overwrite that recoverable session.
- Server now records the current socket id for seats from initial create/join/quick-match as well as reconnect.
- Reconnect returns and detaches any superseded live socket (bfcache/duplicate tab/suspended PWA) while preserving the same PlayerSlot.
- A late disconnect from a superseded socket is ignored and cannot flip the newly restored player back to Waiting/Disconnected.
- Server independently refuses a second create/join/quick-match from a socket that is already seated.
- Added `reconnectSingleSeat.integration.test.ts`, RoomManager regression coverage, and client background-reconnect coverage for the no-second-seat invariant.
- Display name is deliberately NOT used as identity; the secret room session token restores the exact seat, allowing two unrelated people to use the same display name without unsafe seat takeover.
- Lobby presence wording now distinguishes connectivity from readiness: a connected human who has not pressed Ready is shown as **Online**, not “Waiting”; only a dropped seat is **Disconnected**, and Ready remains **Ready**.

## 2026-08-17 — Release 1.5.1 Hazari/Kitti bot-quality hardening

- Audited Hazari computer play against the newer Kitti bot path without changing either game's rules or authoritative engine/ranking code.
- Fixed a shared scheduler race: multiple near-simultaneous human events could previously queue more than one bot timer for the same table. Each room now has at most one pending bot tick per game session; a replaced Play Again session cancels/supersedes the old schedule safely.
- Replaced metronomic 700ms bot pacing with deterministic action-aware pauses: arrangement takes slightly longer, ordinary throws are brisker, and Kitti deciders get a little extra pause. Variation is deterministic, so tests/replays are not made random.
- Hazari/Kitti live tables now show `Thinking…` on the active computer seat and use `<name> is thinking…` at the table centre while the server action is genuinely pending.
- New computer seats use the newer premium Card Room animal medallions. Bot identity allocation now chooses an unused name/avatar pair, so removing and re-adding a computer cannot duplicate a still-seated bot identity.
- Added Hazari bot regression coverage proving the bot's confirmed 3/3/3/4 arrangement contains only that bot's own 13 dealt cards and never arranges the human seat.
- Extended bot identity tests and lengthened the leave-table real-socket observation window to match the more natural arrangement pacing.
- Corrected a stale comment in `hazari/arrangement.ts`: Set 4 uses Hazari's dedicated four-card classifier, not a best-3-of-4 rule. No executable arrangement logic changed in that edit.
- Dependency-light audit: 1,000 random Hazari 13-card hands all produced valid suggestions; 0 invalid arrangements. With a score of 900, all 1,000 samples used the intended concentrated endgame strategy. A 250-hand timing sample measured ~20ms average suggestion time (p95 ~33ms) in this environment, comfortably below the visible bot pacing delay.
- Full Vitest/Vite/Android verification is still pending because the current environment does not contain the complete npm dependency tree.

## 2026-08-18 — continued WIP: Teen Patti Variant Table authority

- Continued from `cardroom-current-work-WIP-2026-08-18-continued.zip`; deployed
  Release 1.5.1 and the old live Haazari deployment were not touched.
- Added server-validated Teen Patti table policy (fixed or Variant Table).
- Added reconnect-safe `AWAITING_VARIANT` round state for Dealer Choice tables.
- Host approves the allowed runtime-ready pool; the actual round dealer is the only
  player who can select from it. No boot/card deal occurs before that selection.
- Added fixed rotation support against the same approved pool.
- Added client lobby mode/pool/rotation controls plus a dedicated dealer-choice
  waiting/selection screen with safe-area and short-landscape layout.
- Fixed Teen Patti deal-animation bookkeeping so merely entering
  `AWAITING_VARIANT` cannot consume the next round's deal animation marker.
- Added lifecycle regression tests for early-boot prevention, non-dealer rejection,
  next-winner dealer authority and fixed rotation.
- Verification in this runtime: 192 TS/TSX/MTS/CTS files parse with zero syntax
  diagnostics; 46 CSS files have balanced brace structure; strict dependency-light
  Teen Patti server TypeScript compile passes; direct dealer-choice and lobby-policy
  runtime harnesses pass. Full npm client install timed out, so complete Vitest/Vite
  verification remains pending before any push/deploy.
## 2026-08-18 — Named Rank + Little restricted to K/Q/J

- Locked the Teen Patti **Named Rank + Little** house rule to the user-approved named ranks **K, Q or J only**.
- Dealer configuration now shows only K, Q and J; Ace, 10–2 and all other choices are unavailable.
- Server validation independently rejects any non-K/Q/J named rank, so a forged/stale client cannot bypass the rule.
- Updated variant help/catalog copy and regression expectations to match the authoritative K/Q/J-only rule.
- No ranking semantics changed: Little remains the player's lowest remaining non-named rank, and duplicated Little ranks are all wild.

