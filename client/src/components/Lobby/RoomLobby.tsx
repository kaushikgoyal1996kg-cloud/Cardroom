import { useState } from 'react';
import { useGame } from '../../lib/GameStore';
import { catalogEntry } from '../../platform/games/catalog';
import { buildInviteUrl } from '../../platform/lib/inviteUrl';
import { AvatarBadge } from './AvatarPicker';
import { LoadingSpinner } from '../LoadingSpinner';
import { TeenPattiLobbySetup } from '../../games/teenpatti/TeenPattiLobbySetup';
import { PokerLobbyConsensus } from '../../games/poker/PokerLobbyConsensus';
import { PlayMoneyBoard } from '../../platform/components/PlayMoneyBoard';
import './RoomLobby.css';

export function RoomLobby() {
  const {
    room,
    myPlayerId,
    setReady,
    startGame,
    addBot,
    removeBot,
    leaveSession,
    teenPattiSetup,
    pokerSetup,
    proposePokerSetup,
    acceptPokerSetup,
  } = useGame();
  const [shareCopied, setShareCopied] = useState(false);
  const [pokerSetupBusy, setPokerSetupBusy] = useState(false);
  if (!room) {
    return (
      <div className="waiting-screen">
        <LoadingSpinner message="Returning to the Card Room…" />
      </div>
    );
  }

  const game = catalogEntry(room.gameId);
  const me = room.players.find((p) => p.playerId === myPlayerId);
  const isHost = me?.isHost ?? false;
  const openSeats = room.maxPlayers - room.players.length;
  const enoughPlayers = game.requiredPlayers !== undefined
    ? room.players.length === game.requiredPlayers
    : room.players.length >= game.minPlayers && room.players.length <= game.maxPlayers;
  const allHumansOnline = room.players.every((p) => p.isBot || p.connected);
  const allReady = enoughPlayers && allHumansOnline && room.players.every((p) => p.ready);
  const teenPattiSetupReady = room.gameId !== 'TEEN_PATTI' || (!!teenPattiSetup && room.players.every((p) => teenPattiSetup.acceptedBy.includes(p.playerId)));
  const pokerSetupReady = room.gameId !== 'POKER' || (!!pokerSetup && room.players.every((p) => pokerSetup.acceptedBy.includes(p.playerId)));
  const playMoneyReady = !room.playMoney.proposal || room.players.every(
    (p) => p.isBot || room.playMoney.proposal!.acceptedBy.includes(p.playerId)
  );
  const canStart = allReady && teenPattiSetupReady && pokerSetupReady && playMoneyReady;
  // Release 1 supports optional computer seats in Hazari and Kitti. Bots are
  // auto-ready and auto-accept the optional virtual board; Teen Patti remains
  // Coming Soon and deliberately has no bot controller.
  const canAddBot = (room.gameId === 'HAZARI' || room.gameId === 'KITTI') && openSeats > 0;
  const needed = Math.max(0, game.minPlayers - room.players.length);

  const roomCode = room.roomCode;
  const gameName = game.name;

  async function handleShare() {
    const url = buildInviteUrl(roomCode);
    const text = `Play ${gameName} with me in The Card Room — room ${roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `The Card Room — ${gameName}`,
          text,
          ...(url ? { url } : {}),
        });
      } catch {
        // User cancelled the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url ? `${text} — ${url}` : text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // The room code remains visible even when clipboard access is denied.
    }
  }

  return (
    <div className="room-lobby">
      <p className="room-lobby__eyebrow">The Card Room</p>
      <h1 className="wordmark room-lobby__title">{game.name}</h1>
      <p className="room-lobby__game-meta">{game.players} · {game.cards}</p>

      <div className="room-lobby__code">
        <span className="text-muted">Private table</span>
        <div className="room-lobby__code-value">{room.roomCode}</div>
        <span className="text-muted">
          {openSeats > 0 ? `${openSeats} seat${openSeats === 1 ? '' : 's'} open` : 'Table full'}
        </span>
        <button className="btn btn-primary room-lobby__share-btn" onClick={handleShare}>
          Share invite
        </button>
        {shareCopied && <span className="room-lobby__share-copied text-muted">Invite copied</span>}
      </div>

      <div className="room-lobby__players" aria-label={`${game.name} seats`}>
        {Array.from({ length: room.maxPlayers }, (_, i) => {
          const p = room.players[i];
          return (
            <div key={i} className={`room-lobby__player${p ? '' : ' is-empty'}`}>
              {p ? (
                <>
                  <span className={p.ready ? 'room-lobby__dot room-lobby__dot--ready' : 'room-lobby__dot'} />
                  <AvatarBadge avatar={p.avatar} size="md" />
                  <span className="room-lobby__name">
                    {p.name} {p.isHost && <span className="room-lobby__host-tag">Host</span>}
                    {p.isBot && <span className="room-lobby__host-tag room-lobby__host-tag--bot">Bot</span>}
                    {p.playerId === myPlayerId && <span className="room-lobby__you-tag">You</span>}
                  </span>
                  <span className="text-muted">
                    {p.isBot ? 'Ready' : !p.connected ? 'Disconnected' : p.ready ? 'Ready' : 'Online'}
                  </span>
                  {isHost && p.isBot && (
                    <button
                      type="button"
                      className="room-lobby__remove-bot"
                      onClick={() => removeBot(p.playerId)}
                      aria-label={`Remove computer player ${p.name}`}
                    >
                      Remove
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className="room-lobby__empty-seat" aria-hidden="true">{i + 1}</span>
                  <span className="text-muted">Open seat</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {room.gameId === 'TEEN_PATTI' && <TeenPattiLobbySetup />}
      {room.gameId === 'POKER' && myPlayerId && (
        <PokerLobbyConsensus
          setup={pokerSetup}
          players={room.players.map((player) => ({
            playerId: player.playerId,
            name: player.name,
            isHost: player.isHost,
          }))}
          selfId={myPlayerId}
          hostId={room.hostId}
          busy={pokerSetupBusy}
          onPropose={async (config) => {
            setPokerSetupBusy(true);
            try {
              await proposePokerSetup(config);
            } finally {
              setPokerSetupBusy(false);
            }
          }}
          onAccept={async (revision) => {
            setPokerSetupBusy(true);
            try {
              await acceptPokerSetup(revision);
            } finally {
              setPokerSetupBusy(false);
            }
          }}
        />
      )}
      {(room.gameId === 'HAZARI' || room.gameId === 'KITTI') && <PlayMoneyBoard />}

      <div className="room-lobby__actions">
        {me && (
          <button className="btn" onClick={() => setReady(!me.ready)}>
            {me.ready ? 'Not ready' : "I'm ready"}
          </button>
        )}
        {isHost && canAddBot && (
          <button className="btn btn-ghost" onClick={addBot}>
            Add computer player ({openSeats} open)
          </button>
        )}
        {isHost && (
          <button className="btn btn-primary" disabled={!canStart} onClick={startGame}>
            Start {game.name}
          </button>
        )}
        <button className="btn btn-ghost" onClick={leaveSession}>Leave room</button>
      </div>
      {isHost && !canStart && (
        <p className="text-muted room-lobby__hint">
          {needed > 0
            ? `Waiting for ${needed} more player${needed === 1 ? '' : 's'}…`
            : !allHumansOnline
              ? 'Waiting for every human player to be back online before Start.'
              : !teenPattiSetupReady
                ? 'Every player must accept the current Teen Patti table setup before Start.'
              : !pokerSetupReady
                ? 'Every player must accept the current Poker table setup before Start.'
              : !playMoneyReady
                ? 'Every human player must accept the optional play-money board, or the host can withdraw it.'
                : 'Everyone at the table must be ready before the host can start.'}
        </p>
      )}
    </div>
  );
}
