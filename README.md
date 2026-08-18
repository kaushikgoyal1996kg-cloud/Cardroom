# The Card Room

> **Working on this project with an AI session? Read
> [`HANDOFF.md`](./HANDOFF.md) first.** It is the entry point and records the
> verified baseline, the locked decisions and the startup procedure.


A private card room for about ten friends and family. Shared premium table,
no real-money mechanics anywhere.

- **Hazari** — 4 players, 13 cards · playable
- **Kitti** — 2–5 players, 9 cards · playable core
- **Teen Patti** — up to 9 players · substantial hidden variant-table runtime, still Coming Soon
- **Poker** — Texas / PLO4 / PLO5 / PLO6 / Short Deck hidden runtime, still Coming Soon

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
cd server && npm test
cd client && npm test
```

Do not rely on a hard-coded count here; the suite grows as regressions are added.
`PROJECT_STATE.md` records the last documented baseline and whether the current
working copy has been re-verified.

## Project layout

```
server/src/
├── platform/
│   ├── rooms/       room and player management
│   ├── net/         Socket.IO handlers
│   └── cards/       shared deck and 3-card hand evaluation
└── games/
    ├── hazari/      the original engine, unchanged
    ├── kitti/       playable
    ├── teenpatti/   hidden combined-update runtime
    └── poker/       hidden combined-update runtime

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

## Game status

Kitti's rules are now fully agreed and its online playable core is implemented.
`RULES_KITTI.md` is authoritative; do not re-open the old placeholder questions.
Optional Kitti computer seats are implemented: the host can add/remove them before Start, bots play only from their own cards, and arrangement Suggest is available only when every opponent is a bot. The consensual room-session virtual board/pot is implemented for both Hazari and Kitti.

Teen Patti remains **Coming Soon** in the live selector, but the current WIP is
well beyond initial groundwork: the hidden server/session/socket/client path
contains the locked betting model, 22 runtime-ready variants, Dealer Choice /
Fixed Rotation / Surprise Me tables, Mutual Show, retained 5-card discards,
Friendly Assist, reconnect-safe history/stats and authoritative privacy/state
sequences. It stays `networkPlayable: false` until the combined release gate.

Poker is also a real server `GameId` in the current WIP, still deliberately
**Coming Soon**. Hidden implementations cover Texas Hold'em, PLO4/PLO5/PLO6
and Short Deck with private-table setup, engine/evaluator, session/socket
contracts, Dealer Choice/rotation, betting/pots/showdown, leave settlement,
reconnect/privacy and client table/history/stats surfaces. It likewise stays
`networkPlayable: false` until full tests/builds/device QA pass.

### Current Release 1 test-track shell

The current source candidate is intentionally multi-game-neutral: no game is
pre-selected on entry, Hazari and Kitti are equal playable choices, and game
rules/tutorial slides appear only after that game is entered. Deliberately leaving
a room returns directly to **The Card Room** selector; cold launch still starts at
Welcome. Shared invitation/support/loading/settings/stat/history screens use the
same Card Room visual language. Native invite sharing requires
`VITE_PUBLIC_APP_URL` so an installed Capacitor build never shares its internal
`https://localhost` origin. See `ANDROID_RELEASE.md` and the latest
`SESSION_CHANGELOG.md` entry before building an APK.

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
│   └── sessions.ts   per-game session adapters + createGameSession factory
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
