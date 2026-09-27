import type { Rng } from './random';

/**
 * IFrame API error codes that mean this video will never play here:
 * 2 invalid ID, 5 HTML5 player error, 100 removed/private, 101 and 150 embedding disabled.
 * https://developers.google.com/youtube/iframe_api_reference#onError
 */
const FATAL_ERROR_CODES: ReadonlySet<number> = new Set([2, 5, 100, 101, 150]);

export function isFatalPlayerError(code: number): boolean {
  return FATAL_ERROR_CODES.has(code);
}

/**
 * Picks a random start second so each tile opens mid-highlight.
 * Returns 0 when the duration is unknown or too short to leave a buffer before the end.
 */
export function pickStartSeconds(
  duration: number,
  endBuffer: number,
  rng: Rng = Math.random,
): number {
  if (!Number.isFinite(duration) || duration <= endBuffer * 2) return 0;
  return Math.floor(rng() * (duration - endBuffer));
}

export function watchUrl(videoId: string, startSeconds = 0): string {
  const url = new URL('https://www.youtube.com/watch');
  url.searchParams.set('v', videoId);
  if (startSeconds > 0) url.searchParams.set('t', `${startSeconds}s`);
  return url.toString();
}

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}
