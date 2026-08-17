// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllStats, getStatsFor, recordGameResult } from './stats';

const V2_KEY = 'cardroom_stats_v2';
const LEGACY_KEY = 'haazari_stats_v1';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('multi-game local stats', () => {
  it('keeps Hazari and Kitti records in separate game buckets', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(200);

    recordGameResult('HAZARI', 'Kaushik', true, 1035);
    recordGameResult('KITTI', 'Kaushik', false, 4);

    expect(getStatsFor('HAZARI', 'Kaushik')).toMatchObject({
      gamesPlayed: 1,
      gamesWon: 1,
      totalPoints: 1035,
      lastPlayedAt: 100,
    });
    expect(getStatsFor('KITTI', 'Kaushik')).toMatchObject({
      gamesPlayed: 1,
      gamesWon: 0,
      totalPoints: 4,
      lastPlayedAt: 200,
    });
  });

  it('accumulates repeat results only inside the selected game', () => {
    recordGameResult('KITTI', 'Kaushik', true, 6);
    recordGameResult('KITTI', 'Kaushik', true, 7);

    expect(getStatsFor('KITTI', 'Kaushik')).toMatchObject({
      gamesPlayed: 2,
      gamesWon: 2,
      totalPoints: 13,
    });
    expect(getAllStats('HAZARI')).toEqual([]);
  });

  it('migrates the old Hazari-only history without leaking it into Kitti', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({
      Kaushik: { gamesPlayed: 3, gamesWon: 2, totalPoints: 2875, lastPlayedAt: 77 },
    }));

    expect(getStatsFor('HAZARI', 'Kaushik')).toEqual({
      gamesPlayed: 3,
      gamesWon: 2,
      totalPoints: 2875,
      lastPlayedAt: 77,
    });
    expect(getStatsFor('KITTI', 'Kaushik')).toBeNull();
    expect(localStorage.getItem(V2_KEY)).toContain('HAZARI');
  });
});
