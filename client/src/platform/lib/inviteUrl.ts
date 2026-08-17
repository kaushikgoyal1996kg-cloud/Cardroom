/**
 * Builds a shareable invite URL without ever leaking Capacitor's internal
 * `https://localhost` origin. Web/PWA builds can use their current public
 * origin; native builds should provide VITE_PUBLIC_APP_URL at build time.
 */
export function buildInviteUrl(
  roomCode: string,
  currentHref: string = typeof window !== 'undefined' ? window.location.href : '',
  configuredPublicUrl: string | undefined = import.meta.env.VITE_PUBLIC_APP_URL,
): string | null {
  const configured = configuredPublicUrl?.trim();
  const source = configured || currentHref;
  if (!source) return null;

  try {
    const url = new URL(source);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;

    // An invite is a fresh app entry, never a copy of whatever query/hash the
    // sender currently has open.
    url.search = '';
    url.hash = '';
    url.searchParams.set('join', roomCode.toUpperCase());
    return url.toString();
  } catch {
    return null;
  }
}
