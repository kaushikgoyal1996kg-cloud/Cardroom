import './LoadingSpinner.css';

interface Props {
  message?: string;
  size?: number;
}

/** Neutral multi-game loading mark. No Hazari-specific branding is allowed
 * on a shared reconnect/wait screen because Kitti uses this component too. */
export function LoadingSpinner({ message, size = 56 }: Props) {
  return (
    <div className="loading-spinner" role="status" aria-live="polite">
      <div className="loading-spinner__seal" style={{ '--loader-size': `${size}px` } as React.CSSProperties} aria-hidden="true">
        <img src="/brand/card-room-emblem.png" alt="" />
      </div>
      {message && <p className="loading-spinner__message text-muted">{message}</p>}
    </div>
  );
}
