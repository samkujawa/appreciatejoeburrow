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

  /** Random start points stay at least this many seconds before the end of a video. */
  endBufferSeconds: 20,
} as const;
