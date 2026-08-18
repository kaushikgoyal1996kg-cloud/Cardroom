import { useMemo, useState } from 'react';
import { CardTable } from '../../platform/components/CardTable';
import { PlayingCard, type CardData } from '../../platform/components/PlayingCard';
import type { SeatPlayer } from '../../platform/components/Seat';
import { clampWhole, pokerQuickRaisePresets } from './betSizing';
import './PokerTable.css';

export interface PokerTableLegalActions {
  fold: boolean;
  check: boolean;
  call: boolean;
  raise: boolean;
  minRaiseTo: number | null;
  maxRaiseTo: number | null;
}

export interface PokerTableProps {
  players: SeatPlayer[];
  selfId: string;
  dealerId: string;
  activePlayerId: string | null;
  variantName: string;
  streetLabel: string;
  board: CardData[];
  holeCards: CardData[];
  holeCardCount: number;
  dealPlayerIds?: string[];
  dealing?: boolean;
  pot: number;
  currentBet: number;
  toCall: number;
  legalActions: PokerTableLegalActions;
  betting: 'NO_LIMIT' | 'POT_LIMIT' | 'ANTE_NO_LIMIT';
  stakesLabel: string;
  /** Hand-complete/result screens keep the felt visible but retire the local
   *  hand/action rail so the between-hand bankroll/result surfaces cannot
   *  stack on top of it. */
  showLocalPanel?: boolean;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaiseTo: (amount: number) => void;
}

export function PokerTable({
  players,
  selfId,
  dealerId,
  activePlayerId,
  variantName,
  streetLabel,
  board,
  holeCards,
  holeCardCount,
  dealPlayerIds,
  dealing = false,
  pot,
  currentBet,
  toCall,
  legalActions,
  betting,
  stakesLabel,
  showLocalPanel = true,
  onFold,
  onCheck,
  onCall,
  onRaiseTo,
}: PokerTableProps) {
  const isMyTurn = activePlayerId === selfId;
  const minRaise = legalActions.minRaiseTo ?? 0;
  const maxRaise = legalActions.maxRaiseTo ?? 0;
  const [raiseTo, setRaiseTo] = useState(minRaise);

  const suggested = useMemo(() => {
    if (!legalActions.raise) return [];
    return pokerQuickRaisePresets(betting, pot, currentBet, toCall, minRaise, maxRaise);
  }, [betting, currentBet, legalActions.raise, maxRaise, minRaise, pot, toCall]);

  const effectiveRaise = clampWhole(raiseTo || minRaise, minRaise, maxRaise || minRaise);
  const aggressiveActionLabel = currentBet > 0 ? `Raise to ${effectiveRaise || '—'}` : `Bet ${effectiveRaise || '—'}`;
  const centre = (
    <div className="poker-board" aria-label={`${streetLabel}, pot ${pot}`}>
      <div className="poker-board__variant">
        <span>{variantName}</span>
        <strong>{streetLabel}</strong>
        <small>{stakesLabel}</small>
      </div>
      <div className="poker-board__cards" aria-label="Community cards">
        {Array.from({ length: 5 }).map((_, index) => (
          <span className="poker-board__slot" key={index}>
            {board[index]
              ? <PlayingCard card={board[index]} size="sm" />
              : <span className="poker-board__empty" aria-hidden="true" />}
          </span>
        ))}
      </div>
      <div className="poker-board__pot">
        <span>Pot</span>
        <strong>{pot}</strong>
      </div>
    </div>
  );

  return (
    <div className={`poker-table-screen${showLocalPanel ? '' : ' is-result'}`}>
      <CardTable
        players={players}
        selfId={selfId}
        dealerId={dealerId}
        activePlayerId={dealing ? null : activePlayerId}
        centreContent={centre}
        centreLabel={dealing ? 'Dealing…' : isMyTurn ? 'Your action' : undefined}
        dealing={dealing}
        dealCardsEach={dealing ? holeCardCount : 0}
        dealStart="LEFT_OF_DEALER"
        dealPlayerIds={dealPlayerIds}
      >
        {showLocalPanel && <section className="poker-local" aria-label="Your poker hand and actions">
          <div className="poker-local__hand">
            <div className="poker-local__cards">
              {!dealing && holeCards.map((card, index) => (
                <PlayingCard key={card.id} card={card} size="md" tilt={(index - (holeCards.length - 1) / 2) * 2.4} />
              ))}
              {dealing && Array.from({ length: holeCardCount }).map((_, index) => (
                <span key={`dealing-slot-${index}`} className="poker-local__deal-slot" aria-hidden="true" />
              ))}
            </div>
            <div className="poker-local__caption">
              <span>{dealing ? 'Dealing your hand' : 'Your hand'}</span>
              {dealing
                ? <strong>Cards on the way…</strong>
                : toCall > 0
                  ? <strong>{toCall} to call</strong>
                  : <strong>{isMyTurn ? 'Action on you' : 'Waiting'}</strong>}
            </div>
          </div>

          <div className={`poker-actions${!dealing && isMyTurn ? ' is-live' : ''}`}>
            {dealing ? (
              <p className="poker-actions__waiting">Dealing clockwise from left of the dealer…</p>
            ) : !isMyTurn ? (
              <p className="poker-actions__waiting">Waiting for the next action…</p>
            ) : (
              <>
                <div className="poker-actions__primary">
                  <button type="button" className="poker-action poker-action--fold" disabled={!legalActions.fold} onClick={onFold}>Fold</button>
                  {legalActions.check ? (
                    <button type="button" className="poker-action poker-action--main" onClick={onCheck}>Check</button>
                  ) : (
                    <button type="button" className="poker-action poker-action--main" disabled={!legalActions.call} onClick={onCall}>Call {toCall}</button>
                  )}
                  <button
                    type="button"
                    className="poker-action poker-action--raise"
                    disabled={!legalActions.raise}
                    onClick={() => onRaiseTo(effectiveRaise)}
                  >
                    {aggressiveActionLabel}
                  </button>
                </div>

                {legalActions.raise && (
                  <div className="poker-bet-controls">
                    <div className="poker-bet-controls__presets" aria-label="Quick raise sizes">
                      {suggested.map((choice) => (
                        <button type="button" key={`${choice.label}-${choice.amount}`} onClick={() => setRaiseTo(choice.amount)}>
                          <span>{choice.label}</span><strong>{choice.amount}</strong>
                        </button>
                      ))}
                    </div>
                    <label className="poker-bet-controls__slider">
                      <span>Raise amount</span>
                      <input
                        type="range"
                        min={minRaise}
                        max={maxRaise}
                        step="1"
                        value={effectiveRaise}
                        onChange={(event) => setRaiseTo(Number(event.target.value))}
                      />
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        </section>}
      </CardTable>
    </div>
  );
}
