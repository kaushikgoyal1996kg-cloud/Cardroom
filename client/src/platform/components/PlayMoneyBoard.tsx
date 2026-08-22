import { useState } from 'react';
import { useGame } from '../../lib/GameStore';
import './PlayMoneyBoard.css';

const PRESETS = [10, 20, 50, 100];

export function PlayMoneyBoard() {
  const {
    room,
    myPlayerId,
    proposePlayMoney,
    acceptPlayMoney,
    declinePlayMoney,
    cancelPlayMoney,
  } = useGame();
  const [amountText, setAmountText] = useState('100');
  const [kittiMode, setKittiMode] = useState<'MATCH_POT' | 'KITTI_ROUND_BOOT'>('MATCH_POT');

  if (!room?.playMoney || !['HAZARI', 'KITTI'].includes(room.gameId)) return null;

  const proposal = room.playMoney.proposal;
  const humans = room.players.filter((player) => !player.isBot);
  const me = room.players.find((player) => player.playerId === myPlayerId);
  const isHost = me?.isHost ?? false;
  const accepted = new Set(proposal?.acceptedBy ?? []);
  const humanAccepted = humans.filter((player) => accepted.has(player.playerId));
  const allHumansAccepted = !!proposal && humanAccepted.length === humans.length;
  const meAccepted = !!myPlayerId && accepted.has(myPlayerId);
  const previewPot = proposal ? proposal.amount * room.players.length : 0;
  const amount = Number(amountText);
  const validAmount = Number.isSafeInteger(amount) && amount > 0 && amount <= 1_000_000;
  const proposalMode = proposal?.mode ?? 'MATCH_POT';
  const isRoundBoot = room.gameId === 'KITTI' && proposalMode === 'KITTI_ROUND_BOOT';

  const ledgerRows = room.players
    .map((player) => ({ player, value: room.playMoney.tableProfitLoss[player.playerId] ?? 0 }))
    .filter((entry) => entry.value !== 0);

  return (
    <section className="play-money-board" aria-labelledby="play-money-title">
      <div className="play-money-board__head">
        <div>
          <p className="play-money-board__eyebrow">Optional · virtual only</p>
          <h2 id="play-money-title">Play-money board</h2>
        </div>
        {proposal && (
          <div className="play-money-board__amount" aria-label={`Board ${proposal.amount}`}>
            <strong>{proposal.amount}</strong>
            <span>board</span>
          </div>
        )}
      </div>

      {!proposal ? (
        isHost ? (
          <div className="play-money-board__propose">
            {room.gameId === 'KITTI' && (
              <label>
                Kitti table mode
                <select value={kittiMode} onChange={(event) => setKittiMode(event.target.value as typeof kittiMode)}>
                  <option value="MATCH_POT">10-round match · one match pot</option>
                  <option value="KITTI_ROUND_BOOT">Round Boot · pot carries on a 1–1–1 tie</option>
                </select>
              </label>
            )}
            <p>{room.gameId === 'KITTI' && kittiMode === 'KITTI_ROUND_BOOT'
              ? 'Choose the boot each seat adds per deal. A three-way 1–1–1 result carries the pot and everyone adds the boot again.'
              : 'Propose a board for this match, or start normally with no play money.'}</p>
            <div className="play-money-board__presets" aria-label="Board amount presets">
              {PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={amountText === String(preset) ? 'is-selected' : ''}
                  onClick={() => setAmountText(String(preset))}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="play-money-board__custom">
              <label htmlFor="play-money-amount">Board amount</label>
              <input
                id="play-money-amount"
                type="number"
                inputMode="numeric"
                min="1"
                max="1000000"
                step="1"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
              />
              <button
                className="btn btn-primary"
                type="button"
                disabled={!validAmount}
                onClick={() => validAmount && proposePlayMoney(amount, room.gameId === 'KITTI' ? kittiMode : 'MATCH_POT')}
              >
                {room.gameId === 'KITTI' && kittiMode === 'KITTI_ROUND_BOOT' ? 'Propose boot' : 'Propose board'}
              </button>
            </div>
          </div>
        ) : (
          <p className="play-money-board__quiet">No board proposed. This match can start with normal scoring only.</p>
        )
      ) : (
        <>
          <div className="play-money-board__pot-preview">
            <span>{isRoundBoot ? 'First-deal pot if accepted' : 'Match pot if accepted'}</span>
            <strong>{previewPot}</strong>
            <small>{room.players.length} × {proposal.amount}</small>
          </div>

          <div className="play-money-board__votes" aria-label="Play-money board votes">
            {humans.map((player) => {
              const hasAccepted = accepted.has(player.playerId);
              return (
                <div key={player.playerId} className={hasAccepted ? 'is-accepted' : 'is-pending'}>
                  <span>{player.name}{player.playerId === myPlayerId ? ' · You' : ''}</span>
                  <strong>{hasAccepted ? 'Accepted' : 'Pending'}</strong>
                </div>
              );
            })}
            {room.players.some((player) => player.isBot) && (
              <p>Computer seats auto-accept.</p>
            )}
          </div>

          <p className={`play-money-board__status${allHumansAccepted ? ' is-ready' : ''}`} role="status">
            {allHumansAccepted
              ? `Everyone has accepted. The ${isRoundBoot ? 'round boot' : 'board'} will lock when the match starts.`
              : `${humanAccepted.length} of ${humans.length} human player${humans.length === 1 ? '' : 's'} accepted.`}
          </p>

          <div className="play-money-board__actions">
            {!isHost && !meAccepted && (
              <>
                <button className="btn btn-primary" type="button" onClick={acceptPlayMoney}>
                  Accept {proposal.amount}
                </button>
                <button className="btn btn-ghost" type="button" onClick={declinePlayMoney}>
                  Decline board
                </button>
              </>
            )}
            {!isHost && meAccepted && <span className="play-money-board__accepted-mark">Your vote is accepted</span>}
            {isHost && (
              <button className="btn btn-ghost" type="button" onClick={cancelPlayMoney}>
                Withdraw proposal
              </button>
            )}
          </div>
        </>
      )}

      {ledgerRows.length > 0 && (
        <div className="play-money-board__ledger">
          <div className="play-money-board__ledger-title">
            <span>Table P/L</span>
            <small>This room session</small>
          </div>
          {ledgerRows.map(({ player, value }) => (
            <div key={player.playerId}>
              <span>{player.name}{player.playerId === myPlayerId ? ' · You' : ''}</span>
              <strong className={value > 0 ? 'is-positive' : 'is-negative'}>{value > 0 ? '+' : ''}{value}</strong>
            </div>
          ))}
        </div>
      )}

      <p className="play-money-board__legal">No deposits · no withdrawals · no cash value</p>
    </section>
  );
}

export function PlayMoneyPotBadge() {
  const { room } = useGame();
  const active = room?.playMoney?.activeMatch;
  if (!active) return null;
  return (
    <div className="play-money-pot-badge play-money-pot-badge--compact" aria-label={`Virtual play-money pot ${active.pot}`}>
      <span>Virtual pot</span>
      <strong>{active.pot}</strong>
      {active.mode === 'KITTI_ROUND_BOOT' && active.contributionRounds > 1 && <small>{active.contributionRounds} boots</small>}
    </div>
  );
}

export function PlayMoneySettlement() {
  const { room, myPlayerId } = useGame();
  const active = room?.playMoney?.activeMatch;
  if (!room || !active?.settled || !active.winnerId) return null;
  const winner = room.players.find((player) => player.playerId === active.winnerId);

  return (
    <section className="play-money-settlement" aria-label="Play-money result">
      <p>Virtual board settled</p>
      <div className="play-money-settlement__pot">
        <span>{active.amount} × {active.participantIds.length}{active.contributionRounds > 1 ? ` × ${active.contributionRounds} deals` : ''}</span>
        <strong>{active.pot}</strong>
        <small>pot</small>
      </div>
      <p>{winner?.name ?? 'Winner'} receives the full virtual pot.</p>
      <div className="play-money-settlement__ledger">
        {room.players.map((player) => {
          const value = room.playMoney.tableProfitLoss[player.playerId] ?? 0;
          return (
            <div key={player.playerId}>
              <span>{player.name}{player.playerId === myPlayerId ? ' · You' : ''}</span>
              <strong className={value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : ''}>{value > 0 ? '+' : ''}{value}</strong>
            </div>
          );
        })}
      </div>
      <small>Room-session play money only. No cash value.</small>
    </section>
  );
}
