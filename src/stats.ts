// The stats page: career and season numbers from /api/stats (ESPN via the Worker).
import '@fontsource/big-shoulders-display/latin-900';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles/index.css';
import './styles/stats.css';

import type { Career, Season } from '../worker/espn';
import { SCHEDULE } from './data/schedule';
import { choosePace, describeArrival, describePace, projectArrival } from './lib/projection';
import { nextMilestone } from './lib/stat-milestones';
import {
  LADDERS,
  ladderStatus,
  ownedRecords,
  type Achievement,
  type Ladder,
} from '../worker/records';

interface StatsResponse {
  career: Career;
  asOf: string;
  stale: boolean;
  justReached?: (Achievement & { reachedAt: string })[];
}

function isStatsResponse(value: unknown): value is StatsResponse {
  const career = (value as { career?: { seasons?: unknown } } | null)?.career;
  return Array.isArray(career?.seasons);
}

const int = new Intl.NumberFormat('en-US');
const dec1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function part(root: ParentNode, role: string): HTMLElement {
  const node = root.querySelector<HTMLElement>(`[data-role="${role}"]`);
  if (!node) throw new Error(`Missing [data-role="${role}"]`);
  return node;
}

function heroStat(value: string, label: string): HTMLElement {
  const box = el('div', 'stat');
  box.append(el('span', 'stat__value', value), el('span', 'stat__label', label));
  return box;
}

function renderHero(target: HTMLElement, s: Omit<Season, 'year'>): void {
  const pct = s.attempts > 0 ? (s.completions / s.attempts) * 100 : s.completionPct;
  target.replaceChildren(
    heroStat(int.format(s.yards), 'Passing yards'),
    heroStat(int.format(s.touchdowns), 'Passing TDs'),
    heroStat(`${dec1.format(pct)}%`, 'Completion'),
    heroStat(dec1.format(s.rating), 'Passer rating'),
    heroStat(int.format(s.games), 'Games'),
    heroStat(int.format(s.rushTouchdowns), 'Rushing TDs'),
  );
}

interface BarSpec {
  label: string;
  value: number;
  /** Right end of the bar; the fill is value / max. */
  max: number;
  /** Big number shown on the right of the heading, e.g. "21,271 of 25,000". */
  position: string;
  /** Ticks along the bar, e.g. the franchise leaders he's passing. */
  markers?: { value: number; label: string; passed: boolean }[];
  /** Plain-English lines under the bar. */
  lines: (string | { strong: string; rest: string })[];
  /** Tooltip text (hover, or tap/focus on touch). */
  tip: string;
}

let tipCount = 0;

/** One labeled bar row: heading, a bar from 0 with optional markers and a tooltip, then notes. */
function barRow(spec: BarSpec): HTMLElement {
  const row = el('div', 'milestone-row');
  const tipId = `bar-tip-${String((tipCount += 1))}`;

  const head = el('div', 'milestone-row__head');
  const position = el('span', 'milestone-row__position');
  position.textContent = spec.position;
  head.append(el('span', 'milestone-row__label', spec.label), position);

  const track = el('div', 'milestone-row__track');
  track.tabIndex = 0;
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(spec.max));
  track.setAttribute('aria-valuenow', String(Math.min(spec.value, spec.max)));
  track.setAttribute('aria-label', `${spec.label}: ${spec.position}`);
  track.setAttribute('aria-describedby', tipId);

  const bar = el('div', 'milestone-row__bar');
  const fill = el('span', 'milestone-row__fill');
  fill.style.width = `${String(Math.max(2, Math.min(1, spec.value / spec.max) * 100))}%`;
  bar.append(fill);
  for (const marker of spec.markers ?? []) {
    const tick = el(
      'span',
      marker.passed ? 'milestone-row__tick is-passed' : 'milestone-row__tick',
    );
    tick.style.left = `${String(Math.min(100, (marker.value / spec.max) * 100))}%`;
    tick.title = marker.label;
    bar.append(tick);
  }

  const ends = el('div', 'milestone-row__ends');
  ends.append(el('span', undefined, '0'), el('span', undefined, int.format(spec.max)));

  const tip = el('span', 'milestone-row__tip', spec.tip);
  tip.id = tipId;
  tip.setAttribute('role', 'tooltip');
  track.append(bar, ends, tip);

  row.append(head, track);
  for (const line of spec.lines) {
    const p = el('p', 'milestone-row__note');
    if (typeof line === 'string') p.textContent = line;
    else p.append(el('strong', undefined, line.strong), line.rest);
    row.append(p);
  }
  return row;
}

/** "He's averaging … At that rate he'd get there in about 17 games: next season." */
function paceLines(career: Career, ladder: Ladder, remaining: number): string[] {
  const pace = choosePace(career, ladder.stat);
  if (!pace) return [];
  const arrival = projectArrival(remaining, pace, SCHEDULE, new Date());
  return [describePace(pace, ladder.perGameUnit), ...(arrival ? [describeArrival(arrival)] : [])];
}

