# PROJECT STATE

> **Authoritative staging update — 2026-08-22:** the current staging WIP now
> enables all four games plus Live Tables/spectators, Teen Patti/Poker bots and
> safe-boundary running-table joins; inactivity is capped at 90 seconds; voice
> diagnostics/autoplay/ICE handling are hardened; and Kitti includes the new
> optional Round Boot mode. See `STAGING_BUG_CHANGE_REGISTER_2026-08-22.md`.
> Older “hidden/Coming Soon” descriptions lower in this long historical file
> describe the earlier checkpoint and do not override this current status.


### Current WIP — whole-app release audit after 5-card + Friendly Assist

- Latest continuation adds a **public/private snapshot barrier** for hidden Teen Patti/Poker: private cards and legal actions render only when their round/hand + authoritative sequence exactly match the public table. Top-ups refresh all affected private channels, reconnect-gated lobby setup can no longer buffer mutations, and Teen Patti keeps the felt mounted while a matching private packet is in flight.
- Hidden-game mobile/result hardening now feeds Teen Patti live/choice/result and Poker runtime from the real `VisualViewport` height; Poker retires its local live hand/action rail on hand-complete so result/bankroll controls do not overlap it.
- Teen Patti now has **22 runtime-ready hidden variants** plus dedicated/Dealer-Choice Surprise Me, Mutual Show, 5-card retained discards and consent-based Friendly Assist. **K Little, Q Little and J Little are now three separate selectable variants**; each uses its fixed face rank plus the player's lowest remaining non-matching rank as Little.
- Poker's hidden App/runtime/network path covers Texas Hold’em, PLO4/PLO5/PLO6 and Short Deck, with authoritative private setup, Dealer Choice/Fixed Rotation, betting, side pots, showdown, reconnect, leave/settlement, history and current-table stats. Both hidden games remain `networkPlayable: false`.
- Whole-app shared-shell audit hardened the circular utility hub, Back/leave behavior, room-surface cleanup, result/loading chrome, Friendly Assist positioning and cross-game Rules/Stats/History routing.
- Completed-state reconnect no longer depends on one-time result events: Hazari/Kitti restore round/winner surfaces from public history/winner fields, Teen Patti restores from `lastOutcome`, and Poker restores from public `outcome`. Result screens also expose a consistent Card Room step-away path before permanent leave/settle.
- Poker now uses a game-specific **left-of-dealer** visual deal ceremony matching its authoritative engine, while dealer-first Hazari/Kitti/Teen Patti behavior remains unchanged. Five-card Teen Patti now starts its deal ceremony at `AWAITING_DISCARD`, not late at betting. Poker/Teen Patti local hand rails use invisible footprint slots during the ceremony so visible face-down cards are not duplicated underneath the flying cards.
- A **real production startup blocker** was found and fixed in `client/src/main.tsx`: `initializeTablePreferences()` had been called as a nonexistent `ReactDOM` method while `createRoot` was not imported.
- Poker Dealer Choice now requires the exact authoritative server sequence, matching betting stale-action protection; an old chooser screen cannot deal into a newer `AWAITING_VARIANT` state.
- Host **Deal next round / Deal next hand** commands are also sequence-bound in Teen Patti/Poker; a delayed result-screen tap cannot start a later completed round/hand, and the client keeps the current result visible until the server actually advances.
- Regression contracts now cover Poker settle-leave from the `seat still connected` screen before detailed Poker state rehydrates, plus historical-name fallback through the room-lifetime participant directory.
- Open-ended table history now keeps a public-safe room-lifetime player name/avatar directory, so completed Teen Patti/Poker history remains readable after a participant settles and releases their live seat. No tokens/cards/balances are archived there.
- Shared registry metadata now correctly marks Teen Patti card count as `VARIES` rather than fixed at 3, because runtime-ready variants deal 2, 3, 4 or 5 cards.
- Strong dependency-light compile gates pass for the complete client source/test graph and complete server source/test graph, in addition to focused Teen Patti/Poker engine and App-route checks. `vite.config.ts`, `capacitor.config.ts` and both client smoke-test scripts also compile under strict external-library stubs. Static CSS/import scans remain clean.
- Full npm/Vitest/Vite release verification is still pending because this runtime cannot resolve `registry.npmjs.org` (`EAI_AGAIN`); no deployment switch is allowed until the normal package suites/builds and real-device QA pass.

