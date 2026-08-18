// The Card Room service worker.
//
// Scope, deliberately kept small:
//   1. Cache the static app shell so a repeat visit (and a genuinely offline
//      one) still loads something branded instead of the browser's own
//      offline page.
//   2. NEVER touch live traffic. Socket.IO (and anything else cross-origin,
//      i.e. the game server) is explicitly let through untouched - see the
//      guard at the top of the fetch handler.
//   3. Update without ever forcing a reload out from under a player mid
//      game. A new SW installs and then WAITS; the page only tells it to
//      take over when the player explicitly asks while out of a live room (see
//      registerServiceWorker.ts / UpdateBanner.tsx), never automatically.
//
// Bump this with a release that changes the cached shell/branding below; it
// gives the waiting worker a new identity and lets activation clean old caches.
const CACHE_VERSION = 'cardroom-v3';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const SHELL_URLS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/brand/card-room-emblem.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  // Deliberately no self.skipWaiting() here - see the file header. A newly
  // installed worker sits in "waiting" until the page explicitly posts
  // SKIP_WAITING (only ever done from a player tapping "Refresh" on the
  // update banner, which is hidden while a room is live).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('cardroom-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ---- Hard exclusions: never intercept live traffic --------------------
  // Anything not same-origin is the game server (Socket.IO's HTTP polling
  // transport included, before/if it upgrades to a real WebSocket, which
  // bypasses the service worker entirely on its own). Letting the browser
  // handle these directly, untouched, is the actual safety mechanism here;
  // the /socket.io/ path check below is defense in depth in case that ever
  // runs through a same-origin proxy path instead.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/socket.io/')) return;
  if (req.method !== 'GET') return;

  // ---- Navigations (HTML page loads): network first, cached shell/offline
  // page as the fallback. A stale cached index.html would point at JS/CSS
  // asset hashes from an old deploy that may no longer exist on the server,
  // so this path only ever serves cache when the network is genuinely
  // unreachable.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(
        () =>
          caches.match('/').then((cached) => cached || caches.match('/offline.html'))
      )
    );
    return;
  }

  // ---- manifest.webmanifest: network first, same reasoning as above.
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/manifest.webmanifest'))
    );
    return;
  }

  // ---- Everything else same-origin (Vite's hashed JS/CSS bundles, icons):
  // cache first. Bundle filenames are content-hashed, so a cached copy of
  // one is never stale - a new deploy ships new filenames rather than
  // changing what an old hash points to. Falls back to network for
  // anything not yet cached, and quietly refreshes the cache from that
  // response for next time.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
