import { useMemo, useState } from 'react';
import type { PokerPublicStatePayload, PokerVariantId } from '../../game/types';
import './PokerVariantChoice.css';

export interface PokerVariantChoiceProps {
  state: PokerPublicStatePayload;
  selfId: string;
  players: Array<{ playerId: string; name: string }>;
  onChoose: (variantId: PokerVariantId) => void;
}

function bettingLabel(betting: PokerPublicStatePayload['variant']['betting']): string {
  if (betting === 'POT_LIMIT') return 'Pot-Limit';
  if (betting === 'ANTE_NO_LIMIT') return 'Ante · No-Limit';
  return 'No-Limit';
}

/**
 * Between-hands chooser for a Dealer-Choice Variant Poker Table.
 * Variant names/rules come from the authoritative server state, not the
 * client Coming Soon catalogue, so a live table cannot drift from its engine.
 */
export function PokerVariantChoice({ state, selfId, players, onChoose }: PokerVariantChoiceProps) {
  const variants = useMemo(() => state.approvedVariants, [state.approvedVariants]);
  const [selectedId, setSelectedId] = useState<PokerVariantId>(
    () => variants[0]?.id ?? state.approvedVariantIds[0] ?? 'TEXAS_HOLDEM'
  );

  if (state.state !== 'AWAITING_VARIANT') return null;

  const chooserId = state.nextVariantChooserId;
  const chooser = players.find((player) => player.playerId === chooserId);
  const isChooser = chooserId === selfId;
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  return (
    <main className="poker-variant-choice" aria-label="Choose the next poker variant">
      <section className="poker-variant-choice__rail">
        <header className="poker-variant-choice__heading">
          <div>
            <p>Variant table · next hand</p>
            <h1>{isChooser ? 'Choose the next game' : `${chooser?.name ?? 'Dealer'} is choosing`}</h1>
          </div>
          <span className="poker-variant-choice__dealer">Dealer {chooser?.name ?? '—'}</span>
        </header>

        <p className="poker-variant-choice__intro">
          {isChooser
            ? 'Your choice is locked before blinds, antes or hole cards are posted. Pick one of the games everyone approved for this table.'
            : 'No blind, ante or private card is posted until the upcoming dealer confirms the next approved game.'}
        </p>

        <div className="poker-variant-choice__grid" role="list" aria-label="Approved poker variants">
          {variants.map((variant) => {
            const active = selected?.id === variant.id;
            return (
              <button
                type="button"
                role="listitem"
                key={variant.id}
                className={active ? 'is-active' : ''}
                disabled={!isChooser}
                onClick={() => setSelectedId(variant.id)}
              >
                <span className="poker-variant-choice__short">{variant.shortName}</span>
                <strong>{variant.name}</strong>
                <small>{variant.holeCards} hole · {bettingLabel(variant.betting)} · {variant.maxPlayers} max</small>
                <p>{variant.howToPlay}</p>
              </button>
            );
          })}
        </div>

        {isChooser && selected && (
          <button
            type="button"
            className="poker-variant-choice__deal"
            onClick={() => onChoose(selected.id)}
          >
            Deal {selected.shortName}
          </button>
        )}
      </section>
    </main>
  );
}
