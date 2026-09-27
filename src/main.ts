import '@fontsource/big-shoulders-display/latin-900';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles/index.css';

import { createWall } from './components/wall';
import { CONFIG } from './config';
import { CLIPS } from './data/clips';
import { POSTS } from './data/posts';

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

  // Motion-sensitive visitors start paused; they can press play themselves.
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wall = createWall(wallEl, CLIPS, POSTS, {
    preloadMargin: CONFIG.preloadMargin,
    apiTimeoutMs: CONFIG.apiTimeoutMs,
    endBufferSeconds: CONFIG.endBufferSeconds,
    startPaused: paused,
    onTileCountChange: (count) => {
      status.hidden = count > 0;
      status.textContent = count > 0 ? '' : 'No highlights could be loaded. Try again later.';
    },
  });

  function updateToggle(): void {
    togglePlay.textContent = paused ? 'Play all' : 'Pause all';
    togglePlay.setAttribute('aria-pressed', String(paused));
  }

  reshuffle.addEventListener('click', () => {
    wall.render();
  });
  togglePlay.addEventListener('click', () => {
    paused = !paused;
    wall.setPaused(paused);
    updateToggle();
  });
  document.addEventListener('visibilitychange', () => {
    wall.setPageHidden(document.hidden);
  });

  renderPhoto();
  updateToggle();
  wall.render();
}

init();
