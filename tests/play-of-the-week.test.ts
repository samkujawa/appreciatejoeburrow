import { describe, expect, it } from 'vitest';
import { CLIPS } from '../src/data/clips';
import { PLAY_OF_THE_WEEK, type Poll } from '../src/data/play-of-the-week';
import { POSTS } from '../src/data/posts';
import { SCHEDULE, type Game } from '../src/data/schedule';
import { pollClosesAt } from '../src/lib/poll-close';
import { checkVote, fullTally, VoteLimiter } from '../worker/polls';

const poll: Poll = {
  id: '2026-week-3',
  label: 'Week 3 at Pittsburgh',
  week: 3,
  candidates: ['a', 'b', 'c'],
};
const before = Date.parse('2026-10-01T00:00:00Z');
const closes = Date.parse('2026-10-04T13:00:00-04:00');

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

  it('has a valid id and label, and its week is on the schedule', () => {
    if (!PLAY_OF_THE_WEEK) return;
    const { id, label, week } = PLAY_OF_THE_WEEK;
    expect(id).toMatch(/^\d{4}-[a-z0-9-]+$/);
    expect(label.trim()).not.toBe('');
    expect(SCHEDULE.some((g) => g.week === week)).toBe(true);
  });
});

describe('checkVote', () => {
  const vote = (body: unknown, p: Poll | null = poll, now = before) =>
    checkVote(body, p, now, closes);

  it('accepts a candidate in the current, open poll', () => {
    expect(vote({ poll: '2026-week-3', choice: 'b' })).toEqual({ ok: true, choice: 'b' });
  });

  it('rejects other polls, closed polls and non-candidates', () => {
    expect(vote({ poll: 'old', choice: 'a' })).toMatchObject({ ok: false, status: 409 });
    expect(vote({ poll: '2026-week-3', choice: 'a' }, poll, closes)).toMatchObject({
      ok: false,
      error: 'voting is closed',
    });
    expect(vote({ poll: '2026-week-3', choice: 'z' })).toMatchObject({ ok: false, status: 400 });
    expect(vote(null)).toMatchObject({ ok: false });
    expect(vote({ poll: '2026-week-3', choice: 'a' }, null)).toMatchObject({ ok: false });
  });
});

describe('pollClosesAt', () => {
  const at = (week: number) => pollClosesAt({ ...poll, week }, SCHEDULE);

  it("closes at kickoff of the Bengals' next game", () => {
    expect(at(3)).toBe(Date.parse('2026-10-04T13:00:00-04:00')); // Week 4 vs. Jaguars
  });

  it('stays open through a bye week', () => {
    // Week 5's poll closes at Week 7 (Week 6 is the bye).
    expect(at(5)).toBe(Date.parse('2026-10-25T13:00:00-04:00'));
  });

  it('uses the estimated date when the next game is TBD', () => {
    // Week 15 -> Week 16 (TBD) is estimated a week after Dec 20.
    expect(at(15)).toBe(Date.parse('2026-12-20T13:00:00-05:00') + 7 * 24 * 60 * 60 * 1000);
  });

  it('closes a week after the last game, and is closed for unknown weeks', () => {
    const last: Game = {
      week: 22,
      opponent: 'Rams',
      home: true,
      kickoff: '2027-02-14T18:30:00-05:00',
      network: 'NBC',
    };
    expect(pollClosesAt({ ...poll, week: 22 }, [...SCHEDULE, last])).toBe(
      Date.parse(last.kickoff ?? '') + 7 * 24 * 60 * 60 * 1000,
    );
    expect(at(99)).toBe(0);
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
