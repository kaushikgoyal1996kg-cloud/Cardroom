import { useEffect, useMemo, useState } from 'react';
import type { Card, DismissalReason, FourSets } from '../../game/types';
import { PlayingCard } from '../../platform/components/PlayingCard';
import {
  classifyThree,
  classifyFour,
  compareHand,
  labelFor,
  hasSixPairs,
  handHasNoPossibleSequence,
  RANK_VALUE,
} from '../../game/handClassification';
import { playSelectSound } from '../../lib/sound';
import { hapticLight } from '../../lib/haptics';
import './ArrangementTable.css';

/**
 * A suggestion as it arrives from the server: card IDS, not card objects.
 * The client resolves them against its own dealt hand, so it never has to be
 * told anything it does not already hold.
 */
export interface SuggestionOption {
  label: string;
  description: string;
  sets: FourSets;
}

type Location = 'pool' | 0 | 1 | 2 | 3;
interface Selected {
  location: Location;
  cardId: string;
}
type SortMode = 'dealt' | 'rank' | 'suit';

const SET_SIZES = [3, 3, 3, 4];
const SET_NAMES = ['Set 1', 'Set 2', 'Set 3', 'Set 4'];
const SET_RANK_HINT = ['Strongest', 'Second', 'Third', 'Weakest'];
const SET_LABELS_SHORT = ['S1', 'S2', 'S3', 'S4'];
const SUIT_ORDER: Record<Card['suit'], number> = { SPADES: 0, HEARTS: 1, DIAMONDS: 2, CLUBS: 3 };

