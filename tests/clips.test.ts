import { describe, expect, it } from 'vitest';
import { CLIPS } from '../src/data/clips';
import { POSTS } from '../src/data/posts';

describe('CLIPS', () => {
  it('has enough clips to fill a wall', () => {
    expect(CLIPS.length).toBeGreaterThanOrEqual(6);
  });

  it('uses well-formed YouTube IDs', () => {
    for (const clip of CLIPS) expect(clip.id).toMatch(/^[\w-]{11}$/);
  });

  it('has no duplicate videos', () => {
    const ids = CLIPS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every clip a title', () => {
    for (const clip of CLIPS) expect(clip.title.trim()).not.toBe('');
  });
});

describe('POSTS', () => {
  it('uses numeric X post IDs', () => {
    for (const post of POSTS) expect(post.id).toMatch(/^\d{15,20}$/);
  });

  it('has no duplicate posts', () => {
    const ids = POSTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every post a title', () => {
    for (const post of POSTS) expect(post.title.trim()).not.toBe('');
  });
});