An inventory of what **actually exists in code** right now. Where something is
planned but not built, it says so.

Legend: ✅ built and tested · 🟡 partial · ⛔ not built

---

## Platform

| Area | Status | Notes |
|---|---|---|
| Room model | ✅ | `platform/rooms/roomManager.ts`. Rooms carry an immutable `gameId`. Codes look like `HZR482`. |
| Game registry | ✅ | `platform/games/registry.ts` — single source of per-game seat limits. Hazari/Kitti are playable; Teen Patti/Poker are recognized identities but remain deliberately `networkPlayable: false`. Drift tests keep registry rules aligned with engines. |
| `GameSession` boundary | ✅ | `platform/games/session.ts` — four methods: `gameId`, `state`, `isComplete()`, `getPublicState()`, `getPrivateState()`. |
| Session factory | ✅ | `platform/games/sessions.ts`. Non-playable games throw; there is no path by which a non-Hazari room can build a `HaazariGame`. |
| Networking / events | ✅ | `platform/net/`. Platform events are `room:*`; each game owns a namespaced protocol (`hazari:*`, `kitti:*`, hidden `teenpatti:*` / `poker:*`); `game:error` is shared. Poker's controller exists behind the disabled registry gate. |
| Reconnect | ✅ | Token-based, 3-minute window (`platform/rooms/sessionConfig.ts`). Restores seat, hand, arrangement, score, dealer, turn. |
| Room cleanup | ✅ | `sweepStaleRooms()` removes rooms once every human has been gone past the window. Bots do not keep a room alive. |
| Bots | ✅ | Hazari + Kitti. Each game has its own server-authoritative controller; one pending bot timer per table/session, stale schedules are session-guarded, actions use deterministic human-like pacing, and the active bot shows `Thinking…`. Computer identities are unique/premium after remove/re-add. Kitti computer seats can be added/removed in the lobby and bots never join voice. |
| Chat | ✅ | Text plus quick emoji reactions. |
| Voice | ✅ | WebRTC mesh; signalling is table-scoped. Backend-issued short-lived Metered TURN credentials are supported via `METERED_DOMAIN`/`METERED_SECRET_KEY`, with STUN-only fallback; the account secret never enters the APK/browser. Voice notes supported. |
| Mobile / safe areas | ✅ | Additive `env(inset, 0px)` throughout, `dvh` for layout, per-screen FAB reserve, VisualViewport keyboard handling. |
| Startup / config errors | ✅ | `StartupErrorBoundary` wraps `GameProvider`; a missing or localhost `VITE_SERVER_URL` in a production build shows a real screen, never a blank page. |
| CORS | ✅ | Explicit allow-list; production refuses to start without `ALLOWED_ORIGINS`. |
| PWA / installability | 🟡 | Approved private-room doorway/table emblem is now the shared Welcome/Home/Profile/invite/offline identity and the source for PWA/Android launcher icons; `sw.js` v3 caches the emblem and retains explicit cross-origin/`/socket.io/` bypass. Orientation remains unlocked. Web updates surface only while out of a room; native builds suppress PWA install/update prompts. Real-device launcher/splash verification still required. |
| Local player identity | ✅ | `lib/identity.ts` — stable `profileId` + name + avatar, `localStorage`, independent of the reconnect/session token. Added 2026-08-15 — see `SESSION_CHANGELOG.md`. Explicitly not a real account system; see that entry's note on the distinction. |
| Android/PWA Back navigation | ✅ | `lib/useBackGuard.ts` syncs one history entry per meaningful screen and intercepts Back where leaving needs confirmation (Lobby, an active game). Entry-level screens (Welcome/Profile/CardRoom) and room-level screens each own their own guard instance — not a second router. Added 2026-08-15. Real-device Back-button QA still needed — see `STAGING-CHECKLIST.md`. |

---

## Hazari — playable core

Fully playable end to end, subject to the visual caveat below.

