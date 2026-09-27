import type { Clip } from '../data/clips';
import type { Post } from '../data/posts';
import { interleave } from './mix';
import { shuffle, type Rng } from './random';

export type WallItem = { kind: 'clip'; clip: Clip } | { kind: 'post'; post: Post };

export interface OrderOptions {
  /** IDs this visitor has already seen recently; they're pushed behind everything unseen. */
  seen: ReadonlySet<string>;
  /** How many videos lead the wall before any X post appears (usually one full row). */
  leadClips: number;
  rng?: Rng;
}

/** Shuffles unseen items to the front and recently seen ones to the back. */
function freshFirst<T extends { id: string }>(
  items: readonly T[],
  seen: ReadonlySet<string>,
  rng: Rng,
): T[] {
  const fresh = items.filter((item) => !seen.has(item.id));
  const stale = items.filter((item) => seen.has(item.id));
  return [...shuffle(fresh, rng), ...shuffle(stale, rng)];
}

/**
 * Builds the wall's reading order: a row of autoplaying videos first, then the remaining
 * videos with X posts spread evenly between them. Unseen items come before seen ones.
 */
export function orderWall(
  clips: readonly Clip[],
  posts: readonly Post[],
  { seen, leadClips, rng = Math.random }: OrderOptions,
): WallItem[] {
  const clipItems = freshFirst(clips, seen, rng).map((clip): WallItem => ({ kind: 'clip', clip }));
  const postItems = freshFirst(posts, seen, rng).map((post): WallItem => ({ kind: 'post', post }));
  const lead = clipItems.slice(0, leadClips);
  return [...lead, ...interleave(clipItems.slice(leadClips), postItems)];
}
