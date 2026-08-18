import { useState } from 'react';
import { useGame } from '../lib/GameStore';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './VoiceCallPanel.css';

interface VoiceCallPanelProps {
  open?: boolean;
  onClose?: () => void;
  showLauncher?: boolean;
}

export function VoiceCallPanel({ open: controlledOpen, onClose, showLauncher = true }: VoiceCallPanelProps = {}) {
  const {
    room,
    myPlayerId,
    voiceCallSupported,
    inVoiceCall,
    voiceMuted,
    voiceParticipants,
    speakingPlayerIds,
    joinVoiceCall,
    leaveVoiceCall,
    toggleVoiceMute,
  } = useGame();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  function closePanel() {
    if (onClose) onClose();
    else setInternalOpen(false);
  }

  if (!room || !voiceCallSupported) return null;

  function nameOf(playerId: string) {
    return room!.players.find((p) => p.playerId === playerId)?.name ?? playerId;
  }

  const othersInCall = voiceParticipants.filter((id) => id !== myPlayerId);

  return (
    <>
      {showLauncher && (
        <button
          className={`voice-call-toggle fab ${inVoiceCall ? 'voice-call-toggle--active' : ''}`}
          onClick={() => setInternalOpen((o) => !o)}
          aria-label="Voice call"
        >
          <ChromeIcon name={inVoiceCall ? "phoneActive" : "phone"} />
          {inVoiceCall && othersInCall.length > 0 && (
            <span className="voice-call-toggle__badge">{othersInCall.length}</span>
          )}
        </button>
      )}

      {open && (
        <div className={`voice-call-panel panel${showLauncher ? '' : ' is-table-utility'}`}>
          <div className="voice-call-panel__header">
            <span>Voice Call</span>
            <button className="btn btn-ghost voice-call-panel__close" onClick={closePanel} aria-label="Close voice call">
              <ChromeIcon name="close" />
            </button>
          </div>

          {!inVoiceCall ? (
            <button className="btn btn-primary voice-call-panel__join" onClick={joinVoiceCall}>
              <ChromeIcon name="phone" /> <span>Join Voice Call</span>
            </button>
          ) : (
            <>
              <div className="voice-call-panel__actions">
                <button className="btn btn-ghost" onClick={toggleVoiceMute}>
                  <><ChromeIcon name={voiceMuted ? 'micOff' : 'mic'} /> <span>{voiceMuted ? 'Unmute' : 'Mute'}</span></>
                </button>
                <button className="btn voice-call-panel__leave" onClick={leaveVoiceCall}>
                  Leave Call
                </button>
              </div>

              <div className="voice-call-panel__participants">
                <div className="voice-call-panel__you">
                  <span className={`voice-call-dot ${voiceMuted ? 'voice-call-dot--muted' : 'voice-call-dot--live'}`} />
                  You {voiceMuted && '(muted)'}
                </div>
                {othersInCall.length === 0 && (
                  <p className="text-muted voice-call-panel__empty">Waiting for others to join…</p>
                )}
                {othersInCall.map((id) => (
                  <div key={id} className="voice-call-panel__participant">
                    <span
                      className={`voice-call-dot ${speakingPlayerIds.includes(id) ? 'voice-call-dot--speaking' : 'voice-call-dot--live'}`}
                    />
                    {nameOf(id)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
