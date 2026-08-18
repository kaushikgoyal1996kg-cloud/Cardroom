import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import type { Card, KittiHandResult, PlayerId } from '../../game/types';
import { CardTable, type PlayedSetView } from '../../platform/components/CardTable';
import type { SeatPlayer } from '../../platform/components/Seat';
import { PlayingCard } from '../../platform/components/PlayingCard';
import { classifyThree, labelFor } from '../../game/handClassification';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useWakeLock } from '../../lib/useWakeLock';
import { PlayMoneyPotBadge } from '../../platform/components/PlayMoneyBoard';
import { PhaseTrack } from '../../platform/components/PhaseTrack';
import './KittiTable.css';

const HAND_NAMES = ['Hand 1', 'Hand 2', 'Hand 3'];

export function KittiTable() {
  const {
    room,
    myPlayerId,
    kittiState,
    kittiArrangedGroups,
    kittiDeciderHand,
    lastKittiRoundResult,
    playKittiHand,
    playKittiDecider,
    gameError,
    clearGameError,
    voiceParticipants,
    speakingPlayerIds,
    isRestoring,
    restorationGeneration,
  } = useGame();
  const [pending, setPending] = useState(false);
  const [dismissedRevealKey, setDismissedRevealKey] = useState<string | null>(null);
  const seenPlayKeysRef = useRef<Set<string> | null>(null);
  const seenRestorationGenRef = useRef(restorationGeneration);

  const order = kittiState?.currentPlayOrder ?? [];
  const playedCount = kittiState?.playersPlayedThisHand.length ?? 0;
  const nextToPlay = order[playedCount] ?? null;
  const isMyTurn = !!myPlayerId && nextToPlay === myPlayerId;
  useWakeLock(isMyTurn);

  useEffect(() => setPending(false), [playedCount, kittiState?.state]);

  const completedWithDecider = !!kittiState
    && ['ROUND_COMPLETE', 'MATCH_COMPLETE'].includes(kittiState.state)
    && kittiState.deciderPlayerIds.length > 0;
  const latestResult: KittiHandResult | null =
    kittiState?.handResultsThisRound[kittiState.handResultsThisRound.length - 1] ?? null;
  const completedDecider = completedWithDecider ? lastKittiRoundResult?.decider ?? null : null;
  const revealKey = completedDecider && kittiState
    ? `${kittiState.roundNumber}:decider:${completedDecider.winnerId}`
    : latestResult && kittiState
      ? `${kittiState.roundNumber}:${latestResult.handIndex}:${latestResult.winnerId}`
      : null;
  const showReveal = !!(completedDecider || latestResult) && revealKey !== dismissedRevealKey;

  useEffect(() => {
    if (!showReveal || !revealKey) return;
    const timer = setTimeout(() => setDismissedRevealKey(revealKey), 2600);
    return () => clearTimeout(timer);
  }, [showReveal, revealKey]);

  const seats: SeatPlayer[] = useMemo(() => {
    if (!room || !kittiState) return [];
    return room.players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      avatar: p.avatar,
      score: kittiState.roundsWon[p.playerId] ?? 0,
      scoreLabel: 'rounds',
      isBot: p.isBot,
      connection: p.connected || p.isBot ? 'CONNECTED' : 'DISCONNECTED',
      hasActed: kittiState.playersPlayedThisHand.includes(p.playerId),
      inVoiceCall: voiceParticipants.includes(p.playerId),
      speaking: speakingPlayerIds.includes(p.playerId),
      statusLabel: p.isBot && p.playerId === nextToPlay ? 'Thinking…' : undefined,
    }));
  }, [room, kittiState, voiceParticipants, speakingPlayerIds, nextToPlay]);

  if (!room || !kittiState || !myPlayerId) {
    return <div className="waiting-screen"><LoadingSpinner message="Returning to Kitti…" /></div>;
  }

  const isDecider = kittiState.state === 'PLAYING_DECIDER' || completedWithDecider;
  const isSpectator = kittiState.spectatorIds.includes(myPlayerId);
  const nameOf = (id: PlayerId | null) => room.players.find((p) => p.playerId === id)?.name ?? 'Player';
  const phaseLabel = isDecider
    ? 'Three-winner decider'
    : `${HAND_NAMES[kittiState.currentHandIndex]} of 3`;
  const roundLabel = kittiState.suddenDeath
    ? `Sudden death · Round ${kittiState.roundNumber}`
    : `Round ${Math.min(kittiState.roundNumber, 10)} of 10`;

  // Animate only genuinely new throws. On first observation/reconnect, seed
  // the current set silently rather than replaying history.
  const currentKeys = kittiState.playedThisHand.map((throw_) => `${kittiState.roundNumber}:${kittiState.state}:${throw_.playerId}`);
  const reseed = seenPlayKeysRef.current === null || isRestoring || seenRestorationGenRef.current !== restorationGeneration;
  if (reseed) {
    seenPlayKeysRef.current = new Set(currentKeys);
    seenRestorationGenRef.current = restorationGeneration;
  }
  const seen = seenPlayKeysRef.current ?? new Set<string>();
  const tableSets: PlayedSetView[] = kittiState.playedThisHand.map((throw_) => {
    const key = `${kittiState.roundNumber}:${kittiState.state}:${throw_.playerId}`;
    const arriving = !reseed && !seen.has(key);
    seen.add(key);
    return { playerId: throw_.playerId, cards: throw_.cards, arriving };
  });

  const myCurrentCards: Card[] = isDecider
    ? kittiDeciderHand
    : (kittiArrangedGroups?.[kittiState.currentHandIndex] ?? []);

  const revealPlayed = completedDecider?.played ?? latestResult?.played ?? [];
  const revealWinnerId = completedDecider?.winnerId ?? latestResult?.winnerId ?? null;
  const revealWasTie = completedDecider?.wasTie ?? latestResult?.wasTie ?? false;
  const revealTitle = completedDecider ? 'Decider' : latestResult ? HAND_NAMES[latestResult.handIndex] : '';

  function play() {
    if (!isMyTurn || pending || isSpectator) return;
    setPending(true);
    if (isDecider) playKittiDecider();
    else playKittiHand();
  }

  return (
    <main className="kitti-table-screen">
      <header className="kitti-table-screen__bar">
        <div>
          <p className="kitti-table-screen__eyebrow">Kitti · {roundLabel}</p>
          <h1 className="kitti-table-screen__title">{phaseLabel}</h1>
        </div>
        <PhaseTrack
          labels={isDecider ? ['Decider'] : HAND_NAMES}
          activeIndex={isDecider ? 0 : kittiState.currentHandIndex}
          completedIndexes={isDecider ? [] : kittiState.handResultsThisRound.map((result) => result.handIndex)}
          ariaLabel={`${roundLabel} progress`}
          compact
        />
        <div className="kitti-table-screen__scoreline">
          <span>{kittiState.scheduledRoundsComplete}/10 complete</span>
          {kittiState.suddenDeath && <strong>Leaders only</strong>}
          <PlayMoneyPotBadge />
        </div>
      </header>

      <section className="kitti-table-screen__table">
        <CardTable
          players={seats}
          selfId={myPlayerId}
          dealerId={kittiState.roundDealerId}
          activePlayerId={nextToPlay}
          playedSets={tableSets}
          centreLabel={isSpectator
            ? 'Sudden death — watching'
            : isMyTurn
              ? 'Your turn'
              : nextToPlay
                ? room.players.find((p) => p.playerId === nextToPlay)?.isBot
                  ? `${nameOf(nextToPlay)} is thinking…`
                  : `Waiting for ${nameOf(nextToPlay)}`
                : 'Resolving hand…'}
          centreLabelEmphasis={isMyTurn}
        />
      </section>

      <section className="kitti-table-screen__rack" aria-label={isSpectator ? 'Sudden-death spectator status' : 'Your Kitti hands'}>
        {isSpectator ? (
          <div className="kitti-mini-hand is-disabled">
            <div className="kitti-mini-hand__label">
              <span>Watching sudden death</span>
              <small>Only the tied leaders receive cards</small>
            </div>
          </div>
        ) : isDecider ? (
          <div className={`kitti-mini-hand is-active${isSpectator ? ' is-disabled' : ''}`}>
            <div className="kitti-mini-hand__label">
              <span>Decider</span>
              <small>{kittiDeciderHand.length === 3 ? labelFor(classifyThree(kittiDeciderHand)) : 'Fresh 3 cards'}</small>
            </div>
            <div className="kitti-mini-hand__cards">
              {kittiDeciderHand.map((card, cardIndex) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="sm"
                  tilt={(cardIndex - (kittiDeciderHand.length - 1) / 2) * 1.25}
                />
              ))}
            </div>
          </div>
        ) : (
          kittiArrangedGroups?.map((group, index) => {
            const completed = kittiState.handResultsThisRound.some((r) => r.handIndex === index);
            const active = index === kittiState.currentHandIndex && !completed;
            return (
              <div key={index} className={`kitti-mini-hand${active ? ' is-active' : ''}${completed ? ' is-complete' : ''}`}>
                <div className="kitti-mini-hand__label">
                  <span>{HAND_NAMES[index]}</span>
                  <small>{labelFor(classifyThree(group))}</small>
                </div>
                <div className="kitti-mini-hand__cards">
                  {group.map((card, cardIndex) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      size="sm"
                      disabled={!active}
                      tilt={(cardIndex - (group.length - 1) / 2) * 1.15}
                    />
                  ))}
                </div>
                {completed && <span className="kitti-mini-hand__done">Played</span>}
              </div>
            );
          })
        )}
      </section>

      <footer className="kitti-table-screen__actions">
        {isSpectator ? (
          <p>Only the tied leaders play sudden death. Your seat remains at the table.</p>
        ) : isMyTurn ? (
          <button className="btn btn-primary" type="button" onClick={play} disabled={pending || myCurrentCards.length !== 3}>
            {pending ? 'Playing…' : `Play ${isDecider ? 'decider' : HAND_NAMES[kittiState.currentHandIndex]}`}
          </button>
        ) : (
          <p>{nextToPlay ? `Waiting for ${nameOf(nextToPlay)}…` : 'Resolving…'}</p>
        )}
      </footer>

      {gameError && <button type="button" className="kitti-table-screen__toast" onClick={clearGameError}>{gameError}</button>}

      {showReveal && revealWinnerId && (
        <div className="kitti-reveal" role="dialog" aria-label={`${revealTitle} result`}>
          <div className="kitti-reveal__sheet">
            <p className="kitti-reveal__eyebrow">{revealTitle}</p>
            <h2>{nameOf(revealWinnerId)} wins</h2>
            {revealWasTie && <p className="kitti-reveal__tie">Exact tie — later throw wins</p>}
            <div className="kitti-reveal__hands">
              {revealPlayed.map((entry) => (
                <div key={entry.playerId} className={`kitti-reveal__hand${entry.playerId === revealWinnerId ? ' is-winner' : ''}`}>
                  <span>{nameOf(entry.playerId)}{entry.playerId === revealWinnerId ? ' · won' : ''}</span>
                  <div>{entry.cards.map((card) => <PlayingCard key={card.id} card={card} size="sm" highlighted={entry.playerId === revealWinnerId} />)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
