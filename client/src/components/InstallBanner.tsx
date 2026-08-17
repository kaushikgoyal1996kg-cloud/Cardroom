import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './InstallBanner.css';

export function InstallBanner() {
  const { canPromptInstall, installed, isIos, promptInstall } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (Capacitor.isNativePlatform()) return null;
  if (installed) return null;
  if (!canPromptInstall && !isIos) return null;

  async function handleClick() {
    if (isIos) {
      setShowIosHelp(true);
      return;
    }
    await promptInstall();
  }

  return (
    <div className="install-banner">
      <button className="install-banner__btn" onClick={handleClick}>
        <ChromeIcon name="install" />
        <span>Install Card Room</span>
      </button>
      {showIosHelp && (
        <div className="install-banner__ios-help">
          <p>On iPhone/iPad in Safari: tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p>
          <button className="install-banner__dismiss" onClick={() => setShowIosHelp(false)}>Got it</button>
        </div>
      )}
    </div>
  );
}
