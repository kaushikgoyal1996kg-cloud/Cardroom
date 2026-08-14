import { useState } from 'react';
import { useGame } from '../../lib/GameStore';
import { Home } from './Home';
import { Landing } from '../../components/Lobby/Landing';
import { getSavedIdentity } from '../../lib/identity';
import type { GameId } from '../../game/types';

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

  const arrivedViaInvite =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('join');

  // No saved identity, mid-edit, or following an invite link: the existing
  // Landing flow already covers all three properly.
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
