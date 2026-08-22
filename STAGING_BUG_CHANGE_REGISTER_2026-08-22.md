# The Card Room — staging bug/change register

Authoritative development line: `staging-bugfix-batch-2-10-2026-08-19`, based on `ac31cac`.
Production `release-1.5.1` is out of scope and must remain untouched.

Status key: **Open** · **Implemented / automated QA passed** · **Closed / preserved** · **Device QA required**.

| No. | Severity | Item | Current staging status |
|---:|---|---|---|
| BUG 1 | Release blocker | Voice/Call reliability | Implemented: diagnostics, TURN/STUN reporting, queued early ICE candidates, autoplay-block recovery, listen-only spectator voice, host-policy revocation, and dedicated client tests. Device QA is still required before release. |
| BUG 2 | High | Explicit Leave could leave/revive a ghost seat | Closed / preserved. Explicit Leave invalidates the old reconnect token; transport loss remains reconnectable. |
| BUG 3 | High | Hazari local name/points could disappear | Closed / preserved. Keep in multi-round/reconnect device QA. |
| BUG 4 | High | Teen Patti Sideshow was effectively compulsory | Closed / preserved. Sideshow remains optional and normal Chaal remains available. |
| BUG 10 | High | Two-Reference Joker selected too early / without confirmation | Closed / preserved. Choice appears only at comparison, shows exact jokers, and requires separate Confirm. |
| CHANGE 11 | High | Inactivity grace | Implemented. Exactly 90 seconds maximum; never acts before the full threshold. |
| CHANGE 12 | High | Hazari/Kitti inactivity continuity | Implemented. A disconnected human becomes bot-controlled after grace and reclaims the same seat only at a safe round boundary. |
| CHANGE 13 | High | Teen Patti/Poker inactivity continuity | Implemented. The seat sits out future rounds/hands and resumes at the next safe boundary after return. |
| CHANGE 14 | High | Host removal of inactive seats | Implemented. Host may permanently remove/convert an eligible inactive seat after threshold without reviving its token. |
| CHANGE 15 | High | Inactive host authority | Implemented. Authority transfers to a connected eligible human without changing reconnect or Explicit Leave semantics. |
| CHANGE 16 | High | Live Tables and spectators | Implemented. Live/private visibility, running-table Watch, public-state-only spectators, spectator voice policy, and live list refresh. |
| CHANGE 17 | High | Join a running table | Implemented. Teen Patti joins next round; Poker joins next hand; in all four games a spectator may reserve an ordinary bot seat and takes control only at the next safe boundary. Temporary bots protecting inactive humans cannot be claimed. |
| CHANGE 18 | High | Bots in Teen Patti and Poker | Implemented. Lobby bots auto-accept setup and use server-authoritative legal variant/discard/betting actions. |
| CHANGE 19 | High | Kitti Round Boot mode | Implemented. Optional alternative to the unchanged 10-round match: each seat pays the agreed virtual boot every deal; a 1–1–1 hand split carries the pot and adds another boot from every seat; the first player to win two hands in one deal takes the accumulated pot. |

## Preserved release contracts

- Mutual Show with 3+ active players.
- Running Teen Patti join-next-round behavior and dealer-choice privacy.
- Teen Patti 4/5-card mobile layout and automatic next round.
- Poker automatic next hand and private hole cards.
- Hazari/Kitti dealer order, scoring, arrangement rules and auto-next-round.
- Kitti 10-round match, tied-leader sudden death and three-winner decider remain unchanged in **10-round match** mode.
- All play-money values are virtual room-session accounting only: no deposits, withdrawals or cash value.

## Release gate

Automated tests, strict zero-skip/todo accounting, builds, `git diff --check`, staging CI/deploy verification and real-device voice/reconnect/mobile QA are all required. A green automated run does not by itself close BUG 1 on real devices.
