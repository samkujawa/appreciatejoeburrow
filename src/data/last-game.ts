export interface LastGame {
  /** Which game, e.g. 'Week 2 at Houston'. */
  readonly label: string;
  /** Final result from the Bengals' side, e.g. 'W 20–6'. */
  readonly result: string;
  /** Game date, YYYY-MM-DD. The section hides itself a few days after (see CONFIG.lastGameDays). */
  readonly date: string;
  /**
   * IDs of clips (src/data/clips.ts) and posts (src/data/posts.ts) from this game, in the order
   * they should lead the wall. Every ID must also be in one of those lists.
   */
  readonly ids: readonly string[];
}

/**
 * Pinned to the top of the wall with a "Last game" label. The weekly clip job updates this after
 * each game; set it to null to turn the section off.
 */
export const LAST_GAME: LastGame | null = {
  label: 'Week 2 at Houston',
  result: 'W 20–6',
  date: '2026-09-20',
  ids: ['2101735938896633876', '2101752655068667986'],
};
