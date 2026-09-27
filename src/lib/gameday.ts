import type { Game } from '../data/schedule';

/**
 * - pregame: game day (from midnight ET) before kickoff
 * - live: kickoff until LIVE_MS after, when the game is almost certainly on
 * - after: the rest of game day, for the final score
 */
export interface GameDay {
  phase: 'pregame' | 'live' | 'after';
  game: Game;
  kickoff: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Keep the final score up at least this long after kickoff, for late games that finish after midnight. */
const AFTER_MS = 4.5 * 60 * 60 * 1000;

/** A game is "live" for this long after kickoff; NFL games run about 3 to 3.5 hours. */
export const LIVE_MS = 3.5 * 60 * 60 * 1000;

/**
 * Midnight Eastern on the game's date. Kickoffs are stored with their Eastern offset, so the
 * date and offset can be read straight from the string.
 */
function gameDayStart(kickoff: string): number {
  return Date.parse(`${kickoff.slice(0, 10)}T00:00:00${kickoff.slice(19)}`);
}

/** Which game (if any) should drive the banner right now, and where in the day we are. */
export function currentGameDay(schedule: readonly Game[], now: Date): GameDay | null {
  const t = now.getTime();
  for (const game of schedule) {
    if (!game.kickoff) continue;
    const kickoff = Date.parse(game.kickoff);
    if (Number.isNaN(kickoff)) continue;
    const start = gameDayStart(game.kickoff);
    // Late kickoffs can run past midnight, so game day ends at midnight or AFTER_MS past kickoff.
    const end = Math.max(start + DAY_MS, kickoff + AFTER_MS);
    if (t < start || t >= end) continue;
    const phase = t < kickoff ? 'pregame' : t < kickoff + LIVE_MS ? 'live' : 'after';
    return { phase, game, kickoff: new Date(kickoff) };
  }
  return null;
}

/** "Bengals at Steelers", "Bengals vs. Jaguars", "Bengals vs. Falcons in Madrid". */
export function matchup(game: Game): string {
  const base = `Bengals ${game.home ? 'vs.' : 'at'} ${game.opponent}`;
  return game.site ? `${base} in ${game.site}` : base;
}

/** "2h 14m", "14m", "under a minute". */
export function formatCountdown(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