| Piece | Built | Visually migrated | Tested | Notes |
|---|---|---|---|---|
| Home / game selection | ✅ | ✅ | 🟡 | Neutral four-game Card Room selector: no default game; Hazari + Kitti open, Teen Patti + Poker polished Coming Soon; actions are contextual rather than disabled fake buttons. Current premium pass needs full suite/device re-verification. |
| Entry / identity / invite | ✅ | ✅ | 🟡 | Welcome/Profile and shared invitation flow use one Card Room language. Invite links identify the selected game; native share builds public URLs rather than Capacitor `https://localhost`. |
| RoomLobby | ✅ | ✅ | 🟡 | Card-room visual language as of 2026-08-14 (`RoomLobby.css`). No dedicated component test yet — see `SESSION_CHANGELOG.md`. |
| Arrangement screen | ✅ | ✅ | ✅ | Felt trays, tap-first, consolidated status line, dismissal folded away. No-sequence dismissal is raw-deal authoritative; Trial/Trail does not block it. |
| Dealing ceremony | ✅ | ✅ | ✅ | Face-down cards from deck to seats, dealer-first clockwise, reduced-motion aware. |
| Game table | ✅ | ✅ | ✅ | Seat ring 2–9, brass dealer token, turn ring, bot/away/voice indicators. |
| Play-travel animation | ✅ | ✅ | ✅ | Sets travel from the throwing seat; keyed on `round:setIndex:playerId`. |
| RoundSummary | ✅ | ✅ | 🟡 | Per-set breakdown, round points, cumulative, next dealer. |
| WinnerScreen | ✅ | ✅ | 🟡 | Winner, final scores, Play Again, **Return to Card Room**, shared restrained brass/ivory/wood/felt celebration. |
| Reconnect | ✅ | — | ✅ | Including animation suppression while the component stays mounted. |
| Bots | ✅ | — | ✅ | Marked `Bot`; never passed off as human. |
| Chat / voice | ✅ | ✅ | 🟡 | Mobile-safe premium utility chrome; WebRTC/voice-note behavior preserved; voice reconnect avoids stale buffered leave events and restores intended call/mute state after room reconnect. |
| Arrangement fairness | ✅ | ✅ | ✅ | Server-authoritative; blocked against any human opponent; real socket test. |
| Play money | ✅ | ✅ | 🟡 | Optional consensual room-session board/pot for Hazari: host proposes, all humans accept, bots auto-accept, contribution is recorded at match start, winner receives the pot once, room P/L persists across Play Again. Full suite/device verification pending. |

**Still uncertain:** most visual claims above are still unverified by
rendering. A first-pass Android QA round (real staging, one phone, portrait
and landscape) has now happened and found confirmed layout issues on Home,
Lobby, Arrangement and Table — see `SESSION_CHANGELOG.md` for the dated entry.
That pass did not cover iPhone/Safari, dealing/travel timing, reconnection, or
a full match, so those remain the highest-risk unknowns.

---

## Kitti — playable core

Kitti is now wired online through the shared room/session architecture. The
agreed rules in `RULES_KITTI.md` are implemented in the authoritative server
engine. Optional computer seats and the consensual room-session virtual board are implemented.

| Piece | Status |
|---|---|
| Rules / evaluator | ✅ agreed ranking, strict group ordering, later-throw tie rule |
| Dealer / deal / lead | ✅ initial high-card draw, dealer-first deal, clockwise lead flow |
| Round structure | ✅ first to two hands; three-winner decider |
| Match structure | ✅ 10 scheduled rounds + tied-leader sudden death |
| Server controller/session | ✅ `KittiSession`, `kitti:*`, private/public split |
| Client flow | ✅ arrangement, deal ceremony, shared table, results, winner |
| Reconnect | ✅ state/private-hand + result-screen restoration |
| Registry | ✅ `networkPlayable: true` |
| Bots | ✅ optional 1–4 computer seats within the 5-seat cap; host can add/remove before Start; server arranges/plays/decides from each bot's own cards only; bot-only human Suggest path is server-gated |
| Play-money board | ✅ shared consensual room-session board/pot; full suite/device verification pending |

---

## Teen Patti — development groundwork, not released

Teen Patti remains **Coming Soon** in the first Android test release and its
registry entry deliberately stays `networkPlayable: false`. The authoritative
engine, multiplayer/session groundwork, authoritative Variant Table flow and a
hidden shared table have advanced, but the flow is **not release-ready** and must
not be enabled merely because the server protocol/UI exists. Permanent
settle-on-leave is implemented behind the gate; full repository verification,
reconnect/multi-device coverage and broader mobile QA remain release blockers.

