# PROJECT STATE

An inventory of what **actually exists in code** right now. Where something is
planned but not built, it says so.

Legend: ✅ built and tested · 🟡 partial · ⛔ not built

---

## Platform

| Area | Status | Notes |
|---|---|---|
| Room model | ✅ | `platform/rooms/roomManager.ts`. Rooms carry an immutable `gameId`. Codes look like `HZR482`. |
| Game registry | ✅ | `platform/games/registry.ts` — single source of per-game seat limits. Drift test keeps it in step with each engine's own rules module. |
| `GameSession` boundary | ✅ | `platform/games/session.ts` — four methods: `gameId`, `state`, `isComplete()`, `getPublicState()`, `getPrivateState()`. |
| Session factory | ✅ | `platform/games/sessions.ts`. Non-playable games throw; there is no path by which a non-Hazari room can build a `HaazariGame`. |
| Networking / events | ✅ | `platform/net/`. Platform events are `room:*`; Hazari events are `hazari:*`; `game:error` is the shared error channel. |
| Reconnect | ✅ | Token-based, 3-minute window (`platform/rooms/sessionConfig.ts`). Restores seat, hand, arrangement, score, dealer, turn. |
| Room cleanup | ✅ | `sweepStaleRooms()` removes rooms once every human has been gone past the window. Bots do not keep a room alive. |
| Bots | ✅ | Hazari + Kitti. Each game has its own server-authoritative controller; one pending bot timer per table/session, stale schedules are session-guarded, actions use deterministic human-like pacing, and the active bot shows `Thinking…`. Computer identities are unique/premium after remove/re-add. Kitti computer seats can be added/removed in the lobby and bots never join voice. |
| Chat | ✅ | Text plus quick emoji reactions. |
| Voice | ✅ | WebRTC mesh; signalling is table-scoped. Backend-issued short-lived Metered TURN credentials are supported via `METERED_DOMAIN`/`METERED_SECRET_KEY`, with STUN-only fallback; the account secret never enters the APK/browser. Voice notes supported. |
| Mobile / safe areas | ✅ | Additive `env(inset, 0px)` throughout, `dvh` for layout, per-screen FAB reserve, VisualViewport keyboard handling. |
| Startup / config errors | ✅ | `StartupErrorBoundary` wraps `GameProvider`; a missing or localhost `VITE_SERVER_URL` in a production build shows a real screen, never a blank page. |
| CORS | ✅ | Explicit allow-list; production refuses to start without `ALLOWED_ORIGINS`. |
| PWA / installability | 🟡 | Branded **The Card Room** manifest/offline shell, unlocked orientation, maskable dark/brass icons, `sw.js` v2 with explicit cross-origin/`/socket.io/` bypass. Web updates surface only while out of a room; native builds suppress PWA install/update prompts. Real-device verification still required. |
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
| Arrangement screen | ✅ | ✅ | ✅ | Felt trays, tap-first, consolidated status line, dismissal folded away. |
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
engine, multiplayer/session groundwork and a hidden Classic table have advanced,
but the flow is **not release-ready** and must not be enabled merely because the
server protocol/UI exists. Teen Patti-specific settle-on-leave and broader
multiplayer/mobile QA are still release blockers.

| Piece | Status |
|---|---|
| `games/teenpatti/rules.ts` | 🟡 agreed Classic/table configuration plus variant descriptors; full live variant execution still pending |
| `games/teenpatti/engine.ts` | 🟡 rewritten Classic core: boot, blind progression/cap, forced seen betting after 3 blind turns, chaal, pack, show, compulsory sideshow, result/dealer transition |
| Card privacy | ✅ forced seen betting status does not reveal cards; cards reveal only on explicit See/show paths |
| Hand ranking | ✅ shared 3-card evaluator |
| Max players | ✅ 9 |
| Dealer rotation | ✅ unique round winner becomes next dealer when the following round starts |
| Compulsory sideshow | ✅ engine path: all remaining seen, nearest active player anticlockwise, tie → initiator packs |
| Final two | ✅ mutual no-cost open show path implemented in engine |
| Lobby setup | 🟡 host proposal + player acceptance model and socket events implemented; not exposed as a playable release flow |
| Session / protocol | 🟡 `TeenPattiSession`, state/private payloads, actions/top-up/next-round events wired behind the disabled registry |
| Client UI | 🟡 hidden Classic shared-table + round-summary/top-up flow exists; still not release-enabled |
| Full variant execution | ⛔ descriptors exist, but only Classic is runtime-enabled |
| Play-money P/L/top-up product flow | 🟡 engine/protocol groundwork only; not release-ready |
| Registry | ✅ deliberately `networkPlayable: false` for the Hazari + Kitti Android test track |

Read `RULES_TEEN_PATTI.md` before further implementation. The rules remain the
authority; this section describes code status, not permission to change them.

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
