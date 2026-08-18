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
            <div><dt>Joker choice</dt><dd>The two references stay visible while betting continues normally. Only when your hand is about to be compared in a sideshow or show/showdown do you privately choose between the two resulting joker sets; the chosen set is then locked for your hand.</dd></div>
          )}
          {state.variant.variantId.startsWith('DISCARD_') && (
            <div><dt>5-card discard</dt><dd>All five cards remain with you. Only the three non-discarded cards are ranked; all five are revealed at sideshow/showdown and discarded cards never break ties.</dd></div>
          )}
          <div><dt>Sideshow</dt><dd>Available only when at least three active players remain and all are seen. It is optional; normal Chaal remains available until someone chooses Sideshow.</dd></div>
          <div><dt>Mutual Show</dt><dd>Available whenever 2+ active players remain. It is free and opens all active hands only if every active player accepts the same proposal; tied strongest hands split the pot. Paid Showdown remains final-two only.</dd></div>
        </dl>
        <button className="btn btn-primary" type="button" onClick={onClose}>Back to table</button>
      </div>
    </div>
  );
}
