import { useGame } from '../lib/GameStore';
import type { Card } from '../game/types';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './RulesModal.css';
import './StatsModal.css';

interface Props { onClose: () => void; }

const TEEN_PATTI_REASON = {
  LAST_STANDING: 'Last player standing',
  PAID_SHOWDOWN: 'Showdown',
  MUTUAL_OPEN_SHOW: 'Mutual open show',
} as const;

const SUIT_SYMBOL = {
  SPADES: '♠',
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
} as const;

function cardText(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}


export function RoundHistoryModal({ onClose }: Props) {
  const {
    room,
    roundHistory,
    kittiRoundHistory,
    teenPattiRoundHistory,
    pokerHandHistory,
  } = useGame();
  if (!room) return null;

  const nameOf = (pid: string) => room.players.find((p) => p.playerId === pid)?.name
    ?? room.playerDirectory?.[pid]?.name
    ?? 'Former player';
  const gameName = room.gameId === 'HAZARI'
    ? 'Hazari'
    : room.gameId === 'KITTI'
      ? 'Kitti'
      : room.gameId === 'TEEN_PATTI'
        ? 'Teen Patti'
        : 'Poker';
  const title = room.gameId === 'POKER' ? 'Hand History' : 'Round History';
  const empty = room.gameId === 'KITTI'
    ? kittiRoundHistory.length === 0
    : room.gameId === 'TEEN_PATTI'
      ? teenPattiRoundHistory.length === 0
      : room.gameId === 'POKER'
        ? pokerHandHistory.length === 0
        : roundHistory.length === 0;

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-panel panel" onClick={(e) => e.stopPropagation()}>
        <div className="rules-panel__header">
          <div><p className="rules-panel__eyebrow">{gameName}</p><h2>{title}</h2></div>
          <button className="rules-close btn btn-ghost" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}><ChromeIcon name="close" /></button>
        </div>

        {empty ? (
          <div className="stats-modal__empty">
            <span className="stats-modal__empty-mark" aria-hidden="true">CR</span>
            <p>No completed {room.gameId === 'POKER' ? 'hands' : 'rounds'} yet.</p>
            <small>This table's results will appear here as you play and return after reconnect.</small>
          </div>
        ) : room.gameId === 'KITTI' ? (
          <div className="round-history-list">
            {[...kittiRoundHistory].reverse().map((r) => (
              <div key={r.roundNumber} className="round-history-row">
                <div className="round-history-row__header">
                  <span>Round {r.roundNumber}{r.suddenDeath ? <span className="round-history-row__sudden"> · sudden death</span> : null}</span>
                  <span className="text-muted">Dealer: {nameOf(r.dealerId)}</span>
                </div>
                <div className="round-history-row__winner">
                  {r.winnerId ? <>Won by <strong>{nameOf(r.winnerId)}</strong></> : <strong>1–1–1 · pot carried</strong>}
                </div>
                <div className="round-history-row__scores">
                  {room.players.map((player) => (
                    <div key={player.playerId} className="round-history-row__player">
                      <span>{player.name}</span>
                      <span>{r.roundsWon[player.playerId] ?? 0} round{(r.roundsWon[player.playerId] ?? 0) === 1 ? '' : 's'} won</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : room.gameId === 'TEEN_PATTI' ? (
          <div className="round-history-list">
            {[...teenPattiRoundHistory].reverse().map((r) => (
              <div key={r.roundNumber} className="round-history-row">
                <div className="round-history-row__header">
                  <span>Round {r.roundNumber} · {r.variantName}</span>
                  <span className="text-muted">Dealer: {nameOf(r.dealerId)}</span>
                </div>
                <div className="round-history-row__winner">
                  {r.winnerIds.length > 1
                    ? <>Split by <strong>{r.winnerIds.map(nameOf).join(' & ')}</strong></>
                    : <>Won by <strong>{nameOf(r.winnerIds[0])}</strong></>}
                </div>
                <div className="round-history-row__scores">
                  <div className="round-history-row__player"><span>Pot awarded</span><span>{r.potAwarded}</span></div>
                  <div className="round-history-row__player"><span>Finish</span><span>{r.split ? 'Split pot' : TEEN_PATTI_REASON[r.reason]}</span></div>
                </div>
                {r.showdown?.length ? (
                  <div className="round-history-row__showdown">
                    {r.showdown.map((entry) => (
                      <div key={entry.playerId} className="round-history-row__showdown-entry">
                        <span>{nameOf(entry.playerId)}</span>
                        <span className="round-history-row__cards">{entry.cards.map(cardText).join(' ')}</span>
                        <small>{entry.description}</small>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : room.gameId === 'POKER' ? (
          <div className="round-history-list">
            {[...pokerHandHistory].reverse().map((hand) => {
              const totalAwarded = hand.pots.reduce((sum, pot) => sum + pot.amount, 0);
              return (
                <div key={hand.handNumber} className="round-history-row">
                  <div className="round-history-row__header">
                    <span>Hand {hand.handNumber} · {hand.variantName}</span>
                    <span className="text-muted">Dealer: {nameOf(hand.dealerId)}</span>
                  </div>
                  <div className="round-history-row__winner">
                    {hand.winnerIds.length > 1
                      ? <>Won by <strong>{hand.winnerIds.map(nameOf).join(' & ')}</strong></>
                      : <>Won by <strong>{nameOf(hand.winnerIds[0])}</strong></>}
                  </div>
                  <div className="round-history-row__scores">
                    <div className="round-history-row__player"><span>Finish</span><span>{hand.reason === 'SHOWDOWN' ? 'Showdown' : 'Last player standing'}</span></div>
                    <div className="round-history-row__player"><span>Total awarded</span><span>{totalAwarded}</span></div>
                    {hand.board.length ? <div className="round-history-row__player"><span>Board</span><span className="round-history-row__cards">{hand.board.map(cardText).join(' ')}</span></div> : null}
                    {hand.pots.length > 1 ? hand.pots.map((pot, index) => (
                      <div key={`${hand.handNumber}-pot-${index}`} className="round-history-row__player">
                        <span>{index === 0 ? 'Main pot' : `Side pot ${index}`}</span>
                        <span>{pot.amount} → {pot.winnerIds.map(nameOf).join(' & ')}</span>
                      </div>
                    )) : null}
                  </div>
                  {hand.showdown?.length ? (
                    <div className="round-history-row__showdown">
                      {hand.showdown.map((entry) => (
                        <div key={entry.playerId} className="round-history-row__showdown-entry">
                          <span>{nameOf(entry.playerId)}</span>
                          <span className="round-history-row__cards">{entry.holeCards.map(cardText).join(' ')}</span>
                          <small>{entry.hand.category}</small>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="round-history-list">
            {[...roundHistory].reverse().map((r) => (
              <div key={r.roundNumber} className="round-history-row">
                <div className="round-history-row__header">
                  <span>Round {r.roundNumber} {r.dismissed && <span className="round-history-row__dismissed">· dismissed</span>}</span>
                  <span className="text-muted">Dealer: {nameOf(r.dealerId)}</span>
                </div>
                <div className="round-history-row__scores">
                  {room.players.map((player) => (
                    <div key={player.playerId} className="round-history-row__player">
                      <span>{player.name}</span>
                      <span>{r.dismissed ? '0' : `+${r.pointsThisRound[player.playerId] ?? 0}`}<span className="text-muted"> · {r.cumulativeScores[player.playerId] ?? 0}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
