# Android test release — four-game Card Room

This is the four-game native release track for **Hazari, Kitti, Teen Patti and Poker**. Teen Patti and Poker remain registry-locked in the working source until the complete server/client CI gate is green; the release APK must not be produced from an unlocked commit that has not passed that gate. No game rule changes are permitted as part of the native wrapper.

## Architecture

The APK bundles the Vite `dist/` frontend through Capacitor. It does **not** load the Netlify site inside a remote WebView. Multiplayer, chat and voice still connect to the configured HTTPS Render backend through `VITE_SERVER_URL`.

Native application id: `com.thecardroom.private`

## One-time prerequisites

From `client/`, install dependencies after this branch is on a machine with npm access. This updates `package-lock.json`, which this build environment cannot currently do because its npm registry connection is blocked.

```bash
npm install
npm run android:init
```

`android:init` creates the Capacitor Android project, idempotently adds the microphone/audio permissions required by voice calls and voice notes, and generates Android launcher/splash resources from `client/assets/icon.png` using the Card Room dark background. `android:sync` re-checks the microphone/audio permissions on every native sync.

Android treats `RECORD_AUDIO` as a dangerous permission, so it must also be granted at runtime. Capacitor's WebChromeClient handles WebView media permission requests; this must be verified on the real APK before voice is considered passed.

## Backend CORS — required for the APK

Capacitor serves bundled Android content from `https://localhost` by default in this configuration. Add that origin to the staging Render service's existing `ALLOWED_ORIGINS`, for example:

```text
https://cardroom-staging.netlify.app,https://localhost
```

Do not replace the Netlify origin; add the native origin alongside it.

## Build a debug APK

### Easiest route: GitHub Actions (no Android Studio required)

This repository includes `.github/workflows/build-android-test-apk.yml`. It is
manual-only: it does not publish anything and does not run just because code was
pushed. In GitHub open **Actions → Build Android Test APK → Run workflow**.

The job installs dependencies, runs both server and client test suites, runs both
builds, generates the Capacitor Android project, builds a debug APK, creates a
SHA-256 checksum, and uploads both as a private workflow artifact named
`cardroom-four-games-debug-apk`. If tests or builds fail, no APK artifact is
produced. The artifact is retained for 14 days.

The workflow currently targets the documented staging backend:
`https://cardroom-staging-server.onrender.com`. The backend CORS change above is
still required before the installed APK can connect.

For stronger voice connectivity on restrictive mobile networks, TURN is now
configured **only on the Render backend** with `METERED_DOMAIN` and
`METERED_SECRET_KEY`. The APK workflow intentionally contains no TURN username,
password or account secret. The app requests short-lived ICE credentials from
the Card Room backend when the player joins voice; if TURN is unavailable it
falls back to direct/STUN voice.

The workflow also sets `VITE_PUBLIC_APP_URL` to the public staging Card Room URL.
This is mandatory for native sharing: Capacitor's bundled web origin is
`https://localhost`, which must **never** be sent to another player as an invite.
`buildInviteUrl()` uses the configured public address in native builds and refuses
localhost/loopback invite URLs.

### Local route

Set `VITE_SERVER_URL` to the staging Render HTTPS URL, then:

```bash
cd client
npm run android:debug
```

Expected APK location after Gradle succeeds:

```text
client/android/app/build/outputs/apk/debug/app-debug.apk
```

## First-device gate

Before sharing broadly, verify on one Android phone:

1. Fresh install and upgrade-over-existing-install.
2. Welcome/Profile → game selector shows **Hazari, Kitti, Teen Patti and Poker all playable** in the release candidate.
3. Hazari full room create/join/start/deal/arrange/play/result.
4. Kitti 2-player, 3-player and 5-player create/join/start/arrange/play/result.
5. Kitti exact-tie later-throw behavior and three-winner decider using deterministic staging support if needed.
6. Teen Patti: create/join/start and exercise Classic plus representative joker, five-card discard, Assume the Third, Closest to N, K Little/Q Little/J Little, Dealer Choice and Friendly Assist paths.
7. Poker: Texas, PLO4, PLO5, PLO6 and 6+ Short Deck; exercise single-game and Variant Table/Dealer Choice paths, side pots and showdown.
8. Background app for 10–30 seconds during each game, return, and confirm reconnect does not replay dealing/results or expose stale private cards/actions.
9. Voice call: microphone permission prompt, join, mute/unmute, leave, rejoin.
10. Voice note record/send/play.
11. Android hardware/gesture Back from Welcome, Card Room, lobby, active table and result screens; guarded room exits must show the existing confirmation rather than closing the app.
12. Portrait ↔ landscape rotation at Welcome, lobby, arrangement and active table.
13. Bug 5 result/reveal scrolling with physical swipes.
14. Bug 6 dismissal: zero points, same room survives, next round deals normally.
15. Confirm the installed launcher icon and startup/splash treatment are **The Card Room**, not a Capacitor template or Hazari-only mark.
16. From the installed APK, tap **Share invite** and open the received link on a second phone/browser. It must point at the configured public Card Room URL, never `https://localhost`.
17. Back/reopen/reconnect a player and confirm the lobby restores the same single seat as **Online** rather than creating a duplicate Waiting row.
18. Deliberately leave a lobby/table and confirm the app returns directly to **The Card Room** selector once; a true cold launch must still begin at Welcome.
19. While a room is live, confirm no PWA install or service-worker update banner can cover the table.

Production remains blocked until this test track passes.
