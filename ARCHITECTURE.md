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
│   ├── kitti/                rules, engine        (no controller)
│   └── teenpatti/            rules, engine        (no controller)
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
`createRoom` throws and the factory throws. That is why Kitti and Teen Patti
appear on the Home screen but cannot be entered.

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
| `room:*` | create, join, quick match, reconnect, ready, start, leave, list tables, add bot, chat, voice signalling |
| `hazari:*` | Hazari only — arrangement, play set, dismissal, suggestions, its state payload |
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
