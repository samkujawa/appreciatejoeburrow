import type { Game } from '../data/schedule';
import type { Career } from '../../worker/espn';
import type { StatKey } from '../../worker/records';

/**
 * Below this many games, a season average swings too much on one hot or cold game (and at the
 * start of a new season there's no average at all), so projections use his career average
 * instead, and say so.
 */
export const MIN_SEASON_GAMES = 4;

export interface Pace {
  perGame: number;
  basis: 'season' | 'career';
  total: number;
  games: number;
  /** The season, when basis is 'season'. */
  year?: number;
}

export function choosePace(career: Career, stat: StatKey): Pace | null {
  const current = career.seasons[career.seasons.length - 1];
  if (current && current.games >= MIN_SEASON_GAMES) {
    return {
      perGame: current[stat] / current.games,
      basis: 'season',
      total: current[stat],
      games: current.games,
      year: current.year,
    };
  }
  const { games } = career.totals;
  if (games <= 0) return null;
  return {
    perGame: career.totals[stat] / games,
    basis: 'career',
    total: career.totals[stat],
    games,
  };
}

export interface Arrival {
  games: number;
  /** The scheduled game he'd reach it in; null when that's past the known schedule. */
  game: Game | null;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Kickoff time, or for a TBD game an estimate: a week per week after the closest earlier game
 * with a known kickoff. Keeps TBD games from counting as "upcoming" after they've been played.
 */
export function estimatedKickoff(game: Game, schedule: readonly Game[]): number {
  if (game.kickoff) return Date.parse(game.kickoff);
  const before = schedule
    .filter((g) => g.kickoff !== null && g.week < game.week)
    .sort((a, b) => b.week - a.week)[0];
  if (!before?.kickoff) return Number.POSITIVE_INFINITY;
  return Date.parse(before.kickoff) + (game.week - before.week) * WEEK_MS;
}

/**
 * How many games until `remaining` more at this pace, and which upcoming game that would be.
 * Counts games, not weeks, over the games that haven't kicked off yet, so bye weeks (not in the
 * schedule) are skipped naturally, and in the offseason there's nothing left: "next season".
 */
export function projectArrival(
  remaining: number,
  pace: Pace | null,
  schedule: readonly Game[],
  now: Date,
): Arrival | null {
  if (!pace || pace.perGame <= 0 || remaining <= 0) return null;
  const games = Math.ceil(remaining / pace.perGame);
  const upcoming = schedule
    .filter((g) => estimatedKickoff(g, schedule) > now.getTime())
    .sort((a, b) => a.week - b.week);
  return { games, game: upcoming[games - 1] ?? null };
}

const one = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en-US');
const day = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'America/New_York',
});

function plural(n: number, word: string): string {
  return `${whole.format(n)} ${n === 1 ? word : `${word}s`}`;
}

/** "He's averaging 230.5 yards a game this season (461 in 2 games)." */
export function describePace(pace: Pace, unit: string): string {
  const sample = `(${whole.format(pace.total)} in ${plural(pace.games, 'game')})`;
  return pace.basis === 'season'
    ? `He's averaging ${one.format(pace.perGame)} ${unit} a game this season ${sample}.`
    : `He's averaged ${one.format(pace.perGame)} ${unit} a game over his career ${sample}.`;
}

/** "At that rate he'd get there in about 2 games: around Week 5 at Dolphins (Oct 11)." */
export function describeArrival(arrival: Arrival): string {
  const lead = `At that rate he'd get there in about ${plural(arrival.games, 'game')}`;
  const g = arrival.game;
  if (!g) return `${lead}: next season.`;
  const when = g.kickoff ? ` (${day.format(new Date(g.kickoff))})` : '';
  return `${lead}: around Week ${String(g.week)} ${g.home ? 'vs.' : 'at'} ${g.opponent}${when}.`;
}
