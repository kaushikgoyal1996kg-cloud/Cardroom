import type { TeenPattiPublicStatePayload } from '../../game/types';
import { PlayingCard } from '../../platform/components/PlayingCard';

interface TeenPattiRulesSheetProps {
  state: TeenPattiPublicStatePayload;
  onClose: () => void;
}

export function TeenPattiRulesSheet({ state, onClose }: TeenPattiRulesSheetProps) {
  return (
    <div className="tp-rules" role="dialog" aria-modal="true" aria-label="How to play this Teen Patti variant">
      <div className="tp-rules__sheet">
        <p className="tp-rules__eyebrow">How to play this variant</p>
        <h2>{state.variantName}</h2>
        <p>{state.variantHelp}</p>
        {state.variantReferenceCards.length > 0 && (
          <div className="tp-rules__references" aria-label="Revealed Teen Patti reference cards">
            <span>{state.variant.variantId === 'REVOLVING_JOKER' ? 'Current joker cards' : state.variantReferenceCards.length === 1 ? 'Reference card' : 'Reference cards'}</span>
            <div>
              {state.variantReferenceCards.map((card) => <PlayingCard key={card.id} card={card} size="sm" />)}
            </div>
          </div>
        )}
        <dl>
          <div><dt>Cards</dt><dd>{state.variantDealCount} dealt this round</dd></div>
          <div><dt>Blind</dt><dd>{state.currentBlind} now · doubles to max {state.tableConfig.maxBlind}</dd></div>
          <div><dt>Seen</dt><dd>2× current blind · {state.seenAmount} now</dd></div>
          <div><dt>Blind limit</dt><dd>3 turns, then betting continues as seen</dd></div>
          {(state.variant.variantId === 'TWO_REFERENCE_JOKER' || state.variant.fiveCardJoker === 'TWO_REFERENCE_JOKER') && (
            <div><dt>Joker roles</dt><dd>Each player privately chooses one reference for Up/Down; the other reference’s own rank is Same. Betting starts after everyone locks a choice.</dd></div>
          )}
          {state.variant.variantId.startsWith('DISCARD_') && (
            <div><dt>5-card discard</dt><dd>All five cards remain with you. Only the three non-discarded cards are ranked; all five are revealed at sideshow/showdown and discarded cards never break ties.</dd></div>
          )}
          <div><dt>Sideshow</dt><dd>Compulsory when all remaining players are seen</dd></div>
          <div><dt>Mutual Show</dt><dd>Any active player may propose a free show. Cards open only if every active player accepts; tied best hands split the pot equally.</dd></div>
        </dl>
        <button className="btn btn-primary" type="button" onClick={onClose}>Back to table</button>
      </div>
    </div>
  );
}
