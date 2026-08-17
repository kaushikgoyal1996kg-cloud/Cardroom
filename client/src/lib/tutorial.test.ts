// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { hasSeenTutorial, markTutorialSeen } from './tutorial';

describe('per-game rules guide memory', () => {
  beforeEach(() => localStorage.clear());

  it('does not let seeing Hazari suppress Kitti', () => {
    expect(hasSeenTutorial('HAZARI')).toBe(false);
    expect(hasSeenTutorial('KITTI')).toBe(false);

    markTutorialSeen('HAZARI');

    expect(hasSeenTutorial('HAZARI')).toBe(true);
    expect(hasSeenTutorial('KITTI')).toBe(false);
  });

  it('remembers Kitti independently', () => {
    markTutorialSeen('KITTI');
    expect(hasSeenTutorial('KITTI')).toBe(true);
    expect(hasSeenTutorial('HAZARI')).toBe(false);
  });
});
