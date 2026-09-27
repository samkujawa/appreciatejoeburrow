import type { Clip } from '../data/clips';
import type { Post } from '../data/posts';
import { orderWall, type WallItem } from '../lib/order';
import { isFatalPlayerError, pickStartSeconds, watchUrl } from '../lib/playback';
import type { SeenStore } from '../lib/seen';
import { loadXWidgets } from '../lib/x-widgets';
import { loadYouTubeApi } from '../lib/youtube-api';
import { createClipTile, createPostTile, setTileState, type TileElements } from './tile';

export interface WallOptions {
  preloadMargin: string;
  apiTimeoutMs: number;
  endBufferSeconds: number;
  startPaused: boolean;
  /** A video off screen this long is torn down back to its thumbnail to free memory. */
  unmountAfterMs: number;
  /** Tiles added per batch; the next batch loads as the visitor nears the end of the wall. */
  batchSize: number;
  /** Tracks what this visitor has seen so the next visit leads with fresh tiles. */
  seen: SeenStore;
  /** Called whenever the number of tiles (shown plus not yet loaded) changes. */
  onTileCountChange?: (count: number) => void;
}

interface BaseTile extends TileElements {
  id: string;
  mounting: boolean;
  ready: boolean;
  visible: boolean;
}

interface ClipTile extends BaseTile {
  kind: 'clip';
  clip: Clip;
  player: YT.Player | null;
  /** Pending teardown for a player that has scrolled away; cleared if it comes back. */
  unmountTimer: number | null;
}

/** X embeds are click-to-play, so post tiles only need mounting, never pausing. */
interface PostTile extends BaseTile {
  kind: 'post';
  post: Post;
}

type Tile = ClipTile | PostTile;

export interface Wall {
  /** Shuffles the clips and posts and rebuilds every tile. */
  render(): void;
  setPaused(paused: boolean): void;
  setPageHidden(hidden: boolean): void;
  destroy(): void;
}

/**
 * YouTube turns captions on for muted players, which clutters small tiles.
 * `unloadModule` isn't in the documented API, so call it only if it exists.
 */
function hideCaptions(player: YT.Player): void {
  const unload = (player as { unloadModule?: (name: string) => void }).unloadModule;
  unload?.call(player, 'captions');
}

