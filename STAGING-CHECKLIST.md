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

**Fourth-pass QA update — 2026-08-16 (later).** Bug 5's diagnosis was
corrected: real-device feedback clarified that the actual broken screen is
the **per-set result sheet** shown after Set 1, 2, or 3 (and, structurally,
Set 4 too — it's the same shared component) — NOT RoundSummary, which the
previous two rounds had been fixing and which was, per this same feedback,
never actually broken. See `SESSION_CHANGELOG.md`'s "Bug 5 diagnosis
corrected" entry for the full root-cause reasoning. **Bug 5 is NOT
real-device verified after this round either.** Given this bug's history —
two prior fixes to the wrong screen, each confirmed clean by a full test
suite at the time — do not mark it passed from a green test suite alone.
Redeploy to staging and specifically:

- Play a hand in a short **landscape** viewport. After **Set 1** completes,
  the per-set result sheet appears (shows all four hands with cards, the
  winner, and points) — confirm **physical touch-swipe scrolls it** and
  every hand plus the "Continue" button is reachable. Repeat after **Set 2**
  and **Set 3**.
- Confirm **Set 4**'s own result sheet behaves the same way, and that the
  round-statistics screen (RoundSummary) that follows it still scrolls
  correctly and was not affected by this change.
- Bugs 1-4 need no re-check this round (their files were not touched), but
  a quick sanity pass on Bug 4 (right-seat names) alongside this costs
  little if convenient.

---

## Prior QA rounds

**Third-pass QA update — 2026-08-16.** Bugs 1 (backgrounding), 2 (Leave
Table), and 3 (Arrangement FAB vs Dealt) are now **owner-verified real-device
PASS** — confirmed working on the installed Android PWA. Neither their code
nor tests were touched this round (confirmed by hash diff). **Bugs 4 (side-
seat names) and 5 (end-of-hand result-screen scroll) were each CONFIRMED
STILL FAILING** on this same retest, with more specific detail than before
(Bug 4: "Nawab" specifically, right-side, portrait; Bug 5: "physical vertical
swiping does NOT scroll the result content" at all, ruling out the previous
session's page-scroll redesign as much as the original nested-scroll shell).
Both were re-derived and fixed again — see `SESSION_CHANGELOG.md`'s "Third
real-device retest" entry for the full root-cause reasoning. **Neither Bug 4
nor Bug 5 is real-device verified after this round.** Bug 5 in particular has
now failed real-device testing on TWO PRIOR STRUCTURES despite a clean test
suite each time — treat a clean suite as necessary, not sufficient, evidence
for this one specifically. Redeploy to staging and re-check:

- Hazari Table, portrait specifically (the retest's own emphasis — landscape
  was reported improved): the right-side seat's name ("Nawab" or similar,
  5-7 ordinary characters) must display IN FULL, not "Na…" — check with both
  a human-named and a Bot-labelled right seat if possible; a very long name
  (7+ characters) on a Bot-labelled seat at a narrow phone width may still
  ellipsize by design (documented, not a regression) — see `Seat.test.tsx`
- The screen shown right after a hand/set ends (RoundSummary) AND the final
  match-winner screen (WinnerScreen), in a short landscape viewport:
  **physical touch-swipe must actually scroll the result content** — this is
  the specific thing that did not work at all in the previous structure
  despite the CSS looking correct. The shell's height is now driven by a
  JS-measured viewport value, not CSS `dvh` alone — worth checking this
  screen specifically right after rotating the phone, since that is when a
  stale/incorrect measurement would be most likely to show up
- Confirm Bugs 1-3 still pass after this redeploy too, as a sanity check
  that nothing in this round's changes affected them (none of their files
  were touched, but a real-device pass costs little to reconfirm)

---

## Prior QA rounds

**Second-pass QA update — 2026-08-15.** The five items below were retested
by the owner on real Android PWA staging. Bugs 1, 2, 4 and 5 were each
CONFIRMED STILL FAILING despite the previous session's fixes and full test
suite passing — the previous session's conclusions on those four were each
wrong or incomplete in specific ways, now corrected; see
`SESSION_CHANGELOG.md`'s "Second real-device retest" entry for the full
root-cause reasoning on each. Bug 3 was re-verified only (no change).

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

## 11. Welcome, Profile & Identity

Added 2026-08-15, entirely unverified on a real device yet.

- [ ] First launch (no saved profile) shows the Welcome screen - brand and
      one button, not a name/avatar form straight away
- [ ] Tapping **Enter Cardroom** opens the compact profile sheet, not
      anything resembling account registration
- [ ] Leaving the name blank and tapping Continue shows a clear message,
      not a silent no-op
- [ ] Completing the profile enters THE CARD ROOM directly
- [ ] Close the app fully (swipe away / force-stop), relaunch: Welcome now
      shows the saved avatar and name with **Continue as `<name>`**, not
      the setup sheet again