function sortCards(cards: Card[], mode: SortMode): Card[] {
  if (mode === 'dealt') return cards;
  const sorted = [...cards];
  if (mode === 'rank') {
    sorted.sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  } else {
    sorted.sort(
      (a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || RANK_VALUE[b.rank] - RANK_VALUE[a.rank]
    );
  }
  return sorted;
}

export interface ArrangementTableProps {
  hand: Card[];
  onConfirm: (sets: FourSets) => void;
  onDismiss: (reason: DismissalReason, proposedSets?: FourSets) => void;
  submitError: string | null;
  cumulativeScore?: number;
  /**
   * Whether this player may receive automatic arrangement assistance.
   * Derived from authoritative room state by the caller. The server
   * independently enforces the same rule on its suggestion endpoints, so a
   * `true` here that the server disagrees with simply produces a refusal.
   */
  canUseAssist: boolean;
  /**
   * Asks the SERVER for suggestions. Supplied by the caller so this screen
   * has no way to compute an arrangement locally - the solver is not
   * imported here at all.
   *
   * The server independently re-checks room composition and refuses when the
   * player has any real human opponent, so a tampered `canUseAssist` of true
   * yields an error rather than an arrangement.
   */
  requestSuggestions?: () => Promise<{
    ok: boolean;
    error?: string;
    options?: { label: string; description: string; cardIdSets: [string[], string[], string[], string[]] }[];
  }>;
}

/**
 * Hazari hand arrangement, staged on felt.
 *
 * Interaction is tap-first throughout, because this has to work with a thumb
 * on a 320px phone: tap a card to pick it up, tap another card to swap, or
 * tap an empty space in a set to place it. No drag is required anywhere.
 */
export function ArrangementTable({
  hand,
  onConfirm,
  onDismiss,
  submitError,
  cumulativeScore,
  canUseAssist,
  requestSuggestions,
}: ArrangementTableProps) {
  const [pool, setPool] = useState<Card[]>(hand);
  const [slots, setSlots] = useState<[Card[], Card[], Card[], Card[]]>([[], [], [], []]);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [justDealt, setJustDealt] = useState(true);
  const [suggestionOptions, setSuggestionOptions] = useState<SuggestionOption[] | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [computingOptions, setComputingOptions] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);

  const isCloseToWinning = cumulativeScore !== undefined && 1000 - cumulativeScore <= 150;

  // Reset the board whenever a genuinely new hand arrives (new round dealt).
  const handFingerprint = hand.map((c) => c.id).sort().join(',');
  useEffect(() => {
    setPool(hand);
    setSlots([[], [], [], []]);
    setSelected(null);
    setJustDealt(true);
    setConfirmPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handFingerprint]);

  // If assistance is withdrawn mid-hand (e.g. a human takes over a bot seat),
  // drop any suggestions already on screen rather than leaving them readable.
  useEffect(() => {
    if (!canUseAssist) {
      setSuggestionOptions(null);
      setSuggestionError(null);
      setComputingOptions(false);
    }
  }, [canUseAssist]);

  // A failed submission must let the player try again.
  useEffect(() => {
    if (submitError) setConfirmPending(false);
  }, [submitError]);

  function findLocation(cardId: string): Location {
    if (pool.some((c) => c.id === cardId)) return 'pool';
    for (let i = 0; i < 4; i++) {
      if (slots[i].some((c) => c.id === cardId)) return i as Location;
    }
    return 'pool';
  }

  function getArray(loc: Location): Card[] {
    return loc === 'pool' ? pool : slots[loc];
  }
  function setArray(loc: Location, arr: Card[]) {
    if (loc === 'pool') setPool(arr);
    else
      setSlots((prev) => {
        const next = [...prev] as [Card[], Card[], Card[], Card[]];
        next[loc] = arr;
        return next;
      });
  }

  function moveTo(cardId: string, dest: Location) {
    const src = findLocation(cardId);
    if (src === dest) return;
    const maxSize = dest === 'pool' ? Infinity : SET_SIZES[dest];
    if (getArray(dest).length >= maxSize) return; // full - no-op
    const card = getArray(src).find((c) => c.id === cardId)!;
    setArray(src, getArray(src).filter((c) => c.id !== cardId));
    setArray(dest, [...getArray(dest), card]);
  }

  function swap(a: Selected, b: Selected) {
    if (a.location === b.location) return;
    const arrA = getArray(a.location);
    const arrB = getArray(b.location);
    const cardA = arrA.find((c) => c.id === a.cardId)!;
    const cardB = arrB.find((c) => c.id === b.cardId)!;
    setArray(a.location, arrA.filter((c) => c.id !== a.cardId).concat(cardB));
    setArray(b.location, arrB.filter((c) => c.id !== b.cardId).concat(cardA));
  }

  function handleCardTap(location: Location, card: Card) {
    playSelectSound();
    hapticLight();
    setJustDealt(false);
    if (!selected) {
      setSelected({ location, cardId: card.id });
      return;
    }
    if (selected.cardId === card.id) {
      setSelected(null);
      return;
    }
    swap(selected, { location, cardId: card.id });
    setSelected(null);
  }

  function handleEmptySlotTap(dest: Location) {
    if (!selected) return;
    playSelectSound();
    hapticLight();
    moveTo(selected.cardId, dest);
    setSelected(null);
  }

  /**
   * Requests suggestions FROM THE SERVER. No arrangement is ever computed in
   * this browser: the solver is not imported by this module, so there is no
   * local code path that could produce one.
   *
   * The `canUseAssist` guard here only avoids a pointless round trip. The
   * decision that matters is the server's, which re-derives eligibility from
   * its own room state and refuses regardless of what this client believes.
   */
  async function handleAutoArrange() {
    if (!canUseAssist || !requestSuggestions) return;
    setJustDealt(false);
    setComputingOptions(true);
    setSuggestionOptions(null);
    setSuggestionError(null);

    const res = await requestSuggestions();

    if (!res.ok || !res.options) {
      setSuggestionError(res.error ?? 'Could not get suggestions right now.');
      setComputingOptions(false);
      return;
    }

    // Resolve card ids against our own hand. An id we were not dealt is
    // dropped, so a malformed response can never inject a foreign card.
    const byId = new Map(hand.map((c) => [c.id, c]));
    const resolved: SuggestionOption[] = [];
    for (const opt of res.options) {
      const sets = opt.cardIdSets.map((ids) =>
        ids.map((id) => byId.get(id)).filter((c): c is Card => !!c)
      );
      const sizesOk =
        sets.length === 4 &&
        sets[0].length === 3 && sets[1].length === 3 &&
        sets[2].length === 3 && sets[3].length === 4;
      if (sizesOk) {
        resolved.push({
          label: opt.label,
          description: opt.description,
          sets: sets as FourSets,
        });
      }
    }

    if (resolved.length === 0) {
      setSuggestionError('Could not get suggestions right now.');
    } else {
      setSuggestionOptions(resolved);
    }
    setComputingOptions(false);
  }

  function applySuggestionOption(opt: SuggestionOption) {
    if (!canUseAssist) return;
    setSlots(opt.sets);
    setPool([]);
    setSelected(null);
    setSuggestionOptions(null);
  }

  function handleReset() {
    setPool(hand);
    setSlots([[], [], [], []]);
    setSelected(null);
    setSuggestionOptions(null);
    setSuggestionError(null);
  }

  const validation = useMemo(() => validateLocally(slots, pool), [slots, pool]);

  const dismissEligible = useMemo(() => {
    const reasons: DismissalReason[] = [];
    if (hasSixPairs(hand)) reasons.push('SIX_PAIRS');
    // Checked on the raw dealt hand - true from the moment it's dealt,
    // regardless of how much the player has arranged so far.
    if (handHasNoPossibleSequence(hand)) reasons.push('NO_SEQUENCE');
    return reasons;
  }, [hand]);

  const canConfirm = validation.valid && !confirmPending;
  const displayedPool = useMemo(() => sortCards(pool, sortMode), [pool, sortMode]);

  function handleConfirm() {
    if (!validation.valid || confirmPending) return;
    setConfirmPending(true);
    onConfirm(slots);
  }

  function handleDismiss() {
    // A dismissal claim only needs every dealt card at the right sizes -
    // ordering is irrelevant, so fall back to a mechanical split if the
    // player hasn't arranged a hand they're about to void anyway.
    const proposedSets: FourSets =
      pool.length === 0
        ? slots
        : [hand.slice(0, 3), hand.slice(3, 6), hand.slice(6, 9), hand.slice(9, 13)];
    onDismiss(dismissEligible[0], proposedSets);
  }

  return (
    <div className="arr">
      <header className="arr__bar">
        <div className="arr__heading">
          <p className="arr__eyebrow">Hazari · 13 cards · 3 / 3 / 3 / 4</p>
          <h1 className="arr__title">Build your four sets</h1>
        </div>
        <p className="arr__hint">
          {selected
            ? 'Selected — tap another card to swap, or an empty place to move it'
            : 'Tap a card, then choose where it belongs'}
        </p>
        <span className={`arr__remaining${validation.valid ? ' is-ready' : ''}`} aria-live="polite">
          {pool.length > 0 ? `${pool.length} card${pool.length === 1 ? '' : 's'} left` : validation.valid ? 'Ready' : 'All placed'}
        </span>
      </header>

      {/* ---- The felt: four marked trays --------------------------------- */}
      <div className="arr__felt">
        <div className="arr__felt-texture" aria-hidden="true" />
        <div className="arr__trays">
          {([0, 1, 2, 3] as const).map((idx) => {
            const setCards = slots[idx];
            const size = SET_SIZES[idx];
            const isFull = setCards.length === size;
            const value = isFull ? (idx === 3 ? classifyFour(setCards) : classifyThree(setCards)) : null;
            const orderOk = validation.setOk[idx];
            const isInvalid = orderOk === false;
            const canAccept = !!selected && setCards.length < size;

            return (
              <section
                key={idx}
                className={[
                  'tray',
                  `tray--${size}`,
                  isInvalid && 'is-invalid',
                  canAccept && 'can-accept',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`${SET_NAMES[idx]}, ${SET_RANK_HINT[idx]}, ${setCards.length} of ${size} cards`}
              >
                <div className="tray__plate">
                  <span className="tray__name">{SET_NAMES[idx]}</span>
                  {SET_RANK_HINT[idx] && (
                    <span className="tray__rank-hint">{SET_RANK_HINT[idx]}</span>
                  )}
                  <span className="tray__count">
                    {setCards.length}/{size}
                  </span>
                </div>

                <div className="tray__slots">
                  {setCards.map((c, cardIndex) => (
                    <button
                      key={c.id}
                      type="button"
                      className="tray__card"
                      style={{ top: `${Math.abs(cardIndex - (setCards.length - 1) / 2) * 3}px` }}
                      onClick={() => handleCardTap(idx, c)}
                      aria-pressed={selected?.cardId === c.id}
                    >
                      <PlayingCard
                        card={c}
                        size="sm"
                        selected={selected?.cardId === c.id}
                        tilt={(cardIndex - (setCards.length - 1) / 2) * 2.5}
                      />
                    </button>
                  ))}

                  {Array.from({ length: size - setCards.length }).map((_, i) => (
                    <button
                      key={`empty-${i}`}
                      type="button"
                      className="tray__empty"
                      onClick={() => handleEmptySlotTap(idx)}
                      disabled={!selected}
                      aria-label={`Place selected card into ${SET_NAMES[idx]}`}
                    />
                  ))}
                </div>

                <p className={`tray__status${isInvalid ? ' is-invalid' : ''}`}>
                  {value ? (
                    <>
                      {isInvalid && <span aria-hidden="true">✕ </span>}
                      {labelFor(value)}
                    </>
                  ) : (
                    <span className="tray__status-empty">&nbsp;</span>
                  )}
                </p>
              </section>
            );
          })}
        </div>
      </div>

      {/* ---- The player's remaining cards -------------------------------- */}
      <div className={`arr__hand${pool.length === 0 ? ' is-empty' : ''}`}>
        {pool.length > 0 ? (
          <>
            <div className="arr__hand-bar">
              <span className="arr__hand-label">Your cards</span>
              <div className="sortbar" role="group" aria-label="Sort your cards">
                <span className="sortbar__label" aria-hidden="true">
                  Sort
                </span>
                {(
                  [
                    ['rank', 'Rank'],
                    ['suit', 'Suit'],
                    ['dealt', 'Dealt'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`sortbar__btn${sortMode === mode ? ' is-active' : ''}`}
                    onClick={() => setSortMode(mode)}
                    aria-pressed={sortMode === mode}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="arr__fan">
              {displayedPool.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className={`arr__fan-card${justDealt ? ' is-dealing' : ''}`}
                  style={{
                    top: `${Math.abs(i - (displayedPool.length - 1) / 2) * 0.7}px`,
                    ...(justDealt ? { animationDelay: `${i * 45}ms` } : {}),
                  }}
                  onClick={() => handleCardTap('pool', c)}
                  aria-pressed={selected?.cardId === c.id}
                >
                  <PlayingCard
                    card={c}
                    size="sm"
                    selected={selected?.cardId === c.id}
                    tilt={(i - (displayedPool.length - 1) / 2) * 1.25}
                  />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* ---- One consolidated status line -------------------------------- */}
      <div className="arr__actions">
        <p
          className={`arr__status${validation.valid ? ' is-ready' : ''}${submitError || suggestionError ? ' is-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {submitError ?? suggestionError ?? validation.summary}
        </p>

        {/* Full validation detail, always available to assistive tech even
            though only the single most useful line is shown visually. */}
        <ul className="visually-hidden">
          {validation.messages.map((m, i) => (
            <li key={i}>
              {m.ok ? 'Done: ' : 'Still needed: '}
              {m.text}
            </li>
          ))}
        </ul>

        <div className="arr__buttons">
          <button type="button" className="btn btn--ghost arr__btn-reset" onClick={handleReset}>
            Reset
          </button>

          {canUseAssist && requestSuggestions && (
            <button
              type="button"
              className="btn btn--ghost arr__btn-suggest"
              onClick={handleAutoArrange}
              disabled={computingOptions}
            >
              {computingOptions ? 'Asking…' : 'Suggest'}
            </button>
          )}

          <button
            type="button"
            className="btn btn--primary arr__btn-confirm"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {confirmPending ? 'Confirming…' : 'Confirm hand'}
          </button>
        </div>

        {dismissEligible.length > 0 && (
          <details className="dismiss">
            <summary className="dismiss__summary">
              This hand can be dismissed
            </summary>
            <div className="dismiss__body">
              <p className="dismiss__reason">
                {dismissEligible.includes('NO_SEQUENCE') && dismissEligible.includes('SIX_PAIRS')
                  ? 'No possible sequence, and six pairs.'
                  : dismissEligible.includes('NO_SEQUENCE')
                    ? 'No possible sequence anywhere in your hand.'
                    : 'Your hand holds six pairs.'}
              </p>
              <p className="dismiss__consequence">
                Dismissing voids the round for <strong>all four players</strong> — everyone scores 0
                and the deal passes on.
              </p>
              <button type="button" className="btn btn--ghost dismiss__action" onClick={handleDismiss}>
                Dismiss hand
              </button>
            </div>
          </details>
        )}
      </div>

      {/* ---- Suggestions, only when permitted ---------------------------- */}
      {canUseAssist && suggestionOptions && (
        <div
          className="suggest"
          role="dialog"
          aria-label="Suggested arrangements"
          aria-modal="true"
        >
          <div className="suggest__sheet">
            <div className="suggest__head">
              <h2 className="suggest__title">Suggested arrangements</h2>
              <button
                type="button"
                className="suggest__close"
                onClick={() => setSuggestionOptions(null)}
                aria-label="Close suggestions"
              >
                ✕
              </button>
            </div>

            {isCloseToWinning && (
              <p className="suggest__note">
                You're close to winning, so these favour one strong set over a balanced spread.
              </p>
            )}

            <ul className="suggest__list" role="list">
              {suggestionOptions.map((opt, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="suggest__option"
                    onClick={() => applySuggestionOption(opt)}
                  >
                    <span className="suggest__option-label">{opt.label}</span>
                    <span className="suggest__option-desc">{opt.description}</span>
                    <span className="suggest__option-sets">
                      {opt.sets.map((setCards, idx) => (
                        <span key={idx} className="suggest__tag">
                          {SET_LABELS_SHORT[idx]} {labelFor(
                            idx === 3 ? classifyFour(setCards) : classifyThree(setCards)
                          )}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Local pre-validation. UNCHANGED from the previous screen - the server
 * remains authoritative and re-validates every submission. `summary` is new
 * and is purely presentational: it picks the single most useful message so
 * the screen isn't a wall of warnings. The underlying checks and the full
 * `messages` list are untouched.
 */
export function validateLocally(
  slots: [Card[], Card[], Card[], Card[]],
  pool: Card[]
): {
  valid: boolean;
  messages: { ok: boolean; text: string }[];
  setOk: (boolean | null)[];
  summary: string;
} {
  const messages: { ok: boolean; text: string }[] = [];
  const allPlaced = pool.length === 0;
  messages.push({ ok: allPlaced, text: 'All 13 cards used' });

  const sizesOk = slots.every((s, i) => s.length === SET_SIZES[i]);
  const setOk: (boolean | null)[] = [null, null, null, null];

  let orderingOk = true;
  let firstBadIndex = -1;
  if (sizesOk) {
    const values = [
      classifyThree(slots[0]),
      classifyThree(slots[1]),
      classifyThree(slots[2]),
      classifyFour(slots[3]),
    ];
    for (let i = 0; i < 3; i++) {
      const ok = compareHand(values[i], values[i + 1]) >= 0;
      setOk[i + 1] = ok;
      if (!ok) {
        orderingOk = false;
        if (firstBadIndex === -1) firstBadIndex = i + 1;
      }
    }
    setOk[0] = true;
  }
  messages.push({ ok: sizesOk && orderingOk, text: 'Sets arranged strongest → weakest' });

  const valid = allPlaced && sizesOk && orderingOk;

  let summary: string;
  if (!allPlaced) {
    summary = pool.length === 1 ? 'Place your last card' : `Place all ${pool.length} remaining cards`;
  } else if (!sizesOk) {
    summary = 'Each set needs the right number of cards';
  } else if (firstBadIndex > 0) {
    summary = `${SET_NAMES[firstBadIndex]} must not outrank ${SET_NAMES[firstBadIndex - 1]}`;
  } else {
    summary = 'Ready to confirm';
  }

  return { valid, messages, setOk, summary };
}
