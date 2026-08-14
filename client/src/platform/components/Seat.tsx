import { memo } from 'react';
import type { SeatPosition } from '../table/seatLayout';
import './Seat.css';

export type ConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

export interface SeatPlayer {
  playerId: string;
  name: string;
  avatar?: string;
  /** Score, chips, or whatever the current game counts. Omit to hide. */
  score?: number;
  scoreLabel?: string;
  isBot: boolean;
  connection: ConnectionStatus;
  /** True once this player has acted in the current phase. */
  hasActed?: boolean;
  /** In the room's live voice call. */
  inVoiceCall?: boolean;
  /** Currently talking, for a subtle live indicator on the seat. */
  speaking?: boolean;
}

export interface SeatProps {
  player: SeatPlayer;
  position: SeatPosition;
  isDealer: boolean;
  isActive: boolean;
}

const CONNECTION_TEXT: Record<ConnectionStatus, string> = {
  CONNECTED: '',
  RECONNECTING: 'Reconnecting',
  DISCONNECTED: 'Away',
};

/**
 * One player's seat at the table.
 *
 * Accessibility rule applied throughout: no state is signalled by colour
 * alone. Turn order also gets a ring and a text label, a disconnected player
 * also gets the word "Away", and a bot is always labelled "Bot" rather than
 * being passed off as a person.
 */
export const Seat = memo(function Seat({ player, position, isDealer, isActive }: SeatProps) {
  const { x, y, scale, isSelf, anchor } = position;

  const classes = [
    'seat',
    `seat--${anchor}`,
    isSelf && 'is-self',
    isActive && 'is-active',
    player.connection !== 'CONNECTED' && 'is-away',
    player.hasActed && 'has-acted',
  ]
    .filter(Boolean)
    .join(' ');

  const statusText = CONNECTION_TEXT[player.connection];

  return (
    <div
      className={classes}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        '--seat-scale': scale,
      } as React.CSSProperties}
    >
      <div className="seat__avatar-wrap">
        <div className="seat__avatar" aria-hidden="true">
          {player.avatar ?? player.name.charAt(0).toUpperCase()}
        </div>
        {isActive && <span className="seat__ring" aria-hidden="true" />}
        {isDealer && <span className="seat__dealer-dot" aria-hidden="true" />}
        {player.inVoiceCall && (
          <span
            className={`seat__mic${player.speaking ? ' is-speaking' : ''}`}
            aria-hidden="true"
          >
            🎙
          </span>
        )}
      </div>

      <div className="seat__info">
        <p className="seat__name">
          {player.name}
          {player.isBot && <span className="seat__tag seat__tag--bot">Bot</span>}
        </p>

        {player.score !== undefined && (
          <p className="seat__score">
            <span className="seat__score-value">{player.score}</span>
            {player.scoreLabel && (
              <span className="seat__score-label"> {player.scoreLabel}</span>
            )}
          </p>
        )}

        {statusText && (
          <p className="seat__status" role="status">
            {statusText}
          </p>
        )}
      </div>

      {/* Screen-reader summary: one sentence covering everything the visual
          indicators convey, so nothing is lost without sight of the ring. */}
      <span className="visually-hidden">
        {player.name}
        {player.isBot ? ', computer player' : ''}
        {isDealer ? ', dealer' : ''}
        {isActive ? ', their turn' : ''}
        {statusText ? `, ${statusText}` : ''}
        {player.inVoiceCall ? ', in voice call' : ''}
        {player.score !== undefined ? `, ${player.score} ${player.scoreLabel ?? 'points'}` : ''}
      </span>
    </div>
  );
});
