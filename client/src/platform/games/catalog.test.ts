import { describe, expect, it } from 'vitest';
import type { GameId } from '../../game/types';
import { GAME_CATALOG, catalogEntry } from './catalog';

describe('Card Room client catalog', () => {
  it('uses the shared GameId model for all four Card Room identities', () => {
    const ids: GameId[] = GAME_CATALOG.map((game) => game.id);
    expect(ids).toEqual(['HAZARI', 'KITTI', 'TEEN_PATTI', 'POKER']);
  });

  it('keeps unfinished games honestly gated while retaining their real identities', () => {
    expect(catalogEntry('HAZARI').networkPlayable).toBe(true);
    expect(catalogEntry('KITTI').networkPlayable).toBe(true);
    expect(catalogEntry('TEEN_PATTI')).toMatchObject({ networkPlayable: false, unavailableReason: 'Coming Soon' });
    expect(catalogEntry('POKER')).toMatchObject({ networkPlayable: false, unavailableReason: 'Coming Soon' });
  });
});
