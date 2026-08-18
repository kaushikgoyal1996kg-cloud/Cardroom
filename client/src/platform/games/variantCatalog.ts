export type VariantFamily = 'TEEN_PATTI' | 'POKER';

export interface VariantCard {
  id: string;
  name: string;
  shortName?: string;
  group: string;
  meta: string;
  description: string;
  /** Whether the current runtime can actually create a table for this variant. */
  runtimeReady: boolean;
  /** Optional design/rules note surfaced in the private-room setup. */
  note?: string;
}

export const TEEN_PATTI_VARIANT_CARDS: VariantCard[] = [
  { id: 'CLASSIC', name: 'Classic', group: 'Core', meta: '3 cards · normal ranking', runtimeReady: true, description: 'Blind, seen and pack using the Card Room house rules. Sideshow becomes optional when 3+ active players are all seen; Mutual Show may be proposed with any 2+ active players and resolves only on unanimous consent.' },
  { id: 'MUFLIS', name: 'Muflis / Lowball', group: 'Core', meta: '3 cards · reverse ranking', runtimeReady: true, description: 'The weakest normal Teen Patti hand wins. 2-3-5 has no special status.' },
  { id: 'BEST_OF_FOUR', name: 'Best of Four', group: 'Core', meta: '4 cards · best 3', runtimeReady: true, description: 'Deal four cards and evaluate the strongest three-card combination automatically.' },

  { id: 'STANDARD_JOKER', name: 'Standard Joker', group: 'Jokers', meta: 'revealed rank is wild', runtimeReady: true, description: 'Reveal one undealt reference card; every card of that rank is wild.' },
  { id: 'LOWEST_CARD_JOKER', name: 'Lowest Card Joker', group: 'Jokers', meta: 'lowest rank is wild', runtimeReady: true, description: 'Each player’s lowest rank becomes wild; a lowest pair makes both cards wild.' },
  { id: 'HIGHEST_CARD_JOKER', name: 'Highest Card Joker', group: 'Jokers', meta: 'highest rank is wild', runtimeReady: true, description: 'Each player’s highest rank becomes wild; a highest pair makes both cards wild.' },
  { id: 'AK47', name: 'AK47', group: 'Jokers', meta: 'A · K · 4 · 7 are wild', runtimeReady: true, description: 'Aces, Kings, fours and sevens are wild.' },
  { id: 'PAIRS_ARE_JOKERS', name: 'Pairs Are Jokers', group: 'Jokers', meta: 'paired rank becomes wild', runtimeReady: true, description: 'If the hand contains a pair, both cards of that pair act as jokers.' },
  { id: 'K_LITTLE', name: 'K Little', group: 'Jokers', meta: 'K + Little are wild', runtimeReady: true, description: 'Kings are wild, plus each player’s lowest remaining non-K rank. A duplicated Little rank makes all cards of that rank wild.' },
  { id: 'Q_LITTLE', name: 'Q Little', group: 'Jokers', meta: 'Q + Little are wild', runtimeReady: true, description: 'Queens are wild, plus each player’s lowest remaining non-Q rank. A duplicated Little rank makes all cards of that rank wild.' },
  { id: 'J_LITTLE', name: 'J Little', group: 'Jokers', meta: 'J + Little are wild', runtimeReady: true, description: 'Jacks are wild, plus each player’s lowest remaining non-J rank. A duplicated Little rank makes all cards of that rank wild.' },
  { id: 'RANDOM_PACK_JOKER', name: 'Random-Pack Joker', group: 'Jokers', meta: 'random undealt rank is wild', runtimeReady: true, description: 'Reveal one undealt card at random; every card of that rank is wild.' },
  { id: 'REVOLVING_JOKER', name: 'Revolving Joker', group: 'Jokers', meta: 'packed hand becomes new jokers', runtimeReady: true, description: 'Three board joker references start the round. Whenever a player packs, that player’s three cards replace the board references and those three ranks become the new wild ranks.' },
  { id: 'UP_DOWN_SAME', name: 'Up · Down · Same', group: 'Jokers', meta: '3 related ranks are wild', runtimeReady: true, description: 'The reference rank, one rank above and one rank below are wild, with wraparound.' },
  { id: 'UP_DOWN', name: 'Up · Down', group: 'Jokers', meta: 'adjacent ranks are wild', runtimeReady: true, description: 'The ranks immediately above and below the reference are wild; the reference itself is not.' },
  { id: 'DOWN_ONLY', name: 'Down Only', group: 'Jokers', meta: 'rank below is wild', runtimeReady: true, description: 'Only the rank immediately below the reference is wild, with wraparound.' },
  { id: 'TWO_REFERENCE_JOKER', name: 'Two-Reference Joker', group: 'Jokers', meta: '2 references · choose at comparison', runtimeReady: true, description: 'Two references stay visible. When your hand reaches a sideshow or show/showdown comparison, choose privately between the two resulting joker sets.' },

  { id: 'DISCARD_LOW_HIGH', name: 'Discard Low + High', group: 'Five-card', meta: '5 retained · discard 1 low + 1 high', runtimeReady: true, description: 'Keep all five cards, mark one lowest and one highest as discarded, then rank only the remaining three. Equal-ranked physical choices belong to the player.' },
  { id: 'DISCARD_TWO_LOWEST', name: 'Discard Two Lowest', group: 'Five-card', meta: '5 retained · discard 2 lowest', runtimeReady: true, description: 'Keep all five cards, mark the two lowest as discarded, then rank only the remaining three. Equal-ranked boundary choices belong to the player.' },
  { id: 'DISCARD_TWO_HIGHEST', name: 'Discard Two Highest', group: 'Five-card', meta: '5 retained · discard 2 highest', runtimeReady: true, description: 'Keep all five cards, mark the two highest as discarded, then rank only the remaining three. Equal-ranked boundary choices belong to the player.' },
  { id: 'ASSUMED_THIRD', name: 'Assume the Third', group: 'House', meta: '2 real cards · imagine 1', runtimeReady: true, description: 'Deal two cards and assume a legal third rank and suit to make the best hand.' },
  { id: 'CLOSEST_TO_N', name: 'Closest to N', group: 'House', meta: 'dealer chooses 3-digit target', runtimeReady: true, description: 'Build the three-digit number closest to the dealer’s target, with optional card reordering declared first.' },
];

