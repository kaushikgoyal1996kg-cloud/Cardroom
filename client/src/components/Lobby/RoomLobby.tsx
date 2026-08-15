import { useState } from 'react';
import { useGame } from '../../lib/GameStore';
import { AvatarBadge } from './AvatarPicker';
import { LoadingSpinner } from '../LoadingSpinner';
import './RoomLobby.css';

export function RoomLobby() {
  const { room, myPlayerId, setReady, startGame, addBot, leaveSession } = useGame();
  const [shareCopied, setShareCopied] = useState(false);
  // Defensive fallback, not the primary guard - App.tsx's routing already
  // only selects this screen once `room` is set. Kept here too so this
  // component can never itself return a blank page if some future change
  // (or a not-yet-found edge case) ever asks it to render without one -
  // see the confirmed "blank black screen after Leave" bug and
  // ARCHITECTURE.md's note on this invariant.
  if (!room) {
    return (
      <div className="waiting-screen">
        <LoadingSpinner message="Returning to Cardroom…" />
      </div>
    );
  }

  const me = room.players.find((p) => p.playerId === myPlayerId);
  const isHost = me?.isHost ?? false;
  const openSeats = 4 - room.players.length;
  const allReady = room.players.length === 4 && room.players.every((p) => p.ready);

  async function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}?join=${room!.roomCode}`;
    const text = `Play Haazari with me! Join room ${room!.roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Haazari', text, url });
      } catch {
        // User cancelled the share sheet - not an error, do nothing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} — ${url}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // Clipboard unavailable - the room code is already visible on screen either way.
    }
  }

  return (
    <div className="room-lobby">
      <h1 className="wordmark room-lobby__title">Haazari Room</h1>

      <div className="room-lobby__code">
        <span className="text-muted">Room Code</span>
        <div className="room-lobby__code-value">{room.roomCode}</div>
        <span className="text-muted">Share this code with 3 friends</span>
        <button className="btn btn-primary room-lobby__share-btn" onClick={handleShare}>
          📤 Share Invite
        </button>
        {shareCopied && <span className="room-lobby__share-copied text-muted">Link copied!</span>}
      </div>

      <div className="room-lobby__players">
        {[0, 1, 2, 3].map((i) => {
          const p = room.players[i];
          return (
            <div key={i} className="room-lobby__player">
              {p ? (
                <>
                  <span className={p.ready ? 'room-lobby__dot room-lobby__dot--ready' : 'room-lobby__dot'} />
                  <AvatarBadge avatar={p.avatar} size="md" />
                  <span className="room-lobby__name">
                    {p.name} {p.isHost && <span className="room-lobby__host-tag">Host</span>}
                    {p.isBot && <span className="room-lobby__host-tag room-lobby__host-tag--bot">🤖 Bot</span>}
                    {p.playerId === myPlayerId && ' (you)'}
                  </span>
                  <span className="text-muted">
                    {p.isBot ? 'Ready' : !p.connected ? 'Disconnected' : p.ready ? 'Ready' : 'Waiting'}
                  </span>
                </>
              ) : (
                <span className="text-muted">Waiting for player...</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="room-lobby__actions">
        {me && (
          <button className="btn" onClick={() => setReady(!me.ready)}>
            {me.ready ? 'Not Ready' : "I'm Ready"}
          </button>
        )}
        {isHost && openSeats > 0 && (
          <button className="btn btn-ghost" onClick={addBot}>
            🤖 Add Computer Player {openSeats > 0 && `(${openSeats} open seat${openSeats > 1 ? 's' : ''})`}
          </button>
        )}
        {isHost && (
          <button className="btn btn-primary" disabled={!allReady} onClick={startGame}>
            Start Game
          </button>
        )}
        <button className="btn btn-ghost" onClick={leaveSession}>Leave</button>
      </div>
      {isHost && !allReady && <p className="text-muted room-lobby__hint">Waiting for all 4 players to be ready…</p>}
    </div>
  );
}
