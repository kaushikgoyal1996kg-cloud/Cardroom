import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import type {
  TeenPattiTableConfig,
  TeenPattiVariantId,
  TeenPattiVariantRotation,
  TeenPattiVariantTablePolicy,
} from '../../game/types';
import { TEEN_PATTI_VARIANT_CARDS } from '../../platform/games/variantCatalog';
import './TeenPattiLobbySetup.css';

const DEFAULTS: TeenPattiTableConfig = {
  startingBalance: 1000,
  bootAmount: 10,
  baseBlind: 10,
  maxBlind: 60,
  friendlyAssist: false,
};

const runtimeVariants = TEEN_PATTI_VARIANT_CARDS.filter((variant) => variant.runtimeReady);
const DEFAULT_POOL: TeenPattiVariantId[] = ['CLASSIC', 'MUFLIS', 'BEST_OF_FOUR'];

export function TeenPattiLobbySetup() {
  const {
    room,
    myPlayerId,
    teenPattiSetup,
    proposeTeenPattiSetup,
    acceptTeenPattiSetup,
  } = useGame();
  const me = room?.players.find((player) => player.playerId === myPlayerId);
  const isHost = me?.isHost ?? false;
  const [draft, setDraft] = useState<TeenPattiTableConfig>(DEFAULTS);
  const [tableMode, setTableMode] = useState<'FIXED' | 'VARIANT_TABLE' | 'SURPRISE_TABLE'>('FIXED');
  const [variantId, setVariantId] = useState<TeenPattiVariantId>('CLASSIC');
  const [variantPool, setVariantPool] = useState<TeenPattiVariantId[]>(DEFAULT_POOL);
  const [rotation, setRotation] = useState<TeenPattiVariantRotation>('DEALER_CHOICE');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!teenPattiSetup) return;
    setDraft({ ...teenPattiSetup.tableConfig, friendlyAssist: teenPattiSetup.tableConfig.friendlyAssist === true });
    setVariantId(teenPattiSetup.roundVariant.variantId);
    const policy = teenPattiSetup.variantPolicy;
    setTableMode(policy.mode === 'FIXED' ? 'FIXED' : policy.rotation === 'SURPRISE_ME' ? 'SURPRISE_TABLE' : 'VARIANT_TABLE');
    if (policy.variants?.length) setVariantPool([...policy.variants]);
    if (policy.rotation && policy.rotation !== 'SURPRISE_ME') setRotation(policy.rotation);
  }, [teenPattiSetup]);

  const selectedVariant = TEEN_PATTI_VARIANT_CARDS.find((variant) => variant.id === variantId);
  const effectiveVariantPool = variantPool;
  const accepted = !!myPlayerId && !!teenPattiSetup?.acceptedBy.includes(myPlayerId);
  const acceptedCount = useMemo(
    () => room?.players.filter((player) => teenPattiSetup?.acceptedBy.includes(player.playerId)).length ?? 0,
    [room, teenPattiSetup]
  );

  if (!room || room.gameId !== 'TEEN_PATTI') return null;

  function update<K extends keyof TeenPattiTableConfig>(key: K, raw: string) {
    const value = Math.max(1, Math.floor(Number(raw) || 0));
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleVariant(id: TeenPattiVariantId) {
    setVariantPool((current) => current.includes(id)
      ? current.filter((variant) => variant !== id)
      : [...current, id]);
  }

  async function propose() {
    if (busy) return;
    const variantPolicy: TeenPattiVariantTablePolicy = tableMode === 'FIXED'
      ? { mode: 'FIXED', fixedVariant: variantId }
      : tableMode === 'SURPRISE_TABLE'
        ? { mode: 'VARIANT_TABLE', variants: effectiveVariantPool, rotation: 'SURPRISE_ME' }
        : { mode: 'VARIANT_TABLE', variants: effectiveVariantPool, rotation };
    const previewVariant = tableMode === 'FIXED' ? variantId : (effectiveVariantPool[0] ?? 'CLASSIC');
    setBusy(true);
    await proposeTeenPattiSetup(draft, { variantId: previewVariant }, variantPolicy);
    setBusy(false);
  }

  async function accept() {
    if (!teenPattiSetup || busy) return;
    setBusy(true);
    await acceptTeenPattiSetup(teenPattiSetup.revision);
    setBusy(false);
  }

  const poolInvalid = tableMode !== 'FIXED' && effectiveVariantPool.length < 2;

  return (
    <section className="tp-setup" aria-label="Teen Patti table setup">
      <div className="tp-setup__heading">
        <div>
          <p className="tp-setup__eyebrow">Table agreement</p>
          <h2>{tableMode === 'SURPRISE_TABLE' ? 'Surprise Me Table' : tableMode === 'VARIANT_TABLE' ? 'Variant Table' : selectedVariant?.name ?? 'Teen Patti table'}</h2>
        </div>
        {teenPattiSetup && <span className="tp-setup__revision">Setup {teenPattiSetup.revision}</span>}
      </div>

      {isHost && (
        <div className="tp-setup__variant-block">
          <div className="tp-setup__mode" role="group" aria-label="Teen Patti table type">
            <button type="button" className={tableMode === 'FIXED' ? 'is-active' : ''} onClick={() => setTableMode('FIXED')}>Single variant</button>
            <button type="button" className={tableMode === 'VARIANT_TABLE' ? 'is-active' : ''} onClick={() => setTableMode('VARIANT_TABLE')}>Variant table</button>
            <button type="button" className={tableMode === 'SURPRISE_TABLE' ? 'is-active' : ''} onClick={() => setTableMode('SURPRISE_TABLE')}>Surprise Me table</button>
          </div>

          <div className="tp-setup__variant-title">
            <span>{tableMode === 'FIXED' ? 'Table variant' : 'Host-approved variant pool'}</span>
            <small>{tableMode === 'FIXED'
              ? 'The same variant is used every round.'
              : tableMode === 'SURPRISE_TABLE'
                ? 'Choose which runtime-ready variants the server may randomly select from every hand.'
                : 'Choose the runtime-ready variants available to Dealer Choice or Fixed Rotation. On Dealer Choice, the dealer can also press Surprise Me and let the server pick from this same pool.'}</small>
          </div>

          <div className="tp-setup__variant-grid">
            {TEEN_PATTI_VARIANT_CARDS.map((variant) => {
              const active = tableMode === 'FIXED'
                ? variantId === variant.id
                : effectiveVariantPool.includes(variant.id as TeenPattiVariantId);
              return (
                <button
                  type="button"
                  key={variant.id}
                  className={active ? 'is-active' : ''}
                  disabled={!variant.runtimeReady}
                  onClick={() => tableMode === 'FIXED'
                    ? setVariantId(variant.id as TeenPattiVariantId)
                    : toggleVariant(variant.id as TeenPattiVariantId)}
                >
                  <strong>{variant.name}</strong>
                  <span>{variant.meta}</span>
                  {!variant.runtimeReady && <small>Not yet enabled</small>}
                </button>
              );
            })}
          </div>

          {tableMode === 'VARIANT_TABLE' && (
            <div className="tp-setup__rotation" role="group" aria-label="Variant rotation">
              <button type="button" className={rotation === 'DEALER_CHOICE' ? 'is-active' : ''} onClick={() => setRotation('DEALER_CHOICE')}>
                <strong>Dealer choice</strong><span>Dealer picks before each deal</span>
              </button>
              <button type="button" className={rotation === 'FIXED_ROTATION' ? 'is-active' : ''} onClick={() => setRotation('FIXED_ROTATION')}>
                <strong>Fixed rotation</strong><span>Server rotates the approved order</span>
              </button>
            </div>
          )}
          {poolInvalid && <p className="tp-setup__warning">Choose at least two variants for this multi-variant table.</p>}
        </div>
      )}

      {isHost ? (
        <div className="tp-setup__fields">
          <label><span>Starting balance</span><input inputMode="numeric" type="number" min="1" value={draft.startingBalance} onChange={(e) => update('startingBalance', e.target.value)} /></label>
          <label><span>Boot</span><input inputMode="numeric" type="number" min="1" value={draft.bootAmount} onChange={(e) => update('bootAmount', e.target.value)} /></label>
          <label><span>Base blind</span><input inputMode="numeric" type="number" min="1" value={draft.baseBlind} onChange={(e) => update('baseBlind', e.target.value)} /></label>
          <label><span>Max blind</span><input inputMode="numeric" type="number" min="1" value={draft.maxBlind} onChange={(e) => update('maxBlind', e.target.value)} /></label>
          <button
            type="button"
            className={`tp-setup__friendly-toggle${draft.friendlyAssist ? ' is-active' : ''}`}
            aria-pressed={draft.friendlyAssist === true}
            onClick={() => setDraft((current) => ({ ...current, friendlyAssist: !current.friendlyAssist }))}
          >
            <span><strong>Friendly Assist</strong><small>After packing, a player may ask one active friend for permission to watch their cards and send private suggestions.</small></span>
            <em>{draft.friendlyAssist ? 'On' : 'Off'}</em>
          </button>
          <button
            type="button"
            className="btn btn-ghost tp-setup__propose"
            onClick={propose}
            disabled={busy || poolInvalid || draft.maxBlind < draft.baseBlind || draft.startingBalance < draft.bootAmount}
          >
            {busy ? 'Saving…' : teenPattiSetup ? 'Propose changed setup' : 'Propose table setup'}
          </button>
        </div>
      ) : teenPattiSetup ? (
        <dl className="tp-setup__summary">
          <div><dt>Format</dt><dd>{teenPattiSetup.variantPolicy.mode === 'VARIANT_TABLE' ? (teenPattiSetup.variantPolicy.rotation === 'SURPRISE_ME' ? 'Surprise Me table' : 'Variant table') : selectedVariant?.name ?? 'Fixed'}</dd></div>
          <div><dt>Balance</dt><dd>{teenPattiSetup.tableConfig.startingBalance}</dd></div>
          <div><dt>Boot</dt><dd>{teenPattiSetup.tableConfig.bootAmount}</dd></div>
          <div><dt>Blind</dt><dd>{teenPattiSetup.tableConfig.baseBlind} → {teenPattiSetup.tableConfig.maxBlind}</dd></div>
          <div><dt>Friendly Assist</dt><dd>{teenPattiSetup.tableConfig.friendlyAssist ? 'On' : 'Off'}</dd></div>
        </dl>
      ) : (
        <p className="tp-setup__waiting">Waiting for the host to propose the table setup.</p>
      )}

      {teenPattiSetup && (
        <>
          <p className="tp-setup__how">{teenPattiSetup.howToPlay}</p>
          <div className="tp-setup__agreement">
            <span>{acceptedCount}/{room.players.length} accepted</span>
            {!isHost && (
              <button type="button" className="btn btn-primary" onClick={accept} disabled={accepted || busy}>
                {accepted ? 'Accepted' : busy ? 'Accepting…' : 'Accept this setup'}
              </button>
            )}
            {isHost && <span className="tp-setup__host-accepted">Your proposal counts as your acceptance.</span>}
          </div>
        </>
      )}
    </section>
  );
}
