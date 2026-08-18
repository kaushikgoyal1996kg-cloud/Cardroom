# ARCHITECTURE

Documented from the source as it stands. Nothing here is aspirational.

---

## Shape

```
server/src/
├── platform/                 game-agnostic
│   ├── rooms/                roomManager, types, avatars, sessionConfig
│   ├── games/                registry, session, sessions (factory + adapters)
│   ├── net/                  socketHandlers, events
│   └── cards/                shared deck + 3-card evaluator (NOT used by Hazari)
├── games/
│   ├── hazari/               engine, rules, deck, hands, arrangement,
│   │                         dismissal, scoring, botController, assist rule
│   ├── kitti/                rules, arrangement, engine, bot controller
│   ├── teenpatti/            rules, evaluation, variant/setup, engine
│   └── poker/                rules, evaluator, setup, engine
└── server.ts

client/src/
├── platform/
│   ├── components/           PlayingCard, CardTable, Seat, DealerToken,
│   │                         PlayerHand, Home, HomeScreen, StartupErrorBoundary
│   ├── table/                seatLayout (seat ring, deal timing, deal order)
│   ├── games/                catalog (mirrors server registry)
│   ├── styles/               tokens.css (card-room design tokens)
│   └── lib/                  config, useVisualViewport
├── games/hazari/             HazariTable, ArrangementTable, DealingTable,
│                             RoundSummary, WinnerScreen, arrangementAssist
├── games/kitti/              arrangement, dealing, table, summary/winner
├── games/teenpatti/          setup, variant choice, table, rules, summary
├── games/poker/              setup/consensus, variant choice, runtime/table, rules
├── lib/                      GameStore, socket, sound, haptics, identity
├── components/               legacy screens still in use (Lobby, Chat, Voice,
│                             modals) + unrouted rollback screens
└── App.tsx                   screen routing
```

---

## Why the room layer must not depend on Hazari

The room layer's job is rooms, seats, players, tokens and reconnection. None
of that is a card-game concern. When it imported Hazari directly:

- `RoomState.game` was typed `HaazariGame`, so adding a second game meant
  casts at every call site;
- seat limits came from `GAME_RULES.PLAYER_COUNT`, so every table was
  implicitly four-player;
- it imported Hazari's rules module purely to learn a **network timeout**
  (`RECONNECT_WINDOW_MS`), which is not a game rule at all — that constant now
  lives in `platform/rooms/sessionConfig.ts`.

Today `platform/rooms/` references no game engine whatsoever. Verifiable:

```bash
grep -r "hazari" server/src/platform/rooms/     # returns nothing
```

Keep it that way. If the room layer needs to know something about a game, add
it to the **registry** or the **session boundary**, not an import.

---

## The `GameSession` boundary

Deliberately four methods. The room layer needs to know only: which game this
is, whether it has finished, what is safe to broadcast, and what belongs
privately to one player.

```ts
interface GameSession {
  readonly gameId: GameId;
  readonly state: string;              // engine state name, per-game
  isComplete(): boolean;
  getPublicState(): unknown;           // never contains hidden cards
  getPrivateState(playerId): unknown;  // that player's cards only
}
```

`HazariSession` wraps the existing engine and exposes it as `.engine`. **Not
one line of the Hazari engine was changed to fit this interface** — that is
the point of an adapter.

### One narrowing point

`asHazari(session)` is the **only** place a session is narrowed to a concrete
engine. Every Hazari socket handler, the bot controller and the reconnect path
go through it. A `hazari:*` event arriving at a table running another game is
rejected there rather than misinterpreted.

If you find yourself adding a second narrowing point or a cast, that is the
signal the boundary needs another method instead.

---

## Game registry

`platform/games/registry.ts` is the single source of truth for which games
exist and what each needs: min/max/required players, cards per player, and
`networkPlayable`.

