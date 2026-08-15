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
| Bots | ✅ | Hazari only. Session-identity guard prevents a stale tick acting on a replaced session. |
| Chat | ✅ | Text plus quick emoji reactions. |
| Voice | ✅ | WebRTC mesh; server relays signalling only and never touches audio. Voice notes supported. |
| Mobile / safe areas | ✅ | Additive `env(inset, 0px)` throughout, `dvh` for layout, per-screen FAB reserve, VisualViewport keyboard handling. |
| Startup / config errors | ✅ | `StartupErrorBoundary` wraps `GameProvider`; a missing or localhost `VITE_SERVER_URL` in a production build shows a real screen, never a blank page. |
| CORS | ✅ | Explicit allow-list; production refuses to start without `ALLOWED_ORIGINS`. |
| PWA / installability | 🟡 | Manifest (`Cardroom` branding, unlocked orientation, maskable dark/brass icons), hand-written `sw.js` (app-shell caching, explicit cross-origin/`/socket.io/` bypass, player-confirmed updates only), `offline.html`, install + update banners. Added 2026-08-14 — see `SESSION_CHANGELOG.md`. Not yet verified on a real device (same standing limitation as the rest of this table). |
| Local player identity | ✅ | `lib/identity.ts` — stable `profileId` + name + avatar, `localStorage`, independent of the reconnect/session token. Added 2026-08-15 — see `SESSION_CHANGELOG.md`. Explicitly not a real account system; see that entry's note on the distinction. |
| Android/PWA Back navigation | ✅ | `lib/useBackGuard.ts` syncs one history entry per meaningful screen and intercepts Back where leaving needs confirmation (Lobby, an active game). Entry-level screens (Welcome/Profile/CardRoom) and room-level screens each own their own guard instance — not a second router. Added 2026-08-15. Real-device Back-button QA still needed — see `STAGING-CHECKLIST.md`. |

---

## Hazari — the flagship

Fully playable end to end, subject to the visual caveat below.

| Piece | Built | Visually migrated | Tested | Notes |
|---|---|---|---|---|
| Home / game selection | ✅ | ✅ | ✅ | Kitti and Teen Patti shown but disabled with reasons. |
| Landing / identity | ✅ | 🟡 legacy | 🟡 | Name, avatar, invite links, table browser. Reached for first-time players and invite links. |
| RoomLobby | ✅ | ✅ | 🟡 | Card-room visual language as of 2026-08-14 (`RoomLobby.css`). No dedicated component test yet — see `SESSION_CHANGELOG.md`. |
| Arrangement screen | ✅ | ✅ | ✅ | Felt trays, tap-first, consolidated status line, dismissal folded away. |
| Dealing ceremony | ✅ | ✅ | ✅ | Face-down cards from deck to seats, dealer-first clockwise, reduced-motion aware. |
| Game table | ✅ | ✅ | ✅ | Seat ring 2–9, brass dealer token, turn ring, bot/away/voice indicators. |
| Play-travel animation | ✅ | ✅ | ✅ | Sets travel from the throwing seat; keyed on `round:setIndex:playerId`. |
| RoundSummary | ✅ | ✅ | 🟡 | Per-set breakdown, round points, cumulative, next dealer. |
| WinnerScreen | ✅ | ✅ | 🟡 | Winner, final scores, Play Again, Return to Lobby, restrained confetti. |
| Reconnect | ✅ | — | ✅ | Including animation suppression while the component stays mounted. |
| Bots | ✅ | — | ✅ | Marked `Bot`; never passed off as human. |
| Chat / voice | ✅ | 🟡 legacy | 🟡 | Mobile-safe; not visually migrated. |
| Arrangement fairness | ✅ | ✅ | ✅ | Server-authoritative; blocked against any human opponent; real socket test. |
| Play money | ⛔ | — | — | **Not implemented.** Confirmed as planned (consensual board, winner takes the virtual pot) — see `RULES_HAZARI.md`. Not a current rule. |

**Still uncertain:** most visual claims above are still unverified by
rendering. A first-pass Android QA round (real staging, one phone, portrait
and landscape) has now happened and found confirmed layout issues on Home,
Lobby, Arrangement and Table — see `SESSION_CHANGELOG.md` for the dated entry.
That pass did not cover iPhone/Safari, dealing/travel timing, reconnection, or
a full match, so those remain the highest-risk unknowns.

---

## Kitti — engine only

**There is no online Kitti.** No server controller, no client UI, no route.

| Piece | Status |
|---|---|
| `games/kitti/rules.ts` | ✅ constants: 2–5 players, 9 cards, 3 groups of 3, 2-3-5 not special |
| `games/kitti/engine.ts` | 🟡 dealing, arrangement validation, per-group comparison |
| Sequence hierarchy | ✅ shared 3-card evaluator, A-K-Q > A-2-3 > K-Q-J > … |
| Scoring | ⛔ `scoreRound()` deliberately throws |
| Round/match structure | ⛔ not implemented |
| Turn order / leading | ⛔ not implemented |
| Initial dealer draw | ⛔ not implemented |
| Three-different-winners decider | ⛔ not implemented |
| Server controller | ⛔ |
| Client UI | ⛔ |
| Play-money board | ⛔ |
| Registry | `networkPlayable: false` — rooms cannot be created |
| Tests | 19, covering only what exists |

The full agreed spec now lives in `RULES_KITTI.md`, which also lists where the
existing engine **conflicts** with it. Nothing has been changed to match.

---

## Teen Patti — engine only

**There is no online Teen Patti.** No server controller, no client UI, no route.

| Piece | Status |
|---|---|
| `games/teenpatti/rules.ts` | 🟡 constants and variant knobs |
| `games/teenpatti/engine.ts` | 🟡 betting state machine: boot, blind/seen, chaal, pack, show, showdown, pot split |
| Hand ranking | ✅ shared 3-card evaluator |
| Max players | ✅ 9 |
| Dealer rotation | 🟡 clockwise — spec says winner deals next |
| Sideshow | ⛔ flag exists, logic not implemented |
| Variant framework | ⛔ none |
| Play-money / P&L / top-up | ⛔ |
| Server controller | ⛔ |
| Client UI | ⛔ |
| Registry | `networkPlayable: false` |
| Tests | 24, covering only what exists |

See `RULES_TEEN_PATTI.md` for the agreed spec and the conflicts with current
code.

---

## Testing

| Suite | Count | Location |
|---|---|---|
| Server | 307 | `server/tests/` (19 files) |
| Client | 315 | `client/src/**/*.test.*` (20 files) |

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
