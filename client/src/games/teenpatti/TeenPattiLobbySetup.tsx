import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../lib/GameStore';
import type { TeenPattiTableConfig } from '../../game/types';
import './TeenPattiLobbySetup.css';

const DEFAULTS: TeenPattiTableConfig = {
  startingBalance: 1000,
  bootAmount: 10,
  baseBlind: 10,
  maxBlind: 60,
};

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (teenPattiSetup) setDraft(teenPattiSetup.tableConfig);
  }, [teenPattiSetup]);

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

  async function propose() {
    if (busy) return;
    setBusy(true);
    await proposeTeenPattiSetup(draft, { variantId: 'CLASSIC' });
    setBusy(false);
  }

  async function accept() {
    if (!teenPattiSetup || busy) return;
    setBusy(true);
    await acceptTeenPattiSetup(teenPattiSetup.revision);
    setBusy(false);
  }

  return (
    <section className="tp-setup" aria-label="Teen Patti table setup">
      <div className="tp-setup__heading">
        <div>
          <p className="tp-setup__eyebrow">Table agreement</p>
          <h2>Classic Teen Patti</h2>
        </div>
        {teenPattiSetup && (
          <span className="tp-setup__revision">Setup {teenPattiSetup.revision}</span>
        )}
      </div>

      {isHost ? (
        <div className="tp-setup__fields">
          <label>
            <span>Starting balance</span>
            <input inputMode="numeric" type="number" min="1" value={draft.startingBalance} onChange={(e) => update('startingBalance', e.target.value)} />
          </label>
          <label>
            <span>Boot</span>
            <input inputMode="numeric" type="number" min="1" value={draft.bootAmount} onChange={(e) => update('bootAmount', e.target.value)} />
          </label>
          <label>
            <span>Base blind</span>
            <input inputMode="numeric" type="number" min="1" value={draft.baseBlind} onChange={(e) => update('baseBlind', e.target.value)} />
          </label>
          <label>
            <span>Max blind</span>
            <input inputMode="numeric" type="number" min="1" value={draft.maxBlind} onChange={(e) => update('maxBlind', e.target.value)} />
          </label>
          <button type="button" className="btn btn-ghost tp-setup__propose" onClick={propose} disabled={busy || draft.maxBlind < draft.baseBlind || draft.startingBalance < draft.bootAmount}>
            {busy ? 'Saving…' : teenPattiSetup ? 'Propose changed setup' : 'Propose table setup'}
          </button>
        </div>
      ) : teenPattiSetup ? (
        <dl className="tp-setup__summary">
          <div><dt>Balance</dt><dd>{teenPattiSetup.tableConfig.startingBalance}</dd></div>
          <div><dt>Boot</dt><dd>{teenPattiSetup.tableConfig.bootAmount}</dd></div>
          <div><dt>Blind</dt><dd>{teenPattiSetup.tableConfig.baseBlind} → {teenPattiSetup.tableConfig.maxBlind}</dd></div>
          <div><dt>Seen</dt><dd>2× current blind</dd></div>
        </dl>
      ) : (
        <p className="tp-setup__waiting">Waiting for the host to propose the table amounts.</p>
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