| Piece | Status |
|---|---|
| `games/teenpatti/rules.ts` | 🟡 agreed table configuration plus data-driven variant descriptors/help; Revolving Joker and Surprise Me are now locked/implemented behind the gate while still-unfinished house variants remain explicitly disabled |
| `games/teenpatti/engine.ts` | 🟡 rewritten Classic core: boot, blind progression/cap, forced seen betting after 3 blind turns, chaal, pack, show, compulsory sideshow, result/dealer transition |
| Card privacy | ✅ forced seen betting status does not reveal cards; cards reveal only on explicit See/show paths |
| Hand ranking | ✅ shared 3-card evaluator |
| Max players | ✅ 9 |
| Dealer rotation | ✅ unique round winner becomes next dealer when the following round starts |
| Compulsory sideshow | ✅ engine path: all remaining seen, nearest active player anticlockwise, tie → initiator packs |
| Mutual Show / final two | ✅ any active player can propose a free unanimous show; 3+ player votes are supported, a decline resumes the exact betting turn, and tied best hands split the pot |
| Lobby setup | 🟡 host proposal + unanimous player acceptance plus Single Variant / Variant Table / dedicated Surprise Me Table setup implemented; host chooses the approved random pool, and Dealer Choice also exposes a server-random Surprise Me option; not exposed as a playable release flow |
| Session / protocol | 🟡 `TeenPattiSession`, setup/state/private/action/top-up/next-round/leave and dealer-variant-choice events wired behind the disabled registry; betting and dealer round-decision/configuration actions require the exact authoritative state sequence |
| Client UI | 🟡 hidden shared-table runtime, server-fed variant help, dealer-choice screen, round summary, top-up and leave/settlement flow exist; still not release-enabled |
| Variant execution | 🟡 **22 runtime-ready variants** behind the gate: Classic, Muflis, Best of Four, Standard/Lowest/Highest Joker, AK47, Pairs Are Jokers, K Little, Q Little, J Little, Random-Pack Joker, Revolving Joker, Up–Down–Same, Up–Down, Down Only, Two-Reference Joker, all three retained 5-card discard families, 2 Cards · Assume the Third and Closest to N. Surprise Me is server-random over the host-approved pool, both as a dedicated every-hand table and as a Dealer Choice option. Five-card rounds use a dealer configuration gate for the compatible joker rule, retain all five physical cards, allow player choice between equal-ranked discard candidates, reveal all five at sideshow/showdown and ignore discards for ranking/ties. K/Q/J Little are direct runtime-ready variants with no secondary rank picker. Friendly Assist is implemented as an optional consent-based private-table social layer. |
| Play-money P/L/top-up product flow | 🟡 funding/top-up/P&L plus permanent settle-on-leave are implemented behind the gate; release QA remains pending |
| Registry | ✅ deliberately `networkPlayable: false` for the Hazari + Kitti Android test track |

Read `RULES_TEEN_PATTI.md` before further implementation. The rules remain the
authority; this section describes code status, not permission to change them.

---


## Poker — authoritative hidden foundation, not released

Poker is now a real server/platform/client game identity, but **still deliberately
Coming Soon**: both registries keep it unreachable through Home while the hidden
App route, socket controller and premium table are exercised behind the gate. The
purpose of the current code is to finish and verify the authoritative private-
table flow before one coordinated release switch can make it reachable.

| Piece | Status |
|---|---|
| Variants/rules | 🟡 Texas Hold’em, PLO4, PLO5, PLO6 and 6+ Short Deck descriptors/config validation implemented; all virtual play money |
| Evaluator | ✅ Texas/Omaha exact-2+3 and Short Deck ranking groundwork, including flush-over-full-house and A-6-7-8-9 |
| Betting engine | 🟡 no-limit / pot-limit actions, min/max raise-to, short all-in reopen rules, side pots, automatic all-in runout and stale action sequence protection implemented; full suite still pending |
| Variant Poker Table | 🟡 Fixed Rotation and Dealer Choice engine flow; Dealer Choice waits before blinds/antes/cards, only the upcoming dealer can commit the next approved game, and the choice carries the exact authoritative sequence so delayed chooser screens are rejected |
| Private lobby setup | 🟡 server-authoritative proposal, strictest variant seat cap, revisioned unanimous acceptance, plus hidden premium host/consensus UI |
| Session / protocol | 🟡 `PokerSession`, hidden `poker:*` state/private/action/setup/top-up/leave events and reconnect restoration are wired behind the disabled registry |
| Leave / settlement | 🟡 active-hand leave folds the seat while committed chips remain in the pot; seat is released permanently; Dealer Choice authority transfers if the upcoming dealer leaves before a deal |
| Client table | 🟡 adaptive shared-table Poker UI, bet presets, dealer-choice screen, runtime adapter, hand-result surface, Hand History and Table Stats consume authoritative public/private state through a hidden App route; Home still cannot enter it |
| Action clock | ⛔ intentionally disabled. Setup/server reject non-zero clocks until authoritative timeout/auto-action behavior exists |
| Registry / release reachability | ✅ `POKER` recognized server-side but deliberately `networkPlayable: false`; client catalog remains Coming Soon |

