import { useState } from 'react';
import type { TeenPattiTwoReferenceAssignment } from '../../game/types';

interface TwoReferenceJokerChoiceProps {
  reason: 'SIDESHOW' | 'SHOWDOWN' | null;
  requiredForMe: boolean;
  requiredPlayerCount: number;
  assignment: TeenPattiTwoReferenceAssignment | null;
  optionA: string[];
  optionB: string[];
  onConfirm: (upDownReferenceIndex: 0 | 1) => void;
}

/**
 * Bug 10 guard: choosing Option A/B is deliberately a local draft first.
 * Nothing is sent to the server until the player has seen the exact joker set
 * and presses the separate confirmation button. This prevents the final chooser
 * from resolving a sideshow/showdown before they can verify what they picked.
 */
export function TwoReferenceJokerChoice({
  reason,
  requiredForMe,
  requiredPlayerCount,
  assignment,
  optionA,
  optionB,
  onConfirm,
}: TwoReferenceJokerChoiceProps) {
  const [draftChoice, setDraftChoice] = useState<0 | 1 | null>(null);

  if (!requiredForMe) {
    return (
      <p className="tp-actions__substatus">
        Waiting for the player{requiredPlayerCount === 1 ? '' : 's'} whose hand needs a joker choice.
      </p>
    );
  }

  if (assignment) {
    const locked = assignment.upDownReferenceIndex === 0 ? optionA : optionB;
    return (
      <p className="tp-actions__substatus">
        Chosen jokers: <strong>{locked.join(' · ')}</strong> · waiting for the comparison.
      </p>
    );
  }

  if (optionA.length === 0 || optionB.length === 0) {
    return <p className="tp-actions__status">Waiting for the two board references…</p>;
  }

  if (draftChoice !== null) {
    const selected = draftChoice === 0 ? optionA : optionB;
    const label = draftChoice === 0 ? 'Option A' : 'Option B';
    return (
      <div className="tp-reference-choice__confirmation" role="status" aria-live="polite">
        <span>You selected {label}</span>
        <strong>Jokers: {selected.join(' · ')}</strong>
        <small>Confirm this joker set before the {reason === 'SIDESHOW' ? 'sideshow' : 'showdown'} is resolved.</small>
        <div className="tp-reference-choice__confirm-actions">
          <button className="btn btn-primary" type="button" onClick={() => onConfirm(draftChoice)}>
            Confirm {label}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setDraftChoice(null)}>
            Change choice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tp-reference-choice__buttons">
      <button className="btn" type="button" onClick={() => setDraftChoice(0)}>
        Option A · Jokers: {optionA.join(' · ')}
      </button>
      <button className="btn" type="button" onClick={() => setDraftChoice(1)}>
        Option B · Jokers: {optionB.join(' · ')}
      </button>
    </div>
  );
}
