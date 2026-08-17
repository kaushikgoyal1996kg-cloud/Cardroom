# DESIGN SYSTEM

The approved visual direction. Follow it for new UI; do not redesign existing
screens without being asked.

---

## The idea

Ten cousins opening the game on their phones should feel they have entered the
same beautiful private card room. Premium comes from craftsmanship, not
monetisation — the app is free and must never look like it is selling
anything.

**Mood:** sophisticated, dark, warm, elegant, modern but not futuristic,
restrained rather than flashy.

---

## Table identity

The card table is the central visual language. Every game renders into it.

- **Deep green felt** as the dominant surface — a radial gradient, lighter
  toward the centre where the light falls.
- **Warm polished wood surround** with fine grain.
- **Thin brass inner rim** where felt meets wood. Restrained: a hairline, not
  a frame.
- **Soft overhead lamp** — one pool of warm light above the table. This is the
  single atmospheric flourish; do not add more.
- **Ivory physical cards** with legible ranks.
- **Subtle realistic tilts and movement.** Thrown sets sit at small
  deterministic angles, as though placed by hand rather than snapped to a grid.
- **Physical brass dealer token** marked `D`, sliding between seats when the
  deal passes on.
- **Integrated seats** — avatar, name, score and status arranged around the
  felt, not bulky rectangular player panels.
- **Local player anchored at the bottom**, always, whoever is dealing.
- **Played sets land in front of the throwing seat**, travelling from that
  seat rather than appearing.

### Avoid

Generic SaaS dashboard panels around the table. Glassmorphism. Neon. Casino
advertising styling. Slot-machine or jackpot aesthetics. Excessive particles.

---

## Palette

Tokens live in `client/src/platform/styles/tokens.css`.

| Group | Use |
|---|---|
| `--felt-*` | Playing surface |
| `--wood-*` | Table surround |
| `--brass-*` | Fittings, dealer token, focus rings, accents |
| `--room-*` | Backdrop behind the table |
| `--ink-*` | Text, warm off-whites through muted browns |
| `--card-face`, `--suit-red`, `--suit-black` | Cards |
| `--status-*` | Turn, connected, away, lost, bot |

Shadows are **warm**, never neutral grey.

⚠️ Two token systems coexist deliberately: `styles/tokens.css` (legacy, gold/
ivory) and `platform/styles/tokens.css` (card room). Legacy screens still
depend on the old variables. **Do not merge them.**

---

## Typography

- **Cinzel** — display and game identity: brand, game names, winner name, set
  labels, tray nameplates.
- **Work Sans** — all readable UI and body text.
- Tabular numerals for scores, so figures do not jitter as they change.

Both are loaded in `styles/global.css`. **Asking for a font that is not loaded
silently falls back to Times** — this has already happened once. Keep the
tokens and the loaded families in step.

---

## Orientation

- **Landscape is the preferred, premium gameplay presentation** — the table
  has room to breathe and the felt dominates.
- **Portrait remains fully supported and playable.** It is what most people
  will actually pick up their phone and use.
- **Never hard-lock orientation** unless the product explicitly changes.
- Rotation must not break layout or leave stale keyboard offsets.

---

## Mobile requirements — non-negotiable

Target widths: 320, 360, 375, 390, 412, 430, tablet, desktop.

- **Safe areas:** always `calc(env(safe-area-inset-*, 0px) + gap)`. Never
  `env(inset, fallback)` — the fallback only applies where safe-area is
  *unsupported*, so on Android it collapses to zero and the padding vanishes.
  This bug has occurred twice.
- **`dvh`, not `vh`**, for anything that lays out. `vh` in keyframe travel
  distances is fine.
- **No horizontal page overflow**, ever. Scroll within a component instead.
- **44×44 minimum touch targets.**
- **No hover-only actions.**
- Fixed chrome must not cover gameplay controls — see `--action-reserve` in
  `tokens.css`.
- **Cards fit by spacing, never by shrinking.** Thirteen cards at 320px fit
  through controlled overlap at full card size.
- `prefers-reduced-motion` respected throughout.
- No state communicated by colour alone: pair colour with position, a frame,
  or text.

---

## Welcome / Profile shell

The first thing anyone sees, before there is a table to sit at.

**Welcome** (`platform/components/Welcome.tsx`) is brand and atmosphere
first, never a form - one lamp, the wordmark, and exactly one primary
action: `Enter Cardroom` for a first-time visitor, or `Continue as <name>`
plus a quiet `Change profile` link for a returning one. It is the true
entry point for a normal launch (an invite link bypasses it entirely - see
ARCHITECTURE.md) and reuses Home's same lamp/backdrop treatment so the two
read as the same room, just quieter, since there is nothing to choose yet.

