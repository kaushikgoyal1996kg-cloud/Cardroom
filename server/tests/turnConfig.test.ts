import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVoiceIceServers } from '../src/platform/net/turnConfig.js';

const originalDomain = process.env.METERED_DOMAIN;
const originalSecret = process.env.METERED_SECRET_KEY;

afterEach(() => {
  if (originalDomain === undefined) delete process.env.METERED_DOMAIN;
  else process.env.METERED_DOMAIN = originalDomain;
  if (originalSecret === undefined) delete process.env.METERED_SECRET_KEY;
  else process.env.METERED_SECRET_KEY = originalSecret;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('voice TURN configuration', () => {
  it('falls back to STUN without contacting Metered when the backend is not configured', async () => {
    delete process.env.METERED_DOMAIN;
    delete process.env.METERED_SECRET_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await getVoiceIceServers('no-turn-config');

    expect(result.ok).toBe(true);
    expect(result.relayAvailable).toBe(false);
    expect(result.iceServers.some((server) => String(server.urls).startsWith('stun:'))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps the account secret server-side and reuses a short-lived ICE result for repeat requests', async () => {
    process.env.METERED_DOMAIN = 'cardroom-test.metered.live';
    process.env.METERED_SECRET_KEY = 'server-only-secret';

    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ apiKey: 'temporary-credential-api-key' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { urls: 'stun:stun.relay.metered.ca:80' },
          { urls: 'turn:global.relay.metered.ca:80', username: 'temporary-user', credential: 'temporary-password' },
          { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'temporary-user', credential: 'temporary-password' },
        ]),
      });
    vi.stubGlobal('fetch', fetchSpy);

    const first = await getVoiceIceServers('room/ABC player!123');
    const second = await getVoiceIceServers('room/ABC player!123');

    expect(first.relayAvailable).toBe(true);
    expect(second).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // POST credential + GET ICE once; second request is cached

    const createUrl = String(fetchSpy.mock.calls[0][0]);
    expect(createUrl).toContain('cardroom-test.metered.live');
    expect(createUrl).toContain(encodeURIComponent('server-only-secret'));

    const createInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(createInit.body));
    expect(body.expiryInSeconds).toBe(4 * 60 * 60);
    expect(body.label).toBe('room-ABC-player-123');

    // The long-lived account key is never returned to the browser/APK. Only
    // Metered's temporary ICE username/password can appear in client config.
    expect(JSON.stringify(first)).not.toContain('server-only-secret');
    expect(JSON.stringify(first)).toContain('temporary-user');
    expect(JSON.stringify(first)).toContain('temporary-password');
  });

  it('refuses a foreign Metered-looking host instead of sending the secret to an arbitrary URL', async () => {
    process.env.METERED_DOMAIN = 'attacker.example.com';
    process.env.METERED_SECRET_KEY = 'must-not-leave-server';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await getVoiceIceServers('invalid-domain-case');

    expect(result.relayAvailable).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
