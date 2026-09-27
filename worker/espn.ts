/**
 * Parsers for ESPN's public (undocumented) NFL JSON. ESPN can change these shapes without notice,
 * so every field is read defensively and anything unexpected returns null rather than throwing.
 * Kept free of Cloudflare types so it can be unit tested against saved responses.
 */

export const BENGALS_TEAM_ID = '4';
export const BURROW_ATHLETE_ID = '3915511';

export const SCOREBOARD_URL =
  'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
export const summaryUrl = (eventId: string): string =>
  `https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${encodeURIComponent(eventId)}`;
export const CAREER_URL = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${BURROW_ATHLETE_ID}/stats`;

export interface TeamScore {
  abbr: string;
  score: number;
}

export interface LiveGame {
  eventId: string;
  state: 'pre' | 'in' | 'post';
  /** "Q3 4:12", "Halftime", "Final", "Final/OT". */
  clock: string;
  bengalsHome: boolean;
  bengals: TeamScore;
  opponent: TeamScore;
}

export interface PassingLine {
  completions: number;
  attempts: number;
  yards: number;
  touchdowns: number;
  interceptions: number;
}

export interface Season {
  year: number;
  games: number;
  completions: number;
  attempts: number;
  completionPct: number;
  yards: number;
  touchdowns: number;
  interceptions: number;
  rating: number;
  rushYards: number;
  rushTouchdowns: number;
}

export type CareerTotals = Omit<Season, 'year'>;

export interface Career {
  seasons: Season[];
  totals: CareerTotals;
}

type Json = Record<string, unknown>;

function obj(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** "4,611" → 4611, "70.4" → 70.4, "--" → 0. */
function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatClock(status: Json): string {
  const type = obj(status.type);
  const name = str(type?.name) ?? '';
  const state = str(type?.state);
  const period = num(status.period);
  if (state === 'post') return period > 4 ? 'Final/OT' : 'Final';
  if (name === 'STATUS_HALFTIME') return 'Halftime';
  if (name === 'STATUS_END_PERIOD') return period > 4 ? 'End of OT' : `End of Q${period}`;
  if (state === 'in') {
    const label = period > 4 ? 'OT' : `Q${period}`;
    const clock = str(status.displayClock);
    return clock ? `${label} ${clock}` : label;
  }
  return str(type?.shortDetail) ?? '';
}

/** Finds the Bengals' game on ESPN's scoreboard; null on a bye week or unexpected data. */
export function parseScoreboard(body: unknown): LiveGame | null {
  for (const event of arr(obj(body)?.events)) {
    const e = obj(event);
    const competition = obj(arr(e?.competitions)[0]);
    const competitors = arr(competition?.competitors).map(obj);
    const bengals = competitors.find((c) => str(obj(c?.team)?.id) === BENGALS_TEAM_ID);
    const opponent = competitors.find((c) => c !== bengals);
    const status = obj(competition?.status);
    const state = str(obj(status?.type)?.state);
    const eventId = str(e?.id);
    if (!bengals || !opponent || !status || !eventId) continue;
    if (state !== 'pre' && state !== 'in' && state !== 'post') continue;
    return {
      eventId,
      state,
      clock: formatClock(status),
      bengalsHome: str(bengals.homeAway) === 'home',
      bengals: { abbr: str(obj(bengals.team)?.abbreviation) ?? 'CIN', score: num(bengals.score) },
      opponent: { abbr: str(obj(opponent.team)?.abbreviation) ?? '', score: num(opponent.score) },
    };
  }
  return null;
}

/** Joe Burrow's passing line from an ESPN game summary; null if he hasn't thrown (or no data). */
export function parsePassingLine(body: unknown, athleteId = BURROW_ATHLETE_ID): PassingLine | null {
  for (const team of arr(obj(obj(body)?.boxscore)?.players)) {
    for (const category of arr(obj(team)?.statistics)) {
      const cat = obj(category);
      if (str(cat?.name) !== 'passing') continue;
      const keys = arr(cat?.keys).map(str);
      for (const athlete of arr(cat?.athletes)) {
        const a = obj(athlete);
        if (str(obj(a?.athlete)?.id) !== athleteId) continue;
        const stats = arr(a?.stats);
        const at = (key: string): unknown => stats[keys.indexOf(key)];
        const [completions, attempts] = (str(at('completions/passingAttempts')) ?? '')
          .split('/')
          .map(num);
        return {
          completions: completions ?? 0,
          attempts: attempts ?? 0,
          yards: num(at('passingYards')),
          touchdowns: num(at('passingTouchdowns')),
          interceptions: num(at('interceptions')),
        };
      }
    }
  }
  return null;
}

/** Season-by-season and career passing (plus rushing yards/TDs) from ESPN's athlete stats. */
export function parseCareer(body: unknown): Career | null {
  const categories = arr(obj(body)?.categories).map(obj);
  const passing = categories.find((c) => str(c?.name) === 'passing');
  const rushing = categories.find((c) => str(c?.name) === 'rushing');
  if (!passing) return null;

  const passNames = arr(passing.names).map(str);
  const rushNames = arr(rushing?.names).map(str);
  const pick = (names: (string | null)[], stats: unknown[], key: string): number =>
    num(stats[names.indexOf(key)]);

  const rushByYear = new Map<number, unknown[]>();
  for (const row of arr(rushing?.statistics)) {
    const r = obj(row);
    rushByYear.set(num(obj(r?.season)?.year), arr(r?.stats));
  }

  const line = (p: unknown[], r: unknown[]): CareerTotals => ({
    games: pick(passNames, p, 'gamesPlayed'),
    completions: pick(passNames, p, 'completions'),
    attempts: pick(passNames, p, 'passingAttempts'),
    completionPct: pick(passNames, p, 'completionPct'),
    yards: pick(passNames, p, 'passingYards'),
    touchdowns: pick(passNames, p, 'passingTouchdowns'),
    interceptions: pick(passNames, p, 'interceptions'),
    rating: pick(passNames, p, 'QBRating'),
    rushYards: pick(rushNames, r, 'rushingYards'),
    rushTouchdowns: pick(rushNames, r, 'rushingTouchdowns'),
  });

  const seasons: Season[] = [];
  for (const row of arr(passing.statistics)) {
    const s = obj(row);
    const year = num(obj(s?.season)?.year);
    if (!year) continue;
    seasons.push({ year, ...line(arr(s?.stats), rushByYear.get(year) ?? []) });
  }
  if (seasons.length === 0) return null;
  seasons.sort((a, b) => a.year - b.year);
  return { seasons, totals: line(arr(passing.totals), arr(rushing?.totals)) };
}