A game with `networkPlayable: false` cannot have a room created for it —
`createRoom` throws and the factory throws. In the current WIP Hazari and Kitti
are playable; Teen Patti and Poker are registered real game identities with
hidden engines/routes but remain gated by this flag.

A drift test asserts the registry still matches each engine's own rules module,
so the two cannot silently diverge.

---

## Rooms, players, reconnection

- A room has an **immutable `gameId`**, fixed at creation. Want a different
  game? Make a different table. This is what stops the room layer ever having
  to migrate a half-played game between engines.
- Each player holds a secret **token**, never broadcast, used to reconnect.
- Disconnect marks the seat and stamps the time; **the host is not
  transferred**. The seat is held for the reconnect window.
- `sweepStaleRooms()` deletes a room once every human has been gone past the
  window. Bots do not count as present.
- **Rooms are in-memory only.** There is no persistence. A server restart
  loses all rooms; tokens and codes are then cleanly *refused* rather than
  admitting anyone to a corrupt state. This is intentional, and tested.

---

## Socket protocol

| Namespace | Purpose |
|---|---|
| `room:*` | create, join, quick match, reconnect, ready, start, leave, list tables, bots, chat, voice signalling |
| `hazari:*` | Hazari arrangement, play-set, dismissal, suggestions and state |
| `kitti:*` | Kitti arrangement/play/next-round and state |
| `teenpatti:*` | hidden setup, dealer/config choices, discards/reference assignment, Friendly Assist, betting/top-up/next-round/settle-leave and state |
| `poker:*` | hidden setup, Dealer Choice, betting/top-up/next-hand/settle-leave and state |
| `game:error` | shared per-game error channel |

`gameId` travels through create, quick-match and list-tables. Quick match will
never drop a player into a table for a different game.

### Privacy boundary

- `getPublicState()` is broadcast to the room and must **never** contain a
  hidden card. Tests assert no card id from any hand appears in the serialised
  public state.
- `getPrivateState(playerId)` goes only down that player's own channel.
- `PublicRoomInfo` never includes tokens.
- The dealing animation is passed **no card data at all** — every ceremony
  card is face-down with no card prop, so it is structurally incapable of
  leaking a hand.

---

## Server authority

The server owns all game state. Clients cannot generate or alter cards, change
scores, play another player's cards, change dealer or turn, reveal opponents'
cards, bypass legal moves, fake membership or spoof identity.

Two specific applications worth knowing:

**Arrangement assistance.** Suggestions are computed server-side. Before
computing *anything*, the handler re-derives eligibility from its own room
state: if the requesting player has any real human opponent, it refuses. The
client mirror exists only to decide what to render. A real Socket.IO
integration test emits the event by hand and confirms refusal — and has been
mutation-verified by removing the gate.

**Duplicate actions.** Client-side disabling is never relied on alone. The
server rejects stale and illegal actions independently.

---

## Bots

Hazari only. Every scheduled tick:

1. re-fetches the room by code;
2. **compares session identity** against the session the tick was scheduled
   for, and bails if it was replaced;
3. re-derives the pending action from current state.

Step 2 matters because after Play Again the room keeps its code but gets a new
session, and a code freed by cleanup can later be reused. Without it a pending
tick could act on a game it was never scheduled for.

Bots are always labelled `Bot` and never presented as human.

---

## Client

**`GameStore`** is the single React context holding room, game state, private
hand, chat, voice, connection status. It owns the socket and all event
handlers.

Two lifecycle signals worth knowing, both driven by the **same** reconnect
lifecycle:

- `freshDealCount` — increments only for a genuinely new deal, never for the
  hand replayed during reconnect restoration. Drives the dealing ceremony.
- `isRestoring` / `restorationGeneration` — observable restoration window.
  `HazariTable` uses it to seed already-present plays without animating them,
  because **a reconnect does not necessarily remount the component**: App keeps
  the same screen mounted and shows the connection banner over it.

