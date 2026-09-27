import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEDULE } from '../src/data/schedule';
import {
  choosePace,
  describeArrival,
  describePace,
  projectArrival,
  type Pace,
} from '../src/lib/projection';
import { parseCareer, type Career } from '../worker/espn';
import { achievements, LADDERS, ladderStatus, ownedRecords } from '../worker/records';

const real = parseCareer(JSON.parse(readFileSync('tests/fixtures/espn-career.json', 'utf8')));
if (!real) throw new Error('fixture did not parse');
const career: Career = real;

/** The same career with different totals / a different current season, for "future" cases. */
function withTotals(
  changes: Partial<Career['totals']>,
  season?: Partial<Career['seasons'][0]>,
): Career {
  const seasons = career.seasons.map((s) => ({ ...s }));
  const last = seasons.at(-1);
  if (last && season) Object.assign(last, season);
  return { seasons, totals: { ...career.totals, ...changes } };
}

const ladder = (stat: string) => {
  const l = LADDERS.find((x) => x.stat === stat);
  if (!l) throw new Error(stat);
  return l;
};

describe('choosePace', () => {
  it('uses his career average early in a season (2 games in 2026)', () => {
    const pace = choosePace(career, 'yards');
    expect(pace?.basis).toBe('career');
    expect(pace?.games).toBe(79);
    expect(pace?.perGame).toBeCloseTo(21_271 / 79);
  });

  it('switches to this season once he has played enough games', () => {
    const later = withTotals({}, { games: 6, yards: 1_500 });
    expect(choosePace(later, 'yards')).toMatchObject({ basis: 'season', perGame: 250, year: 2026 });
  });

  it('describes the pace in words', () => {
    const pace: Pace = { perGame: 230.5, basis: 'season', total: 461, games: 2, year: 2026 };
    expect(describePace(pace, 'yards')).toBe(
      "He's averaging 230.5 yards a game this season (461 in 2 games).",
    );
    expect(describePace({ ...pace, basis: 'career', total: 21_271, games: 79 }, 'yards')).toMatch(
      /^He's averaged 230.5 yards a game over his career \(21,271 in 79 games\)\.$/,
    );
  });
});

describe('projectArrival', () => {
  const pace: Pace = { perGame: 20, basis: 'season', total: 100, games: 5 };

  it('counts games, skipping the Week 6 bye', () => {
    // Before Week 4 kicks off: 5 games away is Week 4, 5, 7, 8, 9 -> Week 9, not Week 8.
    const arrival = projectArrival(100, pace, SCHEDULE, new Date('2026-10-01T12:00:00-04:00'));
    expect(arrival?.games).toBe(5);
    expect(arrival?.game?.week).toBe(9);
    expect(describeArrival(arrival ?? { games: 0, game: null })).toBe(
      "At that rate he'd get there in about 5 games: around Week 9 vs. Falcons (Nov 8).",
    );
  });

  it('says "next season" when it runs past the schedule, including the offseason', () => {
    const late = projectArrival(10_000, pace, SCHEDULE, new Date('2026-10-01T12:00:00-04:00'));
    expect(late?.game).toBeNull();
    const offseason = projectArrival(20, pace, SCHEDULE, new Date('2027-03-01T12:00:00-05:00'));
    expect(offseason).toEqual({ games: 1, game: null });
    expect(describeArrival(offseason ?? { games: 0, game: null })).toBe(
      "At that rate he'd get there in about 1 game: next season.",
    );
  });

  it('counts TBD games only until they would have been played', () => {
    // Week 16 (TBD) is estimated a week after Week 15 (Dec 20), so it's upcoming on Dec 22 but not Jan 5.
    const dec = projectArrival(40, pace, SCHEDULE, new Date('2026-12-22T12:00:00-05:00'));
    expect(dec?.game?.week).toBe(17);
    const jan = projectArrival(20, pace, SCHEDULE, new Date('2027-01-05T12:00:00-05:00'));
    expect(jan?.game?.week).toBe(18);
  });

  it('returns null with no pace or nothing left', () => {
    expect(projectArrival(10, null, SCHEDULE, new Date())).toBeNull();
    expect(projectArrival(0, pace, SCHEDULE, new Date())).toBeNull();
  });
});

describe('ladders', () => {
  it('knows who is next and that the record is still ahead', () => {
    const tds = ladderStatus(career, ladder('touchdowns'));
    expect(tds.passed.map((l) => l.name)).toEqual(['Carson Palmer']);
    expect(tds.next?.name).toBe('Boomer Esiason');
    expect(tds.holdsRecord).toBe(false);
  });

  it('moves along as he passes people, and flips once he holds the record', () => {
    const tds = ladderStatus(withTotals({ touchdowns: 205 }), ladder('touchdowns'));
    expect(tds.next).toBeNull();
    expect(tds.holdsRecord).toBe(true);
    expect(tds.record.name).toBe('Andy Dalton');
  });
});

describe('ownedRecords', () => {
  it('computes the records he holds from his stats', () => {
    const records = ownedRecords(career);
    expect(records.map((r) => [r.title, r.value, r.year, r.holds])).toEqual([
      ['Single-season passing yards', 4_918, 2024, true],
      ['Single-season passing TDs', 43, 2024, true],
      ['Career completion %', 68.5, undefined, true],
      ['Career passer rating', 101, undefined, true],
    ]);
  });

  it('picks up a new best season on its own', () => {
    const records = ownedRecords(withTotals({}, { yards: 5_100 }));
    expect(records[0]).toMatchObject({ value: 5_100, year: 2026 });
  });
});

describe('achievements', () => {
  it('lists the milestones reached and leaders passed', () => {
    const keys = achievements(career).map((a) => a.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'yards:20000',
        'touchdowns:150',
        'completions:1750',
        'passed:touchdowns:Carson Palmer',
      ]),
    );
    expect(keys.some((k) => k.startsWith('season-record'))).toBe(false);
  });

  it('adds new keys as he reaches more (what "just reached" is built on)', () => {
    const later = achievements(
      withTotals({ completions: 2_030, yards: 22_700 }, { yards: 5_000 }),
    ).map((a) => a.key);
    expect(later).toEqual(
      expect.arrayContaining([
        'completions:2000',
        'passed:completions:Boomer Esiason',
        'passed:completions:Carson Palmer',
        'passed:yards:Carson Palmer',
        'season-record:yards:2026',
      ]),
    );
  });
});
