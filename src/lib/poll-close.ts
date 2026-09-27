import type { Poll } from '../data/play-of-the-week';
import type { Game } from '../data/schedule';
import { estimatedKickoff } from './projection';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * When Play of the Week voting closes: kickoff of the Bengals' next game after the poll's game.
 * Bye weeks just mean the next game is later; TBD games use their estimated date; after the last
 * game of the season it closes a week after that game. If the poll's game isn't on the schedule
 * at all, voting is treated as closed (returns 0) rather than open forever.
 */
export function pollClosesAt(poll: Poll, schedule: readonly Game[]): number {
  const game = schedule.find((g) => g.week === poll.week);
  if (!game) return 0;
  const next = schedule.filter((g) => g.week > poll.week).sort((a, b) => a.week - b.week)[0];
  if (next) return estimatedKickoff(next, schedule);
  const played = estimatedKickoff(game, schedule);
  return Number.isFinite(played) ? played + WEEK_MS : 0;
}

/** The next game, for "closes at kickoff vs. Jaguars" copy; null after the last game. */
export function nextGameAfter(poll: Poll, schedule: readonly Game[]): Game | null {
  return schedule.filter((g) => g.week > poll.week).sort((a, b) => a.week - b.week)[0] ?? null;
}
