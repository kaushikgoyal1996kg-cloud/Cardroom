# Final four-game release audit — 2026-08-18

Target: one Card Room release with Hazari, Kitti, Teen Patti and Poker playable.
The production deployment remains untouched during this audit.

## Dependency-light engine and lifecycle results

- Hazari: 25 complete random games / 200+ rounds in the latest run; 52-card uniqueness and 360-point round invariant held; max-seat (4) path passed.
- Kitti: 12 complete 5-seat matches / 120+ rounds in the latest run; sudden-death/three-winner decider exercised repeatedly; hidden hands remained outside live public state before play.
- Teen Patti: all 22 runtime variants exercised at 9 seats; 484-round stress run passed; K/Q/J Little direct variants included; private/public sequence coherence and Two-Reference role privacy passed.
- Poker: Texas, PLO4, PLO5, PLO6 and 6+ Short Deck exercised at their configured maximum seat caps; 250-hand stress run passed; fold-down hand history did not reveal hole cards.
- Lifecycle scenarios passed: Teen Patti Dealer Choice handoff, Friendly Assist reconnect/clear, Poker Dealer Choice handoff, completed-hand dealer leave/button advance.
- Focused engine/session TypeScript compile passed with no external package types.
- Static parser audit: all TS/TSX/MTS/CTS sources parsed with zero syntax diagnostics; all client CSS files had balanced structure.

## Release-prep issues found and corrected in this audit

1. Poker client variant metadata still marked every Poker variant `runtimeReady: false` even though the hidden runtime is implemented and audited. Corrected to `true` while keeping Poker itself registry-locked.
2. Android CI artifact/job naming and Android release instructions still described a Hazari + Kitti-only APK. Updated to the four-game release target and expanded first-device QA to Teen Patti and Poker.

## Mandatory gate still outstanding

The current execution environment does not have a complete npm dependency tree. The normal package gate therefore could not run here:

- server `npm test`
- server production TypeScript build
- client `npm test`
- client production Vite/TypeScript build
- Capacitor/Gradle Android APK build

The attempted server package commands failed because Vitest and multiple `@types/*` packages are absent, not because a game regression failed. The GitHub Actions APK workflow remains the authoritative complete dependency/build gate.

## Unlock policy

Teen Patti and Poker remain `networkPlayable: false` until the complete package/CI gate passes. After it passes, both server and client release registries must be switched to playable together, their Coming Soon expectations updated, and the four-game APK must pass real-device QA before production deployment.
