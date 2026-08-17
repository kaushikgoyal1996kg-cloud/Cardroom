// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

/**
 * The bad-config path must render a meaningful screen rather than a blank
 * page. SERVER_CONFIG is read at module scope, so each test resets modules
 * and re-imports with a different environment.
 */

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

beforeEach(() => {
  // The boundary logs to console on catch; keep test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

/** A component that throws during render, like getSocket() does. */
function Exploding({ message }: { message: string }): never {
  throw new Error(message);
}

async function loadBoundary() {
  const mod = await import('./StartupErrorBoundary');
  return mod.StartupErrorBoundary;
}

describe('StartupErrorBoundary with a broken production config', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_SERVER_URL', '');
  });

  it('renders a real screen instead of nothing', async () => {
    const Boundary = await loadBoundary();
    const { container } = render(
      <Boundary>
        <Exploding message="This build is missing its server address." />
      </Boundary>
    );

    // The specific failure mode being fixed: a blank page.
    expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('explains that the deployment is misconfigured, in plain language', async () => {
    const Boundary = await loadBoundary();
    render(
      <Boundary>
        <Exploding message="boom" />
      </Boundary>
    );

    expect(screen.getByText(/can't connect yet/i)).toBeTruthy();
    expect(screen.getByText(/missing its game-server connection/i)).toBeTruthy();
  });

  it('reassures the player it is not their phone or connection', async () => {
    const Boundary = await loadBoundary();
    render(
      <Boundary>
        <Exploding message="boom" />
      </Boundary>
    );
    expect(screen.getByText(/not a problem with your phone or internet connection/i)).toBeTruthy();
  });

  it('offers a retry control that is a real touch target', async () => {
    const Boundary = await loadBoundary();
    render(
      <Boundary>
        <Exploding message="boom" />
      </Boundary>
    );
    const button = screen.getByRole('button', { name: /try again/i });
    expect(button).toBeTruthy();
    expect(() => fireEvent.click(button)).not.toThrow();
  });

  it('never shows a raw stack trace or the thrown error object', async () => {
    const Boundary = await loadBoundary();
    render(
      <Boundary>
        <Exploding message="Error: secret-token-abc123 at Object.<anonymous>" />
      </Boundary>
    );
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('secret-token-abc123');
    expect(text).not.toMatch(/at Object\./);
  });
});

describe('StartupErrorBoundary with a localhost URL in a production build', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_SERVER_URL', 'http://localhost:3001');
  });

  it('explains the localhost problem specifically', async () => {
    const Boundary = await loadBoundary();
    render(
      <Boundary>
        <Exploding message="boom" />
      </Boundary>
    );
    expect(screen.getByText(/points at a local game server/i)).toBeTruthy();
  });
});

describe('StartupErrorBoundary with a healthy config', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_SERVER_URL', 'https://cardroom-server.example.com');
  });

  it('renders children untouched when nothing throws', async () => {
    const Boundary = await loadBoundary();
    render(
      <Boundary>
        <p>the table</p>
      </Boundary>
    );
    expect(screen.getByText('the table')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('falls back to a generic message for a non-config failure', async () => {
    const Boundary = await loadBoundary();
    render(
      <Boundary>
        <Exploding message="some unrelated render bug" />
      </Boundary>
    );
    // Config is fine, so it must NOT claim the deployment is misconfigured.
    expect(screen.queryByText(/can't connect yet/i)).toBeNull();
    expect(screen.getByText(/could not finish starting/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain('some unrelated render bug');
  });
});

describe('server config resolution', () => {
  it('refuses a production build with no server address', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_SERVER_URL', '');
    const { SERVER_CONFIG } = await import('../lib/config');
    expect(SERVER_CONFIG.ok).toBe(false);
    expect(SERVER_CONFIG.error).toMatch(/missing its server address/i);
  });

  it('refuses a production build pointed at localhost', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_SERVER_URL', 'http://127.0.0.1:3001');
    const { SERVER_CONFIG } = await import('../lib/config');
    expect(SERVER_CONFIG.ok).toBe(false);
  });

  it('never silently falls back to a default server in production', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_SERVER_URL', '');
    const { SERVER_CONFIG } = await import('../lib/config');
    expect(SERVER_CONFIG.url).toBe('');
    expect(SERVER_CONFIG.ok).toBe(false);
  });

  it('keeps development sensible with a localhost default', async () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_SERVER_URL', '');
    const { SERVER_CONFIG } = await import('../lib/config');
    expect(SERVER_CONFIG.ok).toBe(true);
    expect(SERVER_CONFIG.url).toBe('http://localhost:3001');
  });

  it('accepts a valid production address and trims a trailing slash', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_SERVER_URL', 'https://cardroom.example.com/');
    const { SERVER_CONFIG } = await import('../lib/config');
    expect(SERVER_CONFIG.ok).toBe(true);
    expect(SERVER_CONFIG.url).toBe('https://cardroom.example.com');
  });

  it('getSocket throws rather than opening a doomed connection', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_SERVER_URL', '');
    const { getSocket } = await import('../../lib/socket');
    expect(() => getSocket()).toThrow(/missing its server address/i);
  });
});
