import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import type { TeenPattiFiveCardJokerId, TeenPattiRoundVariantConfig, TeenPattiVariantId } from '../../game/types';
import { TEEN_PATTI_VARIANT_CARDS } from '../../platform/games/variantCatalog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useVisualViewport } from '../../platform/lib/useVisualViewport';
import './TeenPattiVariantChoice.css';

const FIVE_CARD_JOKERS: { id: TeenPattiFiveCardJokerId; name: string; note: string }[] = [
  { id: 'NONE', name: 'No Joker', note: 'Normal ranking after discards' },
  { id: 'LOWEST_CARD_JOKER', name: 'Lowest Card', note: 'Lowest rank in the active three is wild' },
  { id: 'HIGHEST_CARD_JOKER', name: 'Highest Card', note: 'Highest rank in the active three is wild' },
  { id: 'STANDARD_JOKER', name: 'Standard Joker', note: 'One undealt reference rank is wild' },
  { id: 'RANDOM_PACK_JOKER', name: 'Random-Pack', note: 'Server reveals a random undealt reference' },
  { id: 'AK47', name: 'AK47', note: 'A, K, 4 and 7 are wild' },
  { id: 'PAIRS_ARE_JOKERS', name: 'Pairs Are Jokers', note: 'Pairs in the active three are wild' },
  { id: 'UP_DOWN_SAME', name: 'Up–Down–Same', note: 'Reference, one up and one down are wild' },
  { id: 'UP_DOWN', name: 'Up–Down', note: 'One rank above and below are wild' },
  { id: 'DOWN_ONLY', name: 'Down Only', note: 'One rank below the reference is wild' },
  { id: 'TWO_REFERENCE_JOKER', name: 'Two-Reference', note: 'Players privately assign Up/Down vs Same' },
];

