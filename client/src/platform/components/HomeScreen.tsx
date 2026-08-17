import { useRef, useState } from 'react';
import { useGame, getStoredSessionRoomCode } from '../../lib/GameStore';
import { Home } from './Home';
import { Welcome } from './Welcome';
import { PlayerProfile } from './PlayerProfile';
import { Landing } from '../../components/Lobby/Landing';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getSavedIdentity, type SavedIdentity } from '../../lib/identity';
import { useBackGuard } from '../../lib/useBackGuard';
import { consumeReturnToCardRoom } from '../../lib/navigation';
import type { GameId } from '../../game/types';

function inviteCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('join');
  return raw ? raw.toUpperCase() : null;
}

type EntryStage = 'welcome' | 'profile' | 'cardroom';

/**
 * Entry point to the app.
 *
 * Two families of screen, kept deliberately separate:
 *
 * 1. Invite-link arrivals (`?join=...`) and the "reconnect already in
 *    flight" wait state - a dedicated Card Room invitation flow plus the
 *    authoritative reconnect wait. They bypass Welcome so a shared table link
 *    still takes the player straight to the invited room.
 * 2. A normal (non-invite) launch: Welcome (the true root) -> Player
 *    Profile (first-time setup, or editing) -> THE CARD ROOM. This is the
 *    Welcome/Profile shell described in DESIGN_SYSTEM.md.
 *
 * Both families share one `useBackGuard` call so Android/PWA Back has a
 * consistent, single owner while this component is mounted - see
 * ARCHITECTURE.md.
 */
export function HomeScreen() {
  const { createRoom, joinRoom, quickMatch, roomError } = useGame();
  const [identity, setIdentity] = useState(() => getSavedIdentity());
  const [entryStage, setEntryStage] = useState<EntryStage>(() =>
    consumeReturnToCardRoom() && getSavedIdentity() ? 'cardroom' : 'welcome'
  );
  const [busy, setBusy] = useState(false);

  // Where "profile" was opened FROM, so Back/Cancel returns there rather
  // than always bouncing to Welcome - reachable from both Welcome itself
  // (first-time setup, or "Change profile") and from THE CARD ROOM's own
  // header profile control (Part 6 of the brief this shipped against).
  const profileOriginRef = useRef<'welcome' | 'cardroom'>('welcome');

  const inviteCode = inviteCodeFromUrl();
  const arrivedViaInvite = inviteCode !== null;

  // If this device already owns a reconnect token, restoring that seat takes
  // priority over EVERY new-room path - not only an invite for the same room.
  // Otherwise a normal Back/reload/cold-start can briefly render Home while
  // `room:reconnect` is still in flight; tapping Play/Create/Join in that
  // window creates a second seat and overwrites the only token that could
  // reclaim the first one. The orphan then sits in the lobby as Waiting /
  // Disconnected until somebody explicitly removes it.
  //
  // Wait for the authoritative reconnect result first. A definitive failure
  // clears the stored token in GameStore, after which this component re-renders
  // and the normal Welcome / invite flow becomes available again.
  const storedSessionRoomCode = getStoredSessionRoomCode();
  const restoringStoredSession = storedSessionRoomCode !== null;

  // One key per distinct screen this component can show, for both the
  // back-guard and (matching App.tsx's existing pattern) as a potential
  // future `data-screen` value. Invite-related keys are intentionally
  // treated as root-like below - they have no in-app screen before them to
  // return to, since Welcome is skipped entirely for an invite arrival.
  const screenKey: string = restoringStoredSession
    ? 'session-restore-wait'
    : arrivedViaInvite
      ? 'invite-landing'
      : entryStage;

  useBackGuard({
    screenKey,
    onBack: () => {
      switch (screenKey) {
        case 'session-restore-wait':
        case 'invite-landing':
        case 'welcome':
          return 'root';
        case 'profile':
          setEntryStage(profileOriginRef.current);
          return 'handled';
        case 'cardroom':
          setEntryStage('welcome');
          return 'handled';
        default:
          return 'root';
      }
    },
  });

  function openProfile(origin: 'welcome' | 'cardroom') {
    profileOriginRef.current = origin;
    setEntryStage('profile');
  }

  async function run(action: () => Promise<unknown>) {
    if (busy) return; // guards against a double tap before the ack arrives
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  let screen: React.ReactNode;

  if (restoringStoredSession) {
    screen = (
      <div className="waiting-screen">
        <LoadingSpinner message={`Rejoining your table ${storedSessionRoomCode}…`} />
      </div>
    );
  } else if (arrivedViaInvite) {
    // A genuinely new invite link: dedicated Card Room invitation arrival,
    // with saved-identity reuse when possible.
    screen = (
      <Landing
        onIdentitySaved={() => {
          setIdentity(getSavedIdentity());
        }}
      />
    );
  } else if (entryStage === 'welcome') {
    screen = (
      <Welcome
        identity={identity}
        onEnter={() => openProfile('welcome')}
        onContinueAs={() => setEntryStage('cardroom')}
        onChangeProfile={() => openProfile('welcome')}
      />
    );
  } else if (entryStage === 'profile') {
    screen = (
      <PlayerProfile
        initial={identity}
        onSaved={(saved: SavedIdentity) => {
          setIdentity(saved);
          setEntryStage('cardroom');
        }}
        onCancel={() => setEntryStage(profileOriginRef.current)}
      />
    );
  } else {
    // entryStage === 'cardroom'. identity is guaranteed set by this point:
    // the only paths into 'cardroom' are Welcome's "Continue as X" (which
    // only renders when identity exists) or PlayerProfile's onSaved (which
    // always provides one).
    const avatar = identity!.avatar;
    screen = (
      <Home
        playerName={identity!.name}
        playerAvatar={identity!.avatar}
        busy={busy}
        error={roomError}
        onEditName={() => openProfile('cardroom')}
        onPlay={(game: GameId) => run(() => quickMatch(identity!.name, avatar, game))}
        onCreateTable={(game: GameId) => run(() => createRoom(identity!.name, avatar, game))}
        onJoinTable={(code: string) => run(() => joinRoom(code, identity!.name, avatar))}
      />
    );
  }

  return screen;
}
