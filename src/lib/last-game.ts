import type { LastGame } from '../data/last-game';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the last-game section should still show: from the game date until `maxDays` after it.
 * Guards against a stale "last game" if the list isn't updated for a while.
 */
export function isLastGameCurrent(game: LastGame | null, now: Date, maxDays: number): boolean {
  if (!game || game.ids.length === 0) return false;
  const played = Date.parse(`${game.date}T00:00:00Z`);
  if (Number.isNaN(played)) return false;
  const age = now.getTime() - played;
  return age >= -DAY_MS && age <= maxDays * DAY_MS;
}