/** Next round-number milestones. Targets move up on their own as he passes each one. */
function renderMilestones(target: HTMLElement, career: Career): void {
  target.replaceChildren(
    ...LADDERS.map((ladder) => {
      const value = career.totals[ladder.stat];
      const next = nextMilestone(value, ladder.step);
      const percent = Math.round((value / next.target) * 100);
      return barRow({
        label: ladder.label,
        value,
        max: next.target,
        position: `${int.format(value)} of ${int.format(next.target)}`,
        lines: [
          { strong: `${int.format(next.remaining)} to go.`, rest: '' },
          ...paceLines(career, ladder, next.remaining),
        ],
        tip: `${int.format(value)} career ${ladder.unit}, ${String(percent)}% of the way to ${int.format(next.target)}.`,
      });
    }),
  );
}

/** The Bengals career leaderboard for each stat: who he's passed, who's next, and the record. */
function renderHistory(target: HTMLElement, career: Career): void {
  target.replaceChildren(
    ...LADDERS.map((ladder) => {
      const status = ladderStatus(career, ladder);
      const { value, record, next } = status;
      const markers = ladder.leaders.map((l) => ({
        value: l.value,
        label: `${l.name}: ${int.format(l.value)}`,
        passed: value > l.value,
      }));
      const passedNames = status.passed.map((l) => l.name);

      if (status.holdsRecord) {
        return barRow({
          label: ladder.label,
          value,
          max: value,
          position: `Bengals record: ${int.format(value)}`,
          markers,
          lines: [
            {
              strong: 'He owns the record.',
              rest: ` Passed ${record.name} (${int.format(record.value)}) for the most in team history, and still adding to it.`,
            },
          ],
          tip: `Joe Burrow holds the Bengals record with ${int.format(value)} ${ladder.unit}. The previous record was ${record.name}'s ${int.format(record.value)}.`,
        });
      }

      const toRecord = record.value - value + 1;
      const lines: BarSpec['lines'] = [];
      if (next) {
        lines.push({
          strong: `Next up: ${next.name} (${int.format(next.value)}), ${int.format(next.value - value + 1)} away.`,
          rest: '',
        });
      }
      if (next !== record) {
        lines.push(
          `${int.format(toRecord)} to break ${record.name}'s record of ${int.format(record.value)}.`,
        );
      }
      lines.push(
        ...paceLines(career, ladder, toRecord).map((t) =>
          t.replace('get there', 'break the record'),
        ),
      );
      return barRow({
        label: ladder.label,
        value,
        max: record.value,
        position: `${int.format(value)} of ${int.format(record.value)}`,
        markers,
        lines,
        tip:
          `Bengals record: ${record.name}, ${int.format(record.value)} ${ladder.unit}.` +
          (passedNames.length ? ` Already passed: ${passedNames.join(', ')}.` : '') +
          ' Ticks on the bar mark each Bengals great on the way.',
      });
    }),
  );
}

/** Franchise records measured from his live stats (so a new best season updates on its own). */
function renderOwned(target: HTMLElement, career: Career): boolean {
  const held = ownedRecords(career).filter((r) => r.holds);
  target.replaceChildren(
    ...held.map((r) => {
      const isRate = r.year === undefined;
      const pct = r.title.includes('%') ? '%' : '';
      const value = isRate ? dec1.format(r.value) + pct : int.format(r.value);
      const box = el('div', 'stat stat--owned');
      const runner = r.runnerUp;
      const detail = `${r.year ? `Set in ${String(r.year)}. ` : ''}Next best: ${runner.name}, ${
        isRate ? dec1.format(runner.value) + pct : int.format(runner.value)
      }${'year' in runner && runner.year ? ` (${String(runner.year)})` : ''}`;
      box.append(
        el('span', 'stat__value', value),
        el('span', 'stat__label', r.title),
        el('span', 'stat__detail', detail),
      );
      return box;
    }),
  );
  return held.length > 0;
}

/** "Just reached" callout for anything he's hit in the last week. */
function renderJustReached(target: HTMLElement, items: StatsResponse['justReached']): boolean {
  if (!items?.length) return false;
  const when = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  });
  const list = el('ul', 'just-reached__list');
  for (const item of items) {
    const li = el('li');
    li.append(
      el('span', 'just-reached__what', item.label),
      el('span', 'just-reached__when', when.format(new Date(item.reachedAt))),
    );
    list.append(li);
  }
  target.replaceChildren(el('p', 'just-reached__tag', 'Just reached'), list);
  return true;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Plain SVG bar chart: passing yards per season, TDs under each bar, best season in orange. */
