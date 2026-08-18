import { useMemo, useState } from 'react';
import type {
  PokerAction,
  PokerHandOutcomePayload,
  PokerPrivateStatePayload,
  PokerPublicStatePayload,
  PokerVariantId,
} from '../../game/types';
import { PlayingCard } from '../../platform/components/PlayingCard';
import { useVisualViewport } from '../../platform/lib/useVisualViewport';
import { PokerTable } from './PokerTable';
import { PokerVariantChoice } from './PokerVariantChoice';
import {
  pokerSeatPlayers,
  pokerStreetLabel,
  pokerWinnerNames,
  type PokerRuntimeIdentity,
} from './runtime';
import './PokerRuntimeView.css';

function pokerCategoryLabel(category: string): string {
  return category
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export interface PokerRuntimeViewProps {
  state: PokerPublicStatePayload;
  privateState: PokerPrivateStatePayload | null;
  selfId: string;
  players: PokerRuntimeIdentity[];
  lastHandResult?: PokerHandOutcomePayload | null;
  dealing?: boolean;
  canStartNextHand?: boolean;
  onChooseVariant: (variantId: PokerVariantId) => void;
  onAction: (action: PokerAction) => void;
  onStartNextHand?: () => void;
  onTopUp?: (amount: number) => void;
  onBackToCardRoom?: () => void;
}

/**
 * Hidden Poker runtime composition.
 *
 * Poker remains `networkPlayable: false`, but the hidden App route now consumes
 * this exact component. That lets the full runtime be type-checked and audited
 * without making Poker creatable from the live game selector.
 */
export function PokerRuntimeView({
  state,
  privateState,
  selfId,
  players,
  lastHandResult,
  dealing = false,
  canStartNextHand = false,
  onChooseVariant,
  onAction,
  onStartNextHand,
  onTopUp,
  onBackToCardRoom,
}: PokerRuntimeViewProps) {
  const { viewportHeight } = useVisualViewport();
  const [topUpAmount, setTopUpAmount] = useState(state.tableConfig.startingStack);
  const selfPlayer = state.players.find((player) => player.playerId === selfId) ?? null;
  const topUpPresets = useMemo(() => {
    const base = state.tableConfig.startingStack;
    return [...new Set([Math.max(state.tableConfig.bigBlind * 20, Math.floor(base / 2)), base, base * 2])];
  }, [state.tableConfig.bigBlind, state.tableConfig.startingStack]);
  const canTopUp = !!onTopUp && !!selfPlayer && (state.state === 'HAND_COMPLETE' || state.state === 'AWAITING_VARIANT');
  const normalizedTopUp = Number.isSafeInteger(topUpAmount) && topUpAmount > 0 ? topUpAmount : state.tableConfig.startingStack;
  function submitTopUp() {
    if (!onTopUp) return;
    // The server sequence is the duplicate-submit guard. Two rapid taps carry
    // the same expected sequence: the first successful top-up advances it and
    // any delayed duplicate is rejected as stale. Do not keep a client-only
    // 'pending at this sequence' latch here: if the network/server rejects the
    // request without advancing state, that latch can never clear and leaves
    // the bankroll button stuck on 'Adding…' for the rest of the table.
    onTopUp(normalizedTopUp);
  }

  const bankroll = canTopUp ? (
    <aside className="poker-bankroll" aria-label="Poker virtual chip top-up">
      <div className="poker-bankroll__copy">
        <span>Your stack</span>
        <strong>{selfPlayer.stack}</strong>
        <small>Virtual play money only · top-ups are between hands</small>
      </div>
      <div className="poker-bankroll__presets" role="group" aria-label="Quick virtual chip top-up amounts">
        {topUpPresets.map((amount) => (
          <button type="button" key={amount} onClick={() => setTopUpAmount(amount)} className={topUpAmount === amount ? 'is-active' : ''}>
            +{amount}
          </button>
        ))}
      </div>
      <label className="poker-bankroll__custom">
        <span>Custom</span>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={topUpAmount}
          onChange={(event) => setTopUpAmount(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
        />
      </label>
      <button type="button" className="poker-bankroll__add" onClick={submitTopUp}>
        Add virtual chips
      </button>
    </aside>
  ) : null;

  if (state.state === 'AWAITING_VARIANT') {
    return (
      <div className="poker-runtime poker-runtime--choice" style={viewportHeight ? ({ '--app-height': `${viewportHeight}px` } as React.CSSProperties) : undefined}>
        <PokerVariantChoice
          state={state}
          selfId={selfId}
          players={players.map(({ playerId, name }) => ({ playerId, name }))}
          onChoose={onChooseVariant}
        />
        {bankroll}
      </div>
    );
  }

  const seats = pokerSeatPlayers(state, players);
  // A zero-stack seat sits out and receives no cards. A player who already
  // folded can still have been dealt this hand, and an all-in blind can have
  // stack 0 after posting, so preserve either funded/committed participation.
  const dealPlayerIds = state.players
    .filter((player) => player.stack > 0 || player.handCommitted > 0 || !player.folded)
    .map((player) => player.playerId);
  const holeCards = privateState?.holeCards ?? [];
  const legalActions = privateState?.legalActions ?? {
    fold: false,
    check: false,
    call: false,
    raise: false,
    minRaiseTo: null,
    maxRaiseTo: null,
  };
  const toCall = privateState?.toCall ?? 0;
  const result = state.outcome ?? lastHandResult ?? null;
  const winnerNames = result ? pokerWinnerNames(result.winnerIds, players) : [];

  return (
    <div className="poker-runtime" style={viewportHeight ? ({ '--app-height': `${viewportHeight}px` } as React.CSSProperties) : undefined}>
      <PokerTable
        players={seats}
        selfId={selfId}
        dealerId={state.dealerId}
        activePlayerId={state.currentTurn}
        variantName={state.variant.name}
        streetLabel={pokerStreetLabel(state.state)}
        board={state.board}
        holeCards={holeCards}
        holeCardCount={state.variant.holeCards}
        dealPlayerIds={dealPlayerIds}
        dealing={dealing}
        pot={state.pot}
        currentBet={state.currentBet}
        toCall={toCall}
        legalActions={legalActions}
        betting={state.variant.betting}
        stakesLabel={state.variantId === 'SHORT_DECK'
          ? `Ante ${state.tableConfig.ante} · Button ${state.tableConfig.bigBlind}`
          : `${state.tableConfig.smallBlind}/${state.tableConfig.bigBlind}${state.tableConfig.ante > 0 ? ` · Ante ${state.tableConfig.ante}` : ''}`}
        showLocalPanel={state.state !== 'HAND_COMPLETE'}
        onFold={() => onAction({ type: 'FOLD' })}
        onCheck={() => onAction({ type: 'CHECK' })}
        onCall={() => onAction({ type: 'CALL' })}
        onRaiseTo={(amount) => onAction({ type: 'RAISE_TO', amount })}
      />

      {state.state === 'HAND_COMPLETE' && result && (
        <aside className="poker-hand-result" role="status" aria-live="polite">
          <div className="poker-hand-result__summary">
            <div className="poker-hand-result__copy">
              <span>Hand {result.handNumber}</span>
              <strong>{winnerNames.join(' & ') || 'Winner'} {winnerNames.length === 1 ? 'wins' : 'win'}</strong>
              <small>{result.reason === 'SHOWDOWN' ? 'Showdown complete' : 'Last player standing'}</small>
            </div>
            <div className="poker-hand-result__actions">
              {canStartNextHand && onStartNextHand ? (
                <button type="button" onClick={onStartNextHand}>Next hand</button>
              ) : (
                <span className="poker-hand-result__waiting">Waiting for the host</span>
              )}
              {onBackToCardRoom && <button type="button" className="is-secondary" onClick={onBackToCardRoom}>Card Room</button>}
            </div>
          </div>

          {result.pots.length > 0 && (
            <div className="poker-hand-result__pots" aria-label="Poker pot awards">
              {result.pots.map((potAward, index) => (
                <span key={`${potAward.amount}-${index}`}>
                  <small>{index === 0 ? 'Main' : `Side ${index}`}</small>
                  <strong>{potAward.amount}</strong>
                  <em>→ {pokerWinnerNames(potAward.winnerIds, players).join(' & ')}</em>
                </span>
              ))}
            </div>
          )}

          {result.showdown && result.showdown.length > 0 && (
            <div className="poker-hand-result__showdown" aria-label="Showdown hands">
              {result.showdown.map((entry) => {
                const won = result.winnerIds.includes(entry.playerId);
                const identity = players.find((player) => player.playerId === entry.playerId);
                return (
                  <div key={entry.playerId} className={won ? 'is-winner' : ''}>
                    <span>{identity?.name ?? 'Player'}<small>{pokerCategoryLabel(entry.hand.category)}</small></span>
                    <span className="poker-hand-result__cards">
                      {entry.holeCards.map((card) => <PlayingCard key={card.id} card={card} size="sm" highlighted={won} />)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      )}
      {bankroll}
    </div>
  );
}
