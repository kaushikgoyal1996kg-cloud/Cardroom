export const AVATAR_OPTIONS = [
  '🦚', // peacock
  '👑', // crown
  '🐘', // elephant
  '🐯', // tiger
  '🦁', // lion
  '🦜', // parrot
  '🐍', // cobra
  '🪷', // lotus
  '🔱', // trident
  '🎭', // mask
  '🌙', // moon
  '⭐', // star
  '🐆', // panther
  '🦅', // eagle
  '🐺', // wolf
  '🐉', // dragon
  '🦉', // owl
  '🐎', // stallion
  '🐂', // bull
  '🦊', // fox
  '💎', // diamond
  '⚜️', // fleur-de-lis
  '🛡️', // shield
  '♠️', // spade
  '🤴', // prince
  '👸', // princess
  '🧞', // genie
  '👳', // person wearing turban
  '🧕', // person with headscarf
  '🥷', // ninja
  '🧙', // wizard
  '🕵️', // detective
  '🤠', // cowboy
  '🥸', // disguise face
] as const;

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0];

/** Human-readable names for accessibility (screen readers) - matches the options above 1:1. */
export const AVATAR_NAMES: Record<string, string> = {
  '🦚': 'Peacock',
  '👑': 'Crown',
  '🐘': 'Elephant',
  '🐯': 'Tiger',
  '🦁': 'Lion',
  '🦜': 'Parrot',
  '🐍': 'Cobra',
  '🪷': 'Lotus',
  '🔱': 'Trident',
  '🎭': 'Mask',
  '🌙': 'Moon',
  '⭐': 'Star',
  '🐆': 'Panther',
  '🦅': 'Eagle',
  '🐺': 'Wolf',
  '🐉': 'Dragon',
  '🦉': 'Owl',
  '🐎': 'Stallion',
  '🐂': 'Bull',
  '🦊': 'Fox',
  '💎': 'Diamond',
  '⚜️': 'Fleur-de-lis',
  '🛡️': 'Shield',
  '♠️': 'Spade',
  '🤴': 'Prince',
  '👸': 'Princess',
  '🧞': 'Genie',
  '👳': 'Person wearing turban',
  '🧕': 'Person with headscarf',
  '🥷': 'Ninja',
  '🧙': 'Wizard',
  '🕵️': 'Detective',
  '🤠': 'Cowboy',
  '🥸': 'Disguise face',
};

/** Presentation-only medallion tone. The server stores/validates only the
 * avatar symbol; tone is derived locally so identity stays portable across
 * web, Android and iPhone without extra image assets. */
export function avatarToneClass(avatar: string): string {
  const index = (AVATAR_OPTIONS as readonly string[]).indexOf(avatar);
  return `avatar-tone-${index < 0 ? 0 : index % 6}`;
}
