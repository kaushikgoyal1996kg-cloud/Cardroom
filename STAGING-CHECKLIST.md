# Staging checklist

Almost nothing in this file has been verified on a real device yet — it is
still mostly a script to run, not a report of work already done.

**First-pass QA update:** the owner opened the deployed staging build
(`https://cardroom-staging.netlify.app`) on one real Android phone, in
portrait and landscape, and reviewed Home, Lobby, Arrangement and the Hazari
Table screens for layout/visual issues. That is reflected below by ticking
the one item it directly confirms. It was **not** a run through this whole
checklist — no iPhone, no reconnection drills, no full match, no double-tap
testing, no chat/voice, no console check. Everything else below is still
open. See `SESSION_CHANGELOG.md` for the dated entry.

Automated tests cover the game logic underneath these flows. What they cannot
cover is real phones, real networks, and real fingers.

---

## What you need

- two phones minimum, four is better
- at least one Android Chrome and one iPhone Safari
- willingness to be annoying with the aeroplane-mode switch

---

## 1. Basics

- [x] Home screen opens on the staging address — confirmed, first-pass Android QA
- [ ] The three games are readable without zooming
- [ ] Name entry works, and the name is still there after closing and reopening
- [ ] Changing the name afterwards works

## 2. Getting into a room

- [ ] **Create table** produces a short room code
- [ ] **Copy room code** actually copies
- [ ] **Copy invite link** actually copies
- [ ] The phone's share sheet opens and WhatsApp appears in it
- [ ] Sending the link over WhatsApp and tapping it opens the game directly
- [ ] The link works for someone who has never opened the app before
- [ ] Typing the code in by hand works
- [ ] A wrong code gives a readable message, not a technical error
- [ ] A code for a room that has closed says so clearly

## 3. Hazari — a full game

- [ ] Four players can join one room
- [ ] Game starts only when everyone is ready
- [ ] Cards visibly deal out from the deck, one at a time
- [ ] Dealing does not feel slow
- [ ] Each player sees 13 cards, and only their own
- [ ] Arrangement screen is usable with a thumb, no precision dragging needed
- [ ] Invalid arrangements are explained clearly
- [ ] Confirm cannot be tapped twice
- [ ] After confirming you see who is still arranging, by name
- [ ] Cards visibly travel to the centre when played
- [ ] The winning set is clearly marked
- [ ] Scores match what you would work out by hand
- [ ] Dealer button moves to the next player between rounds
- [ ] A complete match runs to 1000 without anything getting stuck
- [ ] Play again works without making a new room

## 4. Losing connection — the important part

Do these deliberately. This is where multiplayer games actually fail.

- [ ] Turn Wi-Fi off mid-game → a clear "Reconnecting" message appears
- [ ] Turn it back on → you rejoin with your cards, score and seat intact
- [ ] Your arranged groups survive
- [ ] Nobody else's hidden cards are ever visible
- [ ] Refresh the page mid-game → you rejoin correctly
- [ ] Lock the phone for two minutes, unlock → you rejoin correctly
- [ ] Switch from Wi-Fi to mobile data → you rejoin correctly
- [ ] Force-close the browser and reopen → you rejoin correctly
- [ ] The host disconnecting does not end everyone else's game
- [ ] Other players can see who is disconnected, marked by text not just colour
- [ ] No raw technical errors appear anywhere

## 5. Double taps

Tap each of these twice, fast:

- [ ] Join
- [ ] Create room
- [ ] Start game
- [ ] Confirm arrangement
- [ ] Play cards
- [ ] Next round
- [ ] Play again

Nothing should happen twice.

## 6. Phones specifically

First-pass Android QA found confirmed layout issues on Home, Lobby,
Arrangement and Table (portrait and landscape) — see `SESSION_CHANGELOG.md`.
That is why the items below stay unticked rather than ticked-with-caveats:
the screens were reachable, but not yet reliably usable at every size.

- [ ] Works on the narrowest phone you have (ideally 320px)
- [ ] Works on a large phone
- [ ] Portrait and landscape both usable
- [ ] Nothing hidden behind a notch or the home bar
- [ ] Nothing hidden behind the browser's bottom bar
- [ ] Opening the keyboard for chat does not cover the game
- [ ] Rotating mid-game does not break the layout
- [ ] The page does not scroll around while handling cards
- [ ] Cards are readable without squinting

## 7. Sound and feel

- [ ] Deal, play and win sounds fire at the right moments
- [ ] Mute works and stays muted
- [ ] Game is fully playable with sound off
- [ ] Turning on "reduce motion" in phone settings removes the animations but
      keeps the game working

## 8. Chat

- [ ] Text chat works both ways
- [ ] The chat panel never covers your hand or the play button
- [ ] Voice notes record and play back
- [ ] A long voice note does not break anything

## 9. Everything at once

- [ ] Two separate rooms can run simultaneously without interfering
- [ ] Restarting the backend while a game is running behaves sensibly
- [ ] Open the browser console and confirm there are no red errors

## 10. Install / PWA

Added 2026-08-14, entirely unverified on a real device yet — see
`SESSION_CHANGELOG.md`.

- [ ] Android Chrome: the install banner appears and "Install App" actually
      installs it (icon on the home screen, opens standalone, no browser chrome)
- [ ] iOS Safari: Share → "Add to Home Screen" shows the Cardroom icon and
      name, and opens standalone
- [ ] The installed icon looks right at home-screen size (no cropping — this
      is what "maskable" is supposed to guarantee, worth actually checking)
- [ ] Rotating the phone while the installed app is open is NOT locked to
      portrait
- [ ] Turn on aeroplane mode after the app has loaded once: a branded
      "offline" page appears on reload, not a browser error page or a blank
      screen
- [ ] Deploy a trivial change to staging, then reopen the already-installed
      app: the update banner appears, and does NOT appear mid-hand /
      mid-arrangement uninvited
- [ ] Tapping "Refresh" on the update banner mid-lobby (not mid-hand) works
      and does not lose the player's seat
- [ ] The service worker never visibly interferes with reconnection — do a
      normal reconnect drill (section 4) with the app installed and confirm
      it behaves identically to the browser tab version

---

## Before you switch the family over

Move to production only when:

1. A complete four-player Hazari match has been played on real phones
2. Every reconnection test above passed
3. Scores were checked by hand at least once and matched
4. Nothing in the console is red

**Do not delete the old app until this has all passed.** See `MIGRATION.md`.
