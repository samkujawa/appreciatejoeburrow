import { describe, expect, it } from 'vitest';
import { CLIPS } from '../src/data/clips';
import { PLAY_OF_THE_WEEK, type Poll } from '../src/data/play-of-the-week';
import { POSTS } from '../src/data/posts';
import { checkVote, fullTally, VoteLimiter } from '../worker/polls';

const poll: Poll = {
  id: '2026-week-3',
  label: 'Week 3 at Pittsburgh',
  closes: '2026-10-06T14:00:00Z',
  candidates: ['a', 'b', 'c'],
};
const before = Date.parse('2026-10-01T00:00:00Z');

describe('PLAY_OF_THE_WEEK data', () => {
  it('has 2–4 distinct candidates that are all on the wall', () => {
    if (!PLAY_OF_THE_WEEK) return;
    const known = new Set([...CLIPS, ...POSTS].map((x) => x.id));
    const { candidates } = PLAY_OF_THE_WEEK;
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates.length).toBeLessThanOrEqual(4);
    expect(new Set(candidates).size).toBe(candidates.length);
    for (const id of candidates) expect(known.has(id), id).toBe(true);
  });

  it('has a valid id, label and closing time', () => {
    if (!PLAY_OF_THE_WEEK) return;
    expect(PLAY_OF_THE_WEEK.id).toMatch(/^\d{4}-[a-z0-9-]+$/);
    expect(PLAY_OF_THE_WEEK.label.trim()).not.toBe('');
    expect(Number.isNaN(Date.parse(PLAY_OF_THE_WEEK.closes))).toBe(false);
  });
});

describe('checkVote', () => {
  it('accepts a candidate in the current, open poll', () => {
    expect(checkVote({ poll: '2026-week-3', choice: 'b' }, poll, before)).toEqual({
      ok: true,
      choice: 'b',
    });
  });

  it('rejects other polls, closed polls and non-candidates', () => {
    expect(checkVote({ poll: 'old', choice: 'a' }, poll, before)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(
      checkVote({ poll: '2026-week-3', choice: 'a' }, poll, Date.parse(poll.closes)),
    ).toMatchObject({
      ok: false,
      error: 'voting is closed',
    });
    expect(checkVote({ poll: '2026-week-3', choice: 'z' }, poll, before)).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(checkVote(null, poll, before)).toMatchObject({ ok: false });
    expect(checkVote({ poll: '2026-week-3', choice: 'a' }, null, before)).toMatchObject({
      ok: false,
    });
  });
});

describe('fullTally', () => {
  it('lists every candidate in order, with zeros', () => {
    expect(fullTally(poll, { c: 4, a: 1, stale: 9 })).toEqual({ a: 1, b: 0, c: 4 });
  });
});

describe('VoteLimiter', () => {
  it('allows a few votes per visitor per poll', () => {
    const limiter = new VoteLimiter(3);
    expect([1, 2, 3, 4].map(() => limiter.take('p', 'ip'))).toEqual([true, true, true, false]);
    expect(limiter.take('p', 'other')).toBe(true);
    expect(limiter.take('next-week', 'ip')).toBe(true);
  });
});
