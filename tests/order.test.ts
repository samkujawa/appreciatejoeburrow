import { describe, expect, it } from 'vitest';
import type { Clip } from '../src/data/clips';
import type { Post } from '../src/data/posts';
import { orderWall } from '../src/lib/order';
import { seededRng } from '../src/lib/random';

const clips: Clip[] = Array.from({ length: 10 }, (_, i) => ({
  id: `clip${i}`,
  title: `Clip ${i}`,
}));
const posts: Post[] = Array.from({ length: 6 }, (_, i) => ({ id: `post${i}`, title: `Post ${i}` }));

function ids(seen: string[] = [], leadClips = 4, seed = 1): string[] {
  return orderWall(clips, posts, { seen: new Set(seen), leadClips, rng: seededRng(seed) }).map(
    (item) => (item.kind === 'clip' ? item.clip.id : item.post.id),
  );
}

describe('orderWall', () => {
  it('includes every clip and post exactly once', () => {
    const out = ids();
    expect(out).toHaveLength(16);
    expect(new Set(out).size).toBe(16);
  });

  it('leads with a full row of videos', () => {
    expect(
      ids([], 4)
        .slice(0, 4)
        .every((id) => id.startsWith('clip')),
    ).toBe(true);
    expect(
      ids([], 3)
        .slice(0, 3)
        .every((id) => id.startsWith('clip')),
    ).toBe(true);
  });

  it('pushes recently seen items behind unseen ones', () => {
    const seen = ['clip0', 'clip1', 'post0'];
    const out = ids(seen);
    const lastUnseenClip = Math.max(
      ...out.flatMap((id, i) => (id.startsWith('clip') && !seen.includes(id) ? [i] : [])),
    );
    expect(out.indexOf('clip0')).toBeGreaterThan(lastUnseenClip);
    expect(out.indexOf('clip1')).toBeGreaterThan(lastUnseenClip);
    const lastUnseenPost = Math.max(
      ...out.flatMap((id, i) => (id.startsWith('post') && !seen.includes(id) ? [i] : [])),
    );
    expect(out.indexOf('post0')).toBeGreaterThan(lastUnseenPost);
  });

  it('still shuffles when everything has been seen', () => {
    const everything = [...clips, ...posts].map((x) => x.id);
    expect(ids(everything, 4, 1)).not.toEqual(ids(everything, 4, 2));
  });
});
