import { useGame } from '../lib/GameStore';
import { isSoundEnabled, setSoundEnabled } from '../lib/sound';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { useState } from 'react';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import { loadTablePreferences, saveTablePreferences, type TablePreferences } from '../lib/tablePreferences';
import { tableUtilityCapabilities } from '../platform/games/tableUtilityCapabilities';
import './RulesModal.css';

interface Props {
  onClose: () => void;
  onOpenRules: () => void;
  onOpenStats: () => void;
  onOpenRoundHistory: () => void;
  onLeaveTable?: () => void;
  leaveDescription?: string;
  leaveActionLabel?: string;
}

export function SettingsModal({ onClose, onOpenRules, onOpenStats, onOpenRoundHistory, onLeaveTable, leaveDescription, leaveActionLabel }: Props) {
  const { goToHomeScreen, room } = useGame();
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [tablePreferences, setTablePreferences] = useState<TablePreferences>(() => loadTablePreferences());
  const { canPromptInstall, installed, isIos, promptInstall } = useInstallPrompt();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);
  const utilityCapabilities = room ? tableUtilityCapabilities(room.gameId) : null;

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  function updateTablePreference<K extends keyof TablePreferences>(key: K, value: TablePreferences[K]) {
    setTablePreferences((current) => saveTablePreferences({ ...current, [key]: value }));
  }

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-panel panel settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="rules-panel__header">
          <div>
            <p className="rules-panel__eyebrow">The Card Room</p>
            <h2>Settings</h2>
          </div>
          <button className="rules-close btn btn-ghost" onClick={onClose} aria-label="Close settings"><ChromeIcon name="close" /></button>
        </div>

        <div className="settings-list">
          {!installed && (canPromptInstall || isIos) && (
            <>
              <button
                className="settings-row"
                onClick={async () => {
                  if (isIos) {
                    setShowIosInstallHelp((value) => !value);
                    return;
                  }
                  await promptInstall();
                }}
              >
                <span className="settings-row__label"><ChromeIcon name="install" /><span>Install Card Room</span></span>
                <span className="settings-row__chevron" aria-hidden="true">›</span>
              </button>
              {showIosInstallHelp && (
                <div className="settings-inline-help" role="status">
                  On iPhone/iPad in Safari: tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.
                </div>
              )}
            </>
          )}

          <button className="settings-row" onClick={toggleSound}>
            <span className="settings-row__label"><ChromeIcon name="sound" /><span>Sound</span></span>
            <span className={`settings-toggle ${soundOn ? 'settings-toggle--on' : ''}`}>
              {soundOn ? 'On' : 'Off'}
            </span>
          </button>

          <button
            className="settings-row"
            onClick={() => updateTablePreference('deckPalette', tablePreferences.deckPalette === 'classic' ? 'four-color' : 'classic')}
          >
            <span className="settings-row__label"><ChromeIcon name="cards" /><span>Four-colour suits</span></span>
            <span className={`settings-toggle ${tablePreferences.deckPalette === 'four-color' ? 'settings-toggle--on' : ''}`}>
              {tablePreferences.deckPalette === 'four-color' ? 'On' : 'Off'}
            </span>
          </button>

          <button
            className="settings-row"
            onClick={() => updateTablePreference('cardIndexSize', tablePreferences.cardIndexSize === 'standard' ? 'large' : 'standard')}
          >
            <span className="settings-row__label"><ChromeIcon name="cards" /><span>Large card indices</span></span>
            <span className={`settings-toggle ${tablePreferences.cardIndexSize === 'large' ? 'settings-toggle--on' : ''}`}>
              {tablePreferences.cardIndexSize === 'large' ? 'On' : 'Off'}
            </span>
          </button>

          <button
            className="settings-row"
            onClick={() => updateTablePreference('motion', tablePreferences.motion === 'full' ? 'reduced' : 'full')}
          >
            <span className="settings-row__label"><ChromeIcon name="motion" /><span>Reduced animation</span></span>
            <span className={`settings-toggle ${tablePreferences.motion === 'reduced' ? 'settings-toggle--on' : ''}`}>
              {tablePreferences.motion === 'reduced' ? 'On' : 'Off'}
            </span>
          </button>

          <button className="settings-row" onClick={onOpenRules}>
            <span className="settings-row__label"><ChromeIcon name="rules" /><span>Rules &amp; How to Play</span></span>
            <span className="settings-row__chevron" aria-hidden="true">›</span>
          </button>

          {utilityCapabilities?.stats && (
            <button className="settings-row" onClick={onOpenStats}>
              <span className="settings-row__label"><ChromeIcon name="stats" /><span>{utilityCapabilities.statsLabel}</span></span>
              <span className="settings-row__chevron" aria-hidden="true">›</span>
            </button>
          )}

          {utilityCapabilities?.history && (
            <button className="settings-row" onClick={onOpenRoundHistory}>
              <span className="settings-row__label"><ChromeIcon name="history" /><span>{utilityCapabilities.historyLabel}</span></span>
              <span className="settings-row__chevron" aria-hidden="true">›</span>
            </button>
          )}

          {room && (
            <button className="settings-row" onClick={() => { onClose(); goToHomeScreen(); }}>
              <span className="settings-row__label"><ChromeIcon name="home" /><span>Back to Card Room</span></span>
              <span className="settings-row__meta">Seat stays connected</span>
            </button>
          )}

          {onLeaveTable && !confirmingLeave && (
            <button className="settings-row settings-row--danger" onClick={() => setConfirmingLeave(true)}>
              <span className="settings-row__label"><ChromeIcon name="leave" /><span>Leave Table</span></span>
              <span className="settings-row__chevron" aria-hidden="true">›</span>
            </button>
          )}

          {onLeaveTable && confirmingLeave && (
            <div className="settings-leave-confirm">
              <p>{leaveDescription ?? <>A computer player will take over your seat and the game will continue for everyone else. You won't be able to rejoin this game. Leave anyway?</>}</p>
              <div className="settings-leave-confirm__actions">
                <button className="btn btn-ghost" onClick={() => setConfirmingLeave(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { onClose(); onLeaveTable(); }}>{leaveActionLabel ?? 'Yes, Leave Table'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
