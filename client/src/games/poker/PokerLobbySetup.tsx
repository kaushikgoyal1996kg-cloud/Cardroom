import { useMemo, useState } from 'react';
import type { PokerTableConfig, PokerVariantId, PokerVariantRotation } from '../../game/types';
import { POKER_VARIANT_CARDS } from '../../platform/games/variantCatalog';
import './PokerLobbySetup.css';

const VARIANTS = POKER_VARIANT_CARDS.filter((variant) => variant.id !== 'VARIANT_TABLE');
const SEAT_CAP: Record<PokerVariantId, number> = {
  TEXAS_HOLDEM: 9,
  PLO4: 9,
  PLO5: 8,
  PLO6: 7,
  SHORT_DECK: 6,
};

export const DEFAULT_POKER_DRAFT: PokerTableConfig = {
  mode: 'FIXED',
  fixedVariant: 'TEXAS_HOLDEM',
  startingStack: 2000,
  smallBlind: 10,
  bigBlind: 20,
  ante: 0,
  actionTimerSeconds: 0,
};

export interface PokerLobbySetupProps {
  initial?: PokerTableConfig;
  seatedPlayers: number;
  busy?: boolean;
  onPropose: (config: PokerTableConfig) => void;
}

function selectedIds(config: PokerTableConfig): PokerVariantId[] {
  return config.mode === 'FIXED'
    ? [config.fixedVariant ?? 'TEXAS_HOLDEM']
    : config.variants ?? [];
}

function seatCap(config: PokerTableConfig): number {
  const ids = selectedIds(config);
  if (ids.length === 0) return 0;
  return Math.min(...ids.map((id) => SEAT_CAP[id]));
}

