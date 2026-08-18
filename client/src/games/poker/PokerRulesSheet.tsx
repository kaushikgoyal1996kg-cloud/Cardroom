import type { PokerPublicStatePayload } from '../../game/types';
import './PokerRulesSheet.css';

interface PokerRulesSheetProps {
  state: PokerPublicStatePayload;
  onClose: () => void;
}

function structureLabel(state: PokerPublicStatePayload): string {
  if (state.variant.betting === 'POT_LIMIT') return 'Pot-Limit';
  if (state.variant.betting === 'ANTE_NO_LIMIT') return 'Ante · No-Limit';
  return 'No-Limit';
}

/**
 * Live Poker help is deliberately generated from authoritative public state.
 * The Coming Soon marketing catalogue is never used to tell a seated player
 * which rules/stakes are active at their private table.
 */
export function PokerRulesSheet({ state, onClose }: PokerRulesSheetProps) {
  const shortDeck = state.variantId === 'SHORT_DECK';
  const variantTable = state.tableConfig.mode === 'VARIANT_TABLE';

  return (
    <div className="poker-rules" role="dialog" aria-modal="true" aria-label="How to play this Poker variant">
      <section className="poker-rules__sheet">
        <header className="poker-rules__heading">
          <div>
            <p>How to play this game</p>
            <h2>{state.variant.name}</h2>
          </div>
          <span>{state.variant.shortName}</span>
        </header>

        <p className="poker-rules__intro">{state.variant.howToPlay}</p>

        <dl className="poker-rules__facts">
          <div><dt>Hole cards</dt><dd>{state.variant.holeCards}</dd></div>
          <div><dt>Betting</dt><dd>{structureLabel(state)}</dd></div>
          {shortDeck ? (
            <>
              <div><dt>Ante</dt><dd>{state.tableConfig.ante} from every funded seat</dd></div>
              <div><dt>Button blind</dt><dd>{state.tableConfig.bigBlind}</dd></div>
            </>
          ) : (
            <>
              <div><dt>Blinds</dt><dd>{state.tableConfig.smallBlind} / {state.tableConfig.bigBlind}</dd></div>
              <div><dt>Ante</dt><dd>{state.tableConfig.ante > 0 ? state.tableConfig.ante : 'Off'}</dd></div>
            </>
          )}
          <div><dt>Starting stack</dt><dd>{state.tableConfig.startingStack} virtual chips</dd></div>
          <div><dt>Action clock</dt><dd>{state.tableConfig.actionTimerSeconds > 0 ? `${state.tableConfig.actionTimerSeconds}s` : 'Off'}</dd></div>
        </dl>

        {variantTable && (
          <section className="poker-rules__variants" aria-label="Approved games for this variant table">
            <span>Approved for this table</span>
            <div>
              {state.approvedVariants.map((variant) => (
                <span key={variant.id} className={variant.id === state.variantId ? 'is-current' : ''}>
                  {variant.shortName}
                </span>
              ))}
            </div>
            <small>
              {state.tableConfig.rotation === 'DEALER_CHOICE'
                ? 'The upcoming dealer chooses the next approved game before blinds, antes or cards are posted.'
                : 'The table rotates through the approved games between hands.'}
            </small>
          </section>
        )}

        <p className="poker-rules__money">Virtual play money only. Table chips have no cash value and cannot be deposited, withdrawn or cashed out.</p>

        <button type="button" className="poker-rules__back" onClick={onClose}>Back to table</button>
      </section>
    </div>
  );
}
