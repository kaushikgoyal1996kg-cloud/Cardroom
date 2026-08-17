import { useState } from 'react';
import { AvatarBadge, AvatarPicker } from '../../components/Lobby/AvatarPicker';
import { AVATAR_OPTIONS } from '../../game/avatars';
import { saveIdentity, type SavedIdentity } from '../../lib/identity';
import { ChromeIcon } from './ChromeIcon';
import './PlayerProfile.css';

export interface PlayerProfileProps {
  /** Existing identity when editing; null for first-time setup. */
  initial: SavedIdentity | null;
  onSaved: (identity: SavedIdentity) => void;
  onCancel: () => void;
}

/**
 * Collects only what a private card room actually needs: a display name and
 * an avatar. Not an account-registration page - see PROJECT_STATE.md and
 * Part 12 of the brief this shipped against: no email, password, phone
 * number, or date of birth, now or later without an explicit reason.
 */
export function PlayerProfile({ initial, onSaved, onCancel }: PlayerProfileProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATAR_OPTIONS[0]);
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const isValid = trimmed.length > 0;

  function handleContinue() {
    setTouched(true);
    if (!isValid) return;
    const saved = saveIdentity(trimmed, avatar);
    onSaved(saved);
  }

  return (
    <div className="player-profile">
      <div className="player-profile__sheet">
        <button type="button" className="player-profile__back" onClick={onCancel} aria-label="Back">
          <ChromeIcon name="back" />
        </button>

        <div className="player-profile__seal" aria-hidden="true">CR</div>
        <div className="player-profile__preview" aria-hidden="true">
          <AvatarBadge avatar={avatar} size="lg" ring />
        </div>

        <h1 className="player-profile__title">
          {initial ? 'Change Profile' : 'Your Player Profile'}
        </h1>
        <p className="player-profile__tagline">
          {initial
            ? 'Update how you appear at the table.'
            : 'Just a name and an avatar - nothing else.'}
        </p>

        <label className="player-profile__field">
          <span className="player-profile__label">Display name</span>
          <input
            className="player-profile__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            maxLength={24}
            placeholder="Enter your name"
            autoComplete="off"
            aria-invalid={touched && !isValid}
            aria-describedby={touched && !isValid ? 'player-profile-name-error' : undefined}
          />
          {touched && !isValid && (
            <span className="player-profile__error" id="player-profile-name-error" role="alert">
              Enter a name to continue.
            </span>
          )}
        </label>

        <div className="player-profile__field">
          <span className="player-profile__label">Avatar</span>
          <div className="player-profile__avatar-picker">
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>
        </div>

        <button type="button" className="btn btn--primary player-profile__continue" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
