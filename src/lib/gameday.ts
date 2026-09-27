import type { Game } from '../data/schedule';

export type GameDay =
  { phase: 'pregame'; game: Game; kickoff: Date } | { phase: 'live'; game: Game; kickoff: Date };

/** A game is "live" for this long after kickoff; NFL games run about 3 to 3.5 hours. */
export const LIVE_MS = 3.5 * 60 * 60 * 1000;

/**
 * Midnight Eastern on the game's date. Kickoffs are stored with their Eastern offset, so the
 * date and offset can be read straight from the string.
 */
function gameDayStart(kickoff: string): number {
  return Date.parse(`${kickoff.slice(0, 10)}T00:00:00${kickoff.slice(19)}`);
}

/** Which game (if any) should drive the banner right now: game day before kickoff, or live. */
export function currentGameDay(schedule: readonly Game[], now: Date): GameDay | null {
  const t = now.getTime();
  for (const game of schedule) {
    if (!game.kickoff) continue;
    const kickoff = Date.parse(game.kickoff);
    if (Number.isNaN(kickoff)) continue;
    if (t >= kickoff && t < kickoff + LIVE_MS) {
      return { phase: 'live', game, kickoff: new Date(kickoff) };
    }
    if (t >= gameDayStart(game.kickoff) && t < kickoff) {
      return { phase: 'pregame', game, kickoff: new Date(kickoff) };
    }
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
