import '@fontsource/big-shoulders-display/latin-900';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles/index.css';

import { createWall } from './components/wall';
import { CONFIG } from './config';
import { CLIPS } from './data/clips';
import { LAST_GAME } from './data/last-game';
import { POSTS } from './data/posts';
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
  img.addEventListener('error', () => {
    img.remove();
  });
  requireElement('.masthead', HTMLElement).prepend(img);
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

  renderPhoto();
  updateToggle();
  updateHoverSound();
  wall.render();
}

init();
