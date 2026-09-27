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

export function createClipTile(clip: Clip): TileElements {
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

  const link = createLink(watchUrl(clip.id), clip.title, 'YouTube');
  root.append(thumb, frame, link);
  return { root, mount, link };
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
