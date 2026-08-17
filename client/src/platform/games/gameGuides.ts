import type { GameId } from '../../game/types';

export type GuideGameId = 'HAZARI' | 'KITTI';

export interface GameGuideSlide {
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
}

export interface GameGuide {
  gameId: GuideGameId;
  gameName: string;
  subtitle: string;
  slides: GameGuideSlide[];
}

const HAZARI_GUIDE: GameGuide = {
  gameId: 'HAZARI',
  gameName: 'Hazari',
  subtitle: '13 cards · four sets · race to 1,000',
  slides: [
    {
      eyebrow: 'The table',
      title: 'Four players. Thirteen cards each.',
      body: 'Hazari uses one full 52-card deck. Every player receives 13 cards and arranges them into four sets before play begins.',
      points: [
        'Set sizes are 3 · 3 · 3 · 4.',
        'The full deck is worth 360 points in every completed round.',
        'The match is won on cumulative points, not on the number of sets won.',
      ],
    },
    {
      eyebrow: 'Dealer & deal',
      title: 'The first dealer is drawn in front of the table.',
      body: 'At the start of the match, each player draws one card. Highest card deals; Ace is high. Tied highest players redraw until one dealer remains.',
      points: [
        'After that, the dealer rotates clockwise every round.',
        'Cards are dealt one at a time clockwise, starting with the dealer.',
        'A dismissed round still passes the deal to the next dealer.',
      ],
    },
    {
      eyebrow: 'Arrange your hand',
      title: 'Strongest set first. Weakest set last.',
      body: 'Your four sets must be ordered from strongest to weakest: Set 1 ≥ Set 2 ≥ Set 3 ≥ Set 4. The server checks the arrangement before accepting it.',
      points: [
        'Sets 1–3 contain three cards each.',
        'Set 4 contains four cards and uses Hazari’s dedicated four-card ranking.',
        'Rank / Suit / Dealt sorting only reorders your loose cards; it never chooses your sets.',
      ],
    },
    {
      eyebrow: 'Three-card ranking',
      title: 'Know what beats what.',
      body: 'For Sets 1–3, the order from strongest to weakest is Trail, Pure Sequence, Sequence, Colour, Pair, High Card.',
      points: [
        'Sequence order starts A-K-Q, then A-2-3, then K-Q-J, Q-J-10 and downward.',
        'Pairs compare the pair first, then the kicker.',
        'Suit never breaks an exact tie.',
      ],
    },
    {
      eyebrow: 'The four-card set',
      title: 'Set 4 has its own ranking.',
      body: 'The four-card set is compared as a four-card hand rather than by simply choosing three of its cards.',
      points: [
        'Four of a Kind > Straight Flush > Flush > Straight.',
        'Then Three of a Kind + kicker > Two Pair > One Pair > High Card.',
        'Rank-based tiebreaks decide strength within the same category.',
      ],
    },
    {
      eyebrow: 'Playing the four sets',
      title: 'Set 1 first, then follow the winner.',
      body: 'Each round contains four sub-rounds. Set 1 is played first, then Set 2, Set 3 and Set 4.',
      points: [
        'For Set 1, the player immediately clockwise from the dealer leads.',
        'Play continues clockwise from the leader.',
        'Whoever wins a set leads the next set.',
      ],
    },
    {
      eyebrow: 'Points & ties',
      title: 'The winning set collects every card point played.',
      body: 'A, K, Q, J and 10 are worth 10 points each. Cards 9 through 2 are worth 5 points each.',
      points: [
        'The winner of a sub-round takes the value of all cards played in that sub-round.',
        'An exact hand tie goes to the player who threw later.',
        'Suit is never used as a tiebreaker.',
      ],
    },
    {
      eyebrow: 'Dismissal',
      title: 'A dismissible hand can void the whole round.',
      body: 'Dismissal is optional and is verified by the server. It is available for a hand with no possible Sequence / Pure Sequence / Trail, or a raw hand containing at least six pairs.',
      points: [
        'If used, the entire round is dismissed for all four players.',
        'Everybody scores 0 for that round; cumulative scores do not change.',
        'The dealer still rotates and a fresh round begins.',
      ],
    },
    {
      eyebrow: 'Winning the match',
      title: 'Race to 1,000 cumulative points.',
      body: 'Rounds continue until a completed round leaves one or more players at 1,000 points or more. The highest cumulative score wins the match.',
      points: [
        'There is no separate bonus for winning a particular number of sets.',
        'Your score carries from round to round.',
        'Play stays server-authoritative, including cards, turns, scoring and ties.',
      ],
    },
  ],
};