**Player Profile** (`platform/components/PlayerProfile.tsx`) is the compact
sheet behind both first-time setup and later editing - display name and an
avatar, nothing else, per `PROJECT_STATE.md`'s note on this being local
identity, not an account system. It reuses the shared `AvatarPicker`
structurally (the grid, the radiogroup, the selection state) but repaints
its legacy gold/dark-green colours to the card-room palette with a scoped
override, rather than forking the component or changing its shared base
styles - `Landing`'s own avatar step deliberately keeps the legacy look for
now, so the override must not leak there either.

Both screens are quieter than Home - fewer elements, more restraint - but
share its typography, brass weight, spacing rhythm and lack of
glassmorphism. Do not add a second visual theme here.

---

## Arrangement screen language

The player has physically received cards and is laying them out.

- Sets are **recesses cut into the felt** — a darker inlay with an inset
  shadow — each with a small **brass nameplate**, not a heading.
- Empty places are **dashed brass outlines** sized to the exact card
  footprint, so rows do not jump as cards land.
- **Tap-first, always.** Tap to pick up, tap to swap, tap an empty space to
  place. Drag may be added but must never be required.
- Selection lifts the card and adds a brass edge — two signals.
- **One consolidated status line**, not a wall of warnings. Full validation
  detail stays available to screen readers.
- Dismissal is folded away behind a single line. Important but exceptional; it
  must not compete with Confirm.

---

## Result screens

**RoundSummary.** The round winner reads first; detail sits underneath. Sets
are shallow felt inlays echoing the arrangement trays. Winners carry a brass
frame *and* the word "won". Scrolls internally with a fixed action rail so
"Next round" is always reachable.

**WinnerScreen.** Celebration by lighting and typography, not flashing. One
warm pool of light, the winner's name in display type, final scores beneath.
Confetti is kept but restrained and must be `pointer-events: none`.

Neither should look like a spreadsheet or a jackpot.

---

## Motion

- `--ease-deal` for cards travelling, `--ease-settle` for arrivals,
  `--ease-smooth` for state changes.
- Dealing is one card at a time round the table, dealer first, with small
  deterministic jitter. Brisk — a full Hazari deal finishes under four seconds.
- Play-travel is a short glide with a slight settle. No arcs, no flourishes.
- Prefer CSS transforms and opacity so animation stays on the compositor.
- Everything must degrade cleanly under `prefers-reduced-motion`.

---

## Multi-game shell and navigation

The Card Room is the product; no playable game is presented as the default or
"flagship" in the player-facing selector.

- **Cold launch:** Welcome → Profile when needed → The Card Room.
- **Game selector:** no game pre-selected. Hazari and Kitti have equal visual
  weight. Teen Patti and Poker may be shown as polished **Coming Soon** entries,
  but they must not expose dead/fake Play or Create controls.
- **Contextual actions:** before selection, invite the player to choose a table;
  after selecting a playable game, show its Play/Create actions; after selecting
  Coming Soon, show explanation only.
- **Deliberate table exit:** returns to The Card Room, not all the way out through
  Welcome. Welcome remains the building entrance, not a punishment for leaving a
  table.
- **Active-seat peek/return:** if the player is still connected to a room, show a
  premium live-seat pass with game + room identity and one obvious Return action.
- **Invite links:** use a neutral Card Room invitation screen and identify the
  invited game. Shared/native invite URLs must be public, never a local WebView
  origin.

## Shared support and transient screens

Loading, reconnect, offline/error, Settings, Rules, Stats, History, confirmed-hand
waiting and similar utility states are part of the premium product. They must not
fall back to a legacy green/glass/browser-tool visual language.

- Use the same opaque room/wood/brass materials as the main shell; no
  glassmorphism/backdrop-filter utility panels.
- Use consistent vector chrome for Close, Back, Settings, Voice, Chat, Rules,
  Stats and History. Emoji are content (reactions), not navigation icons.
- Player-facing copy says **The Card Room** consistently. Avoid web-deployment
  language such as "landing page", implementation variable names, or browser
  alerts.
- Web install/update prompts are secondary shell UI and must never cover a live
  room. Native builds must not ask the player to install or refresh a PWA.
- The 44×44 minimum touch-target rule applies equally to banners, modal chrome
  and support screens, not only gameplay.



## Player identity / avatars

Avatar choices are compact seat identities, not profile photos. The picker uses
a curated Unicode/emoji set shared by server and client so the same identity
works in browser, Android and iPhone Safari without image downloads. Release 1
expands the set with restrained animal/symbol identities such as panther, eagle,
wolf, dragon, owl, stallion, bull, fox, diamond, shield and spade. Picker
targets remain at least 44×44px; seat rendering stays a small brass medallion.
