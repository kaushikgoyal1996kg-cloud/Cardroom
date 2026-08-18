import { useState } from 'react';
import type { PokerLobbySetup as PokerLobbySetupState, PokerTableConfig } from '../../game/types';
import { PokerLobbySetup } from './PokerLobbySetup';
import './PokerLobbyConsensus.css';

export interface PokerLobbyPlayer {
  playerId: string;
  name: string;
  isHost?: boolean;
}

export interface PokerLobbyConsensusProps {
  setup: PokerLobbySetupState | null;
  players: PokerLobbyPlayer[];
  selfId: string;
  hostId: string;
  busy?: boolean;
  onPropose: (config: PokerTableConfig) => void;
  onAccept: (revision: number) => void;
}

/**
 * Hidden private-lobby consensus surface for Poker.
 * The server owns legality + revisioning; this component only presents the
 * current proposal and sends explicit propose/accept intent.
 */
export function PokerLobbyConsensus({
  setup,
  players,
  selfId,
  hostId,
  busy = false,
  onPropose,
  onAccept,
}: PokerLobbyConsensusProps) {
  const [editing, setEditing] = useState(!setup);
  const isHost = selfId === hostId;
  const accepted = new Set(setup?.acceptedBy ?? []);
  const selfAccepted = accepted.has(selfId);
  const everyoneAccepted = !!setup && players.every((player) => accepted.has(player.playerId));

  if (!setup || (isHost && editing)) {
    if (isHost) {
      return (
        <div className="poker-consensus">
          <PokerLobbySetup
            initial={setup?.config}
            seatedPlayers={players.length}
            busy={busy}
            onPropose={(config) => {
              onPropose(config);
              setEditing(false);
            }}
          />
          {setup && (
            <button type="button" className="poker-consensus__cancel" onClick={() => setEditing(false)}>
              Keep current proposal
            </button>
          )}
        </div>
      );
    }

    return (
      <section className="poker-consensus poker-consensus--waiting" aria-live="polite">
        <span className="poker-consensus__mark" aria-hidden="true">♠</span>
        <div>
          <p>Private Poker table</p>
          <h2>Host is setting the table</h2>
          <span>Stacks, blinds, variants and seat limits will appear here for everyone to review before play starts.</span>
        </div>
      </section>
    );
  }

  const modeLabel = setup.config.mode === 'VARIANT_TABLE' ? 'Variant Poker Table' : setup.variants[0]?.name ?? 'Poker table';
  const rotationLabel = setup.config.mode === 'VARIANT_TABLE'
    ? setup.config.rotation === 'DEALER_CHOICE' ? 'Dealer Choice' : 'Fixed Rotation'
    : 'Single game';

  return (
    <section className="poker-consensus" aria-label="Poker table proposal">
      <header className="poker-consensus__heading">
        <div>
          <p>Proposal #{setup.revision}</p>
          <h2>{modeLabel}</h2>
        </div>
        <span>{everyoneAccepted ? 'Ready to start' : `${accepted.size}/${players.length} accepted`}</span>
      </header>

      <div className="poker-consensus__variants" aria-label="Approved Poker games">
        {setup.variants.map((variant) => (
          <article key={variant.id}>
            <strong>{variant.shortName}</strong>
            <span>{variant.name}</span>
          </article>
        ))}
      </div>

      <dl className="poker-consensus__facts">
        <div><dt>Starting stack</dt><dd>{setup.config.startingStack}</dd></div>
        <div><dt>Blinds</dt><dd>{setup.config.smallBlind} / {setup.config.bigBlind}</dd></div>
        <div><dt>Ante</dt><dd>{setup.config.ante || 'Off'}</dd></div>
        <div><dt>Rotation</dt><dd>{rotationLabel}</dd></div>
        <div><dt>Seat cap</dt><dd>{setup.seatCap}</dd></div>
        <div><dt>Action clock</dt><dd>Off</dd></div>
      </dl>

      <div className="poker-consensus__players" aria-label="Player acceptance">
        {players.map((player) => (
          <span key={player.playerId} className={accepted.has(player.playerId) ? 'is-accepted' : ''}>
            <i aria-hidden="true">{accepted.has(player.playerId) ? '✓' : '·'}</i>
            {player.name}{player.playerId === hostId ? ' · Host' : ''}
          </span>
        ))}
      </div>

      <div className="poker-consensus__actions">
        {isHost && (
          <button type="button" className="poker-consensus__secondary" disabled={busy} onClick={() => setEditing(true)}>
            Change setup
          </button>
        )}
        {!selfAccepted && (
          <button type="button" className="poker-consensus__accept" disabled={busy} onClick={() => onAccept(setup.revision)}>
            {busy ? 'Saving…' : 'Accept table'}
          </button>
        )}
        {selfAccepted && !everyoneAccepted && <span className="poker-consensus__waiting-copy">Accepted · waiting for everyone</span>}
        {everyoneAccepted && <span className="poker-consensus__ready">Everyone accepted</span>}
      </div>

      <small className="poker-consensus__safety">Virtual play money only. No deposits, withdrawals or cash-out.</small>
    </section>
  );
}
