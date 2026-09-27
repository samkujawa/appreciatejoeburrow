export interface Game {
  week: number;
  /** Opponent's team name, e.g. 'Steelers'. */
  opponent: string;
  /** Bengals are the home team (or the designated home team at a neutral site). */
  home: boolean;
  /** Kickoff as an ISO time with its Eastern offset (EDT -04:00, EST -05:00); null while TBD. */
  kickoff: string | null;
  /** TV/stream network; null while TBD. */
  network: string | null;
  /** Neutral-site city, e.g. 'Madrid'. */
  site?: string;
}

/**
 * 2026 regular season (bye in Week 6). Drives the game-day banner. Times are Eastern; flexed or
 * newly announced games get updated by the weekly clip job.
 */
export const SCHEDULE: readonly Game[] = [
  {
    week: 1,
    opponent: 'Buccaneers',
    home: true,
    kickoff: '2026-09-13T13:00:00-04:00',
    network: 'FOX',
  },
  {
    week: 2,
    opponent: 'Texans',
    home: false,
    kickoff: '2026-09-20T13:00:00-04:00',
    network: 'CBS',
  },
  {
    week: 3,
    opponent: 'Steelers',
    home: false,
    kickoff: '2026-09-27T13:00:00-04:00',
    network: 'CBS',
  },
  {
    week: 4,
    opponent: 'Jaguars',
    home: true,
    kickoff: '2026-10-04T13:00:00-04:00',
    network: 'CBS',
  },
  {
    week: 5,
    opponent: 'Dolphins',
    home: false,
    kickoff: '2026-10-11T13:00:00-04:00',
    network: 'FOX',
  },
  {
    week: 7,
    opponent: 'Ravens',
    home: false,
    kickoff: '2026-10-25T13:00:00-04:00',
    network: 'CBS',
  },
  { week: 8, opponent: 'Titans', home: true, kickoff: '2026-11-01T13:00:00-05:00', network: 'CBS' },
  {
    week: 9,
    opponent: 'Falcons',
    home: true,
    kickoff: '2026-11-08T09:30:00-05:00',
    network: 'NFL Network',
    site: 'Madrid',
  },
  {
    week: 10,
    opponent: 'Steelers',
    home: true,
    kickoff: '2026-11-15T20:20:00-05:00',
    network: 'NBC',
  },
  {
    week: 11,
    opponent: 'Commanders',
    home: false,
    kickoff: '2026-11-23T20:15:00-05:00',
    network: 'ESPN',
  },
  {
    week: 12,
    opponent: 'Saints',
    home: true,
    kickoff: '2026-11-29T13:00:00-05:00',
    network: 'CBS',
  },
  {
    week: 13,
    opponent: 'Browns',
    home: false,
    kickoff: '2026-12-06T13:00:00-05:00',
    network: 'CBS',
  },
  {
    week: 14,
    opponent: 'Chiefs',
    home: true,
    kickoff: '2026-12-13T16:25:00-05:00',
    network: 'FOX',
  },
  {
    week: 15,
    opponent: 'Panthers',
    home: false,
    kickoff: '2026-12-20T13:00:00-05:00',
    network: 'FOX',
  },
  { week: 16, opponent: 'Colts', home: false, kickoff: null, network: null },
  {
    week: 17,
    opponent: 'Ravens',
    home: true,
    kickoff: '2026-12-31T20:15:00-05:00',
    network: 'Prime Video',
  },
  { week: 18, opponent: 'Browns', home: true, kickoff: null, network: null },
];
