import '@fontsource/big-shoulders-display/latin-900';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles/index.css';

import { initAppreciate } from './components/appreciate';
import { initGameDay } from './components/gameday';
import { initJoeCool } from './lib/joe-cool';
import { createWall } from './components/wall';
import { CONFIG } from './config';
import { CLIPS } from './data/clips';
import { LAST_GAME } from './data/last-game';
import { POSTS } from './data/posts';
import { SCHEDULE } from './data/schedule';
import { isLastGameCurrent } from './lib/last-game';
import { createSeenStore } from './lib/seen';

function requireElement<T extends HTMLElement>(selector: string, type: new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`Missing required element: ${selector}`);
  return el;
}

function renderPhoto(): void {
  if (!CONFIG.photoSrc) return;
  const img = document.createElement('img');
  img.className = 'masthead__photo';
  img.src = CONFIG.photoSrc;
  img.alt = 'Joe Burrow';
  img.width = 128;
  img.height = 128;
  const wrap = document.createElement('span');
  wrap.className = 'masthead__photo-wrap';
  // Sunglasses for Joe Cool mode; CSS shows them only when the mode is on.
  wrap.innerHTML = `<svg class="masthead__shades" viewBox="0 0 100 34" aria-hidden="true">
    <path d="M2 4h96v6H2z" fill="#0b0b0b"/>
    <path d="M5 8h40c0 14-8 24-20 24S5 22 5 8zM55 8h40c0 14-8 24-20 24S55 22 55 8z" fill="#0b0b0b"/>
    <path d="M12 13l8-2M62 13l8-2" stroke="#9fe3ff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
  img.addEventListener('error', () => {
    wrap.remove();
  });
  wrap.prepend(img);
  requireElement('.masthead', HTMLElement).prepend(wrap);
}

function init(): void {
  const wallEl = requireElement('#wall', HTMLElement);
  const status = requireElement('#wall-status', HTMLParagraphElement);
  const reshuffle = requireElement('#reshuffle', HTMLButtonElement);
  const togglePlay = requireElement('#toggle-play', HTMLButtonElement);
  const hoverSoundToggle = requireElement('#hover-sound', HTMLButtonElement);
  const lastGameBanner = requireElement('#last-game', HTMLParagraphElement);

  const lastGame = isLastGameCurrent(LAST_GAME, new Date(), CONFIG.lastGameDays) ? LAST_GAME : null;
  if (lastGame) {
    lastGameBanner.querySelector('.last-game__label')?.append(lastGame.label);
    lastGameBanner.querySelector('.last-game__result')?.append(lastGame.result);
    lastGameBanner.hidden = false;
  }

  // Motion-sensitive visitors, and phones in data-saver mode, start paused; they can press play.
  const saveData =
    (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches || saveData;
  let hoverSound = false;

  const wall = createWall(wallEl, CLIPS, POSTS, {
    preloadMargin: CONFIG.preloadMargin,
    apiTimeoutMs: CONFIG.apiTimeoutMs,
    endBufferSeconds: CONFIG.endBufferSeconds,
    startPaused: paused,
    mountDelayMs: CONFIG.mountDelayMs,
    unmountAfterMs: CONFIG.unmountAfterMs,
    maxEmbedsPerColumn: CONFIG.maxEmbedsPerColumn,
    batchSize: CONFIG.batchSize,
    seen: createSeenStore(CONFIG.seenMemory),
    ...(lastGame ? { pinned: { ids: lastGame.ids, label: 'Last game' } } : {}),
    onTileCountChange: (count) => {
      status.hidden = count > 0;
      status.textContent = count > 0 ? '' : 'No highlights could be loaded. Try again later.';
    },
  });

  function updateToggle(): void {
    togglePlay.textContent = paused ? 'Play all' : 'Pause all';
    togglePlay.setAttribute('aria-pressed', String(paused));
  }

  function updateHoverSound(): void {
    hoverSoundToggle.textContent = `Sound on hover: ${hoverSound ? 'on' : 'off'}`;
    hoverSoundToggle.setAttribute('aria-pressed', String(hoverSound));
  }

  reshuffle.addEventListener('click', () => {
    wall.render();
  });
  togglePlay.addEventListener('click', () => {
    paused = !paused;
    wall.setPaused(paused);
    updateToggle();
  });
  // Browsers only allow sound after the visitor clicks or taps something, so hover sound is an
  // opt-in switch: the click that turns it on is what unlocks audio. Not remembered across
  // visits for the same reason. The button is hidden on touch screens (see base.css).
  hoverSoundToggle.addEventListener('click', () => {
    hoverSound = !hoverSound;
    wall.setHoverSound(hoverSound);
    updateHoverSound();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') wall.muteAll();
  });
  document.addEventListener('visibilitychange', () => {
    wall.setPageHidden(document.hidden);
  });

  const countBox = requireElement('#appreciate-count', HTMLParagraphElement);
  initAppreciate({
    button: requireElement('#appreciate', HTMLButtonElement),
    countBox,
    total: requireElement('.appreciate__total', HTMLElement),
    mine: requireElement('.appreciate__mine', HTMLElement),
  });

  // Links to #about sit below an ever-growing wall; load it all first so the jump lands.
  function goToAbout(): void {
    wall.loadAll();
    document.querySelector('#about')?.scrollIntoView();
  }
  document.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest('a[href="#about"]');
    if (!link) return;
    event.preventDefault();
    history.replaceState(null, '', '#about');
    goToAbout();
  });

  initJoeCool();
  initGameDay(requireElement('#gameday', HTMLParagraphElement), SCHEDULE);
  renderPhoto();
  updateToggle();
  updateHoverSound();
  wall.render();
  if (location.hash === '#about') goToAbout();
}

init();
