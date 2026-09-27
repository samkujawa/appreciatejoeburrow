export interface Post {
  /** Numeric X (Twitter) post ID: the number after /status/ in the URL. */
  readonly id: string;
  /** Short label shown before the embed loads and used as the tile's accessible name. */
  readonly title: string;
}

/**
 * X posts mixed into the wall between the YouTube tiles. NFL game footage mostly can't be
 * embedded from YouTube, but the NFL's own X clips can, so this is where single plays live.
 * Run `npm run check:clips` after editing to confirm each post still exists and has video.
 */
export const POSTS: readonly Post[] = [
  { id: '2101735938896633876', title: 'Launches it to Chase · 2026' },
  { id: '2101752655068667986', title: 'Chase again, two TDs · 2026' },
  { id: '1873172510394728764', title: 'To Tee Higgins for the win' },
  { id: '1843013286998245876', title: 'Five TD passes vs. Baltimore' },
  { id: '1854722076390633921', title: 'Chase 67-yard TD at Baltimore' },
  { id: '1931441029443662289', title: 'Burrow vs. Lamar, 2024' },
  { id: '1845659986690748467', title: 'Clutch on 3rd and 12' },
  { id: '1477717448665145344', title: 'To Chase again vs. KC · 2021' },
  { id: '1870911219642622317', title: 'Playing a different game' },
  { id: '1850592879632322901', title: 'The 34.9-yard scramble' },
  { id: '2082828564177850691', title: 'NFL Top 100 · 2026' },
  { id: '1930002280855810150', title: 'Burrow to Chase is back' },
];
