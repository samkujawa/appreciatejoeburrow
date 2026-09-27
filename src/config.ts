export const CONFIG = {
  /**
   * Optional headshot shown above the title. Put the file in /public and set the path,
   * e.g. '/joe-photo.jpg'. Leave null to hide it.
   */
  photoSrc: null as string | null,

  /** Players are created when a tile gets this close to the viewport. */
  preloadMargin: '300px 0px',

  /** How long to wait for YouTube's player script before showing link-only tiles. */
  apiTimeoutMs: 15_000,

  /** A video off screen this long goes back to its thumbnail, so long walls stay light. */
  unmountAfterMs: 20_000,

  /** Tiles added per batch as the visitor scrolls. Keeps a long clip list light on first load. */
  batchSize: 24,

  /** How many recently seen tiles to remember and push down the wall on the next visit. */
  seenMemory: 60,

  /** Random start points stay at least this many seconds before the end of a video. */
  endBufferSeconds: 20,
} as const;
