import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import type { TeenPattiAction, TeenPattiFriendlySuggestion } from '../../game/types';
import { CardTable } from '../../platform/components/CardTable';
import type { SeatPlayer } from '../../platform/components/Seat';
import { PlayingCard } from '../../platform/components/PlayingCard';
import { useVisualViewport } from '../../platform/lib/useVisualViewport';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useWakeLock } from '../../lib/useWakeLock';
import './TeenPattiTable.css';

interface TeenPattiTableProps {
  dealing?: boolean;
  onOpenRules?: () => void;
}

export function TeenPattiTable({ dealing = false, onOpenRules }: TeenPattiTableProps) {
  const {
    room,
    myPlayerId,
    teenPattiState,
    teenPattiPrivate,
    teenPattiAction,
    assignTeenPattiTwoReference,
    chooseTeenPattiDiscards,
    requestTeenPattiFriendlyAssist,
    respondTeenPattiFriendlyAssist,
    revokeTeenPattiFriendlyAssist,
    suggestTeenPattiFriendlyAssist,
    topUpTeenPatti,
    gameError,
    clearGameError,
    voiceParticipants,
    speakingPlayerIds,
  } = useGame();
  const { viewportHeight } = useVisualViewport();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [draftDiscardSlots, setDraftDiscardSlots] = useState<number[]>([]);

  const isMyTurn = !!myPlayerId && teenPattiState?.currentTurn === myPlayerId;
  useWakeLock(isMyTurn);

  const seats: SeatPlayer[] = useMemo(() => {
    if (!room || !teenPattiState) return [];
    const byId = new Map(teenPattiState.players.map((player) => [player.playerId, player]));
    return room.players.map((roomPlayer) => {
      const player = byId.get(roomPlayer.playerId);
      const statusLabel = teenPattiState.state === 'AWAITING_DISCARD' && player
        ? player.discardLocked ? 'Discards locked' : 'Choosing discards'
        : teenPattiState.state === 'AWAITING_REFERENCE_ASSIGNMENT' && player
          ? player.referenceAssigned ? 'Jokers locked' : 'Choosing jokers'
        : player?.packed
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
  const mutualShowOpen = !!teenPattiState.openShowRequestFrom;
  const mutualShowAccepted = new Set(teenPattiState.openShowAcceptedBy);
  const iAcceptedMutualShow = mutualShowAccepted.has(myPlayerId);
  const acceptedMutualCount = active.filter((player) => mutualShowAccepted.has(player.playerId)).length;
  const turnName = room.players.find((player) => player.playerId === teenPattiState.currentTurn)?.name ?? 'Player';
  const requesterName = room.players.find((player) => player.playerId === teenPattiState.openShowRequestFrom)?.name ?? 'Another player';
  // GameStore exposes private state only when its round + sequence exactly
  // matches the public snapshot. A transient null therefore means "the next
  // private packet is still arriving", not "the player has no hand". Keep the
  // table visible but do not offer any private-state-dependent action until the
  // matching snapshot lands.
  const privateSnapshotReady = teenPattiPrivate !== null;
  const myCardsViewed = teenPattiPrivate?.cardsViewed ?? false;
  const myCards = teenPattiPrivate?.cards ?? [];
  const cardCount = Math.max(0, teenPattiPrivate?.cardCount ?? teenPattiState.variantDealCount);
  const awaitingDiscard = teenPattiState.state === 'AWAITING_DISCARD';
  const awaitingReferenceAssignment = teenPattiState.state === 'AWAITING_REFERENCE_ASSIGNMENT';
  const myReferenceAssignment = teenPattiPrivate?.twoReferenceAssignment ?? null;
  const discardState = teenPattiPrivate?.discardState ?? null;
  const lockedDiscardSlots = discardState?.selectedSlots ?? [];
  const shownDiscardSlots = discardState?.complete ? lockedDiscardSlots : draftDiscardSlots;
  const legalDiscardSelections = discardState?.legalSelections ?? [];
  const isDraftDiscardLegal = draftDiscardSlots.length === 2 && legalDiscardSelections.some((selection) => {
    const left = [...selection].sort((a, b) => a - b);
    const right = [...draftDiscardSlots].sort((a, b) => a - b);
    return left[0] === right[0] && left[1] === right[1];
  });
  const referenceA = teenPattiState.variantReferenceCards[0];
  const referenceB = teenPattiState.variantReferenceCards[1];
  const friendlyAssist = teenPattiPrivate?.friendlyAssist ?? { enabled: false, coachLockedTargetPlayerId: null, outgoing: null, incoming: [] };
  const outgoingAssist = friendlyAssist.outgoing;
  const incomingAssist = friendlyAssist.incoming;
  const pendingIncomingAssist = incomingAssist.filter((request) => request.status === 'PENDING');
  const acceptedIncomingAssist = incomingAssist.filter((request) => request.status === 'ACCEPTED');
  const coachablePlayers = active.filter((player) => {
    const roomPlayer = room.players.find((candidate) => candidate.playerId === player.playerId);
    return player.playerId !== myPlayerId && !roomPlayer?.isBot;
  });

  // Capture the guarded player list rather than the nullable store room in a
  // nested helper. This keeps the production strict TypeScript build honest
  // while preserving the same runtime lookup.
  const roomPlayers = room.players;
  function playerName(playerId: string) {
    return roomPlayers.find((player) => player.playerId === playerId)?.name ?? 'Player';
  }

  const suggestionLabel: Record<TeenPattiFriendlySuggestion, string> = {
    PLAY: 'Play / continue',
    PACK: 'Pack',
    SIDESHOW: 'Sideshow',
    SHOW: 'Show',
  };

  useEffect(() => {
    setDraftDiscardSlots([]);
  }, [teenPattiState.roundNumber, teenPattiState.state, discardState?.complete]);

  function toggleDiscardSlot(index: number) {
    if (!awaitingDiscard || discardState?.complete) return;
    const participates = legalDiscardSelections.some((selection) => selection.includes(index));
    if (!participates) return;
    setDraftDiscardSlots((current) => {
      if (current.includes(index)) return current.filter((slot) => slot !== index);
      const next = [...current, index];
      if (next.length > 2) return [current[current.length - 1], index].filter((slot): slot is number => slot !== undefined);
      return next;
    });
  }

  const centreLabel = dealing
    ? undefined
    : awaitingDiscard
      ? `Choose discards · ${teenPattiState.discardSelectionsComplete}/${teenPattiState.players.length}`
      : awaitingReferenceAssignment
      ? `Choose joker roles · ${teenPattiState.twoReferenceAssignmentsComplete}/${teenPattiState.players.length}`
      : mutualShowOpen
      ? `Mutual Show · ${acceptedMutualCount}/${active.length}`
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
    <main className="tp-table-screen" style={viewportHeight ? ({ '--js-vh': `${viewportHeight}px` } as React.CSSProperties) : undefined}>
      <header className="tp-table-screen__bar">
        <div>
          <p className="tp-table-screen__eyebrow">Teen Patti · Round {teenPattiState.roundNumber}{teenPattiState.variantWasSurprise ? ' · Surprise Me' : ''}</p>
          <h1 className="tp-table-screen__title">{teenPattiState.variantName}</h1>
        </div>
        {teenPattiState.variantReferenceCards.length > 0 && (
          <div className="tp-table-screen__reference" aria-label="Revealed joker reference">
            <span>{teenPattiState.variant.variantId === 'REVOLVING_JOKER' ? 'Current jokers' : teenPattiState.variant.variantId === 'TWO_REFERENCE_JOKER' || teenPattiState.variant.fiveCardJoker === 'TWO_REFERENCE_JOKER' ? 'References A · B' : 'Reference'}</span>
            <div>
              {teenPattiState.variantReferenceCards.map((card) => <PlayingCard key={card.id} card={card} size="sm" />)}
            </div>
          </div>
        )}
        <div className="tp-table-screen__pot" aria-label={`Pot ${teenPattiState.pot}`}>
          <span>Pot</span>
          <strong>{teenPattiState.pot}</strong>
        </div>
        <button type="button" className="tp-table-screen__rules" onClick={onOpenRules}>
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
          dealCardsEach={dealing ? teenPattiState.variantDealCount : 0}
          centreLabel={centreLabel}
          centreLabelEmphasis={(isMyTurn || mutualShowOpen) && !dealing}
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
        <div className={`tp-hand__cards${discardState ? ' has-discards' : ''}`}>
          {dealing
            ? Array.from({ length: cardCount }, (_, index) => (
                <span key={`deal-slot-${index}`} className="tp-hand__deal-slot" aria-hidden="true" />
              ))
            : myCardsViewed && myCards.length > 0
            ? myCards.map((card, index) => {
                const discarded = shownDiscardSlots.includes(index);
                const selectable = awaitingDiscard && !discardState?.complete && legalDiscardSelections.some((selection) => selection.includes(index));
                return (
                  <button
                    type="button"
                    key={card.id}
                    className={`tp-hand__card-slot${discarded ? ' is-discarded' : ''}${selectable ? ' is-selectable' : ''}`}
                    onClick={() => toggleDiscardSlot(index)}
                    disabled={!selectable}
                    aria-label={`${discarded ? 'Selected to discard, ' : ''}${card.rank} ${card.suit}`}
                  >
                    <PlayingCard card={card} size="md" tilt={(index - (myCards.length - 1) / 2) * 2} />
                    {discarded && <span className="tp-hand__discard-mark">Discard</span>}
                  </button>
                );
              })
            : Array.from({ length: cardCount }, (_, index) => {
                const discarded = shownDiscardSlots.includes(index);
                const selectable = awaitingDiscard && !discardState?.complete && legalDiscardSelections.some((selection) => selection.includes(index));
                return (
                  <button
                    type="button"
                    key={`hidden-${index}`}
                    className={`tp-hand__card-slot${discarded ? ' is-discarded' : ''}${selectable ? ' is-selectable' : ''}`}
                    onClick={() => toggleDiscardSlot(index)}
                    disabled={!selectable}
                    aria-label={selectable ? `Facedown discard option ${index + 1}` : `Facedown card ${index + 1}`}
                  >
                    <PlayingCard faceDown size="md" tilt={(index - (cardCount - 1) / 2) * 2} />
                    {discarded && <span className="tp-hand__discard-mark">Discard</span>}
                  </button>
                );
              })}
        </div>
        <div className="tp-hand__money">
          <span>Balance <strong>{me.chips}</strong></span>
          <span className={me.profitLoss >= 0 ? 'is-positive' : 'is-negative'}>
            P/L {me.profitLoss >= 0 ? '+' : ''}{me.profitLoss}
          </span>
          <button type="button" onClick={() => setTopUpOpen((open) => !open)}>Top up</button>
        </div>
      </section>

      {friendlyAssist.enabled && !me.packed && incomingAssist.length > 0 && (
        <aside className="tp-friendly-incoming" aria-label="Friendly Assist requests and suggestions">
          {pendingIncomingAssist.map((request) => (
            <div className="tp-friendly-incoming__request" key={request.requestId}>
              <div>
                <strong>{playerName(request.coachPlayerId)} wants to watch & suggest</strong>
                <small>If you accept while blind, your betting status becomes Seen. Your own cards can stay closed.</small>
              </div>
              <div>
                <button className="btn btn-primary" type="button" onClick={() => respondTeenPattiFriendlyAssist(request.requestId, true)}>Allow</button>
                <button className="btn btn-ghost" type="button" onClick={() => respondTeenPattiFriendlyAssist(request.requestId, false)}>Decline</button>
              </div>
            </div>
          ))}
          {acceptedIncomingAssist.map((request) => (
            <div className="tp-friendly-incoming__active" key={request.requestId}>
              <span><strong>{playerName(request.coachPlayerId)}</strong> is watching</span>
              {request.lastSuggestion && <em>{suggestionLabel[request.lastSuggestion]}</em>}
              <button type="button" onClick={() => revokeTeenPattiFriendlyAssist(request.requestId)}>Stop</button>
            </div>
          ))}
        </aside>
      )}

      <footer className="tp-actions" aria-label="Teen Patti actions">
        {!dealing && !privateSnapshotReady ? (
          <p className="tp-actions__status" role="status" aria-live="polite">Syncing your private hand…</p>
        ) : awaitingDiscard && !dealing ? (
          <div className="tp-discard-choice" role="group" aria-label="Choose five-card discards">
            <div className="tp-discard-choice__copy">
              <strong>{discardState?.complete ? 'Your discards are locked' : 'Choose the required two discards'}</strong>
              <small>{myCardsViewed ? 'Equal-ranked cards are your choice. Suit can matter, so select the physical cards you want to remove from the active three.' : 'You may stay blind and choose only among the eligible facedown positions, or see all five and become seen for this round.'}</small>
            </div>
            {discardState?.complete ? (
              <p className="tp-actions__substatus">Your five cards stay with you · waiting for {Math.max(0, teenPattiState.players.length - teenPattiState.discardSelectionsComplete)} player{Math.max(0, teenPattiState.players.length - teenPattiState.discardSelectionsComplete) === 1 ? '' : 's'}.</p>
            ) : (
              <div className="tp-discard-choice__actions">
                {!myCardsViewed && <button className="btn" type="button" onClick={() => act({ type: 'SEE' })}>See 5 cards · become seen</button>}
                <button className="btn btn-primary" type="button" disabled={!isDraftDiscardLegal} onClick={() => chooseTeenPattiDiscards(draftDiscardSlots)}>Lock {draftDiscardSlots.length}/2 discards</button>
              </div>
            )}
          </div>
        ) : awaitingReferenceAssignment && !dealing ? (
          <div className="tp-reference-choice" role="group" aria-label="Choose Two-Reference Joker roles">
            <div className="tp-reference-choice__copy">
              <strong>Choose your joker roles</strong>
              <small>One board card supplies Up + Down. The other card’s own rank is Same. Your choice is private.</small>
            </div>
            {myReferenceAssignment ? (
              <p className="tp-actions__substatus">Locked · waiting for {Math.max(0, teenPattiState.players.length - teenPattiState.twoReferenceAssignmentsComplete)} player{Math.max(0, teenPattiState.players.length - teenPattiState.twoReferenceAssignmentsComplete) === 1 ? '' : 's'}.</p>
            ) : referenceA && referenceB ? (
              <div className="tp-reference-choice__buttons">
                <button className="btn btn-primary" type="button" onClick={() => assignTeenPattiTwoReference(0)}>
                  A: Up/Down · B: Same
                </button>
                <button className="btn" type="button" onClick={() => assignTeenPattiTwoReference(1)}>
                  B: Up/Down · A: Same
                </button>
              </div>
            ) : (
              <p className="tp-actions__status">Waiting for the two board references…</p>
            )}
          </div>
        ) : mutualShowOpen && !me.packed ? (
          <div className="tp-open-show-request" role="dialog" aria-label="Mutual Show request">
            <p><strong>{requesterName}</strong> proposes a free Mutual Show.</p>
            <small>{acceptedMutualCount}/{active.length} active players accepted · cards open only if everyone agrees.</small>
            {iAcceptedMutualShow ? (
              <p className="tp-actions__substatus">You accepted · waiting for the remaining players.</p>
            ) : (
              <div>
                <button className="btn btn-primary" type="button" onClick={() => act({ type: 'ACCEPT_OPEN_SHOW' })}>Accept show</button>
                <button className="btn btn-ghost" type="button" onClick={() => act({ type: 'DECLINE_OPEN_SHOW' })}>Keep betting</button>
              </div>
            )}
          </div>
        ) : me.packed ? (
          friendlyAssist.enabled ? (
            <div className="tp-friendly-coach">
              {!outgoingAssist ? (
                friendlyAssist.coachLockedTargetPlayerId ? (
                  <>
                    <div className="tp-friendly-coach__copy">
                      <strong>Friendly Assist finished</strong>
                      <small>You already watched {playerName(friendlyAssist.coachLockedTargetPlayerId)} this hand, so you cannot switch to another player’s cards.</small>
                    </div>
                    <p className="tp-actions__status">Keep watching the table · a fresh assist choice is available next hand.</p>
                  </>
                ) : (
                  <>
                    <div className="tp-friendly-coach__copy">
                      <strong>Watch & Suggest</strong>
                      <small>Ask one active friend for permission. You can coach only that player for the rest of this hand.</small>
                    </div>
                    <div className="tp-friendly-coach__targets">
                      {coachablePlayers.length > 0 ? coachablePlayers.map((player) => (
                        <button className="btn" type="button" key={player.playerId} onClick={() => requestTeenPattiFriendlyAssist(player.playerId)}>
                          Watch {playerName(player.playerId)}
                        </button>
                      )) : <span>No human player is available to coach.</span>}
                    </div>
                  </>
                )
              ) : outgoingAssist.status === 'PENDING' ? (
                <>
                  <div className="tp-friendly-coach__copy">
                    <strong>Waiting for {playerName(outgoingAssist.targetPlayerId)}</strong>
                    <small>Their cards remain private unless they explicitly allow your request.</small>
                  </div>
                  <button className="btn btn-ghost" type="button" onClick={() => revokeTeenPattiFriendlyAssist(outgoingAssist.requestId)}>Cancel request</button>
                </>
              ) : (
                <>
                  <div className="tp-friendly-coach__copy">
                    <strong>Watching {playerName(outgoingAssist.targetPlayerId)}</strong>
                    <small>Your suggestions are private and never perform the action for them.</small>
                  </div>
                  <div className="tp-friendly-coach__cards" aria-label={`${playerName(outgoingAssist.targetPlayerId)} cards`}>
                    {outgoingAssist.targetCards.map((card, index) => {
                      const discarded = outgoingAssist.targetDiscardedCardIds.includes(card.id);
                      return (
                        <div className={`tp-friendly-coach__card${discarded ? ' is-discarded' : ''}`} key={card.id}>
                          <PlayingCard card={card} size="sm" tilt={(index - (outgoingAssist.targetCards.length - 1) / 2) * 2} />
                          {discarded && <span>Discard</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="tp-friendly-coach__suggestions" role="group" aria-label="Private suggestions">
                    {(Object.keys(suggestionLabel) as TeenPattiFriendlySuggestion[]).map((suggestion) => (
                      <button
                        className={outgoingAssist.lastSuggestion === suggestion ? 'is-active' : ''}
                        type="button"
                        key={suggestion}
                        onClick={() => suggestTeenPattiFriendlyAssist(outgoingAssist.requestId, suggestion)}
                      >
                        {suggestionLabel[suggestion]}
                      </button>
                    ))}
                    <button className="is-stop" type="button" onClick={() => revokeTeenPattiFriendlyAssist(outgoingAssist.requestId)}>Stop watching</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="tp-actions__status">You packed this round · watching the table.</p>
          )
        ) : dealing ? (
          <p className="tp-actions__status">Dealing {teenPattiState.variantDealCount} cards…</p>
        ) : !isMyTurn ? (
          <div className="tp-actions__waiting">
            <p className="tp-actions__status">{teenPattiState.currentTurn ? `Waiting for ${turnName}…` : 'Resolving round…'}</p>
            {active.length >= 2 && teenPattiState.currentTurn && (
              <button className="btn btn-ghost" type="button" onClick={() => act({ type: 'REQUEST_OPEN_SHOW' })}>Propose Mutual Show</button>
            )}
          </div>
        ) : compulsorySideshow ? (
          <div className="tp-actions__buttons">
            <button className="btn btn-primary tp-actions__primary" type="button" onClick={() => act({ type: 'SIDESHOW' })}>
              Compulsory sideshow
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => act({ type: 'REQUEST_OPEN_SHOW' })}>
              Propose Mutual Show
            </button>
          </div>
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
            {active.length >= 2 && (
              <button className="btn" type="button" onClick={() => act({ type: 'REQUEST_OPEN_SHOW' })}>
                Propose Mutual Show
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


      {teenPattiState.lastSideshow && (
        <aside
          className={`tp-sideshow-note${teenPattiState.lastSideshow.revealedHands?.length ? ' has-reveal' : ''}`}
          role="status"
          aria-label="Sideshow result"
        >
          <div className="tp-sideshow-note__summary">
            <strong>{playerName(teenPattiState.lastSideshow.packedPlayerId)} packed after sideshow</strong>
            {teenPattiState.lastSideshow.tied && <span>Exact tie · initiator packs</span>}
          </div>
          {teenPattiState.lastSideshow.revealedHands && teenPattiState.lastSideshow.revealedHands.length > 0 && (
            <div className="tp-sideshow-note__hands" aria-label="Five-card sideshow reveal">
              {teenPattiState.lastSideshow.revealedHands.map((entry) => (
                <div className="tp-sideshow-note__hand" key={entry.playerId}>
                  <div className="tp-sideshow-note__hand-copy">
                    <strong>{playerName(entry.playerId)}</strong>
                    <small>{entry.description}</small>
                  </div>
                  <div className="tp-sideshow-note__cards">
                    {entry.cards.map((card, index) => {
                      const discarded = entry.discardedCardIds?.includes(card.id) ?? false;
                      return (
                        <div className={`tp-sideshow-note__card${discarded ? ' is-discarded' : ''}`} key={card.id}>
                          <PlayingCard card={card} size="sm" tilt={(index - (entry.cards.length - 1) / 2) * 1.4} />
                          {discarded && <span>Discard</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      )}

      {gameError && (
        <button type="button" className="tp-error" onClick={clearGameError}>{gameError}</button>
      )}
    </main>
  );
}
