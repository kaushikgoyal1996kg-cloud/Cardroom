import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import { InstallBanner } from '../InstallBanner';
import { AvatarBadge, AvatarPicker } from './AvatarPicker';
import { AVATAR_OPTIONS } from '../../game/avatars';
import { getSavedIdentity, saveIdentity } from '../../lib/identity';
import './Lobby.css';

function codeFromShareLink(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get('join') ?? '').toUpperCase();
}

function gameFromRoomCode(code: string): string {
  if (code.startsWith('KIT')) return 'Kitti';
  if (code.startsWith('HZR')) return 'Hazari';
  if (code.startsWith('TPT')) return 'Teen Patti';
  return 'Card Room';
}

export interface LandingProps {
  /** Called once the player has stored a name/avatar, so the Card Room shell
   * can pick the identity back up after the invite is accepted. */
  onIdentitySaved?: () => void;
}

/**
 * Dedicated shared-invite arrival.
 *
 * Invite links deliberately bypass the normal Welcome screen, but they must
 * still feel like the same multi-game Card Room. The room-code prefix tells
 * us which table the invitation belongs to; the server remains authoritative
 * and will reject a stale/invalid code when Join is pressed.
 */
export function Landing({ onIdentitySaved }: LandingProps = {}) {
  const { joinRoom, roomError } = useGame();
  const savedIdentity = getSavedIdentity();
  const [code] = useState(codeFromShareLink);
  const [editingIdentity, setEditingIdentity] = useState(!savedIdentity);
  const [name, setName] = useState(savedIdentity?.name ?? '');
  const [avatar, setAvatar] = useState<string>(savedIdentity?.avatar ?? AVATAR_OPTIONS[0]);
  const [busy, setBusy] = useState(false);
  const gameName = useMemo(() => gameFromRoomCode(code), [code]);

  // Once the invitation has been captured, clean it from the address bar so
  // a later refresh/bookmark does not accidentally behave like a fresh invite.
  useEffect(() => {
    if (code && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [code]);

  function rememberIdentity() {
    const saved = saveIdentity(name.trim(), avatar);
    onIdentitySaved?.();
    return saved;
  }

  async function acceptInvite() {
    if (!code || !name.trim() || busy) return;
    rememberIdentity();
    setBusy(true);
    try {
      await joinRoom(code, name.trim(), avatar);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="invite-arrival">
      <div className="invite-arrival__lamp" aria-hidden="true" />
      <section className="invite-card" aria-label={`${gameName} invitation`}>
        <div className="invite-card__seal" aria-hidden="true">
          <img src="/brand/card-room-emblem.png" alt="" />
        </div>
        <p className="invite-card__eyebrow">Private table invitation</p>
        <h1>The Card Room</h1>
        <p className="invite-card__game">{gameName}</p>

        <div className="invite-card__code-block">
          <span>Room</span>
          <strong>{code || '—'}</strong>
        </div>

        {!editingIdentity && savedIdentity ? (
          <div className="invite-card__identity">
            <div className="invite-card__avatar">
              <AvatarBadge avatar={savedIdentity.avatar} size="lg" ring />
            </div>
            <p>Joining as <strong>{savedIdentity.name}</strong></p>
            {roomError && <p className="error-text" role="alert">{roomError}</p>}
            <button className="btn btn-primary" disabled={busy || !code} onClick={acceptInvite}>
              {busy ? 'Taking your seat…' : `Join ${gameName}`}
            </button>
            <button className="invite-card__change" type="button" onClick={() => setEditingIdentity(true)}>
              Use a different player
            </button>
          </div>
        ) : (
          <div className="invite-card__profile">
            <label className="landing__field">
              <span>Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder="Enter your name"
                autoComplete="off"
              />
            </label>
            <div className="landing__field">
              <span>Choose an avatar</span>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </div>
            {roomError && <p className="error-text" role="alert">{roomError}</p>}
            <button className="btn btn-primary" disabled={busy || !code || !name.trim()} onClick={acceptInvite}>
              {busy ? 'Taking your seat…' : `Join ${gameName}`}
            </button>
            {savedIdentity && (
              <button className="invite-card__change" type="button" onClick={() => {
                setName(savedIdentity.name);
                setAvatar(savedIdentity.avatar);
                setEditingIdentity(false);
              }}>
                Back to {savedIdentity.name}
              </button>
            )}
          </div>
        )}
      </section>

      <div className="invite-arrival__install"><InstallBanner /></div>
    </main>
  );
}
