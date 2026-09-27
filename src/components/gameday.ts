import type { Game } from '../data/schedule';
import { currentGameDay, formatCountdown, matchup } from '../lib/gameday';

const REFRESH_MS = 30_000;

/**
 * Game-day banner at the top of the page: a kickoff countdown on game day, "Game on" during the
 * game, hidden otherwise. Kickoff is shown in Eastern time.
 */
export function initGameDay(banner: HTMLElement, schedule: readonly Game[]): void {
  // Kickoff in Eastern time, the Bengals' home time zone, as NFL listings show it ("1:00 PM ET").
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
  const tag = banner.querySelector('.gameday__tag');
  const game = banner.querySelector('.gameday__game');
  const detail = banner.querySelector('.gameday__detail');

  function update(): void {
    const state = currentGameDay(schedule, new Date());
    banner.hidden = !state;
    if (!state || !tag || !game || !detail) return;

    banner.dataset.phase = state.phase;
    game.textContent = matchup(state.game);
    const network = state.game.network ? ` · ${state.game.network}` : '';
    if (state.phase === 'live') {
      tag.textContent = 'Game on';
      detail.textContent = `Live now${network}`;
    } else {
      tag.textContent = 'Game day';
      const countdown = formatCountdown(state.kickoff.getTime() - Date.now());
      detail.textContent = `Kickoff ${time.format(state.kickoff)} ET${network} · in ${countdown}`;
    }
  }

  update();
  window.setInterval(update, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) update();
  });
}
