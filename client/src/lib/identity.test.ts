// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getSavedIdentity, saveIdentity } from './identity';

const IDENTITY_KEY = 'haazari_identity_v1';
const SESSION_KEY = 'haazari_session_v1';

beforeEach(() => {
  localStorage.clear();
});

describe('persistent local player identity', () => {
  it('a first-time user has no saved profile', () => {
    expect(getSavedIdentity()).toBeNull();
  });

  it('creating a profile persists a stable ID, name and avatar', () => {
    const saved = saveIdentity('Kaushik', '🦚');
    expect(saved.name).toBe('Kaushik');
    expect(saved.avatar).toBe('🦚');
    expect(typeof saved.profileId).toBe('string');
    expect(saved.profileId.length).toBeGreaterThan(0);

    const loaded = getSavedIdentity();
    expect(loaded).toEqual(saved);
  });

  it('a returning user loads the exact same saved identity, including profileId', () => {
    const first = saveIdentity('Kaushik', '🦚');
    // Simulate a fresh page load / relaunch by reading it back independently.
    const returning = getSavedIdentity();
    expect(returning?.profileId).toBe(first.profileId);
    expect(returning?.name).toBe('Kaushik');
    expect(returning?.avatar).toBe('🦚');
  });

  it('editing the profile (name/avatar change) persists the change but keeps the same profileId', () => {
    const original = saveIdentity('Kaushik', '🦚');
    const edited = saveIdentity('K', '👑');

    expect(edited.profileId).toBe(original.profileId);
    expect(edited.name).toBe('K');
    expect(edited.avatar).toBe('👑');

    const loaded = getSavedIdentity();
    expect(loaded).toEqual(edited);
  });

  it('an empty or whitespace-only display name is not treated as a valid saved identity', () => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ profileId: 'x', name: '   ', avatar: '🦚' }));
    expect(getSavedIdentity()).toBeNull();
  });

  it('a malformed stored value is not treated as a valid saved identity', () => {
    localStorage.setItem(IDENTITY_KEY, 'not json at all');
    expect(getSavedIdentity()).toBeNull();

    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ name: 'Kaushik' })); // missing avatar
    expect(getSavedIdentity()).toBeNull();
  });

  it('backfills a profileId for an identity saved before profileId existed, without forcing setup again', () => {
    // Simulates the pre-existing shape this project shipped before this
    // change - no profileId field at all.
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ name: 'Kaushik', avatar: '🦚' }));

    const loaded = getSavedIdentity();
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Kaushik');
    expect(loaded?.avatar).toBe('🦚');
    expect(typeof loaded?.profileId).toBe('string');
    expect(loaded?.profileId.length).toBeGreaterThan(0);

    // The backfilled ID is persisted, not regenerated on every read.
    const loadedAgain = getSavedIdentity();
    expect(loadedAgain?.profileId).toBe(loaded?.profileId);
  });

  it('profile storage never touches the reconnect/session storage key', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'secret-token', roomCode: 'HZR482', playerName: 'Kaushik' }));

    saveIdentity('Kaushik', '🦚');
    saveIdentity('K', '👑'); // an edit too

    const sessionRaw = localStorage.getItem(SESSION_KEY);
    expect(sessionRaw).not.toBeNull();
    const session = JSON.parse(sessionRaw!);
    expect(session.token).toBe('secret-token');
    expect(session.roomCode).toBe('HZR482');
  });

  it('clearing/corrupting session storage never touches saved profile identity', () => {
    const saved = saveIdentity('Kaushik', '🦚');
    localStorage.removeItem(SESSION_KEY);
    localStorage.setItem(SESSION_KEY, 'corrupt');

    const loaded = getSavedIdentity();
    expect(loaded).toEqual(saved);
  });
});
