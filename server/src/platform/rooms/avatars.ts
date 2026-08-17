// Curated Card Room seat identities. Kept as plain Unicode symbols/emoji so
// the same value renders in the website, Android wrapper and iPhone Safari
// without image downloads or per-platform asset paths. The server validates
// every client-supplied avatar against this exact allow-list.
export const AVATAR_OPTIONS = [
  '🦚', '👑', '🐘', '🐯', '🦁', '🦜', '🐍', '🪷', '🔱', '🎭', '🌙', '⭐',
  '🐆', '🦅', '🐺', '🐉', '🦉', '🐎', '🐂', '🦊', '💎', '⚜️', '🛡️', '♠️',
  '🤴', '👸', '🧞', '👳', '🧕', '🥷', '🧙', '🕵️', '🤠', '🥸',
] as const;

export type Avatar = (typeof AVATAR_OPTIONS)[number];

export const DEFAULT_AVATAR: Avatar = AVATAR_OPTIONS[0];

export function isValidAvatar(value: unknown): value is Avatar {
  return typeof value === 'string' && (AVATAR_OPTIONS as readonly string[]).includes(value);
}
