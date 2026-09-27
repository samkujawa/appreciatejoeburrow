/**
 * Bengals franchise passing leaders, and what Joe Burrow has achieved against them. Shared by the
 * Worker (to notice when he reaches something new) and the stats page (to draw it). Pure data and
 * functions, no Cloudflare types.
 *
 * The fixed numbers are other quarterbacks' Bengals-only totals (StatMuse / Pro Football
 * Reference, Sept 2026). They're all retired or gone from Cincinnati, so they don't change.
 * Everything about Burrow is computed from his live stats, so the page keeps up on its own as he
 * passes people, breaks records, and sets new ones.
 */
import type { Career } from './espn';

export type StatKey = 'yards' | 'touchdowns' | 'completions';

export interface Leader {
  name: string;
  value: number;
}

export interface Ladder {
  stat: StatKey;
  label: string;
  unit: string;
  /** Short unit for pace text, e.g. "yards" in "230.5 yards a game". */
  perGameUnit: string;
  /** Round-number milestone spacing for this stat. */
  step: number;
  /** Other Bengals career leaders near or ahead of Burrow, lowest first; the last held the record. */
  leaders: Leader[];
}

export const LADDERS: readonly Ladder[] = [
  {
    stat: 'yards',
    label: 'Career passing yards',
    unit: 'yards',
    perGameUnit: 'yards',
    step: 5_000,
    leaders: [
      { name: 'Carson Palmer', value: 22_694 },
      { name: 'Boomer Esiason', value: 27_149 },
      { name: 'Andy Dalton', value: 31_594 },
      { name: 'Ken Anderson', value: 32_838 },
    ],
  },
  {
    stat: 'touchdowns',
    label: 'Career passing TDs',
    unit: 'touchdown passes',
    perGameUnit: 'TD passes',
    step: 25,
    leaders: [
      { name: 'Carson Palmer', value: 154 },
      { name: 'Boomer Esiason', value: 187 },
      { name: 'Ken Anderson', value: 197 },
      { name: 'Andy Dalton', value: 204 },
    ],
  },
  {
    stat: 'completions',
    label: 'Career completions',
    unit: 'completions',
    perGameUnit: 'completions',
    step: 250,
    leaders: [
      { name: 'Boomer Esiason', value: 2_015 },
      { name: 'Carson Palmer', value: 2_024 },
      { name: 'Ken Anderson', value: 2_654 },
      { name: 'Andy Dalton', value: 2_757 },
    ],
  },
];

export function statValue(career: Career, stat: StatKey): number {
  return career.totals[stat];
}

export interface LadderStatus {
  ladder: Ladder;
  value: number;
  passed: Leader[];
  /** Next leader he hasn't passed yet; null once he holds the record. */
  next: Leader | null;
  /** The previous record (the last leader), which he may already have broken. */
  record: Leader;
  holdsRecord: boolean;
}

export function ladderStatus(career: Career, ladder: Ladder): LadderStatus {
  const value = statValue(career, ladder.stat);
  const record = ladder.leaders[ladder.leaders.length - 1] ?? { name: '', value: 0 };
  const passed = ladder.leaders.filter((l) => value > l.value);
  const next = ladder.leaders.find((l) => value <= l.value) ?? null;
  return { ladder, value, passed, next, record, holdsRecord: value > record.value };
}

/** Best Bengals marks by anyone other than Burrow, for the records he can hold. */
const OTHERS_BEST = {
  seasonYards: { name: 'Andy Dalton', value: 4_293, year: 2013 },
  seasonTouchdowns: { name: 'Andy Dalton', value: 33, year: 2013 },
  completionPct: { name: 'Carson Palmer', value: 62.9 },
  rating: { name: 'Andy Dalton', value: 87.5 },
} as const;

export interface OwnedRecord {
  title: string;
  /** Burrow's mark, e.g. 4918 (season) or 68.5 (rate). */
  value: number;
  /** For season records, the season he set it. */
  year?: number;
  /** The best mark by anyone else, for context. */
  runnerUp: { name: string; value: number; year?: number };
  holds: boolean;
}

/** Franchise records measured from his live stats, so a new best season updates on its own. */
export function ownedRecords(career: Career): OwnedRecord[] {
  const bestBy = (key: 'yards' | 'touchdowns') =>
    career.seasons.reduce((a, b) => (b[key] > a[key] ? b : a));
  const yards = bestBy('yards');
  const tds = bestBy('touchdowns');
  const pct =
    career.totals.attempts > 0
      ? Math.round((career.totals.completions / career.totals.attempts) * 1000) / 10
      : career.totals.completionPct;
  return [
    {
      title: 'Single-season passing yards',
      value: yards.yards,
      year: yards.year,
      runnerUp: OTHERS_BEST.seasonYards,
      holds: yards.yards > OTHERS_BEST.seasonYards.value,
    },
    {
      title: 'Single-season passing TDs',
      value: tds.touchdowns,
      year: tds.year,
      runnerUp: OTHERS_BEST.seasonTouchdowns,
      holds: tds.touchdowns > OTHERS_BEST.seasonTouchdowns.value,
    },
    {
      title: 'Career completion %',
      value: pct,
      runnerUp: OTHERS_BEST.completionPct,
      holds: pct > OTHERS_BEST.completionPct.value,
    },
    {
      title: 'Career passer rating',
      value: career.totals.rating,
      runnerUp: OTHERS_BEST.rating,
      holds: career.totals.rating > OTHERS_BEST.rating.value,
    },
  ];
}

export interface Achievement {
  /** Stable id, e.g. "yards:20000", "passed:touchdowns:Carson Palmer" or "season-record:yards:2026". */
  key: string;
  label: string;
}

/**
 * Everything Burrow has reached so far. The Worker remembers when each key first appeared, so a
 * key it hasn't seen before means he just reached it.
 */
export function achievements(career: Career): Achievement[] {
  const fmt = new Intl.NumberFormat('en-US');
  const out: Achievement[] = [];

  for (const ladder of LADDERS) {
    const value = statValue(career, ladder.stat);
    const milestone = Math.floor(value / ladder.step) * ladder.step;
    if (milestone > 0) {
      out.push({
        key: `${ladder.stat}:${String(milestone)}`,
        label: `${fmt.format(milestone)} ${ladder.label.toLowerCase()}`,
      });
    }
    const status = ladderStatus(career, ladder);
    for (const leader of status.passed) {
      out.push({
        key: `passed:${ladder.stat}:${leader.name}`,
        label:
          leader === status.record
            ? `The Bengals record for ${ladder.label.toLowerCase()}, passing ${leader.name}`
            : `Passed ${leader.name} in Bengals ${ladder.label.toLowerCase()}`,
      });
    }
  }

  // A season that beats every earlier season (his own included) is a new single-season record.
  const current = career.seasons[career.seasons.length - 1];
  const earlier = career.seasons.slice(0, -1);
  if (current) {
    for (const [stat, label] of [
      ['yards', 'passing yards'],
      ['touchdowns', 'passing TDs'],
    ] as const) {
      const previousBest = Math.max(
        stat === 'yards' ? OTHERS_BEST.seasonYards.value : OTHERS_BEST.seasonTouchdowns.value,
        ...earlier.map((s) => s[stat]),
      );
      if (current[stat] > previousBest) {
        out.push({
          key: `season-record:${stat}:${String(current.year)}`,
          label: `A new Bengals single-season record for ${label} (${String(current.year)})`,
        });
      }
    }
  }
  return out;
}