Poker must not be enabled until full server/client suites, production builds,
reconnect/multi-device tests and real-device portrait/landscape QA pass.

---

## Testing

| Suite | Last fully-run accepted count | Location |
|---|---|---|
| Server | 310 | `server/tests/` |
| Client | 377 | `client/src/**/*.test.*` |

Server covers: Hazari engine (the original 152, untouched), platform rooms,
game registry, arrangement fairness, a **real Socket.IO** fairness integration
test, reliability (host disconnect, cleanup, concurrent rooms, stale bot
timers, restart), Kitti engine, Teen Patti engine, shared 3-card evaluator.

Client covers: seat layout and geometry at target phone widths, arrangement
assist capability and UI, dealing and play-travel including reconnect
behaviour, the reconnect lifecycle itself, VisualViewport, startup error
boundary, mobile safe-area contracts.

Several tests have been **mutation-verified** — the bug was reintroduced and
the test confirmed to fail — for fairness gating, the landscape FAB reserve,
play-travel wiring, dealing order and reconnect suppression.

**Current Release 1.5 source candidate:** the counts above are the last fully-run
accepted suite, not a claim about the newest working copy. Release 1.5.1 includes the Hazari/Kitti consensual virtual board, backend-issued Metered
TURN, Kitti computer seats + bot-only suggestions, mixed Hazari/Kitti room/voice
isolation coverage, expanded avatars, and lobby host/online safety hardening on top
of the Release 1.4 premium shell. This environment cannot restore the complete npm
dependency tree, so the new/full Vitest suites, package typechecks, Vite build and
Android/Gradle build remain to be run by the APK workflow. Source-level checks and
dependency-light Kitti harnesses are recorded in the newest SESSION_CHANGELOG entry.

---

## Deployment

| Item | State |
|---|---|
| Production | **Blocked.** Never deployed. |
| Staging | **Deployed**, after this file was first written. Netlify client: `https://cardroom-staging.netlify.app`. Render server: `https://cardroom-staging-server.onrender.com`. Confirmed connected (`ALLOWED_ORIGINS` set, `/health` responds). |
| `netlify.toml` | Present and configured (base `client`, publish `dist`, SPA redirects) |
| `.env.example` | Present for both client and server |
| `DEPLOYMENT.md` | Written for a non-developer |
| `STAGING-CHECKLIST.md` | Mostly still unticked. One item confirmed by a first-pass Android QA round — see that file and `SESSION_CHANGELOG.md`. |
| `MIGRATION.md` | Written; old app must not be deleted |

The previous live application is untouched, separate from staging, and
remains the working version for the family. Nothing about staging affects it.

### Release 1.4 premium/native shell — 2026-08-17

- Cold launch remains Welcome; deliberate Leave/Return from a table uses a one-shot
  navigation marker to return directly to **The Card Room** selector.
- Shared transient screens (loading, reconnect, confirmed-hand waiting, active-seat
  return pass, Settings/Rules/Stats/History) now use the same wood/brass/felt language.
- Hazari and Kitti stats/history are separated by game; old Hazari local stats migrate
  forward automatically.
- Native/PWA install and update prompts are platform-aware; web updates are hidden
  while a room is live. The viewport no longer disables user zoom with
  `maximum-scale=1`.
- Android CI passes `VITE_PUBLIC_APP_URL` so Share from a Capacitor APK never emits
  a `https://localhost` invitation, and `android:init` generates branded native
  launcher/splash resources from the Card Room emblem.

## Per-game rules guides — 2026-08-17

