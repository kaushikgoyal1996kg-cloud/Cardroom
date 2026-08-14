import { useEffect, useState } from 'react';
import { registerServiceWorker, applyUpdate } from '../lib/registerServiceWorker';
import './UpdateBanner.css';

/**
 * A new version is never applied automatically - a mid-hand reload would be
 * one of the worse things this app could do to a player. This only ever
 * shows a small, dismissible notice and waits for an explicit tap.
 */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    registerServiceWorker(() => setAvailable(true));
  }, []);

  if (!available || dismissed) return null;

  return (
    <div className="update-banner" role="status">
      <span>A new version of Cardroom is ready.</span>
      <button className="update-banner__refresh" onClick={applyUpdate}>
        Refresh
      </button>
      <button
        className="update-banner__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
