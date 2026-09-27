import type { Career } from '../../worker/espn';
import type { Achievement, LadderStatus } from '../../worker/records';

/** What goes on a share card; drawn by lib/share-card.ts. */
export interface CardContent {
  /** Small orange tag at the top, e.g. "Just reached". */
  kicker: string;
  /** The giant number or word. */
  big: string;
  /** Uppercase line under the big text. */
  label: string;
  /** A sentence or two of context. */
  lines: string[];
  /** Suggested download/share file name (no extension). */
  slug: string;
}

const int = new Intl.NumberFormat('en-US');
const dec1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Career snapshot. */
export function statsCard(career: Career): CardContent {
  const t = career.totals;
  const pct = t.attempts > 0 ? (t.completions / t.attempts) * 100 : t.completionPct;
  const latest = career.seasons[career.seasons.length - 1];
  return {
    kicker: 'By the numbers',
    big: int.format(t.yards),
    label: 'Career passing yards',
    lines: [
      `${int.format(t.touchdowns)} TD passes · ${dec1.format(pct)}% completions · ${dec1.format(t.rating)} rating`,
      latest ? `Through the ${String(latest.year)} season so far` : '',
    ].filter(Boolean),
    slug: 'joe-burrow-career-stats',
  };
}

/** One row of "Chasing Bengals history". */
export function historyCard(status: LadderStatus): CardContent {
  const { ladder, value, next, record } = status;
  const unit = ladder.perGameUnit;
  if (status.holdsRecord || !next) {
    return {
      kicker: 'Bengals record',
      big: int.format(value),
      label: ladder.label,
      lines: [
        `The most in Bengals history. He passed ${record.name} (${int.format(record.value)}).`,
      ],
      slug: `joe-burrow-${ladder.stat}-record`,
    };
  }
  const away = next.value - value + 1;
  const lines = [`${int.format(value)} career ${unit} and climbing.`];
  if (next !== record) {
    lines.push(`Bengals record: ${record.name}, ${int.format(record.value)}.`);
  }
  return {
    kicker: 'Chasing Bengals history',
    big: int.format(away),
    label: `${unit} to pass ${next.name}`,
    lines,
    slug: `joe-burrow-chasing-${next.name.toLowerCase().replace(/\s+/g, '-')}`,
  };
}

/** A "Just reached" achievement (see worker/records.ts for the key formats). */
export function achievementCard(a: Achievement): CardContent {
  const [kind, stat, rest] = a.key.split(':');
  const slug = `joe-burrow-${a.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  if (kind === 'passed' && rest) {
    const record = a.label.startsWith('The Bengals record');
    return {
      kicker: record ? 'New Bengals record' : 'Just reached',
      big: 'Passed',
      label: rest,
      lines: [record ? a.label : a.label.replace(/^Passed .+? in /, 'In ')],
      slug,
    };
  }
  if (kind === 'season-record') {
    return {
      kicker: 'New Bengals record',
      big: 'Record',
      label: `Single-season ${stat === 'yards' ? 'passing yards' : 'passing TDs'}`,
      lines: [a.label],
      slug,
    };
  }
  // Round-number milestone, e.g. "yards:25000" with label "25,000 career passing yards".
  const n = Number(stat);
  return {
    kicker: 'Just reached',
    big: Number.isFinite(n) ? int.format(n) : a.label,
    label: a.label.replace(/^[\d,]+\s+/, ''),
    lines: ['Another one for the coolest man in Cincinnati.'],
    slug,
  };
}

/** The global Appreciate counter crossing a milestone. */
export function counterCard(milestone: number): CardContent {
  return {
    kicker: 'Appreciation milestone',
    big: int.format(milestone),
    label: 'Appreciations',
    lines: [`I was appreciation #${int.format(milestone)} for the coolest man in Cincinnati.`],
    slug: `appreciation-${String(milestone)}`,
  };
}
