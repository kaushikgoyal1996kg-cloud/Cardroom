// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoundHistoryModal } from './RoundHistoryModal';

const useGameMock = vi.fn();
vi.mock('../lib/GameStore', () => ({ useGame: () => useGameMock() }));

afterEach(() => {
  cleanup();
  useGameMock.mockReset();
});

describe('RoundHistoryModal historical player identity', () => {
  it('uses the room-lifetime player directory after a Teen Patti player has settled and left', () => {
    useGameMock.mockReturnValue({
      room: {
        gameId: 'TEEN_PATTI',
        roomCode: 'TP482',
        players: [],
        playerDirectory: {
          departed: { name: 'Asha', avatar: 'owl' },
        },
      },
      roundHistory: [],
      kittiRoundHistory: [],
      teenPattiRoundHistory: [{
        roundNumber: 3,
        dealerId: 'departed',
        variantName: 'Classic',
        winnerIds: ['departed'],
        potAwarded: 60,
        reason: 'LAST_STANDING',
        split: false,
      }],
      pokerHandHistory: [],
    });

    render(<RoundHistoryModal onClose={() => undefined} />);

    expect(screen.getByText('Dealer: Asha')).toBeTruthy();
    expect(screen.getByText('Asha')).toBeTruthy();
    expect(screen.queryByText('Former player')).toBeNull();
  });
});
