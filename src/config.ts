export const CONFIG = {
  /**
   * Optional headshot shown above the title. Put the file in /public and set the path,
   * e.g. '/joe-photo.jpg'. Leave null to hide it.
   */
  photoSrc: null as string | null,

  /** Players are created when a tile gets this close to the viewport. */
  preloadMargin: '150px 0px',

  /** How long to wait for YouTube's player script before showing link-only tiles. */
  apiTimeoutMs: 15_000,

  /** An embed loads only after staying on screen this long, so fast scrolling skips it. */
  mountDelayMs: 350,

  /** An embed off screen this long is torn down (videos go back to their thumbnail). */
  unmountAfterMs: 4_000,

  /**
   * Most YouTube players plus X posts alive at once, per column (so 6 on a phone). iOS Safari
   * kills the tab when too many embedded pages pile up.
   */
  maxEmbedsPerColumn: 6,

  /** Tiles added per batch as the visitor scrolls. Keeps a long clip list light on first load. */
  batchSize: 24,

  /** How many recently seen tiles to remember and push down the wall on the next visit. */
  seenMemory: 60,

  /** Random start points stay at least this many seconds before the end of a video. */
  endBufferSeconds: 20,
} as const;
