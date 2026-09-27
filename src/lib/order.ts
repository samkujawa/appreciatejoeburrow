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
  /** IDs pinned to the very top in this order (the last game), ahead of everything else. */
  pinned?: readonly string[];
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
 * Builds the wall's reading order: any pinned last-game items, then a row of autoplaying videos,
 * then the remaining videos with X posts spread evenly between them. Unseen items come before
 * seen ones.
 */
export function orderWall(
  clips: readonly Clip[],
  posts: readonly Post[],
  { seen, leadClips, pinned = [], rng = Math.random }: OrderOptions,
): WallItem[] {
  const pinnedSet = new Set(pinned);
  const byId = new Map<string, WallItem>([
    ...clips.map((clip): [string, WallItem] => [clip.id, { kind: 'clip', clip }]),
    ...posts.map((post): [string, WallItem] => [post.id, { kind: 'post', post }]),
  ]);
  const top = pinned.flatMap((id) => byId.get(id) ?? []);

  const clipItems = freshFirst(
    clips.filter((c) => !pinnedSet.has(c.id)),
    seen,
    rng,
  ).map((clip): WallItem => ({ kind: 'clip', clip }));
  const postItems = freshFirst(
    posts.filter((p) => !pinnedSet.has(p.id)),
    seen,
    rng,
  ).map((post): WallItem => ({ kind: 'post', post }));
  const lead = clipItems.slice(0, leadClips);
  return [...top, ...lead, ...interleave(clipItems.slice(leadClips), postItems)];
}