- The neutral Card Room / Welcome flow no longer launches a Hazari tutorial before a game is selected.
- Hazari and Kitti each have their own detailed slide-based `Rules & How to Play` guide in `client/src/platform/games/gameGuides.ts`.
- First entry is remembered independently per game on the device; viewing Hazari never suppresses Kitti's first-entry guide.
- The active game's guide is always reopenable from Settings.

### Reconnect / duplicate-seat hardening (2026-08-17)

The current Release 1 candidate enforces a one-session-seat invariant: a returning device with a valid token restores the original `playerId` and lobby row as connected instead of creating a second Waiting/Disconnected entry. Client new-room actions are blocked during restoration; server create/join/quick-match handlers independently refuse an already-seated socket; superseded live sockets are detached on token reconnect; stale late disconnects cannot mark the newer restored socket offline. Regression coverage exists at RoomManager, client reconnect, and real-Socket.IO integration levels.

### Current WIP continuation — premium identity, physical hands and Teen Patti action authority (2026-08-18)

This working copy is newer than the packaged Poker Network Foundation WIP and remains unpushed.

- The user-approved third logo concept (open private-room doorway, lit card table, dark green/black and antique gold) replaces the old bullseye-like primary seal on Welcome, Home, Profile, invitation, offline/PWA and leave surfaces. PWA/Android icon source assets are derived from the emblem, not the full tiny wordmark.
- Hazari and Kitti arrangement screens retain every locked rule while moving farther from boxed trays toward shallow felt hand bays: grouped cards have a physical arc/fan, the unplaced hand has stronger natural overlap, selected cards lift above neighbours, and short-landscape keeps card size rather than solving fit by shrinking cards.
- Teen Patti socket betting actions now require the exact current authoritative sequence. The client refuses to emit an action without a current sequence and the server rejects missing/invalid/old sequence values, matching the stale-action protection already used by Poker.
- Full npm/Vitest/typecheck/Vite production verification and real-device launcher/portrait/landscape QA remain mandatory before either hidden game is enabled or this WIP is deployed.

### Current WIP continuation — Teen Patti Variant Table (2026-08-18)

This working copy is **newer than deployed Release 1.5.1** and remains unpushed.
Teen Patti still stays `networkPlayable: false`; none of this enables an unfinished
public table.

- Runtime-ready fixed variants now include Classic, Muflis, Best of Four, Standard
  Joker, Lowest Card Joker, Highest Card Joker, AK47, Pairs Are Jokers,
  Random-Pack Joker, Up–Down–Same, Up–Down and Down Only.
- Private-table setup now carries a server-validated `TeenPattiVariantTablePolicy`:
  either one fixed variant or a host-approved Variant Table pool with Dealer Choice
  or Fixed Rotation.
- Dealer Choice is authoritative per round. The host approves the pool, but after
  the initial dealer draw (and after each next-round transition) the actual dealer
  is the only player allowed to select the round variant.
- Dealer-choice tables enter `AWAITING_VARIANT` before any boot is charged or card
  is dealt. The chooser id and approved policy are public/reconnect-safe.
- Variant selection and dealing are one server transaction. A non-dealer cannot
  race/replace the selection.
- The hidden client has a dedicated mobile/landscape-safe dealer-choice screen and
  lobby controls for Single Variant vs Variant Table.
- A dependency-light strict TypeScript compile of the Teen Patti server slice and
  direct runtime harnesses pass the dealer-choice and lobby-policy lifecycle.
- Full client/server npm test suites and production builds are **still pending** in
  an environment with the complete dependency tree.

### Current WIP continuation — Two-Reference Joker + reconnect-safe Hazari/Kitti history (2026-08-18)

- Two-Reference Joker now deals two public references, then pauses in a private role-assignment gate. Each seated player independently chooses which reference supplies Up/Down; the other automatically supplies Same-rank. Other players can see only completion status, never that private A/B assignment. No betting begins until every remaining seated player has locked a choice; leaving during the gate preserves committed boot and refreshes the gate safely.
- Hazari and Kitti completed-round history is now included in authoritative public state and continuously rehydrates the client. Settings → Round History therefore survives reconnect, Return to Table and later live rounds instead of depending only on one-off `roundComplete` events from the current browser session.
- Settings navigation to Rules / Stats / Round History is now a single parent-owned surface transition, preventing the old Settings sheet from racing the destination overlay.
- No Hazari or Kitti gameplay rule changed. Full dependency-based Vitest/Vite and device verification remain release gates.
