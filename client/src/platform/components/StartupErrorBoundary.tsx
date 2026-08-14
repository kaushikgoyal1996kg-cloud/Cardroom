import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SERVER_CONFIG } from '../lib/config';
import './StartupErrorBoundary.css';

/**
 * Catches failures that happen while the app is starting up - overwhelmingly
 * a misconfigured deployment.
 *
 * WHY THIS EXISTS: `getSocket()` throws when VITE_SERVER_URL is missing or
 * points at localhost in a production build. It is called during GameStore's
 * `useRef` initialiser, i.e. during the very first render, so the throw
 * escaped React entirely and the player got a blank white page. The detection
 * was correct; there was simply nothing to show it.
 *
 * SCOPE: startup and configuration only. Normal runtime disconnects are still
 * handled by the socket's own reconnection logic and the connection banner -
 * this boundary must not swallow those, and it does not, because they never
 * throw during render.
 */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class StartupErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console only - never surfaced to the player, and never sent anywhere.
    console.error('Startup failure:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A configuration problem has a specific, actionable explanation. Anything
    // else gets a generic message rather than a raw stack trace.
    const isConfigProblem = !SERVER_CONFIG.ok;

    return (
      <div className="startup-error" role="alert">
        <div className="startup-error__sheet">
          <p className="startup-error__eyebrow">The Card Room</p>
          <h1 className="startup-error__title">
            {isConfigProblem ? "This table isn't set up yet" : 'Something went wrong'}
          </h1>

          <p className="startup-error__message">
            {isConfigProblem
              ? SERVER_CONFIG.error
              : 'The game could not start. Reloading the page will usually fix it.'}
          </p>

          {isConfigProblem && (
            <p className="startup-error__hint">
              Nothing is wrong with your phone or your connection — the game
              itself needs configuring by whoever set it up.
            </p>
          )}

          <button
            type="button"
            className="startup-error__action"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
