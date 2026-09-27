export interface Poll {
  /** Stable id for this week's vote, e.g. '2026-week-3'. Votes are stored under it. */
  readonly id: string;
  /** Which game the plays are from, e.g. 'Week 3 at Pittsburgh'. */
  readonly label: string;
  /** When voting closes (ISO time). After this the section shows final results. */
  readonly closes: string;
  /** 2–4 clip/post IDs (from src/data/clips.ts or posts.ts) to vote between. */
  readonly candidates: readonly string[];
}

/**
 * Play of the Week, shown near the top of the home page. The weekly clip job replaces it every
 * Tuesday with the best plays from the latest game; set it to null to hide the section.
 */
export const PLAY_OF_THE_WEEK: Poll | null = {
  id: '2026-week-2',
  label: 'Week 2 at Houston',
  closes: '2026-09-29T14:00:00Z',
  candidates: ['2101735938896633876', '2101752655068667986'],
};
