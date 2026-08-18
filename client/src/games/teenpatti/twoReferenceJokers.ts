import type { Rank } from '../../game/types';

const TEEN_PATTI_RANK_CYCLE: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function adjacentRank(rank: Rank, direction: -1 | 1): Rank {
  const index = TEEN_PATTI_RANK_CYCLE.indexOf(rank);
  return TEEN_PATTI_RANK_CYCLE[(index + direction + TEEN_PATTI_RANK_CYCLE.length) % TEEN_PATTI_RANK_CYCLE.length];
}

/** Resulting wild ranks when `upDownRank` supplies Up+Down and `sameRank`
 * supplies Same. Duplicate ranks collapse because a rank is either wild or not. */
export function twoReferenceJokerSet(upDownRank: Rank, sameRank: Rank): Rank[] {
  return [...new Set<Rank>([adjacentRank(upDownRank, -1), adjacentRank(upDownRank, 1), sameRank])];
}
