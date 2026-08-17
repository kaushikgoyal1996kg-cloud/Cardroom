import type { GameId } from '../game/types';

const LEGACY_HAZARI_STATS_KEY = 'haazari_stats_v1';
const STATS_KEY = 'cardroom_stats_v2';

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  /** Hazari points for Hazari, rounds won for Kitti. The UI labels this per game. */
  totalPoints: number;
  lastPlayedAt: number;
}

type NameStatsStore = Record<string, PlayerStats>;
type StatsStore = Partial<Record<GameId, NameStatsStore>>;

function emptyStats(): PlayerStats {
  return { gamesPlayed: 0, gamesWon: 0, totalPoints: 0, lastPlayedAt: 0 };
}

function readLegacyHazariStore(): NameStatsStore {
  try {
    const raw = localStorage.getItem(LEGACY_HAZARI_STATS_KEY);
    return raw ? (JSON.parse(raw) as NameStatsStore) : {};
  } catch {
    return {};
  }
}

function readStore(): StatsStore {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw) as StatsStore;

    // One-time in-place migration: old builds tracked only Hazari under the
    // legacy key. Preserve that history under the Hazari bucket instead of
    // making an upgrade look like it erased the player's record.
    const legacy = readLegacyHazariStore();
    if (Object.keys(legacy).length > 0) {
      const migrated: StatsStore = { HAZARI: legacy };
      localStorage.setItem(STATS_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return {};
  } catch {
    return {};
  }
}

function writeStore(store: StatsStore): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(store));
  } catch {
    /* ignore storage failures (private browsing etc.) */
  }
}

/** Records a completed local-player result for one game on this device. */
export function recordGameResult(gameId: GameId, playerName: string, won: boolean, finalScore: number): void {
  const store = readStore();
  const gameStore = store[gameId] ?? {};
  const existing = gameStore[playerName] ?? emptyStats();
  gameStore[playerName] = {
    gamesPlayed: existing.gamesPlayed + 1,
    gamesWon: existing.gamesWon + (won ? 1 : 0),
    totalPoints: existing.totalPoints + finalScore,
    lastPlayedAt: Date.now(),
  };
  store[gameId] = gameStore;
  writeStore(store);
}

/** All names recorded for one game on this device, newest first. */
export function getAllStats(gameId: GameId): { name: string; stats: PlayerStats }[] {
  const gameStore = readStore()[gameId] ?? {};
  return Object.entries(gameStore)
    .map(([name, stats]) => ({ name, stats }))
    .sort((a, b) => b.stats.lastPlayedAt - a.stats.lastPlayedAt);
}

export function getStatsFor(gameId: GameId, playerName: string): PlayerStats | null {
  return readStore()[gameId]?.[playerName] ?? null;
}
