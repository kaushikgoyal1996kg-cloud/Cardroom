import { describe, expect, it } from 'vitest';
import { tableUtilityCapabilities } from './tableUtilityCapabilities';

describe('shared table utility capabilities', () => {
  it('routes each game only to stats with truthful semantics', () => {
    expect(tableUtilityCapabilities('HAZARI')).toMatchObject({ stats: true, statsLabel: 'Your Stats' });
    expect(tableUtilityCapabilities('KITTI')).toMatchObject({ stats: true, statsLabel: 'Your Stats' });
    expect(tableUtilityCapabilities('TEEN_PATTI')).toMatchObject({ stats: true, statsLabel: 'Table Stats' });
    expect(tableUtilityCapabilities('POKER')).toMatchObject({ stats: true, statsLabel: 'Table Stats' });
  });

  it('keeps authoritative history available for all four game families', () => {
    expect(tableUtilityCapabilities('HAZARI')).toMatchObject({ history: true, historyLabel: 'Round History' });
    expect(tableUtilityCapabilities('KITTI')).toMatchObject({ history: true, historyLabel: 'Round History' });
    expect(tableUtilityCapabilities('TEEN_PATTI')).toMatchObject({ history: true, historyLabel: 'Round History' });
    expect(tableUtilityCapabilities('POKER')).toMatchObject({ history: true, historyLabel: 'Hand History' });
  });
});