**Routing** is a plain conditional chain in `App.tsx` producing a `screenKey`.
That key is also set as `data-screen` on `.app-root`, which lets fixed chrome
(the chat FAB) reserve space for the current screen's action rail
declaratively, since CSS variables cascade downward only.

**Entry flow** (`HomeScreen.tsx`, only rendered while `room` is null) is the
same style of plain conditional chain, one level down: an internal
`entryStage` (`'welcome' | 'profile' | 'cardroom'`) picks between `Welcome`,
`PlayerProfile` and `Home` for a normal launch. An invite link (`?join=...`)
or an in-flight reconnect for that exact room bypasses this entirely and
falls through to the existing `Landing`/waiting-spinner paths, unchanged -
see the "Persistent local identity" and "Android/PWA Back navigation"
sections below for why that boundary is deliberate.

**Persistent local identity** (`lib/identity.ts`) is a `localStorage`-backed
`{ profileId, name, avatar }`, separate from `GameStore`'s reconnect/session
token (`haazari_session_v1`) both in storage key and in purpose: `profileId`
identifies *this device's saved profile*, generated once and stable across
edits; the session token identifies *a seat in a specific room* and is
owned entirely by `GameStore`. Neither module reads or writes the other's
key. `profileId` is not sent to the server today - see PROJECT_STATE.md and
Part 12 of the brief this shipped against for why that's a deliberate,
revisitable choice rather than an oversight.

**Android/PWA Back navigation** (`lib/useBackGuard.ts`) is a shared hook, not
a second router: it observes a `screenKey` the caller already computed (the
existing conditional chains above) and keeps one browser/PWA history entry
in step with it, intercepting Back where leaving needs confirmation first.
Two independent call sites use it - `App.tsx` for room-level screens (Lobby,
an active game, round-summary/winner, home-return) and `HomeScreen.tsx` for
entry-level screens (Welcome/Profile/CardRoom) - never both at once, since
`App.tsx`'s instance is explicitly `disabled` while `screenKey === 'home'`
(i.e. while `HomeScreen` is mounted and owns Back itself). A screen either
returns `'root'` (no interception - lets Back exit the app/tab, used only
for true entry points: Welcome, an invite link's own landing), `'handled'`
(a safe, reversible state change the caller already made, e.g.
`setEntryStage('welcome')`), or `'blocked'` (the pop is cancelled; used both
for confirmation-guarded leaves and for absorbing a press on a screen with
no sensible Back destination, like round-summary). A confirmed Leave calls
`consumeAsBack()` immediately before the state change that follows, so the
next history sync replaces the blocked entry instead of stacking a new one
on top of it. See `App.tsx`'s `pendingLeaveConfirm` effect for why a
guarded dialog is also cleared - not left stale - if the room's status
changes for a reason other than that dialog's own confirm/cancel (e.g. the
host starts the game while another player has a Lobby leave-confirm open).

**Table primitives** in `platform/components/` are shared and game-agnostic:
`CardTable` takes players, dealer, played sets and dealing flags. `seatLayout`
provides hand-tuned seat rings for 2–9 players, deal timing and the
dealer-first dealing order.

**Game-specific UI** lives under `games/<game>/`. Hazari's screens compose the
platform primitives; they do not fork them. When Kitti and Teen Patti arrive,
they should do the same.

---

## One deliberate duplication

Hazari does **not** import from `platform/cards/`. It keeps its own card model
and 3-card evaluator. Kitti and Teen Patti share the platform one.

This is intentional. Hazari's rules are the authority for how the family
actually plays and are covered by the original 152 tests. Physical separation
makes it impossible for a change made for another game to alter Hazari's
scoring by accident.

**Do not "tidy this up" by merging them.**

⚠️ Note the two are **not identical**: Hazari's `seatingOrderFromDealer` starts
*at* the dealer (`slice(idx)`); the platform version starts *after* the dealer
(`slice(idx + 1)`). This matters for Kitti — see `RULES_KITTI.md`.
