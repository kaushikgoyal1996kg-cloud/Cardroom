const IDENTITY_KEY = 'haazari_identity_v1';

export interface SavedIdentity {
  /**
   * Stable local player/profile ID. Deliberately NOT the reconnect/session
   * token (`haazari_session_v1`, owned by GameStore) - this identifies the
   * device's saved profile itself, independent of any particular room. It
   * is generated once, kept for the lifetime of this saved identity, and
   * never sent to the server today. See ARCHITECTURE.md - this is the seam
   * a future real account system would hang off, not one itself.
   */
  profileId: string;
  name: string;
  avatar: string;
}

function generateProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older WebViews).
  // Not cryptographically strong, and doesn't need to be - this only ever
  // has to be locally unique enough to identify "this saved profile", never
  // used as a security or reconnect credential.
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getSavedIdentity(): SavedIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.name === 'string' && typeof parsed?.avatar === 'string' && parsed.name.trim()) {
      if (typeof parsed?.profileId === 'string' && parsed.profileId) {
        return { profileId: parsed.profileId, name: parsed.name, avatar: parsed.avatar };
      }
      // Migration: an identity saved before profileId existed. Backfill one
      // now and persist it immediately, rather than treating this as "no
      // profile" and forcing a returning player through setup again.
      const migrated: SavedIdentity = { profileId: generateProfileId(), name: parsed.name, avatar: parsed.avatar };
      try {
        localStorage.setItem(IDENTITY_KEY, JSON.stringify(migrated));
      } catch {
        /* ignore storage failures - still return the migrated value for this session */
      }
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveIdentity(name: string, avatar: string): SavedIdentity {
  // Preserve the existing profileId across an edit (name/avatar change) -
  // only a genuinely new profile (none saved yet) gets a new one. A saved
  // profile's ID must stay stable across edits for it to mean anything.
  const existing = getSavedIdentity();
  const identity: SavedIdentity = {
    profileId: existing?.profileId ?? generateProfileId(),
    name,
    avatar,
  };
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    /* ignore storage failures */
  }
  return identity;
}
