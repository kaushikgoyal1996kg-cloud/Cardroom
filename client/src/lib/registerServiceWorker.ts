import { IS_PRODUCTION } from '../platform/lib/config';

let waitingWorker: ServiceWorker | null = null;

/**
 * Registers the service worker and reports when an update is ready.
 *
 * `onUpdateAvailable` fires only once a NEW version has finished installing
 * while an OLDER one is already controlling the page - i.e. never on the
 * very first visit, only on a genuine update. It does not reload anything
 * itself; see `applyUpdate` for that, which only ever runs when the player
 * asks for it (the update banner's "Refresh" button).
 */
export function registerServiceWorker(onUpdateAvailable: () => void): void {
  if (!('serviceWorker' in navigator)) return;
  // Skip entirely outside production: caching the dev server's own output
  // would fight Vite's HMR and make local development confusing to debug.
  if (!IS_PRODUCTION) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A controller already existing means this is a genuine
              // update, not the first-ever install on this device.
              waitingWorker = newWorker;
              onUpdateAvailable();
            }
          });
        });
      })
      .catch(() => {
        // Offline support degrading to "just a normal web app" is fine;
        // nothing here should ever block the game itself from loading.
      });
  });
}

/**
 * Player-initiated: hand control to the waiting worker and reload once it
 * takes over. Never called automatically - only from the update banner.
 */
export function applyUpdate(): void {
  if (!waitingWorker) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
  waitingWorker.postMessage('SKIP_WAITING');
}
