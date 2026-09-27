import type { Clip } from '../data/clips';
import type { Post } from '../data/posts';
import { thumbnailUrl, watchUrl } from '../lib/playback';
import { postUrl } from '../lib/x-widgets';

export type TileState = 'idle' | 'loading' | 'ready' | 'offline';

export interface TileElements {
  root: HTMLElement;
  /** Placeholder the YouTube player or X embed is rendered into. */
  mount: HTMLElement;
  link: HTMLAnchorElement;
}

function createLink(href: string, title: string, destination: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'tile__link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.append(title);
  const hint = document.createElement('span');
  hint.className = 'visually-hidden';
  hint.textContent = ` (opens ${destination} in a new tab)`;
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = ' ↗';
  link.append(hint, arrow);
  return link;
}

export interface ClipTileElements extends TileElements {
  /** Toggles this video's sound. Its aria-pressed reflects whether the tile is audible. */
  sound: HTMLButtonElement;
  /**
   * Transparent layer over the player. It keeps pointer events in this page (the YouTube iframe
   * would swallow them, breaking hover sound between tiles), hides YouTube's hover chrome, and
   * makes a click or tap anywhere on the video toggle its sound. Not focusable: `sound` is the
   * accessible control.
   */
  hit: HTMLElement;
}

// Static speaker icons; CSS shows one or the other based on the button's aria-pressed.
const SPEAKER_ICONS = `
<svg class="tile__sound-off" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>
  <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
<svg class="tile__sound-on" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>
  <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round"/>
</svg>`;

export function createClipTile(clip: Clip): ClipTileElements {
  const root = document.createElement('article');
  root.className = 'tile tile--clip';
  root.dataset.videoId = clip.id;
  setTileState(root, 'idle');

  const thumb = document.createElement('img');
  thumb.className = 'tile__thumb';
  thumb.src = thumbnailUrl(clip.id);
  thumb.alt = '';
  thumb.loading = 'lazy';
  thumb.decoding = 'async';
  thumb.addEventListener(
    'error',
    () => {
      thumb.remove();
    },
    { once: true },
  );

  const frame = document.createElement('div');
  frame.className = 'tile__frame';
  const mount = document.createElement('div');
  frame.append(mount);

  const hit = document.createElement('div');
  hit.className = 'tile__hit';
  hit.setAttribute('aria-hidden', 'true');

  const sound = document.createElement('button');
  sound.type = 'button';
  sound.className = 'tile__sound';
  sound.setAttribute('aria-pressed', 'false');
  sound.setAttribute('aria-label', `Sound: ${clip.title}`);
  sound.innerHTML = SPEAKER_ICONS;

  const link = createLink(watchUrl(clip.id), clip.title, 'YouTube');
  root.append(thumb, frame, hit, sound, link);
  return { root, mount, link, sound, hit };
}

export function createPostTile(post: Post): TileElements {
  const root = document.createElement('article');
  root.className = 'tile tile--post';
  root.dataset.postId = post.id;
  root.setAttribute('aria-label', post.title);
  setTileState(root, 'idle');

  const mount = document.createElement('div');
  mount.className = 'tile__post';

  // Shown until the embed renders, and kept if X can't be reached.
  const link = createLink(postUrl(post.id), post.title, 'X');
  root.append(mount, link);
  return { root, mount, link };
}

export function setTileState(root: HTMLElement, state: TileState): void {
  root.dataset.state = state;
}
