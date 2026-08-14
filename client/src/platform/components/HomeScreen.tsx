import { useState } from 'react';
import { useGame, getStoredSessionRoomCode } from '../../lib/GameStore';
import { Home } from './Home';
import { Landing } from '../../components/Lobby/Landing';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getSavedIdentity } from '../../lib/identity';
import type { GameId } from '../../game/types';

function inviteCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('join');
  return raw ? raw.toUpperCase() : null;
}

/**
 * Entry point to the app.
 *
 * Delegates to the existing Landing flow in the two cases it already handles
 * well - a first-time player who has no saved name yet, and someone arriving
 * through a shared invite link - and otherwise shows the new Home screen.
 *
 * Keeping Landing for those paths rather than reimplementing them preserves
 * the avatar picker, the ?join= link handling and the table browser, none of
 * which were part of this block's redesign.
 */
export function HomeScreen() {
  const { createRoom, joinRoom, quickMatch, roomError } = useGame();
  const [identity, setIdentity] = useState(() => getSavedIdentity());
  const [editingName, setEditingName] = useState(false);
  const [busy, setBusy] = useState(false);

  const inviteCode = inviteCodeFromUrl();
  const arrivedViaInvite = inviteCode !== null;

  // A person can already hold a valid reconnect token for the exact room an
  // invite link points at - most commonly by opening their own share link,
  // or reopening a link they'd already used, while GameStore's own
  // reconnect-on-connect is still in flight (this component is only
  // rendered at all while `room` is still null - see App.tsx). If the Join
  // flow below ran anyway, it would create a brand-new player rather than
  // resuming the existing one, leaving a stale duplicate seat behind once
  // the real reconnect also lands. Detect that case and wait for the
  // already-in-flight reconnect instead of offering a redundant Join.
  const alreadyHoldsInvitedRoom = arrivedViaInvite && getStoredSessionRoomCode() === inviteCode;

  if (alreadyHoldsInvitedRoom) {
    return (
      <div className="waiting-screen">
        <LoadingSpinner message="Rejoining your table…" />
      </div>
    );
  }

  // No saved identity, mid-edit, or following a genuinely new invite link:
  // the existing Landing flow already covers all three properly.
  if (!identity || editingName || arrivedViaInvite) {
    return (
      <Landing
        onIdentitySaved={() => {
          setIdentity(getSavedIdentity());
          setEditingName(false);
        }}
      />
    );
  }

  const avatar = identity.avatar;

  async function run(action: () => Promise<unknown>) {
    if (busy) return; // guards against a double tap before the ack arrives
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Home
      playerName={identity.name}
      busy={busy}
      error={roomError}
      onEditName={() => setEditingName(true)}
      onPlay={(game: GameId) => run(() => quickMatch(identity!.name, avatar, game))}
      onCreateTable={(game: GameId) => run(() => createRoom(identity!.name, avatar, game))}
      onJoinTable={(code: string) => run(() => joinRoom(code, identity!.name, avatar))}
    />
  );
}
