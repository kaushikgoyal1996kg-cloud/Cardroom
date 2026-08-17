import { describe, expect, it } from 'vitest';
import { canUseKittiArrangementAssist, type KittiSeatOccupant } from './arrangementAssist';

const human = (playerId: string): KittiSeatOccupant => ({ playerId, isBot: false });
const bot = (playerId: string): KittiSeatOccupant => ({ playerId, isBot: true });

describe('Kitti arrangement assistance visibility', () => {
  it('allows suggestion when every opponent is a bot', () => {
    expect(canUseKittiArrangementAssist([human('me'), bot('b1'), bot('b2'), bot('b3')], 'me')).toBe(true);
  });

  it('blocks suggestion when even one real human opponent is present', () => {
    expect(canUseKittiArrangementAssist([human('me'), human('friend'), bot('b1')], 'me')).toBe(false);
  });

  it('blocks while local seat identity is unresolved', () => {
    expect(canUseKittiArrangementAssist([human('friend'), bot('b1')], null)).toBe(false);
  });

  it('is based on opponents, not total table size', () => {
    expect(canUseKittiArrangementAssist([human('me'), bot('b1')], 'me')).toBe(true);
    expect(canUseKittiArrangementAssist([human('me'), human('friend')], 'me')).toBe(false);
  });
});
