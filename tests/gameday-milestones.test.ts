import { describe, expect, it } from 'vitest';
import { SCHEDULE, type Game } from '../src/data/schedule';
import { currentGameDay, formatCountdown, matchup } from '../src/lib/gameday';
import { crossedMilestones, isMilestone, isNines } from '../src/lib/milestones';

const steelers: Game = {
  week: 3,
  opponent: 'Steelers',
  home: false,
  kickoff: '2026-09-27T13:00:00-04:00',
  network: 'CBS',
};
const at = (iso: string): Date => new Date(iso);

describe('currentGameDay', () => {
  it('is quiet the day before', () => {
    expect(currentGameDay([steelers], at('2026-09-26T23:59:00-04:00'))).toBeNull();
  });

  it('is pregame from midnight Eastern until kickoff', () => {
    expect(currentGameDay([steelers], at('2026-09-27T00:00:00-04:00'))?.phase).toBe('pregame');
    expect(currentGameDay([steelers], at('2026-09-27T12:59:00-04:00'))?.phase).toBe('pregame');
  });

  it('is live from kickoff for three and a half hours, then "after" until midnight Eastern', () => {
    expect(currentGameDay([steelers], at('2026-09-27T13:00:00-04:00'))?.phase).toBe('live');
    expect(currentGameDay([steelers], at('2026-09-27T16:29:00-04:00'))?.phase).toBe('live');
    expect(currentGameDay([steelers], at('2026-09-27T16:31:00-04:00'))?.phase).toBe('after');
    expect(currentGameDay([steelers], at('2026-09-27T23:59:00-04:00'))?.phase).toBe('after');
    expect(currentGameDay([steelers], at('2026-09-28T00:00:00-04:00'))).toBeNull();
  });

  it('keeps a late game’s final score up past midnight', () => {
    const late: Game = { ...steelers, kickoff: '2026-11-23T20:15:00-05:00' };
    expect(currentGameDay([late], at('2026-11-23T23:40:00-05:00'))?.phase).toBe('live');
    expect(currentGameDay([late], at('2026-11-24T00:30:00-05:00'))?.phase).toBe('after');
    expect(currentGameDay([late], at('2026-11-24T00:50:00-05:00'))).toBeNull();
  });

  it('ignores games without a kickoff time', () => {
    const tbd: Game = { ...steelers, kickoff: null };
    expect(currentGameDay([tbd], at('2026-09-27T13:30:00-04:00'))).toBeNull();
  });
});

describe('matchup and countdown', () => {
  it('names the matchup from the Bengals side', () => {
    expect(matchup(steelers)).toBe('Bengals at Steelers');
    expect(matchup({ ...steelers, home: true, opponent: 'Falcons', site: 'Madrid' })).toBe(
      'Bengals vs. Falcons in Madrid',
    );
  });

  it('formats the countdown', () => {
    expect(formatCountdown(2 * 3_600_000 + 14 * 60_000 + 30_000)).toBe('2h 14m');
    expect(formatCountdown(14 * 60_000)).toBe('14m');
    expect(formatCountdown(20_000)).toBe('under a minute');
  });
});

describe('SCHEDULE', () => {
  it('has well-formed Eastern kickoff times with no overlapping game days', () => {
    const days = new Set<string>();
    for (const game of SCHEDULE) {
      if (!game.kickoff) continue;
      expect(game.kickoff).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-0[45]:00$/);
      expect(Number.isNaN(Date.parse(game.kickoff))).toBe(false);
      expect(days.has(game.kickoff.slice(0, 10))).toBe(false);
      days.add(game.kickoff.slice(0, 10));
    }
  });
});

describe('SCHEDULE daylight saving', () => {
  // The hour in America/New_York must match the hour written in the kickoff string. If a game
  // after the November clock change still says -04:00 (or vice versa), this catches it.
  const easternHour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: 'America/New_York',
  });

  it('uses the correct Eastern offset (EDT or EST) for every kickoff date', () => {
    for (const game of SCHEDULE) {
      if (!game.kickoff) continue;
      const written = Number(game.kickoff.slice(11, 13));
      const actual = Number(easternHour.format(new Date(game.kickoff)));
      expect(actual, `Week ${game.week}: ${game.kickoff}`).toBe(written);
    }
  });

  it('switches from EDT to EST at the November clock change', () => {
    const offsets = SCHEDULE.flatMap((g) => (g.kickoff ? [g.kickoff.slice(19)] : []));
    expect(offsets.slice(0, 6).every((o) => o === '-04:00')).toBe(true);
    expect(offsets.slice(6).every((o) => o === '-05:00')).toBe(true);
  });
});

describe('milestones', () => {
  it('recognizes round numbers and nines', () => {
    for (const n of [99, 100, 200, 500, 999, 1_000, 2_000, 5_000, 9_999, 10_000, 1_000_000]) {
      expect(isMilestone(n), String(n)).toBe(true);
    }
    for (const n of [1, 9, 50, 101, 150, 300, 998, 1_001, 1_500, 90_000]) {
      expect(isMilestone(n), String(n)).toBe(false);
    }
    expect(isNines(999)).toBe(true);
    expect(isNines(1_000)).toBe(false);
  });

  it('finds milestones a batch crossed, excluding where it started', () => {
    expect(crossedMilestones(990, 1_005)).toEqual([999, 1_000]);
    expect(crossedMilestones(1_000, 1_010)).toEqual([]);
    expect(crossedMilestones(95, 100)).toEqual([99, 100]);
    expect(crossedMilestones(10, 20)).toEqual([]);
  });
});