export const POKER_VARIANT_CARDS: VariantCard[] = [
  {
    id: 'TEXAS_HOLDEM', name: 'Texas Hold’em', shortName: 'Texas', group: 'Hold’em',
    meta: '2 hole · 5 board · No-Limit', runtimeReady: true,
    description: 'Two private cards, five community cards and four betting streets. Make the best five-card poker hand.',
    note: '2–9 seats',
  },
  {
    id: 'PLO4', name: 'Pot-Limit Omaha 4', shortName: 'PLO4', group: 'Omaha',
    meta: '4 hole · exactly 2 + 3', runtimeReady: true,
    description: 'Four private cards. At showdown use exactly two hole cards and exactly three community cards.',
    note: '2–9 seats',
  },
  {
    id: 'PLO5', name: 'Pot-Limit Omaha 5', shortName: 'PLO5', group: 'Omaha',
    meta: '5 hole · exactly 2 + 3', runtimeReady: true,
    description: 'Five private cards create more combinations while the Omaha exactly-two-hole-card rule stays unchanged.',
    note: '2–8 seats',
  },
  {
    id: 'PLO6', name: 'Pot-Limit Omaha 6', shortName: 'PLO6', group: 'Omaha',
    meta: '6 hole · exactly 2 + 3', runtimeReady: true,
    description: 'Six private cards and fifteen possible two-card starting combinations. Pot-limit betting throughout.',
    note: '2–7 seats',
  },
  {
    id: 'SHORT_DECK', name: '6+ Short Deck', shortName: '6+', group: 'Hold’em',
    meta: '36-card deck · ante + button blind', runtimeReady: true,
    description: 'Cards 2–5 are removed. Everyone antes, the dealer/button posts the only live blind, A-6-7-8-9 is a straight, and flush ranks above full house.',
    note: '2–6 seats',
  },
  {
    id: 'VARIANT_TABLE', name: 'Variant Poker Table', shortName: 'Mixed', group: 'Card Room',
    meta: 'Texas + Omaha + optional 6+', runtimeReady: true,
    description: 'One private room, several approved poker variants. Rotate automatically or let the dealer choose the next game between hands.',
    note: 'Seat cap follows the strictest selected variant',
  },
];

export function variantsFor(family: VariantFamily): VariantCard[] {
  return family === 'TEEN_PATTI' ? TEEN_PATTI_VARIANT_CARDS : POKER_VARIANT_CARDS;
}