function renderChart(target: HTMLElement, seasons: Season[]): void {
  const width = 640;
  const height = 280;
  const pad = { top: 28, bottom: 46, side: 12 };
  const max = Math.max(...seasons.map((s) => s.yards), 1);
  const best = seasons.reduce((a, b) => (b.yards > a.yards ? b : a));
  const slot = (width - pad.side * 2) / seasons.length;
  const barWidth = Math.min(56, slot * 0.62);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `Passing yards by season. Best: ${best.year} with ${int.format(best.yards)} yards.`,
  );

  seasons.forEach((s, i) => {
    const h = ((height - pad.top - pad.bottom) * s.yards) / max;
    const x = pad.side + slot * i + (slot - barWidth) / 2;
    const y = height - pad.bottom - h;
    const text = (content: string, ty: number, cls: string): SVGTextElement => {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(x + barWidth / 2));
      t.setAttribute('y', String(ty));
      t.setAttribute('class', cls);
      t.textContent = content;
      return t;
    };
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(barWidth));
    rect.setAttribute('height', String(Math.max(h, 1)));
    rect.setAttribute('class', s === best ? 'chart__bar chart__bar--best' : 'chart__bar');
    svg.append(
      rect,
      text(int.format(s.yards), y - 8, 'chart__value'),
      text(String(s.year), height - pad.bottom + 18, 'chart__year'),
      text(`${s.touchdowns} TD`, height - pad.bottom + 36, 'chart__td'),
    );
  });

  const caption = el('figcaption', 'stats__caption');
  caption.textContent = `Best season: ${best.year}, ${int.format(best.yards)} yards and ${best.touchdowns} TDs.`;
  target.replaceChildren(svg, caption);
}

function renderTable(target: HTMLTableElement, career: Career): void {
  const columns: [string, (s: Omit<Season, 'year'>) => string][] = [
    ['G', (s) => int.format(s.games)],
    ['Cmp/Att', (s) => `${int.format(s.completions)}/${int.format(s.attempts)}`],
    ['Pct', (s) => dec1.format(s.completionPct)],
    ['Yds', (s) => int.format(s.yards)],
    ['TD', (s) => int.format(s.touchdowns)],
    ['INT', (s) => int.format(s.interceptions)],
    ['Rtg', (s) => dec1.format(s.rating)],
    ['Rush Yds', (s) => int.format(s.rushYards)],
    ['Rush TD', (s) => int.format(s.rushTouchdowns)],
  ];
  const best = career.seasons.reduce((a, b) => (b.yards > a.yards ? b : a));

  const head = el('thead');
  const headRow = el('tr');
  headRow.append(el('th', undefined, 'Season'));
  for (const [label] of columns) {
    const th = el('th', undefined, label);
    th.scope = 'col';
    headRow.append(th);
  }
  head.append(headRow);

  const body = el('tbody');
  for (const season of [...career.seasons].reverse()) {
    const row = el('tr', season === best ? 'is-best' : undefined);
    const th = el('th', undefined, String(season.year));
    th.scope = 'row';
    row.append(th, ...columns.map(([, value]) => el('td', undefined, value(season))));
    body.append(row);
  }

  const foot = el('tfoot');
  const footRow = el('tr');
  const label = el('th', undefined, 'Career');
  label.scope = 'row';
  footRow.append(label, ...columns.map(([, value]) => el('td', undefined, value(career.totals))));
  foot.append(footRow);

  const caption = el(
    'caption',
    'visually-hidden',
    'Joe Burrow passing and rushing stats by season',
  );
  target.replaceChildren(caption, head, body, foot);
}

async function init(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#stats');
  if (!root) return;
  const status = part(root, 'status');

  let data: StatsResponse;
  try {
    const res = await fetch('/api/stats', { headers: { Accept: 'application/json' } });
    const body: unknown = await res.json();
    if (!res.ok || !isStatsResponse(body)) throw new Error(`stats ${res.status}`);
    data = body;
  } catch {
    status.textContent = 'Stats are unavailable right now. Try again in a few minutes.';
    root.setAttribute('aria-busy', 'false');
    return;
  }

  const { career } = data;
  const current = career.seasons.at(-1);
  renderHero(part(root, 'hero'), career.totals);
  if (current) {
    part(root, 'season-title').textContent = `${current.year} season`;
    renderHero(part(root, 'season-hero'), current);
  }
  renderMilestones(part(root, 'milestone-list'), career);
  renderHistory(part(root, 'history-list'), career);
  const hasOwned = renderOwned(part(root, 'owned-list'), career);
  const hasRecent = renderJustReached(part(root, 'just-reached'), data.justReached);
  renderChart(part(root, 'chart-figure'), career.seasons);
  const table = root.querySelector<HTMLTableElement>('[data-role="season-table"]');
  if (table) renderTable(table, career);

  const asOf = new Date(data.asOf).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  });
  const source = part(root, 'source');
  source.textContent = `${data.stale ? 'Showing saved stats. ' : ''}Updated ${asOf} ET · Regular season · Source: ESPN`;

  status.remove();
  const show: Record<string, boolean> = {
    'just-reached': hasRecent,
    career: true,
    season: Boolean(current),
    milestones: true,
    history: true,
    owned: hasOwned,
    chart: true,
    table: true,
    source: true,
  };
  for (const [role, visible] of Object.entries(show)) part(root, role).hidden = !visible;
  root.setAttribute('aria-busy', 'false');
}

void init();
