import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useGame } from '../lib/GameStore';
import { registerServiceWorker, applyUpdate } from '../lib/registerServiceWorker';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './UpdateBanner.css';

/**
 * Web/PWA update notice.
 *
 * Never surface a refresh action while somebody still owns a live room: even
 * a player-confirmed reload is a needless reconnect risk in the middle of a
 * card game. Native builds are versioned as APK/app updates instead, so the
 * service-worker banner is web-only.
 */
export function UpdateBanner() {
  const { room } = useGame();
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    registerServiceWorker(() => setAvailable(true));
  }, []);

  if (Capacitor.isNativePlatform() || !available || dismissed || room) return null;

  return (
    <div className="update-banner" role="status">
      <span>A Card Room update is ready.</span>
      <button className="update-banner__refresh" onClick={applyUpdate}>
        Update now
      </button>
      <button
        className="update-banner__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update"
      >
        <ChromeIcon name="close" />
      </button>
    </div>
  );
}
