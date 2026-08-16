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

  // How far this seat's identity block may safely grow toward the table
  // centre before it would start crossing the felt's own visual
  // centreline - a PER-SEAT, viewport-DYNAMIC value (Seat.css turns it
  // into an actual max-width via calc(), scaled by the real viewport
  // width), not a single hardcoded constant. A fixed constant generous
  // enough for THIS ring (4-player Hazari, where "left"/"right" sit at a
  // real 31.6 percentage points from centre) proved unsafe for anchors on
  // OTHER, currently-unreachable-but-shared ring sizes that sit much
  // closer to centre already (the 9-player ring's inner top-left/
  // top-right, only 18 points from centre) - see Seat.css's own comment
  // on `.seat--left .seat__name` for the full reasoning (Bug 4, 2026-08-15
  // FOURTH retest).
  const identityDist = Math.round(Math.abs(50 - x) * 100) / 100;

  return (
    <div
      className={classes}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        '--seat-scale': scale,
        '--identity-dist': identityDist,
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
          <span className="seat__name-text">{player.name}</span>
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
