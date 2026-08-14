# The Card Room

> **Working on this project with an AI session? Read
> [`HANDOFF.md`](./HANDOFF.md) first.** It is the entry point and records the
> verified baseline, the locked decisions and the startup procedure.


A private card room for about ten friends and family. Three games, one table,
no money involved anywhere.

- **Hazari** — 4 players, 13 cards
- **Kitti** — 2–5 players, 9 cards *(scoring rules pending, see below)*
- **Teen Patti** — up to 9 players, 3 cards

## Running it locally

Two terminals.

```bash
# Terminal 1 - the game server
cd server
npm install
npm run dev
```

```bash
# Terminal 2 - the app
cd client
npm install
cp .env.example .env.local
npm run dev
```

Open the address Vite prints, usually http://localhost:5173.

To play from your phone on the same Wi-Fi, put your computer's LAN address in
`client/.env.local` instead of localhost.

## Tests

```bash
cd server && npm test    # 215 tests
cd client && npm test    #  22 tests
```

## Project layout

```
server/src/
├── platform/
│   ├── rooms/       room and player management
│   ├── net/         Socket.IO handlers
│   └── cards/       shared deck and 3-card hand evaluation
└── games/
    ├── hazari/      the original engine, unchanged
    ├── kitti/       new
    └── teenpatti/   new

client/src/
├── platform/
│   ├── components/  card, table, seat, hand, dealer button, home
│   ├── table/       seat layout engine
│   ├── styles/      design tokens
│   └── lib/         server configuration
└── games/           per-game screens
```

### One deliberate piece of duplication

Hazari does **not** import from `platform/cards`. It keeps a private copy of
the card model and hand evaluator.

This is on purpose. Hazari's rules are covered by 152 pre-existing tests and
are the authority for how the family actually plays. Keeping its engine
physically separate makes it impossible for a change made for Kitti or Teen
Patti to alter Hazari's scoring by accident. Kitti and Teen Patti share the
platform evaluator, because there is no tested legacy behaviour to protect
there.

Do not "tidy this up" by merging them.

## Outstanding rule questions

Kitti cannot be finished until these are answered — the engine throws rather
than guessing:

1. Must the three groups be ordered strongest to weakest, as in Hazari?
2. What points does winning a group award?
3. What ends the game — a target score, a fixed number of rounds?
4. How is an exact tie between two identical groups resolved?
5. Who leads — the dealer, or the player to their left?

Teen Patti is playable, but these house settings were chosen rather than
confirmed. They all live in `server/src/games/teenpatti/rules.ts`:

boot amount, starting chips, blind and seen multipliers, maximum blind turns,
pot limit, side show on/off, show cost, and how ties split.

## Documentation

- `DEPLOYMENT.md` — how to put it online, written for a non-developer
- `STAGING-CHECKLIST.md` — what to test before switching over
- `MIGRATION.md` — when it is safe to retire the old version

## Architecture: the shared room model

A table belongs to exactly one game, chosen when it is created and immutable
thereafter. If you want a different game, you make a different table.

```
platform/
├── games/
│   ├── registry.ts   GameId + per-game seat limits (single source of truth)
│   ├── session.ts    the 4-method GameSession boundary
│   └── sessions.ts   HazariSession adapter + createGameSession factory
└── rooms/            rooms, players, reconnection - imports NO game engine
```

`platform/rooms/` does not reference Hazari at all. The room layer knows only
`GameSession`: which game, whether it has finished, what is public, what is
private.

`asHazari(session)` is the **only** place a session is narrowed to a concrete
engine. Every Hazari socket handler goes through it. If you find yourself
adding a second narrowing point or a cast, that is the signal the boundary
needs another method instead.

### Adding a game

1. Add an entry to `platform/games/registry.ts`.
2. Add an adapter and a `case` in `createGameSession`.
3. Add its socket handlers under its own `gamename:` event namespace.

Nothing in `platform/rooms/` should need to change.

### Event namespaces

- `room:*` — platform: create, join, quick match, reconnect, ready, start,
  leave, list tables, chat, voice
- `hazari:*` — Hazari only: arrangement, play set, dismissal, its state payload
- `game:error` — generic per-game error channel

A `hazari:*` event arriving at a table running another game is rejected by
`asHazari`, not misinterpreted.
