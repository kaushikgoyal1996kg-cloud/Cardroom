import { useEffect, useState } from 'react';
import { useGame } from '../lib/GameStore';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './TableControls.css';

interface Props {
  gameName: string;
  onOpenChat: () => void;
  onOpenVoice: () => void;
  onOpenSettings: () => void;
  onBackToCardRoom: () => void;
  onLeaveTable?: () => void;
  leaveDescription?: string;
  leaveActionLabel?: string;
}

/**
 * Compact radial utility control shared by every game table.
 *
 * Only one launcher occupies the playing surface. Secondary actions fan out
 * around it on demand so Chat, Voice and Settings never become three separate
 * fixed overlays competing with cards or action controls. Leaving remains a
 * deliberate two-choice flow: step away while keeping the seat, or give the
 * seat up permanently.
 */
export function TableControls({
  gameName,
  onOpenChat,
  onOpenVoice,
  onOpenSettings,
  onBackToCardRoom,
  onLeaveTable,
  leaveDescription,
  leaveActionLabel,
}: Props) {
  const {
    room,
    unreadChatCount,
    voiceCallSupported,
    inVoiceCall,
    voiceMuted,
    voiceParticipants,
  } = useGame();
  const [open, setOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  useEffect(() => {
    if (!room) {
      setOpen(false);
      setExitOpen(false);
    }
  }, [room]);

  useEffect(() => {
    if (!open && !exitOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (exitOpen) setExitOpen(false);
      else setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, exitOpen]);

  if (!room) return null;

  const otherVoiceParticipants = Math.max(0, voiceParticipants.length - 1);
  const hasAttention = unreadChatCount > 0 || inVoiceCall;
  const voiceStatus = !voiceCallSupported
    ? 'Voice unavailable'
    : inVoiceCall
      ? voiceMuted
        ? `Voice muted, ${otherVoiceParticipants + 1} connected`
        : `Voice active, ${otherVoiceParticipants + 1} connected`
      : 'Join voice call';

  function launch(action: () => void) {
    setOpen(false);
    action();
  }

  function openExitFlow() {
    setOpen(false);
    if (onLeaveTable) setExitOpen(true);
    else onBackToCardRoom();
  }

  return (
    <>
      <div className={`table-controls${open ? ' is-open' : ''}`}>
        {open && (
          <div className="table-controls__wheel" role="menu" aria-label={`${gameName} table controls`}>
            <button
              type="button"
              role="menuitem"
              className="table-controls__action table-controls__action--chat"
              onClick={() => launch(onOpenChat)}
              aria-label={unreadChatCount > 0 ? `Open chat, ${unreadChatCount} unread messages` : 'Open chat'}
              title="Chat"
            >
              <ChromeIcon name="chat" />
              <span className="table-controls__action-label">Chat</span>
              {unreadChatCount > 0 && (
                <span className="table-controls__action-badge" aria-hidden="true">
                  {Math.min(unreadChatCount, 9)}{unreadChatCount > 9 ? '+' : ''}
                </span>
              )}
            </button>

            <button
              type="button"
              role="menuitem"
              className={`table-controls__action table-controls__action--voice${inVoiceCall ? ' is-live' : ''}${voiceMuted ? ' is-muted' : ''}`}
              onClick={() => launch(onOpenVoice)}
              disabled={!voiceCallSupported}
              aria-label={voiceStatus}
              title={voiceStatus}
            >
              <ChromeIcon name={inVoiceCall ? 'phoneActive' : 'phone'} />
              <span className="table-controls__action-label">Voice</span>
              {inVoiceCall && <span className="table-controls__action-status" aria-hidden="true" />}
            </button>

            <button
              type="button"
              role="menuitem"
              className="table-controls__action table-controls__action--settings"
              onClick={() => launch(onOpenSettings)}
              aria-label="Open settings and table information"
              title="Settings"
            >
              <ChromeIcon name="settings" />
              <span className="table-controls__action-label">Settings</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className={`table-controls__action table-controls__action--exit${onLeaveTable ? ' is-exit' : ''}`}
              onClick={openExitFlow}
              aria-label={onLeaveTable ? 'Exit table options' : 'Back to Card Room'}
              title={onLeaveTable ? 'Exit table' : 'Card Room'}
            >
              <ChromeIcon name={onLeaveTable ? 'leave' : 'home'} />
              <span className="table-controls__action-label">{onLeaveTable ? 'Exit' : 'Card Room'}</span>
            </button>
          </div>
        )}

        <button
          type="button"
          className={`table-controls__launcher${open ? ' is-open' : ''}${hasAttention ? ' has-status' : ''}`}
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close table controls' : 'Open table controls'}
          aria-expanded={open}
          title={open ? 'Close table controls' : 'Table controls'}
        >
          <ChromeIcon name={open ? 'close' : 'menu'} />
          {unreadChatCount > 0 && !open && (
            <span className="table-controls__badge" aria-label={`${unreadChatCount} unread messages`}>
              {Math.min(unreadChatCount, 9)}{unreadChatCount > 9 ? '+' : ''}
            </span>
          )}
          {inVoiceCall && !open && (
            <span
              className={`table-controls__voice-dot${voiceMuted ? ' is-muted' : ''}`}
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      {open && (
        <button
          type="button"
          className="table-controls__scrim"
          aria-label="Close table controls"
          onClick={() => setOpen(false)}
        />
      )}

      {exitOpen && onLeaveTable && (
        <div className="table-leave table-exit" role="dialog" aria-modal="true" aria-labelledby="table-exit-title">
          <button type="button" className="table-leave__scrim" aria-label="Stay at table" onClick={() => setExitOpen(false)} />
          <section className="table-leave__sheet table-exit__sheet">
            <div className="table-exit__head">
              <div className="table-exit__mark" aria-hidden="true">
                <img src="/brand/card-room-emblem.png" alt="" draggable={false} />
              </div>
              <div>
                <p className="table-leave__eyebrow">Table exit</p>
                <h2 id="table-exit-title">What would you like to do?</h2>
              </div>
            </div>

            <div className="table-exit__choices">
              <button type="button" className="table-exit__choice" onClick={() => { setExitOpen(false); onBackToCardRoom(); }}>
                <span className="table-exit__choice-icon"><ChromeIcon name="home" /></span>
                <span className="table-exit__choice-copy">
                  <strong>Step away</strong>
                  <small>Return to The Card Room. Your seat stays connected so you can come straight back.</small>
                </span>
                <span className="table-exit__choice-state">Keep seat</span>
              </button>

              <button type="button" className="table-exit__choice table-exit__choice--danger" onClick={() => { setExitOpen(false); onLeaveTable(); }}>
                <span className="table-exit__choice-icon"><ChromeIcon name="leave" /></span>
                <span className="table-exit__choice-copy">
                  <strong>{leaveActionLabel ?? 'Leave Table'}</strong>
                  <small>{leaveDescription ?? 'Give up this seat permanently for the current match.'}</small>
                </span>
                <span className="table-exit__choice-state">Permanent</span>
              </button>
            </div>

            <button type="button" className="btn btn-ghost table-exit__stay" onClick={() => setExitOpen(false)}>Stay at table</button>
          </section>
        </div>
      )}
    </>
  );
}
