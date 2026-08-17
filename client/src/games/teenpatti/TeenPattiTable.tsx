import { useMemo, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import type { TeenPattiAction } from '../../game/types';
import { CardTable } from '../../platform/components/CardTable';
import type { SeatPlayer } from '../../platform/components/Seat';
import { PlayingCard } from '../../platform/components/PlayingCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useWakeLock } from '../../lib/useWakeLock';
import './TeenPattiTable.css';

interface TeenPattiTableProps {
  dealing?: boolean;
}

export function TeenPattiTable({ dealing = false }: TeenPattiTableProps) {
  const {
    room,
    myPlayerId,
    teenPattiState,
    teenPattiPrivate,
    teenPattiAction,
    topUpTeenPatti,
    gameError,
    clearGameError,
    voiceParticipants,
    speakingPlayerIds,
  } = useGame();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');

  const isMyTurn = !!myPlayerId && teenPattiState?.currentTurn === myPlayerId;
  useWakeLock(isMyTurn);

  const seats: SeatPlayer[] = useMemo(() => {
    if (!room || !teenPattiState) return [];
    const byId = new Map(teenPattiState.players.map((player) => [player.playerId, player]));
    return room.players.map((roomPlayer) => {
      const player = byId.get(roomPlayer.playerId);
      const statusLabel = player?.packed
        ? 'Packed'
        : player?.seen
          ? player.cardsViewed ? 'Seen' : 'Seen · cards closed'
          : player ? `Blind · ${player.blindTurns}/3` : undefined;
      return {
        playerId: roomPlayer.playerId,
        name: roomPlayer.name,
        avatar: roomPlayer.avatar,
        score: player?.chips,
        scoreLabel: 'balance',
        isBot: roomPlayer.isBot,
        connection: roomPlayer.connected || roomPlayer.isBot ? 'CONNECTED' : 'DISCONNECTED',
        statusLabel,
        inVoiceCall: voiceParticipants.includes(roomPlayer.playerId),
        speaking: speakingPlayerIds.includes(roomPlayer.playerId),
      };
    });
  }, [room, teenPattiState, voiceParticipants, speakingPlayerIds]);

  if (!room || !teenPattiState || !myPlayerId) {
    return <div className="waiting-screen"><LoadingSpinner message="Returning to Teen Patti…" /></div>;
  }

  const me = teenPattiState.players.find((player) => player.playerId === myPlayerId);
  if (!me) {
    return <div className="waiting-screen"><LoadingSpinner message="Restoring your Teen Patti seat…" /></div>;
  }

  const active = teenPattiState.players.filter((player) => !player.packed);
  const finalTwo = active.length === 2;
  const compulsorySideshow = active.length > 2 && active.every((player) => player.seen);
  const incomingOpenShow = !!teenPattiState.openShowRequestFrom && teenPattiState.openShowRequestFrom !== myPlayerId;
  const outgoingOpenShow = teenPattiState.openShowRequestFrom === myPlayerId;
  const turnName = room.players.find((player) => player.playerId === teenPattiState.currentTurn)?.name ?? 'Player';
  const requesterName = room.players.find((player) => player.playerId === teenPattiState.openShowRequestFrom)?.name ?? 'The other player';
  const myCardsViewed = teenPattiPrivate?.cardsViewed ?? false;
  const myCards = teenPattiPrivate?.cards ?? [];
  const cardCount = Math.max(teenPattiPrivate?.cardCount ?? 3, 3);

  const centreLabel = dealing
    ? undefined
    : compulsorySideshow && isMyTurn
      ? 'Compulsory sideshow'
      : isMyTurn
        ? 'Your turn'
        : teenPattiState.currentTurn
          ? `Waiting for ${turnName}`
          : 'Resolving…';

  function act(action: TeenPattiAction) {
    teenPattiAction(action);
  }

  function submitTopUp() {
    const amount = Number(topUpAmount);
    if (!Number.isInteger(amount) || amount <= 0) return;
    topUpTeenPatti(amount);
    setTopUpAmount('');
    setTopUpOpen(false);
  }

  return (
    <main className="tp-table-screen">
      <header className="tp-table-screen__bar">
        <div>
          <p className="tp-table-screen__eyebrow">Teen Patti · Round {teenPattiState.roundNumber}</p>
          <h1 className="tp-table-screen__title">Classic</h1>
        </div>
        <div className="tp-table-screen__pot" aria-label={`Pot ${teenPattiState.pot}`}>
          <span>Pot</span>
          <strong>{teenPattiState.pot}</strong>
        </div>
        <button type="button" className="tp-table-screen__rules" onClick={() => setRulesOpen(true)}>
          How to play
        </button>
      </header>

      <section className="tp-table-screen__table">
        <CardTable
          players={seats}
          selfId={myPlayerId}
          dealerId={teenPattiState.dealerId}
          activePlayerId={teenPattiState.currentTurn}
          dealing={dealing}
          dealCardsEach={dealing ? 3 : 0}
          centreLabel={centreLabel}
          centreLabelEmphasis={isMyTurn && !dealing}
        />
      </section>

      <section className={`tp-hand${me.packed ? ' is-packed' : ''}`} aria-label="Your Teen Patti cards">
        <div className="tp-hand__meta">
          <span>{me.packed ? 'Packed' : me.seen ? 'Seen' : 'Blind'}</span>
          <small>
            {me.seen && !myCardsViewed
              ? 'Betting as seen · cards still closed'
              : myCardsViewed
                ? 'Your cards'
                : `${Math.max(0, 3 - me.blindTurns)} blind chance${Math.max(0, 3 - me.blindTurns) === 1 ? '' : 's'} left`}
          </small>
        </div>
        <div className="tp-hand__cards">
          {myCardsViewed && myCards.length > 0
            ? myCards.map((card, index) => <PlayingCard key={card.id} card={card} size="md" tilt={(index - 1) * 2} />)
            : Array.from({ length: cardCount }, (_, index) => <PlayingCard key={`hidden-${index}`} faceDown size="md" tilt={(index - 1) * 2} />)}
        </div>
        <div className="tp-hand__money">
          <span>Balance <strong>{me.chips}</strong></span>
          <span className={me.profitLoss >= 0 ? 'is-positive' : 'is-negative'}>
            P/L {me.profitLoss >= 0 ? '+' : ''}{me.profitLoss}
          </span>
          <button type="button" onClick={() => setTopUpOpen((open) => !open)}>Top up</button>
        </div>
      </section>

      <footer className="tp-actions" aria-label="Teen Patti actions">
        {incomingOpenShow && finalTwo && !me.packed ? (
          <div className="tp-open-show-request" role="dialog" aria-label="Open show request">
            <p><strong>{requesterName}</strong> proposes a free open show.</p>
            <div>
              <button className="btn btn-primary" type="button" onClick={() => act({ type: 'ACCEPT_OPEN_SHOW' })}>Accept show</button>
              <button className="btn btn-ghost" type="button" onClick={() => act({ type: 'DECLINE_OPEN_SHOW' })}>Keep betting</button>
            </div>
          </div>
        ) : me.packed ? (
          <p className="tp-actions__status">You packed this round · watching the table.</p>
        ) : dealing ? (
          <p className="tp-actions__status">Dealing three cards…</p>
        ) : !isMyTurn ? (
          <p className="tp-actions__status">{teenPattiState.currentTurn ? `Waiting for ${turnName}…` : 'Resolving round…'}</p>
        ) : compulsorySideshow ? (
          <button className="btn btn-primary tp-actions__primary" type="button" onClick={() => act({ type: 'SIDESHOW' })}>
            Compulsory sideshow
          </button>
        ) : (
          <div className="tp-actions__buttons">
            {!me.seen && (
              <button className="btn btn-primary" type="button" onClick={() => act({ type: 'BLIND' })}>
                Blind · {teenPattiState.currentBlind}
              </button>
            )}
            {me.seen && (
              <button className="btn btn-primary" type="button" onClick={() => act({ type: 'CHAAL' })}>
                Chaal · {teenPattiState.seenAmount}
              </button>
            )}
            {!myCardsViewed && (
              <button className="btn" type="button" onClick={() => act({ type: 'SEE' })}>
                See cards
              </button>
            )}
            {finalTwo && !outgoingOpenShow && (
              <button className="btn" type="button" onClick={() => act({ type: 'REQUEST_OPEN_SHOW' })}>
                Ask free show
              </button>
            )}
            {finalTwo && (
              <button className="btn" type="button" onClick={() => act({ type: 'SHOWDOWN' })}>
                Showdown · {teenPattiState.seenAmount}
              </button>
            )}
            <button className="btn btn-ghost" type="button" onClick={() => act({ type: 'PACK' })}>
              Pack
            </button>
          </div>
        )}
        {outgoingOpenShow && finalTwo && (
          <p className="tp-actions__substatus">Free show requested · waiting for the other player.</p>
        )}
      </footer>

      {topUpOpen && (
        <div className="tp-topup" role="dialog" aria-label="Top up play money">
          <div className="tp-topup__sheet">
            <p className="tp-topup__eyebrow">Play money only</p>
            <h2>Top up balance</h2>
            <p>No real-money payment or cash-out exists in this game.</p>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              placeholder="Amount"
              autoFocus
            />
            <div className="tp-topup__actions">
              <button className="btn btn-primary" type="button" onClick={submitTopUp}>Add play money</button>
              <button className="btn btn-ghost" type="button" onClick={() => setTopUpOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div className="tp-rules" role="dialog" aria-modal="true" aria-label="How to play this Teen Patti variant">
          <div className="tp-rules__sheet">
            <p className="tp-rules__eyebrow">How to play this variant</p>
            <h2>Classic Teen Patti</h2>
            <p>{teenPattiState.variantHelp}</p>
            <dl>
              <div><dt>Blind</dt><dd>{teenPattiState.currentBlind} now · doubles to max {teenPattiState.tableConfig.maxBlind}</dd></div>
              <div><dt>Seen</dt><dd>2× current blind · {teenPattiState.seenAmount} now</dd></div>
              <div><dt>Blind limit</dt><dd>3 turns, then betting continues as seen</dd></div>
              <div><dt>Sideshow</dt><dd>Compulsory when all remaining players are seen</dd></div>
            </dl>
            <button className="btn btn-primary" type="button" onClick={() => setRulesOpen(false)}>Back to table</button>
          </div>
        </div>
      )}

      {teenPattiState.lastSideshow && (
        <div className="tp-sideshow-note" role="status">
          {room.players.find((p) => p.playerId === teenPattiState.lastSideshow?.packedPlayerId)?.name ?? 'Player'} packed after sideshow
          {teenPattiState.lastSideshow.tied ? ' · exact tie, initiator packs' : ''}
        </div>
      )}

      {gameError && (
        <button type="button" className="tp-error" onClick={clearGameError}>{gameError}</button>
      )}
    </main>
  );
}
