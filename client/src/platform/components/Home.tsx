import { useState } from 'react';
import { GAME_CATALOG, catalogEntry, isRuntimeGameId, type CatalogGameId } from '../games/catalog';
import { AvatarBadge } from '../../components/Lobby/AvatarPicker';
import type { GameId } from '../../game/types';
import './Home.css';

export interface HomeProps {
  playerName: string;
  /** Shown alongside the name in the header profile control (Part 6: "a
   *  small avatar/profile control in the global shell/header is
   *  acceptable"). Optional so existing callers/tests that don't pass it
   *  still render sensibly. */
  playerAvatar?: string;
  onEditName: () => void;
  onPlay: (game: GameId) => void;
  onCreateTable: (game: GameId) => void;
  onJoinTable: (code: string) => void;
  /** Disables the primary actions while a request is in flight. */
  busy?: boolean;
  error?: string | null;
}

/**
 * The entry point to the card room.
 *
 * A game whose server controller does not exist yet is shown, but its actions
 * are disabled with the reason stated on the card - so nobody can walk into a
 * table that cannot actually run.
 */
export function Home({
  playerName,
  playerAvatar,
  onEditName,
  onPlay,
  onCreateTable,
  onJoinTable,
  busy = false,
  error = null,
}: HomeProps) {
  const [selected, setSelected] = useState<CatalogGameId | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const active = selected ? catalogEntry(selected) : null;
  const canPlay = !!active?.networkPlayable && !busy;

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setJoinError('Enter the full room code from your invite.');
      return;
    }
    setJoinError(null);
    onJoinTable(code);
  }

  return (
    <div className="home">
      <div className="home__lamp" aria-hidden="true" />

      <header className="home__header">
        <p className="home__eyebrow">The</p>
        <h1 className="home__brand">Card Room</h1>
        <p className="home__subtitle">Choose a table. The room remembers the rest.</p>
        <button type="button" className="home__identity" onClick={onEditName}>
          {playerAvatar && (
            <span className="home__identity-avatar">
              <AvatarBadge avatar={playerAvatar} size="sm" />
            </span>
          )}
          <span className="home__identity-name">{playerName}</span>
          <span className="home__identity-edit">Profile</span>
        </button>
      </header>

      <main className="home__main">
        <h2 className="home__section-title">Choose a game</h2>

        <ul className="home__games" role="list">
          {GAME_CATALOG.map((game) => {
            const isActive = game.id === selected;
            const number = String(GAME_CATALOG.indexOf(game) + 1).padStart(2, '0');
            return (
              <li key={game.id}>
                <button
                  type="button"
                  className={[
                    'gamecard',
                    isActive && 'is-active',
                    !game.networkPlayable && 'is-limited',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelected(game.id)}
                  aria-pressed={isActive}
                >
                  <span className="gamecard__felt" aria-hidden="true" />
                  <span className="gamecard__topline">
                    <span className="gamecard__index" aria-hidden="true">{number}</span>
                    <span className={`gamecard__availability ${game.networkPlayable ? 'is-open' : 'is-soon'}`}>
                      {game.networkPlayable ? 'Table open' : 'Coming soon'}
                    </span>
                  </span>
                  <span className="gamecard__name">{game.name}</span>
                  <span className="gamecard__meta">
                    <span>{game.players}</span>
                    <span className="gamecard__dot" aria-hidden="true">·</span>
                    <span>{game.cards}</span>
                  </span>
                  <span className="gamecard__blurb">{game.blurb}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className={`home__actions${active ? '' : ' is-idle'}`} aria-live="polite">
          {!active ? (
            <div className="home__selection-prompt">
              <span className="home__selection-mark" aria-hidden="true">CR</span>
              <p>Select a game to open its table options.</p>
            </div>
          ) : active.networkPlayable ? (
            <>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (isRuntimeGameId(active.id)) onPlay(active.id);
                }}
                disabled={!canPlay}
              >
                {busy ? 'Just a moment…' : `Play ${active.name}`}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  if (isRuntimeGameId(active.id)) onCreateTable(active.id);
                }}
                disabled={!canPlay}
              >
                Create table
              </button>
            </>
          ) : (
            <div className="home__coming-soon">
              <span>Coming soon</span>
              <strong>{active.name}</strong>
              <p>This table is being prepared for a later Card Room update.</p>
            </div>
          )}
        </div>

        {error && (
          <p className="home__join-error" role="alert">
            {error}
          </p>
        )}

        <div className="home__join">
          <label className="home__join-label" htmlFor="room-code">
            Have a room code?
          </label>
          <div className="home__join-row">
            <input
              id="room-code"
              className="home__join-input"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setJoinError(null);
              }}
              placeholder="Enter code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={8}
              inputMode="text"
              aria-describedby={joinError ? 'room-code-error' : undefined}
              aria-invalid={!!joinError}
            />
            <button type="button" className="btn btn--ghost" onClick={handleJoin} disabled={busy}>
              Join
            </button>
          </div>
          {joinError && (
            <p className="home__join-error" id="room-code-error" role="alert">
              {joinError}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
