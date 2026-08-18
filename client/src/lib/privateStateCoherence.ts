import type {
  PokerPrivateStatePayload,
  PokerPublicStatePayload,
  TeenPattiPrivateStatePayload,
  TeenPattiPublicStatePayload,
} from '../game/types';

/**
 * Socket.IO preserves event order on one connection, but React can paint
 * between the public and private packets in a two-packet authoritative update.
 * Never let cards or legal actions from one Teen Patti snapshot be rendered
 * against another snapshot's public turn/sequence.
 */
export function coherentTeenPattiPrivateState(
  publicState: TeenPattiPublicStatePayload | null,
  privateState: TeenPattiPrivateStatePayload | null,
): TeenPattiPrivateStatePayload | null {
  if (!publicState || !privateState) return null;
  return privateState.roundNumber === publicState.roundNumber
    && privateState.sequence === publicState.sequence
    ? privateState
    : null;
}

/** Same snapshot barrier for Poker hole cards and legal betting actions. */
export function coherentPokerPrivateState(
  publicState: PokerPublicStatePayload | null,
  privateState: PokerPrivateStatePayload | null,
): PokerPrivateStatePayload | null {
  if (!publicState || !privateState) return null;
  return privateState.handNumber === publicState.handNumber
    && privateState.sequence === publicState.sequence
    ? privateState
    : null;
}