export function createWall(
  root: HTMLElement,
  clips: readonly Clip[],
  posts: readonly Post[],
  options: WallOptions,
): Wall {
  let tiles: Tile[] = [];
  let columns: HTMLElement[] = [];
  /** The full reading order for this render; `tiles` holds the ones already added. */
  let order: WallItem[] = [];
  let nextIndex = 0;
  let paused = options.startPaused;
  let pageHidden = document.hidden;
  // Bumped on every render so async work from an old layout can tell it's stale.
  let generation = 0;

  const byElement = new WeakMap<Element, Tile>();
  const observer = new IntersectionObserver(handleIntersections, {
    rootMargin: options.preloadMargin,
  });
  // Marks tiles as seen only once they're genuinely on screen, not just preloading.
  const seenObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const tile = byElement.get(entry.target);
        if (tile) options.seen.add(tile.id);
        seenObserver.unobserve(entry.target);
      }
    },
    { threshold: 0.5 },
  );
  // Loads the next batch as the visitor approaches the end of the wall.
  const sentinel = document.createElement('div');
  sentinel.className = 'wall-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  root.after(sentinel);
  const batchObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) addBatch();
    },
    { rootMargin: '1200px 0px' },
  );
  batchObserver.observe(sentinel);
  // Column count follows the wall's width; rebuild only when it actually changes.
  const resizeObserver = new ResizeObserver(() => {
    if (order.length > 0 && columnCount() !== columns.length) layout();
  });
  resizeObserver.observe(root);

  function shouldPlay(tile: ClipTile): boolean {
    return !paused && !pageHidden && tile.visible;
  }

  function syncPlayback(tile: Tile): void {
    if (tile.kind !== 'clip' || !tile.player || !tile.ready) return;
    if (shouldPlay(tile)) tile.player.playVideo();
    else tile.player.pauseVideo();
  }

  function seekToRandomPoint(player: YT.Player): void {
    const start = pickStartSeconds(player.getDuration(), options.endBufferSeconds);
    player.seekTo(start, true);
  }

  function handleIntersections(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const tile = byElement.get(entry.target);
      if (!tile) continue;
      tile.visible = entry.isIntersecting;
      if (tile.kind === 'clip') scheduleUnmount(tile);
      if (tile.visible && !tile.ready && !tile.mounting) {
        if (tile.kind === 'clip' && !tile.player) void mountPlayer(tile);
        else if (tile.kind === 'post') void mountPost(tile);
      }
      syncPlayback(tile);
    }
  }

  /**
   * Long walls would otherwise pile up dozens of paused players. Once a video has been off screen
   * for a while, destroy it and show the thumbnail again; it remounts when scrolled back to.
   */
  function scheduleUnmount(tile: ClipTile): void {
    if (tile.unmountTimer !== null) window.clearTimeout(tile.unmountTimer);
    tile.unmountTimer = null;
    if (tile.visible || !tile.player) return;
    tile.unmountTimer = window.setTimeout(() => {
      tile.unmountTimer = null;
      if (tile.visible) return;
      unmountPlayer(tile);
    }, options.unmountAfterMs);
  }

  function unmountPlayer(tile: ClipTile): void {
    const frame = tile.player?.getIframe().parentElement ?? null;
    try {
      tile.player?.destroy();
    } catch {
      // Player may already be torn down by YouTube; nothing to clean up.
    }
    tile.player = null;
    tile.ready = false;
    tile.mounting = false;
    // The API replaced the mount element with its iframe, so give the next player a fresh one.
    if (frame) {
      const mount = document.createElement('div');
      frame.replaceChildren(mount);
      tile.mount = mount;
    }
    setTileState(tile.root, 'idle');
  }

  async function mountPlayer(tile: ClipTile): Promise<void> {
    const gen = generation;
    tile.mounting = true;
    setTileState(tile.root, 'loading');

    let api: typeof YT;
    try {
      api = await loadYouTubeApi(options.apiTimeoutMs);
    } catch (error) {
      console.warn(error);
      if (gen === generation) setTileState(tile.root, 'offline');
      tile.mounting = false;
      return;
    }
    if (gen !== generation) return;

    tile.player = new api.Player(tile.mount, {
      host: 'https://www.youtube-nocookie.com',
      videoId: tile.clip.id,
      playerVars: {
        autoplay: 0,
        cc_load_policy: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        mute: 1,
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: ({ target }) => {
          if (gen !== generation) return;
          target.mute();
          hideCaptions(target);
          target.getIframe().title = tile.clip.title;
          target.getIframe().tabIndex = -1;
          seekToRandomPoint(target);
          tile.ready = true;
          tile.mounting = false;
          setTileState(tile.root, 'ready');
          syncPlayback(tile);
        },
        onStateChange: ({ target, data }) => {
          if (gen !== generation) return;
          if (data === api.PlayerState.ENDED) {
            // Loop by jumping to a fresh random moment instead of restarting at 0:00.
            seekToRandomPoint(target);
            syncPlayback(tile);
          } else if (data === api.PlayerState.PLAYING) {
            // The captions module can load after onReady, so unload it again once playing.
            hideCaptions(target);
            tile.link.href = watchUrl(tile.clip.id, Math.floor(target.getCurrentTime()));
          }
        },
        onError: ({ data }) => {
          if (gen !== generation) return;
          if (isFatalPlayerError(data)) removeTile(tile);
        },
      },
    });
  }

  async function mountPost(tile: PostTile): Promise<void> {
    const gen = generation;
    tile.mounting = true;
    setTileState(tile.root, 'loading');

    try {
      const x = await loadXWidgets(options.apiTimeoutMs);
      if (gen !== generation) return;
      const embed = await x.widgets.createTweet(tile.post.id, tile.mount, {
        theme: 'dark',
        dnt: true,
        conversation: 'none',
        align: 'center',
      });
      if (gen !== generation) return;
      if (!embed) {
        // Deleted, private or otherwise unavailable.
        removeTile(tile);
        return;
      }
      tile.ready = true;
      setTileState(tile.root, 'ready');
    } catch (error) {
      console.warn(error);
      if (gen === generation) setTileState(tile.root, 'offline');
    } finally {
      tile.mounting = false;
    }
  }

  function destroyTile(tile: Tile): void {
    observer.unobserve(tile.root);
    seenObserver.unobserve(tile.root);
    if (tile.kind !== 'clip') return;
    if (tile.unmountTimer !== null) window.clearTimeout(tile.unmountTimer);
    tile.unmountTimer = null;
    try {
      tile.player?.destroy();
    } catch {
      // Player may already be torn down by YouTube; nothing to clean up.
    }
    tile.player = null;
  }

  function remainingCount(): number {
    return tiles.length + (order.length - nextIndex);
  }

  function removeTile(tile: Tile): void {
    destroyTile(tile);
    tile.root.remove();
    tiles = tiles.filter((t) => t !== tile);
    options.onTileCountChange?.(remainingCount());
  }

  function columnCount(): number {
    const style = getComputedStyle(root);
    const min = parseFloat(style.getPropertyValue('--tile-min')) || 340;
    const gap = parseFloat(style.columnGap) || 0;
    const width = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return Math.max(1, Math.floor((width + gap) / (min + gap)));
  }

  /** The column whose bottom is highest, so tiles fill in roughly row by row. */
  function shortestColumn(): HTMLElement {
    return columns.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a));
  }

  function buildTile(item: WallItem): Tile {
    const fresh = { mounting: false, ready: false, visible: false };
    const tile: Tile =
      item.kind === 'clip'
        ? {
            ...createClipTile(item.clip),
            ...fresh,
            id: item.clip.id,
            kind: 'clip',
            clip: item.clip,
            player: null,
            unmountTimer: null,
          }
        : {
            ...createPostTile(item.post),
            ...fresh,
            id: item.post.id,
            kind: 'post',
            post: item.post,
          };
    byElement.set(tile.root, tile);
    return tile;
  }

  function addBatch(): void {
    if (nextIndex >= order.length || columns.length === 0) return;
    const batch = order.slice(nextIndex, nextIndex + options.batchSize);
    nextIndex += batch.length;
    for (const item of batch) {
      const tile = buildTile(item);
      tiles.push(tile);
      shortestColumn().append(tile.root);
      observer.observe(tile.root);
      seenObserver.observe(tile.root);
    }
  }

  /** Clears the wall and lays out `order` from the top in the current number of columns. */
  function layout(): void {
    generation += 1;
    tiles.forEach(destroyTile);
    tiles = [];
    nextIndex = 0;
    root.setAttribute('aria-busy', 'true');

    columns = Array.from({ length: columnCount() }, () => {
      const col = document.createElement('div');
      col.className = 'wall__col';
      return col;
    });
    root.replaceChildren(...columns);
    addBatch();

    root.setAttribute('aria-busy', 'false');
    options.onTileCountChange?.(remainingCount());
  }

  function render(): void {
    // Lead with a full row of videos, and at least a few on narrow screens with one column.
    const leadClips = Math.max(columnCount(), 3);
    order = orderWall(clips, posts, { seen: options.seen.load(), leadClips });
    layout();
  }

  return {
    render,
    setPaused(value) {
      paused = value;
      tiles.forEach(syncPlayback);
    },
    setPageHidden(value) {
      pageHidden = value;
      tiles.forEach(syncPlayback);
    },
    destroy() {
      generation += 1;
      tiles.forEach(destroyTile);
      observer.disconnect();
      seenObserver.disconnect();
      batchObserver.disconnect();
      resizeObserver.disconnect();
      sentinel.remove();
      tiles = [];
      order = [];
      root.replaceChildren();
    },
  };
}
