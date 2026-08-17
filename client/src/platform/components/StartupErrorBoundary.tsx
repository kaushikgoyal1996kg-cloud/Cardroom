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
    const isLocalhostProblem =
      isConfigProblem && /localhost/i.test(SERVER_CONFIG.error ?? '');

    return (
      <div className="startup-error" role="alert">
        <div className="startup-error__sheet">
          <p className="startup-error__eyebrow">The Card Room</p>
          <h1 className="startup-error__title">
            {isConfigProblem ? "The Card Room can't connect yet" : 'The Card Room needs a moment'}
          </h1>

          <p className="startup-error__message">
            {isConfigProblem
              ? isLocalhostProblem
                ? 'This version points at a local game server and cannot reach the Card Room online. Ask the host to update the build.'
                : 'This version is missing its game-server connection. Use the latest Card Room build or ask the host to update it.'
              : 'The app could not finish starting. Try again; if it persists, the Card Room host may need to check the deployment.'}
          </p>

          {isConfigProblem && (
            <p className="startup-error__hint">
              This is a Card Room setup issue, not a problem with your phone or internet connection.
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