export function TeenPattiVariantChoice() {
  const { room, myPlayerId, teenPattiState, chooseTeenPattiRoundVariant, chooseTeenPattiSurpriseRound, gameError, clearGameError } = useGame();
  const { viewportHeight } = useVisualViewport();
  const decision = teenPattiState?.variantDecision ?? 'CHOOSE_VARIANT';
  const configuredVariantId = decision === 'CONFIGURE_VARIANT' ? teenPattiState?.variant.variantId : undefined;
  const allowed = configuredVariantId
    ? [configuredVariantId]
    : teenPattiState?.variantPolicy.mode === 'VARIANT_TABLE'
      ? teenPattiState.variantPolicy.variants ?? []
      : teenPattiState?.variantPolicy.fixedVariant ? [teenPattiState.variantPolicy.fixedVariant] : [];
  const runtimeAllowed = useMemo(
    () => TEEN_PATTI_VARIANT_CARDS.filter((variant) => variant.runtimeReady && allowed.includes(variant.id as TeenPattiVariantId)),
    [allowed]
  );
  const allowedKey = allowed.join('|');
  const [selectedId, setSelectedId] = useState<TeenPattiVariantId>(() => (allowed[0] as TeenPattiVariantId | undefined) ?? 'CLASSIC');
  const [targetNumber, setTargetNumber] = useState('');
  const [reorderTargetCards, setReorderTargetCards] = useState<boolean | null>(null);
  const [fiveCardJoker, setFiveCardJoker] = useState<TeenPattiFiveCardJokerId | null>(null);

  useEffect(() => {
    const next = (configuredVariantId ?? allowed[0]) as TeenPattiVariantId | undefined;
    if (next) setSelectedId(next);
  }, [configuredVariantId, allowedKey]);

  useEffect(() => {
    if (decision === 'CONFIGURE_VARIANT') {
      setTargetNumber(teenPattiState?.variant.targetNumber?.toString() ?? '');
      setReorderTargetCards(teenPattiState?.variant.reorderTargetCards ?? null);
      setFiveCardJoker(teenPattiState?.variant.fiveCardJoker ?? null);
      return;
    }
    // Dealer Choice parameters belong to one round only. Never let a target,
    // joker selection from the previous round silently become
    // the next dealer's explicit configuration just because this screen stayed
    // mounted across the round transition.
    setTargetNumber('');
    setReorderTargetCards(null);
    setFiveCardJoker(null);
  }, [decision, teenPattiState?.roundNumber, teenPattiState?.variant.variantId]);

  if (!room || !teenPattiState || teenPattiState.state !== 'AWAITING_VARIANT') {
    return <div className="waiting-screen"><LoadingSpinner message="Preparing Teen Patti…" /></div>;
  }

  const chooserId = teenPattiState.nextVariantChooserId;
  const chooser = room.players.find((player) => player.playerId === chooserId);
  const isChooser = !!myPlayerId && chooserId === myPlayerId;
  const isConfiguring = teenPattiState.variantDecision === 'CONFIGURE_VARIANT';
  const canDealerSurprise = !isConfiguring
    && teenPattiState.variantPolicy.mode === 'VARIANT_TABLE'
    && teenPattiState.variantPolicy.rotation === 'DEALER_CHOICE'
    && runtimeAllowed.length >= 2;
  const isSurpriseConfig = isConfiguring && teenPattiState.variantWasSurprise;
  const selected = runtimeAllowed.find((variant) => variant.id === selectedId) ?? runtimeAllowed[0];
  const isClosest = selected?.id === 'CLOSEST_TO_N';
  const isFiveCardDiscard = !!selected && ['DISCARD_LOW_HIGH', 'DISCARD_TWO_LOWEST', 'DISCARD_TWO_HIGHEST'].includes(selected.id);
  const parsedTarget = Number(targetNumber);
  const closestConfigValid = !isClosest || (
    Number.isInteger(parsedTarget)
    && parsedTarget >= 100
    && parsedTarget <= 999
    && reorderTargetCards !== null
  );
  const fiveCardConfigValid = !isFiveCardDiscard || fiveCardJoker !== null;
  const roundConfigValid = closestConfigValid && fiveCardConfigValid;

  function submitRound() {
    if (!selected || !roundConfigValid) return;
    const config: TeenPattiRoundVariantConfig = { variantId: selected.id as TeenPattiVariantId };
    if (selected.id === 'CLOSEST_TO_N') {
      config.targetNumber = parsedTarget;
      config.reorderTargetCards = reorderTargetCards!;
    }
    if (isFiveCardDiscard) config.fiveCardJoker = fiveCardJoker!;
    chooseTeenPattiRoundVariant(config);
  }

  const eyebrow = isSurpriseConfig
    ? `Round ${teenPattiState.roundNumber} · Surprise Me selected`
    : isConfiguring
      ? `Round ${teenPattiState.roundNumber} · Dealer setup`
      : `Round ${teenPattiState.roundNumber} · Dealer choice`;

  const title = isChooser
    ? isConfiguring ? `Set up ${selected?.name ?? teenPattiState.variantName}` : 'Choose this round'
    : `Waiting for ${chooser?.name ?? 'the dealer'}`;

  const intro = isChooser
    ? isConfiguring
      ? isSurpriseConfig
        ? `The server randomly selected ${selected?.name ?? teenPattiState.variantName}. Set its round options before any boot is charged or card is dealt.`
        : `This round uses ${selected?.name ?? teenPattiState.variantName}. Set the required dealer options before the deal.`
      : 'Choose one of the variants approved by the table before any boot is charged or card is dealt.'
    : isConfiguring
      ? `${chooser?.name ?? 'The dealer'} is setting the required round options. No boot or cards are committed yet.`
      : 'The dealer is choosing from the variants everyone accepted in the lobby. The choice is server-authoritative and reconnect-safe.';

  return (
    <main className="tp-variant-choice" style={viewportHeight ? ({ '--js-vh': `${viewportHeight}px` } as React.CSSProperties) : undefined}>
      <section className="tp-variant-choice__card">
        <p className="tp-variant-choice__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="tp-variant-choice__intro">{intro}</p>

        <div className="tp-variant-choice__grid" aria-label="Approved Teen Patti variants">
          {canDealerSurprise && (
            <button
              type="button"
              className="tp-variant-choice__surprise"
              disabled={!isChooser}
              onClick={chooseTeenPattiSurpriseRound}
            >
              <strong>Surprise Me</strong>
              <span>Server random</span>
              <small>Server chooses one from this table’s host-approved pool. No reroll.</small>
            </button>
          )}
          {runtimeAllowed.map((variant) => (
            <button
              type="button"
              key={variant.id}
              disabled={!isChooser || isConfiguring}
              className={selected?.id === variant.id ? 'is-active' : ''}
              onClick={() => setSelectedId(variant.id as TeenPattiVariantId)}
            >
              <strong>{variant.name}</strong>
              <span>{variant.meta}</span>
              <small>{variant.description}</small>
            </button>
          ))}
        </div>

        {isChooser && isClosest && (
          <section className="tp-variant-choice__config" aria-label="Closest to N round settings">
            <div className="tp-variant-choice__config-heading">
              <div>
                <span>Dealer configuration</span>
                <strong>Closest to N</strong>
              </div>
              <small>Choose before the deal</small>
            </div>
            <label className="tp-variant-choice__target">
              <span>3-digit target</span>
              <input
                type="number"
                inputMode="numeric"
                min="100"
                max="999"
                placeholder="e.g. 555"
                value={targetNumber}
                onChange={(event) => setTargetNumber(event.target.value.replace(/\D/g, '').slice(0, 3))}
              />
            </label>
            <div className="tp-variant-choice__reorder" role="group" aria-label="May players reorder the three cards?">
              <span>Card reordering</span>
              <div>
                <button type="button" className={reorderTargetCards === true ? 'is-active' : ''} onClick={() => setReorderTargetCards(true)}>Allowed</button>
                <button type="button" className={reorderTargetCards === false ? 'is-active' : ''} onClick={() => setReorderTargetCards(false)}>Keep dealt order</button>
              </div>
            </div>
            {!closestConfigValid && <small className="tp-variant-choice__config-note">Enter a target from 100–999 and declare whether reordering is allowed.</small>}
          </section>
        )}


        {isChooser && isFiveCardDiscard && (
          <section className="tp-variant-choice__config" aria-label="Five-card joker setting">
            <div className="tp-variant-choice__config-heading">
              <div>
                <span>Dealer configuration</span>
                <strong>Choose the joker rule</strong>
              </div>
              <small>Applies after the two discards</small>
            </div>
            <p className="tp-variant-choice__five-note">All five cards stay with each player. Only the three non-discarded cards are ranked; discarded cards are revealed at sideshow/showdown but never break a tie.</p>
            <div className="tp-variant-choice__joker-grid" role="group" aria-label="Five-card joker options">
              {FIVE_CARD_JOKERS.map((joker) => (
                <button
                  type="button"
                  key={joker.id}
                  className={fiveCardJoker === joker.id ? 'is-active' : ''}
                  onClick={() => setFiveCardJoker(joker.id)}
                >
                  <strong>{joker.name}</strong>
                  <small>{joker.note}</small>
                </button>
              ))}
            </div>
            {!fiveCardConfigValid && <small className="tp-variant-choice__config-note">Choose the joker rule for this five-card round, including No Joker if desired.</small>}
          </section>
        )}

        {isChooser && selected && (
          <button
            type="button"
            className="btn btn-primary tp-variant-choice__deal"
            disabled={!roundConfigValid}
            onClick={submitRound}
          >
            Deal {selected.name}
          </button>
        )}
        <small className="tp-variant-choice__safety">Play money only · no real-money payment or cash-out.</small>
      </section>

      {gameError && <button type="button" className="tp-variant-choice__error" onClick={clearGameError}>{gameError}</button>}
    </main>
  );
}
