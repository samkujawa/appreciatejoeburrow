// The stats page: career and season numbers from /api/stats (ESPN via the Worker).
import '@fontsource/big-shoulders-display/latin-900';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles/index.css';
import './styles/stats.css';

import type { Career, Season } from '../worker/espn';
import { gamesToReach, nextMilestone } from './lib/stat-milestones';

interface StatsResponse {
  career: Career;
  asOf: string;
  stale: boolean;
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

interface MilestoneSpec {
  label: string;
  unit: string;
  value: number;
  step: number;
  /** Per-game pace used to project how many games until the next milestone. */
  perGame: number;
}

/**
 * Next round-number milestones, each with a labeled bar (last milestone → next), how many to go,
 * a games-away projection, and a tooltip (hover, or tap/focus on touch) with the full context.
 */
function renderMilestones(target: HTMLElement, career: Career): void {
  const current = career.seasons.at(-1);
  // Project from this season's pace once he's played, otherwise from his career pace.
  const pace = current && current.games > 0 ? current : null;
  const paceLabel = pace ? `his ${String(pace.year)} pace` : 'his career pace';
  const perGame = (season: number | undefined, total: number): number => {
    if (pace && season !== undefined) return season / pace.games;
    return career.totals.games > 0 ? total / career.totals.games : 0;
  };

  const specs: MilestoneSpec[] = [
    {
      label: 'Career passing yards',
      unit: 'yards',
      value: career.totals.yards,
      step: 5_000,
      perGame: perGame(pace?.yards, career.totals.yards),
    },
    {
      label: 'Career passing TDs',
      unit: 'touchdown passes',
      value: career.totals.touchdowns,
      step: 25,
      perGame: perGame(pace?.touchdowns, career.totals.touchdowns),
    },
    {
      label: 'Career completions',
      unit: 'completions',
      value: career.totals.completions,
      step: 250,
      perGame: perGame(pace?.completions, career.totals.completions),
    },
  ];

  target.replaceChildren(
    ...specs.map((spec, i) => {
      const next = nextMilestone(spec.value, spec.step);
      const games = gamesToReach(next.remaining, spec.perGame);
      // The bar runs from 0 to the target, matching the "21,271 of 25,000" label beside it.
      const share = spec.value / next.target;
      const percent = Math.round(share * 100);
      const tipId = `milestone-tip-${String(i)}`;

      const row = el('div', 'milestone-row');

      const head = el('div', 'milestone-row__head');
      const position = el('span', 'milestone-row__position');
      position.append(
        el('strong', undefined, int.format(spec.value)),
        ` of ${int.format(next.target)}`,
      );
      head.append(el('span', 'milestone-row__label', spec.label), position);

      // Focusable so the tooltip also opens by keyboard and by tapping on phones.
      const track = el('div', 'milestone-row__track');
      track.tabIndex = 0;
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', String(next.target));
      track.setAttribute('aria-valuenow', String(spec.value));
      track.setAttribute(
        'aria-label',
        `${spec.label}: ${int.format(spec.value)} of ${int.format(next.target)}`,
      );
      track.setAttribute('aria-describedby', tipId);
      const bar = el('div', 'milestone-row__bar');
      const fill = el('span', 'milestone-row__fill');
      fill.style.width = `${String(Math.max(2, share * 100))}%`;
      bar.append(fill);
      const ends = el('div', 'milestone-row__ends');
      ends.append(el('span', undefined, '0'), el('span', undefined, int.format(next.target)));
      const tip = el('span', 'milestone-row__tip');
      tip.id = tipId;
      tip.setAttribute('role', 'tooltip');
      tip.textContent =
        `${int.format(spec.value)} career ${spec.unit}, ${String(percent)}% of the way to ` +
        `${int.format(next.target)}.` +
        (games
          ? ` Averaging ${dec1.format(spec.perGame)} per game at ${paceLabel}, he'd get there in about ${String(games)} ${games === 1 ? 'game' : 'games'}.`
          : '');
      track.append(bar, ends, tip);

      const note = el('p', 'milestone-row__note');
      note.append(el('strong', undefined, `${int.format(next.remaining)} to go`));
      if (games) {
        note.append(` · about ${String(games)} ${games === 1 ? 'game' : 'games'} at ${paceLabel}`);
      }

      row.append(head, track, note);
      return row;
    }),
  );
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
  for (const role of ['career', 'season', 'milestones', 'chart', 'table', 'source']) {
    part(root, role).hidden = role === 'season' && !current;
  }
  root.setAttribute('aria-busy', 'false');
}

void init();
