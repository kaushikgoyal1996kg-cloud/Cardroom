import type { VoiceIceServerConfig, VoiceIceServersAck } from './events.js';

const TURN_TTL_SECONDS = 4 * 60 * 60;
const REQUEST_TIMEOUT_MS = 8_000;
// Reuse a temporary credential until shortly before its 4-hour expiry. This
// avoids creating dozens of active Metered credentials during a long game
// night/reconnect cycle on the free plan.
const RELAY_CACHE_MS = (TURN_TTL_SECONDS - 10 * 60) * 1000;
const FALLBACK_CACHE_MS = 20 * 1000;

const FALLBACK_ICE_SERVERS: VoiceIceServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
];

interface MeteredCredentialResponse {
  username?: unknown;
  password?: unknown;
  apiKey?: unknown;
}

interface IceCacheEntry {
  value: VoiceIceServersAck;
  expiresAt: number;
}

// Reconnects and repeated UI taps must not create a fresh Metered credential
// every time. Cache only short-lived client ICE configuration, never the
// account Secret Key. In-flight de-duplication also prevents two simultaneous
// reconnect paths from racing two credential-creation requests.
const iceCache = new Map<string, IceCacheEntry>();
const iceRequests = new Map<string, Promise<VoiceIceServersAck>>();

/**
 * Returns per-call ICE configuration without ever sending the Metered account
 * Secret Key to the browser/APK. When Metered is not configured or is
 * temporarily unavailable, voice gracefully falls back to direct/STUN-only.
 */
export async function getVoiceIceServers(label: string): Promise<VoiceIceServersAck> {
  const safeLabel = sanitiseLabel(label);
  const now = Date.now();
  for (const [key, entry] of iceCache) {
    if (entry.expiresAt <= now) iceCache.delete(key);
  }
  const cached = iceCache.get(safeLabel);
  if (cached && cached.expiresAt > Date.now()) return cloneAck(cached.value);
  if (cached) iceCache.delete(safeLabel);

  const pending = iceRequests.get(safeLabel);
  if (pending) return cloneAck(await pending);

  const request = fetchVoiceIceServers(safeLabel);
  iceRequests.set(safeLabel, request);
  try {
    const value = await request;
    iceCache.set(safeLabel, {
      value: cloneAck(value),
      expiresAt: Date.now() + (value.relayAvailable ? RELAY_CACHE_MS : FALLBACK_CACHE_MS),
    });
    return cloneAck(value);
  } finally {
    iceRequests.delete(safeLabel);
  }
}

async function fetchVoiceIceServers(safeLabel: string): Promise<VoiceIceServersAck> {
  const domain = normaliseMeteredDomain(process.env.METERED_DOMAIN);
  const secretKey = process.env.METERED_SECRET_KEY?.trim();

  if (!domain || !secretKey) {
    return { ok: true, iceServers: FALLBACK_ICE_SERVERS, relayAvailable: false };
  }

  try {
    const credential = await fetchJson<MeteredCredentialResponse>(
      `https://${domain}/api/v1/turn/credential?secretKey=${encodeURIComponent(secretKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiryInSeconds: TURN_TTL_SECONDS, label: safeLabel }),
      }
    );

    if (typeof credential.apiKey !== 'string' || !credential.apiKey) {
      throw new Error('Metered did not return a credential API key.');
    }

    const rawServers = await fetchJson<unknown>(
      `https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(credential.apiKey)}`,
      { method: 'GET' }
    );
    const meteredServers = normaliseIceServers(rawServers);
    const relayAvailable = meteredServers.some((entry) =>
      asUrls(entry.urls).some((url) => url.startsWith('turn:') || url.startsWith('turns:'))
    );

    if (!relayAvailable) {
      throw new Error('Metered returned no TURN relay endpoint.');
    }

    // Keep Google's STUN as a second discovery path, then use Metered's own
    // returned array (including its STUN/TURN/TURNS endpoints) unchanged.
    return {
      ok: true,
      iceServers: dedupeIceServers([FALLBACK_ICE_SERVERS[0], ...meteredServers]),
      relayAvailable: true,
    };
  } catch (err) {
    console.warn('[voice] TURN credential unavailable; using STUN-only fallback:', err instanceof Error ? err.message : err);
    return {
      ok: true,
      iceServers: FALLBACK_ICE_SERVERS,
      relayAvailable: false,
      error: 'TURN relay is temporarily unavailable; direct voice will still be attempted.',
    };
  }
}

function cloneAck(value: VoiceIceServersAck): VoiceIceServersAck {
  return {
    ...value,
    iceServers: value.iceServers.map((server) => ({
      ...server,
      urls: Array.isArray(server.urls) ? [...server.urls] : server.urls,
    })),
  };
}

function normaliseMeteredDomain(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  // The account dashboard normally supplies <app>.metered.live. Refuse a
  // malformed/foreign host rather than turning a secret-key request into an
  // arbitrary server-side fetch target.
  if (!/^[a-z0-9][a-z0-9.-]*\.metered\.live$/i.test(trimmed)) return null;
  return trimmed;
}

function sanitiseLabel(label: string): string {
  const safe = label.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  return safe || 'cardroom-voice';
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Metered request failed (${response.status}).`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function normaliseIceServers(value: unknown): VoiceIceServerConfig[] {
  if (!Array.isArray(value)) return [];
  const result: VoiceIceServerConfig[] = [];
  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    const urls = normaliseUrls(candidate.urls);
    if (!urls) continue;
    const username = typeof candidate.username === 'string' ? candidate.username : undefined;
    const credential = typeof candidate.credential === 'string' ? candidate.credential : undefined;
    result.push({ urls, ...(username ? { username } : {}), ...(credential ? { credential } : {}) });
  }
  return result;
}

function normaliseUrls(value: unknown): string | string[] | null {
  const allow = (url: string) => /^(stun|turn|turns):/i.test(url) && url.length <= 500;
  if (typeof value === 'string') return allow(value) ? value : null;
  if (Array.isArray(value)) {
    const urls = value.filter((url): url is string => typeof url === 'string' && allow(url)).slice(0, 8);
    return urls.length ? urls : null;
  }
  return null;
}

function asUrls(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function dedupeIceServers(servers: VoiceIceServerConfig[]): VoiceIceServerConfig[] {
  const seen = new Set<string>();
  return servers.filter((entry) => {
    const key = `${asUrls(entry.urls).join('|')}|${entry.username ?? ''}|${entry.credential ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
