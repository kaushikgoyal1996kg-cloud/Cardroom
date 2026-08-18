export type DeckPalette = 'classic' | 'four-color';
export type CardIndexSize = 'standard' | 'large';
export type MotionPreference = 'full' | 'reduced';

export interface TablePreferences {
  deckPalette: DeckPalette;
  cardIndexSize: CardIndexSize;
  motion: MotionPreference;
}

const STORAGE_KEY = 'cardroom_table_preferences_v1';

export const DEFAULT_TABLE_PREFERENCES: TablePreferences = {
  deckPalette: 'classic',
  cardIndexSize: 'standard',
  motion: 'full',
};

function normalize(value: unknown): TablePreferences {
  const raw = value && typeof value === 'object' ? value as Partial<TablePreferences> : {};
  return {
    deckPalette: raw.deckPalette === 'four-color' ? 'four-color' : 'classic',
    cardIndexSize: raw.cardIndexSize === 'large' ? 'large' : 'standard',
    motion: raw.motion === 'reduced' ? 'reduced' : 'full',
  };
}

export function loadTablePreferences(): TablePreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_TABLE_PREFERENCES };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalize(JSON.parse(stored)) : { ...DEFAULT_TABLE_PREFERENCES };
  } catch {
    return { ...DEFAULT_TABLE_PREFERENCES };
  }
}

export function applyTablePreferences(preferences: TablePreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.cardDeck = preferences.deckPalette;
  root.dataset.cardIndex = preferences.cardIndexSize;
  root.dataset.cardMotion = preferences.motion;
}

export function saveTablePreferences(preferences: TablePreferences): TablePreferences {
  const normalized = normalize(preferences);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Private browsing / storage denial should never block table play.
    }
  }
  applyTablePreferences(normalized);
  return normalized;
}

export function initializeTablePreferences(): TablePreferences {
  const preferences = loadTablePreferences();
  applyTablePreferences(preferences);
  return preferences;
}
