// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { consumeReturnToCardRoom, requestReturnToCardRoom } from './navigation';

beforeEach(() => {
  sessionStorage.clear();
});

describe('deliberate return to the Card Room', () => {
  it('is false on a normal cold launch', () => {
    expect(consumeReturnToCardRoom()).toBe(false);
  });

  it('survives a remount but is consumed exactly once', () => {
    requestReturnToCardRoom();

    expect(consumeReturnToCardRoom()).toBe(true);
    expect(consumeReturnToCardRoom()).toBe(false);
  });
});