- [ ] **Continue as `<name>`** enters THE CARD ROOM in one tap
- [ ] **Change profile** (from Welcome, and from the small profile control
      in THE CARD ROOM's header) opens the sheet pre-filled with the
      current name/avatar
- [ ] Editing the name/avatar and saving is reflected immediately in THE
      CARD ROOM header and the next time the room is entered
- [ ] Editing profile does **not** change anything about a room already in
      progress, and is not reachable at all while inside one (no profile
      control appears in the Lobby or at the table)

## 12. Android/PWA Back navigation

Added 2026-08-15, entirely unverified on a real device yet. Test in both a
normal Chrome tab and the installed standalone PWA - they can differ.

- [ ] Back from THE CARD ROOM (game selector) returns to Welcome, not the
      previous website
- [ ] Back from Welcome exits the app/tab normally - it is the true root,
      it must not trap you
- [ ] Back from the profile sheet returns to wherever it was opened from
      (Welcome, or THE CARD ROOM if opened from its header control), not
      always to Welcome
- [ ] Back from the Room Lobby shows **Leave this room? Stay / Leave** -
      it does not close the app or silently leave
- [ ] **Stay** dismisses the dialog with nothing else happening
- [ ] **Leave** actually leaves, the same as the Lobby's own Leave button
- [ ] Back during Arrangement shows a confirmation (with the computer-
      takeover wording) rather than silently abandoning the round or
      closing the app
- [ ] Back during an active hand shows the same guarded confirmation, and
      confirming leaves the same way **Leave Table** in Settings does
- [ ] Back on Round Summary or the Winner screen does nothing unexpected -
      no dialog, no exit, no lost game - the screen's own buttons remain
      the way forward
- [ ] Rapid repeated Back presses never produce two dialogs, a duplicate
      leave, or a duplicate room join
- [ ] None of the above create a second/duplicate player in the room (see
      `HANDOFF.md`'s existing note on duplicate-player causes - this is a
      new potential source worth specifically ruling out)
- [ ] The normal browser Back button (not just the Android system gesture)
      behaves the same way when playing in an ordinary Chrome tab

---


## 13. Combined Teen Patti + Poker pre-enable gate

Added for the post-1.5.1 combined update. Teen Patti and Poker must remain
`networkPlayable: false` until every applicable item below is green on the
actual release candidate.

- [ ] Teen Patti: create/join private table with 2, 5 and 9 real seats; no cross-game room/state leakage
- [ ] Teen Patti: Dealer Choice, Fixed Rotation and dedicated Surprise Me all use only the host-approved variant pool
- [ ] Teen Patti: delayed/double-tapped Dealer Choice and **Deal next round** commands are rejected as stale and do not deduct boot/deal twice
- [ ] Teen Patti: Mutual Show with 3+ players pauses the exact turn, unanimous accept reveals all active hands, decline resumes the same turn, exact best ties split the pot
- [ ] Teen Patti: Revolving Joker replaces (does not accumulate) joker references after manual pack, sideshow loss and leave-as-pack
- [ ] Teen Patti: 5-card rounds retain all five cards, equal-ranked physical discard choice belongs to the player, blind selection stays facedown, and sideshow/showdown reveals all five while ranking only the active three
- [ ] Teen Patti: Friendly Assist reveals nothing before consent, permits one coached target per folded player per hand, suggestions never auto-act, revoke works, and reconnect restores only valid consent
- [ ] Teen Patti: Round History and Table Stats remain correct during the next live round and after reconnect
- [ ] Poker: Texas, PLO4, PLO5, PLO6 and Short Deck each complete multiple hands with correct seat cap, blinds/ante, board, pot/side-pot and showdown behavior
- [ ] Poker: Dealer Choice waits before forced bets/cards; delayed chooser and **Deal next hand** commands are rejected as stale
- [ ] Poker: fold-down hand history exposes no private hole cards; showdown history exposes only legitimately revealed cards
- [ ] Poker: “Your seat is still connected” → **Leave & settle** uses Poker settlement even when detailed Poker state has not rehydrated yet
- [ ] Teen Patti/Poker: a settled/departed participant still has a human-readable name in older history rows after reconnect
- [ ] Teen Patti/Poker: current-table Stats show the correct game/player balances, P/L/top-ups and cumulative rounds/hands won; never Hazari/Kitti fallback data
- [ ] Teen Patti/Poker: portrait + short landscape keep the radial utility hub, hand/action rail, Friendly Assist/errors and result panels from overlapping
- [ ] Voice/chat/TURN remain table-scoped when Hazari, Kitti, Teen Patti and Poker rooms run at the same time


## Before you switch the family over

Move to production only when:

1. A complete four-player Hazari match has been played on real phones
2. Every reconnection test above passed
3. Scores were checked by hand at least once and matched
4. Nothing in the console is red

**Do not delete the old app until this has all passed.** See `MIGRATION.md`.
