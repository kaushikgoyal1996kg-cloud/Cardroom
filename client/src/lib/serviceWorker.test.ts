import { describe, it, expect } from 'vitest';
import SW_SRC from '../../public/sw.js?raw';

/**
 * These do not execute the worker (vitest has no service worker runtime) -
 * they assert that the source text still contains the specific guards this
 * file depends on, so an edit that quietly removes one fails loudly here
 * instead of the first time it matters, live, mid-game.
 */
describe('service worker never touches live game traffic', () => {
  it('bypasses every cross-origin request before any caching logic runs', () => {
    const fetchHandler = SW_SRC.slice(SW_SRC.indexOf("addEventListener('fetch'"));
    const originGuard = fetchHandler.indexOf('url.origin !== self.location.origin');
    expect(originGuard).toBeGreaterThan(-1);

    // The guard must appear before any caches.match / fetch().then / respondWith
    // call, i.e. before any caching decision is made.
    const firstRespondWith = fetchHandler.indexOf('respondWith');
    expect(originGuard).toBeLessThan(firstRespondWith);
  });


  it('keeps the approved Card Room emblem in the offline shell cache', () => {
    expect(SW_SRC).toContain("'/brand/card-room-emblem.png'");
  });

  it('also excludes /socket.io/ paths explicitly, as defense in depth', () => {
    expect(SW_SRC).toMatch(/url\.pathname\.startsWith\(['"]\/socket\.io\/['"]\)/);
  });

  it('only handles GET - never intercepts a socket.io polling POST', () => {
    expect(SW_SRC).toMatch(/req\.method !== ['"]GET['"]/);
  });

  it('never auto-activates a new version (no self.skipWaiting() call in install)', () => {
    const installHandler = SW_SRC.slice(
      SW_SRC.indexOf("addEventListener('install'"),
      SW_SRC.indexOf("addEventListener('activate'")
    );
    // Strip line comments first - the install handler intentionally
    // mentions "self.skipWaiting()" in prose explaining why it's absent,
    // which would otherwise false-positive a plain text match.
    const code = installHandler
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    expect(code).not.toMatch(/self\.skipWaiting\(\)/);
  });

  it('only skips waiting on an explicit message from the page', () => {
    expect(SW_SRC).toMatch(/addEventListener\('message'/);
    expect(SW_SRC).toMatch(/self\.skipWaiting\(\)/);
  });
});
