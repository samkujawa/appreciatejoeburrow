import type { Game } from '../data/schedule';
import { currentGameDay, formatCountdown, matchup, type GameDay } from '../lib/gameday';

const SCHEDULE_REFRESH_MS = 30_000;
const LIVE_POLL_MS = 30_000;
const FINAL_POLL_MS = 5 * 60_000;

/** Shape of GET /api/live (see worker/index.ts). */
interface LiveResponse {
  game: {
    state: 'pre' | 'in' | 'post';
    clock: string;
    bengals: { abbr: string; score: number };
    opponent: { abbr: string; score: number };
  } | null;
  burrow: {
    completions: number;
    attempts: number;
    yards: number;
    touchdowns: number;
    interceptions: number;
  } | null;
}

function isLiveResponse(value: unknown): value is LiveResponse {
  return typeof value === 'object' && value !== null && 'game' in value;
}

const format = new Intl.NumberFormat('en-US');

function burrowLine(b: NonNullable<LiveResponse['burrow']>): string {
  const picks = b.interceptions > 0 ? ` · ${b.interceptions} INT` : '';
  return `Burrow ${b.completions}/${b.attempts} · ${format.format(b.yards)} yds · ${b.touchdowns} TD${picks}`;
}

/**
 * Game-day banner at the top of the page:
 * - game day before kickoff: countdown with kickoff in Eastern time
 * - during the game: live score, clock and Burrow's line (from ESPN via /api/live), falling back to a plain "Game on" if scores are unavailable
 * - after the game: the final, for the rest of game day
 */
export function initGameDay(banner: HTMLElement, schedule: readonly Game[]): void {
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
  const tag = banner.querySelector('.gameday__tag');
  const game = banner.querySelector('.gameday__game');
  const detail = banner.querySelector('.gameday__detail');
  let live: LiveResponse | null = null;
  let pollTimer: number | null = null;

  function show(phase: string, tagText: string, gameText: string, detailText: string): void {
    if (!tag || !game || !detail) return;
    banner.hidden = false;
    banner.dataset.phase = phase;
    tag.textContent = tagText;
    game.textContent = gameText;
    detail.textContent = detailText;
  }

  function render(state: GameDay | null): void {
    if (!state) {
      banner.hidden = true;
      return;
    }
    const network = state.game.network ? ` · ${state.game.network}` : '';

    if (state.phase === 'pregame') {
      const countdown = formatCountdown(state.kickoff.getTime() - Date.now());
      show(
        'pregame',
        'Game day',
        matchup(state.game),
        `Kickoff ${time.format(state.kickoff)} ET${network} · in ${countdown}`,
      );
      return;
    }

    const g = live?.game;
    if (g && (g.state === 'in' || g.state === 'post')) {
      const score = `${g.bengals.abbr} ${g.bengals.score} – ${g.opponent.abbr} ${g.opponent.score}`;
      const parts: string[] = [];
      if (g.state === 'post') {
        const diff = g.bengals.score - g.opponent.score;
        parts.push(diff > 0 ? 'Win' : diff < 0 ? 'Loss' : 'Tie');
      } else {
        parts.push(g.clock);
      }
      if (live?.burrow) parts.push(burrowLine(live.burrow));
      show(
        g.state === 'post' ? 'final' : 'live',
        g.state === 'post' ? g.clock : 'Game on',
        score,
        parts.join(' · '),
      );
      return;
    }

    // No live data (ESPN unreachable or not started yet): keep it simple during the game window.
    if (state.phase === 'live') {
      show('live', 'Game on', matchup(state.game), `Live now${network}`);
    } else {
      banner.hidden = true;
    }
  }

  async function poll(): Promise<void> {
    pollTimer = null;
    const state = currentGameDay(schedule, new Date());
    if (!state || state.phase === 'pregame') return;
    try {
      const res = await fetch('/api/live', { headers: { Accept: 'application/json' } });
      const body: unknown = await res.json();
      if (res.ok && isLiveResponse(body)) live = body;
    } catch {
      // Keep the last good data; render() falls back to the schedule if there is none.
    }
    render(currentGameDay(schedule, new Date()));
    if (!document.hidden) {
      const delay = live?.game?.state === 'post' ? FINAL_POLL_MS : LIVE_POLL_MS;
      pollTimer = window.setTimeout(() => void poll(), delay);
    }
  }

  function tick(): void {
    const state = currentGameDay(schedule, new Date());
    render(state);
    if (state && state.phase !== 'pregame' && pollTimer === null && !document.hidden) void poll();
  }

  tick();
  window.setInterval(tick, SCHEDULE_REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || pollTimer !== null) return;
    tick();
  });
}
