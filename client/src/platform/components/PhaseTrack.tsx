import './PhaseTrack.css';

interface PhaseTrackProps {
  labels: readonly string[];
  activeIndex: number;
  completedIndexes?: readonly number[];
  ariaLabel: string;
  compact?: boolean;
}

/**
 * A restrained progress rail for live card-table phases.
 *
 * This is deliberately presentation-only: callers derive the active/completed
 * steps from authoritative game state. It gives Hazari/Kitti/Teen Patti/Poker
 * one shared visual language without pushing rule logic into the platform UI.
 */
export function PhaseTrack({
  labels,
  activeIndex,
  completedIndexes,
  ariaLabel,
  compact = false,
}: PhaseTrackProps) {
  const completed = new Set(completedIndexes ?? labels.map((_, index) => index).filter((index) => index < activeIndex));

  return (
    <ol className={`phase-track${compact ? ' phase-track--compact' : ''}`} aria-label={ariaLabel}>
      {labels.map((label, index) => {
        const isActive = index === activeIndex;
        const isDone = completed.has(index);
        return (
          <li
            key={`${label}-${index}`}
            className={`phase-track__step${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="phase-track__node" aria-hidden="true">
              {isDone ? '✓' : index + 1}
            </span>
            <span className="phase-track__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