const KITTI_GUIDE: GameGuide = {
  gameId: 'KITTI',
  gameName: 'Kitti',
  subtitle: '9 cards · three hands · ten rounds',
  slides: [
    {
      eyebrow: 'The table',
      title: 'Two to five players. Nine cards each.',
      body: 'Every player receives nine cards and divides them into three separate 3-card hands.',
      points: [
        'Hand 1 is your strongest group.',
        'Hand 2 is your middle group.',
        'Hand 3 is your weakest group.',
      ],
    },
    {
      eyebrow: 'Dealer & deal',
      title: 'The match begins with a high-card draw.',
      body: 'Each player draws one card. Highest card deals; Ace is high. Tied highest players redraw until one dealer remains.',
      points: [
        'Dealer rotates clockwise every round.',
        'Nine cards are dealt one at a time clockwise, starting with the dealer.',
        'The player immediately clockwise from the dealer leads Hand 1.',
      ],
    },
    {
      eyebrow: 'Arrange your nine cards',
      title: 'The order must be strictly strongest → weakest.',
      body: 'Your three groups must descend in strength: Hand 1 > Hand 2 > Hand 3. An invalid ordering cannot be confirmed.',
      points: [
        'Each hand contains exactly three cards.',
        'You arrange once before the hands are played.',
        'The server validates the final arrangement.',
      ],
    },
    {
      eyebrow: 'Hand ranking',
      title: 'Trial is highest. 2-3-5 is ordinary.',
      body: 'The order from strongest to weakest is Trial, Pure Sequence, Sequence, Colour, Pair, High Card.',
      points: [
        'Trial runs AAA down to 222.',
        'Sequence order is A-K-Q, then A-2-3, then K-Q-J, Q-J-10 and downward.',
        '2-3-5 has no special status.',
      ],
    },
    {
      eyebrow: 'Playing the hands',
      title: 'Hand 1, then Hand 2, then Hand 3.',
      body: 'Everyone throws the same hand number before moving on. The winner of a hand leads the next hand.',
      points: [
        'Play follows the table order from the current leader.',
        'Pair compares pair rank first, then kicker.',
        'If two hands are exactly equal, the later thrower wins.',
      ],
    },
    {
      eyebrow: 'Winning a round',
      title: 'First to two hand wins takes the round.',
      body: 'As soon as one player wins two of the three hands, that player has won the round.',
      points: [
        'A third hand may still be revealed after the result is mathematically decided.',
        'There is no sweep bonus for winning all three hands.',
        'Standings count rounds won, not individual hands won.',
      ],
    },
    {
      eyebrow: 'Three different winners',
      title: 'One fresh-card decider settles the round.',
      body: 'If Hands 1, 2 and 3 are won by three different players, only those three hand-winners enter a deciding hand.',
      points: [
        'Each of the three receives three fresh cards.',
        'The Hand 3 winner leads the decider.',
        'Normal ranking applies; an exact tie still goes to the later thrower.',
      ],
    },
    {
      eyebrow: 'Computer practice & board',
      title: 'Bots play the same Kitti rules.',
      body: 'The host may add or remove computer seats before Start. A computer arranges and throws only its own cards and never joins the table voice call.',
      points: [
        'When every opponent is a bot, Suggest arrangement can arrange your own nine cards for you.',
        'If even one real human opponent is seated, arrangement assistance is unavailable.',
        'The optional virtual board requires every human to accept; computer seats auto-accept. It has no cash value.',
      ],
    },
    {
      eyebrow: 'The ten-round match',
      title: 'Most round wins after Round 10 wins.',
      body: 'Kitti schedules ten normal rounds. The player with the most round victories at the end is the match winner.',
      points: [
        'If the lead is tied, only the tied leaders continue.',
        'Everyone else becomes a spectator.',
        'Tied leaders play full 9-card sudden-death rounds until one winner remains.',
      ],
    },
  ],
};

const GUIDES: Record<GuideGameId, GameGuide> = {
  HAZARI: HAZARI_GUIDE,
  KITTI: KITTI_GUIDE,
};

export function hasGameGuide(gameId: GameId): gameId is GuideGameId {
  return gameId === 'HAZARI' || gameId === 'KITTI';
}

export function gameGuide(gameId: GuideGameId): GameGuide {
  return GUIDES[gameId];
}
