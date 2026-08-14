// ============================================================================
// PLATFORM - Server configuration
//
// FIXES A REAL PRODUCTION BUG in the previous build:
//   const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
//
// That silently fell back to localhost when VITE_SERVER_URL was missing from
// the deployed build. On a phone, "localhost" is the phone itself, so every
// player just saw an endless "Connecting..." with nothing in the UI to
// explain why. A missing configuration must fail loudly at build/boot time,
// not degrade into an unexplainable hang.
// ============================================================================

/** True when this bundle was produced by `vite build`. */
export const IS_PRODUCTION = import.meta.env.PROD;

export interface ServerConfig {
  ok: boolean;
  url: string;
  /** Present when ok is false - a message safe to show a non-technical player. */
  error?: string;
}

function readServerUrl(): ServerConfig {
  const configured = import.meta.env.VITE_SERVER_URL?.trim();

  if (configured) {
    // Reject an obviously wrong production value rather than letting every
    // player hit their own phone.
    if (IS_PRODUCTION && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(configured)) {
      return {
        ok: false,
        url: configured,
        error:
          'This build points at localhost, so it cannot reach the game server. ' +
          'Set VITE_SERVER_URL to the public backend address and redeploy.',
      };
    }
    return { ok: true, url: configured.replace(/\/+$/, '') };
  }

  // No configuration at all.
  if (IS_PRODUCTION) {
    return {
      ok: false,
      url: '',
      error:
        'This build is missing its server address. ' +
        'Set VITE_SERVER_URL in the Netlify environment variables and redeploy.',
    };
  }

  // Local development only - never reached in a production bundle.
  return { ok: true, url: 'http://localhost:3001' };
}

export const SERVER_CONFIG: ServerConfig = readServerUrl();

/**
 * Throws if the build is misconfigured. Call this at boot so the app can show
 * a real explanation instead of hanging on a connection that can never open.
 */
export function assertServerConfigured(): string {
  if (!SERVER_CONFIG.ok) throw new Error(SERVER_CONFIG.error);
  return SERVER_CONFIG.url;
}