export function PokerLobbySetup({ initial = DEFAULT_POKER_DRAFT, seatedPlayers, busy = false, onPropose }: PokerLobbySetupProps) {
  const [draft, setDraft] = useState<PokerTableConfig>(() => ({
    ...initial,
    variants: initial.variants ? [...initial.variants] : undefined,
  }));

  const ids = selectedIds(draft);
  const cap = useMemo(() => seatCap(draft), [draft]);
  const shortDeckSelected = ids.includes('SHORT_DECK');
  const invalidPool = draft.mode === 'VARIANT_TABLE' && ids.length < 2;
  const tooManyPlayers = cap > 0 && seatedPlayers > cap;
  const blindInvalid = draft.bigBlind < draft.smallBlind || draft.startingStack < draft.bigBlind * 2;
  const anteInvalid = shortDeckSelected && draft.ante <= 0;
  const canPropose = !busy && !invalidPool && !tooManyPlayers && !blindInvalid && !anteInvalid;

  function setNumber(key: 'startingStack' | 'smallBlind' | 'bigBlind' | 'ante', raw: string) {
    const minimum = key === 'ante' ? 0 : 1;
    const value = Math.max(minimum, Math.floor(Number(raw) || 0));
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setMode(mode: PokerTableConfig['mode']) {
    setDraft((current) => mode === 'FIXED'
      ? {
          ...current,
          mode,
          fixedVariant: current.fixedVariant ?? current.variants?.[0] ?? 'TEXAS_HOLDEM',
          variants: undefined,
          rotation: undefined,
        }
      : {
          ...current,
          mode,
          fixedVariant: undefined,
          variants: current.variants?.length ? current.variants : ['TEXAS_HOLDEM', 'PLO4', 'PLO5', 'PLO6'],
          rotation: current.rotation ?? 'DEALER_CHOICE',
        });
  }

  function chooseFixed(id: PokerVariantId) {
    setDraft((current) => ({
      ...current,
      fixedVariant: id,
      // Short Deck uses an ante + live button blind. Give the host a valid
      // starter value rather than proposing an invalid table by surprise.
      ante: id === 'SHORT_DECK' && current.ante === 0 ? current.smallBlind : current.ante,
    }));
  }

  function toggleVariant(id: PokerVariantId) {
    setDraft((current) => {
      const currentIds = current.variants ?? [];
      const variants = currentIds.includes(id)
        ? currentIds.filter((variant) => variant !== id)
        : [...currentIds, id];
      const hasShortDeck = variants.includes('SHORT_DECK');
      return {
        ...current,
        variants,
        ante: hasShortDeck && current.ante === 0 ? current.smallBlind : current.ante,
      };
    });
  }

  return (
    <section className="poker-setup" aria-label="Poker private-table setup">
      <header className="poker-setup__heading">
        <div>
          <p>Private table</p>
          <h2>{draft.mode === 'VARIANT_TABLE' ? 'Variant Poker Table' : 'Poker table'}</h2>
        </div>
        <span>{cap ? `Up to ${cap} seats` : 'Choose variants'}</span>
      </header>

      <div className="poker-setup__mode" role="group" aria-label="Poker table type">
        <button type="button" className={draft.mode === 'FIXED' ? 'is-active' : ''} onClick={() => setMode('FIXED')}>Single game</button>
        <button type="button" className={draft.mode === 'VARIANT_TABLE' ? 'is-active' : ''} onClick={() => setMode('VARIANT_TABLE')}>Variant table</button>
      </div>

      <div className="poker-setup__variants" aria-label="Poker variants">
        {VARIANTS.map((variant) => {
          const id = variant.id as PokerVariantId;
          const active = ids.includes(id);
          return (
            <button
              type="button"
              key={variant.id}
              className={active ? 'is-active' : ''}
              onClick={() => draft.mode === 'FIXED' ? chooseFixed(id) : toggleVariant(id)}
            >
              <span>{variant.shortName ?? variant.name}</span>
              <strong>{variant.name}</strong>
              <small>{variant.meta}</small>
              <em>{SEAT_CAP[id]} max</em>
            </button>
          );
        })}
      </div>

      {draft.mode === 'VARIANT_TABLE' && (
        <div className="poker-setup__rotation" role="group" aria-label="Poker variant rotation">
          {(['DEALER_CHOICE', 'FIXED_ROTATION'] as PokerVariantRotation[]).map((rotation) => (
            <button
              type="button"
              key={rotation}
              className={draft.rotation === rotation ? 'is-active' : ''}
              onClick={() => setDraft((current) => ({ ...current, rotation }))}
            >
              <strong>{rotation === 'DEALER_CHOICE' ? 'Dealer choice' : 'Fixed rotation'}</strong>
              <span>{rotation === 'DEALER_CHOICE' ? 'Upcoming dealer picks between hands' : 'Server follows the approved order'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="poker-setup__money">
        <label><span>Starting stack</span><input type="number" inputMode="numeric" min="1" value={draft.startingStack} onChange={(event) => setNumber('startingStack', event.target.value)} /></label>
        <label><span>Small blind</span><input type="number" inputMode="numeric" min="1" value={draft.smallBlind} onChange={(event) => setNumber('smallBlind', event.target.value)} /></label>
        <label><span>Big / button blind</span><input type="number" inputMode="numeric" min="1" value={draft.bigBlind} onChange={(event) => setNumber('bigBlind', event.target.value)} /></label>
        <label><span>Ante</span><input type="number" inputMode="numeric" min="0" value={draft.ante} onChange={(event) => setNumber('ante', event.target.value)} /></label>
      </div>

      <div className="poker-setup__timer">
        <span>Action clock</span>
        <div role="group" aria-label="Poker action clock">
          {([0, 15, 20, 30, 45, 60] as const).map((seconds) => (
            <button
              type="button"
              key={seconds}
              className={draft.actionTimerSeconds === seconds ? 'is-active' : ''}
              disabled={seconds !== 0}
              title={seconds === 0 ? 'No action clock' : 'Action clock will be enabled only after the server timeout engine is complete'}
              onClick={() => setDraft((current) => ({ ...current, actionTimerSeconds: seconds }))}
            >
              {seconds === 0 ? 'Off' : `${seconds}s`}
            </button>
          ))}
        </div>
      </div>

      <div className="poker-setup__notes" aria-live="polite">
        <p><strong>Seat cap:</strong> {cap || '—'} for the selected game{ids.length === 1 ? '' : 's'}.</p>
        {shortDeckSelected && <p><strong>6+:</strong> everyone antes; the dealer/button posts the live button blind.</p>}
        {invalidPool && <p className="is-warning">Choose at least two games for a Variant Poker Table.</p>}
        {tooManyPlayers && <p className="is-warning">{seatedPlayers} players are seated, but this selection allows at most {cap}.</p>}
        {blindInvalid && <p className="is-warning">Big blind must be at least the small blind, and the starting stack must cover at least two big blinds.</p>}
        {anteInvalid && <p className="is-warning">A table containing 6+ Short Deck needs a positive ante.</p>}
        <p><strong>Action clock:</strong> Off for this build; timed auto-actions will not be exposed until the server timeout engine is complete.</p>
      </div>

      <button
        type="button"
        className="poker-setup__propose"
        disabled={!canPropose}
        onClick={() => onPropose({ ...draft, variants: draft.variants ? [...draft.variants] : undefined })}
      >
        {busy ? 'Saving setup…' : 'Propose table setup'}
      </button>

      <small className="poker-setup__safety">All stacks, blinds, antes and winnings are virtual play money only.</small>
    </section>
  );
}
