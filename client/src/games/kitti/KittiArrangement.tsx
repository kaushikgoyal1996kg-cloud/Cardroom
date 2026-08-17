import { useEffect, useMemo, useState } from 'react';
import type { Card, KittiGroups } from '../../game/types';
import type { KittiSuggestionAck } from '../../lib/socket';
import { classifyThree, compareHand, labelFor, RANK_VALUE } from '../../game/handClassification';
import { PlayingCard } from '../../platform/components/PlayingCard';
import './KittiArrangement.css';

type SortMode = 'dealt' | 'rank' | 'suit';

const SUIT_ORDER: Record<Card['suit'], number> = {
  SPADES: 0,
  HEARTS: 1,
  CLUBS: 2,
  DIAMONDS: 3,
};

function emptyGroups(): KittiGroups {
  return [[], [], []];
}

export function KittiArrangement({
  hand,
  onConfirm,
  canSuggest = false,
  onSuggest,
  submitError,
}: {
  hand: Card[];
  onConfirm: (groups: KittiGroups) => void;
  canSuggest?: boolean;
  onSuggest?: () => Promise<KittiSuggestionAck>;
  submitError?: string | null;
}) {
  const [groups, setGroups] = useState<KittiGroups>(() => emptyGroups());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('dealt');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const handSignature = hand.map((c) => c.id).join('|');

  useEffect(() => {
    setGroups(emptyGroups());
    setSelectedId(null);
    setSortMode('dealt');
    setSuggestionError(null);
  }, [handSignature]);

  const placedIds = useMemo(() => new Set(groups.flat().map((c) => c.id)), [groups]);
  const remaining = useMemo(() => {
    const cards = hand.filter((c) => !placedIds.has(c.id));
    if (sortMode === 'rank') {
      return [...cards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank] || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]);
    }
    if (sortMode === 'suit') {
      return [...cards].sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
    }
    return cards;
  }, [hand, placedIds, sortMode]);

  const groupValues = groups.map((g) => (g.length === 3 ? classifyThree(g) : null));
  const full = groups.every((g) => g.length === 3);
  const ordered = full && !!groupValues[0] && !!groupValues[1] && !!groupValues[2]
    && compareHand(groupValues[0], groupValues[1]) > 0
    && compareHand(groupValues[1], groupValues[2]) > 0;

  function putSelectedIn(groupIndex: number) {
    if (!selectedId || groups[groupIndex].length >= 3) return;
    const card = hand.find((c) => c.id === selectedId);
    if (!card || placedIds.has(card.id)) return;
    setGroups((prev) => prev.map((group, index) => index === groupIndex ? [...group, card] : group) as KittiGroups);
    setSelectedId(null);
  }

  function returnToHand(groupIndex: number, cardId: string) {
    setGroups((prev) => prev.map((group, index) => index === groupIndex ? group.filter((c) => c.id !== cardId) : group) as KittiGroups);
    setSelectedId(cardId);
  }

  async function applySuggestion() {
    if (!canSuggest || !onSuggest || suggesting) return;
    setSuggesting(true);
    setSuggestionError(null);
    try {
      const response = await onSuggest();
      if (!response.ok || !response.cardIdGroups) {
        setSuggestionError(response.error ?? 'Could not suggest an arrangement.');
        return;
      }
      const byId = new Map(hand.map((card) => [card.id, card]));
      const suggested = response.cardIdGroups.map((ids) => ids.map((id) => {
        const card = byId.get(id);
        if (!card) throw new Error('The suggested arrangement does not match this deal.');
        return card;
      })) as KittiGroups;
      setGroups(suggested);
      setSelectedId(null);
      setSortMode('dealt');
    } catch (error) {
      setSuggestionError(error instanceof Error ? error.message : 'Could not suggest an arrangement.');
    } finally {
      setSuggesting(false);
    }
  }

  const status = !full
    ? `${remaining.length} card${remaining.length === 1 ? '' : 's'} left to place`
    : ordered
      ? 'Arrangement ready — strongest to weakest'
      : 'Group 1 must be stronger than Group 2, and Group 2 stronger than Group 3';

  return (
    <main className="karr">
      <header className="karr__bar">
        <div>
          <p className="karr__eyebrow">Kitti · arrange once, play three hands</p>
          <h1 className="karr__title">Build your three hands</h1>
        </div>
        <span className={`karr__status${full && !ordered ? ' is-error' : ''}`}>{status}</span>
      </header>

      <section className="karr__felt" aria-label="Kitti arrangement table">
        <div className="karr__felt-texture" aria-hidden="true" />
        <div className="karr__trays">
          {groups.map((group, groupIndex) => {
            const value = groupValues[groupIndex];
            const relationInvalid = full && !ordered && (
              (groupIndex === 0 && compareHand(groupValues[0]!, groupValues[1]!) <= 0) ||
              (groupIndex === 1 && (compareHand(groupValues[0]!, groupValues[1]!) <= 0 || compareHand(groupValues[1]!, groupValues[2]!) <= 0)) ||
              (groupIndex === 2 && compareHand(groupValues[1]!, groupValues[2]!) <= 0)
            );
            return (
              <div className={`karr-tray${relationInvalid ? ' is-invalid' : ''}`} key={groupIndex}>
                <div className="karr-tray__plate">
                  <span className="karr-tray__name">Hand {groupIndex + 1}</span>
                  <span className="karr-tray__order">{groupIndex === 0 ? 'Strongest' : groupIndex === 1 ? 'Middle' : 'Weakest'}</span>
                  <span className="karr-tray__kind">{value ? labelFor(value) : `${group.length}/3 cards`}</span>
                </div>
                <div className="karr-tray__slots">
                  {group.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      className="karr-tray__card"
                      onClick={() => returnToHand(groupIndex, card.id)}
                      aria-label={`Move ${card.rank} back to your hand`}
                    >
                      <PlayingCard card={card} size="sm" />
                    </button>
                  ))}
                  {Array.from({ length: 3 - group.length }, (_, i) => (
                    <button
                      key={`empty-${i}`}
                      type="button"
                      className={`karr-tray__empty${selectedId ? ' can-accept' : ''}`}
                      disabled={!selectedId}
                      onClick={() => putSelectedIn(groupIndex)}
                      aria-label={selectedId ? `Place selected card in Hand ${groupIndex + 1}` : `Empty slot in Hand ${groupIndex + 1}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`karr__hand${remaining.length === 0 ? ' is-empty' : ''}`} aria-label="Cards not yet placed">
        {remaining.length > 0 && (
          <>
            <div className="karr__handbar">
              <span>{selectedId ? 'Tap an empty slot to place the selected card' : 'Tap a card, then choose a hand'}</span>
              <div className="karr__sort" role="group" aria-label="Sort remaining cards">
                {(['dealt', 'rank', 'suit'] as SortMode[]).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    className={sortMode === mode ? 'is-active' : ''}
                    onClick={() => setSortMode(mode)}
                    aria-pressed={sortMode === mode}
                  >
                    {mode === 'dealt' ? 'Dealt' : mode === 'rank' ? 'Rank' : 'Suit'}
                  </button>
                ))}
              </div>
            </div>
            <div className="karr__fan">
              {remaining.map((card, index) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="md"
                  selected={selectedId === card.id}
                  onClick={() => setSelectedId((current) => current === card.id ? null : card.id)}
                  tilt={(index - (remaining.length - 1) / 2) * 1.1}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <footer className="karr__actions">
        <div className="karr__rule">Hand 1 &gt; Hand 2 &gt; Hand 3. Exact equal strength is not a valid arrangement.</div>
        {canSuggest && onSuggest && (
          <div className="karr__assist">
            <span>Playing only against computers? You can ask the table to arrange your own nine cards.</span>
            <button type="button" className="btn btn-ghost" disabled={suggesting} onClick={applySuggestion}>
              {suggesting ? 'Finding arrangement…' : 'Suggest arrangement'}
            </button>
          </div>
        )}
        {(suggestionError || submitError) && (
          <div className="karr__error" role="alert">{suggestionError ?? submitError}</div>
        )}
        <button type="button" className="btn btn-primary" disabled={!ordered} onClick={() => onConfirm(groups)}>
          Confirm arrangement
        </button>
      </footer>
    </main>
  );
}
