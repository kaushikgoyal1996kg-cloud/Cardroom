import { AvatarBadge } from '../../components/Lobby/AvatarPicker';
import { InstallBanner } from '../../components/InstallBanner';
import type { SavedIdentity } from '../../lib/identity';
import './Welcome.css';

export interface WelcomeProps {
  /** Null for a first-time visitor with no saved profile yet. */
  identity: SavedIdentity | null;
  /** ENTER CARDROOM - shown only for a first-time visitor with no saved
   *  profile yet; leads to profile setup. */
  onEnter: () => void;
  /** CONTINUE AS <NAME> - returning visitors only, one tap straight in. */
  onContinueAs: () => void;
  /** Change profile - returning visitors only. */
  onChangeProfile: () => void;
}

/**
 * The first thing a new (or returning) visitor sees. Brand and atmosphere
 * first, never a form - see DESIGN_SYSTEM.md and PROJECT_STATE.md for the
 * Welcome/Profile shell pattern this establishes.
 */
export function Welcome({ identity, onEnter, onContinueAs, onChangeProfile }: WelcomeProps) {
  return (
    <div className="welcome">
      <div className="welcome__lamp" aria-hidden="true" />
      <div className="welcome__door-frame" aria-hidden="true" />

      <div className="welcome__content">
        <div className="welcome__brand-emblem" aria-hidden="true">
          <img src="/brand/card-room-emblem.png" alt="" draggable={false} />
        </div>
        <p className="welcome__eyebrow">Private tables. Classic games.</p>
        <h1 className="welcome__brand">
          <span className="welcome__brand-the">The</span> Card Room
        </h1>
        <div className="welcome__rule" aria-hidden="true"><span>◆</span></div>
        <p className="welcome__invitation">For friends, family and familiar rivals.</p>

        {identity ? (
          <div className="welcome__returning">
            <div className="welcome__avatar-ring">
              <AvatarBadge avatar={identity.avatar} size="lg" />
            </div>
            <p className="welcome__returning-name">{identity.name}</p>
            <button type="button" className="btn btn--primary welcome__cta" onClick={onContinueAs}>
              Continue as {identity.name}
            </button>
            <button type="button" className="welcome__change-profile" onClick={onChangeProfile}>
              Change profile
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--primary welcome__cta" onClick={onEnter}>
            <span>Enter the Card Room</span>
            <span className="welcome__cta-arrow" aria-hidden="true">→</span>
          </button>
        )}
      </div>

      <div className="welcome__install">
        <InstallBanner />
      </div>
    </div>
  );
}
