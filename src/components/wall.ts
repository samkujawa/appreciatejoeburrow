import type { Clip } from '../data/clips';
import type { Post } from '../data/posts';
import { orderWall, type WallItem } from '../lib/order';
import { isFatalPlayerError, pickStartSeconds, watchUrl } from '../lib/playback';
import type { SeenStore } from '../lib/seen';
import { loadXWidgets } from '../lib/x-widgets';
import { loadYouTubeApi } from '../lib/youtube-api';
import {
  addTileBadge,
  createClipTile,
  createPostTile,
  setTileState,
  type ClipTileElements,
  type TileElements,
} from './tile';

export interface WallOptions {
  preloadMargin: string;
  apiTimeoutMs: number;
  endBufferSeconds: number;
  startPaused: boolean;
  /** An embed must stay on screen this long before it loads, so fast scrolling skips it. */
  mountDelayMs: number;
  /** An embed off screen this long is torn down (video back to its thumbnail) to free memory. */
  unmountAfterMs: number;
  /**
   * Most embeds (YouTube players plus X posts) alive per column. Each one is a full page in an
   * iframe; iOS Safari kills the tab ("A problem repeatedly occurred") well before desktops do.
   */
  maxEmbedsPerColumn: number;
  /** Tiles added per batch; the next batch loads as the visitor nears the end of the wall. */
  batchSize: number;
  /** Tracks what this visitor has seen so the next visit leads with fresh tiles. */
  seen: SeenStore;
  /** IDs pinned to the top of the wall with a label (the last game), in order. */
  pinned?: { ids: readonly string[]; label: string };
  /** Called whenever the number of tiles (shown plus not yet loaded) changes. */
  onTileCountChange?: (count: number) => void;
}

interface BaseTile extends TileElements {
  id: string;
  /** An embed (player or X post) exists or is being created. */
  live: boolean;
  ready: boolean;
  visible: boolean;
  /** Bumped on every unmount, so an in-flight mount can tell it was cancelled. */
  epoch: number;
  /** When the tile last left the screen, for evicting the longest-gone embeds first. */
  hiddenSince: number;
  /** Pending mount, waiting to see if the tile stays on screen. */
  mountTimer: number | null;
  /** Pending teardown for an embed that has scrolled away; cleared if it comes back. */
  unmountTimer: number | null;
}

interface ClipTile extends BaseTile, ClipTileElements {
  kind: 'clip';
  clip: Clip;
  player: YT.Player | null;
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
  /** Desktop mode where hovering a video plays its sound. Enable it from a click (see README). */
  setHoverSound(enabled: boolean): void;
  /** Mutes whichever video currently has sound. */
  muteAll(): void;
  /** Adds every remaining tile now, so anchors below the wall (like #about) stay put. */
  loadAll(): void;
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
  /** The one video allowed to play sound; everything else stays muted. */
  let soundTile: ClipTile | null = null;
  let hoverSound = false;
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
    // Turning a video's sound on also plays it, even while everything else is paused.
    return (!paused || tile === soundTile) && !pageHidden && tile.visible;
  }

  /** Mutes or unmutes a tile's player to match `soundTile`, and updates its button. */
  function applySound(tile: ClipTile): void {
    const audible = tile === soundTile;
    tile.sound.setAttribute('aria-pressed', String(audible));
    tile.root.classList.toggle('tile--audible', audible);
    if (!tile.player || !tile.ready) return;
    if (audible) {
      tile.player.unMute();
      tile.player.setVolume(100);
    } else {
      tile.player.mute();
    }
  }

  function setSoundTile(tile: ClipTile | null): void {
    const previous = soundTile;
    if (previous === tile) return;
    soundTile = tile;
    for (const t of [previous, tile]) {
      if (!t) continue;
      applySound(t);
      syncPlayback(t);
    }
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
      clearTimers(tile);
      if (tile.visible) {
        scheduleMount(tile);
      } else {
        tile.hiddenSince = performance.now();
        // Sound follows what's on screen: a video that scrolls away goes quiet.
        if (tile === soundTile) setSoundTile(null);
        scheduleUnmount(tile);
      }
      syncPlayback(tile);
    }
  }

  function clearTimers(tile: Tile): void {
    if (tile.mountTimer !== null) window.clearTimeout(tile.mountTimer);
    if (tile.unmountTimer !== null) window.clearTimeout(tile.unmountTimer);
    tile.mountTimer = null;
    tile.unmountTimer = null;
  }

  /** Mounts a tile's embed once it has stayed on screen briefly, making room under the cap. */
  function scheduleMount(tile: Tile): void {
    if (tile.live) return;
    tile.mountTimer = window.setTimeout(() => {
      tile.mountTimer = null;
      if (!tile.visible || tile.live) return;
      makeRoom();
      if (tile.kind === 'clip') void mountPlayer(tile);
      else void mountPost(tile);
    }, options.mountDelayMs);
  }

  /**
   * Long walls would otherwise pile up dozens of embeds. Once one has been off screen for a
   * while, tear it down; it mounts again when scrolled back to.
   */
  function scheduleUnmount(tile: Tile): void {
    if (!tile.live) return;
    tile.unmountTimer = window.setTimeout(() => {
      tile.unmountTimer = null;
      if (!tile.visible) unmountEmbed(tile);
    }, options.unmountAfterMs);
  }

  /** Enforces the embed cap by tearing down off-screen embeds, longest gone first. */
  function makeRoom(): void {
    const cap = options.maxEmbedsPerColumn * Math.max(1, columns.length);
    const live = tiles.filter((t) => t.live);
    if (live.length < cap) return;
    const evictable = live.filter((t) => !t.visible).sort((a, b) => a.hiddenSince - b.hiddenSince);
    for (const tile of evictable.slice(0, live.length - cap + 1)) unmountEmbed(tile);
  }

  function unmountEmbed(tile: Tile): void {
    clearTimers(tile);
    tile.epoch += 1;
    tile.live = false;
    tile.ready = false;
    if (tile.kind === 'clip') {
      unmountPlayer(tile);
    } else {
      // Hold the rendered height so the page doesn't jump when posts above the viewport unload.
      const height = tile.root.offsetHeight;
      if (height > 0) tile.root.style.minHeight = `${height}px`;
      tile.mount.replaceChildren();
    }
    setTileState(tile.root, 'idle');
  }

  function unmountPlayer(tile: ClipTile): void {
    if (tile === soundTile) setSoundTile(null);
    const frame = tile.player?.getIframe().parentElement ?? null;
    try {
      tile.player?.destroy();
    } catch {
      // Player may already be torn down by YouTube; nothing to clean up.
    }
    tile.player = null;
    // The API replaced the mount element with its iframe, so give the next player a fresh one.
    if (frame) {
      const mount = document.createElement('div');
      frame.replaceChildren(mount);
      tile.mount = mount;
    }
  }

  async function mountPlayer(tile: ClipTile): Promise<void> {
    const gen = generation;
    const epoch = tile.epoch;
    const current = (): boolean => gen === generation && epoch === tile.epoch;
    tile.live = true;
    setTileState(tile.root, 'loading');

    let api: typeof YT;
    try {
      api = await loadYouTubeApi(options.apiTimeoutMs);
    } catch (error) {
      console.warn(error);
      if (current()) {
        tile.live = false;
        setTileState(tile.root, 'offline');
      }
      return;
    }
    if (!current()) return;

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
          if (!current()) return;
          target.mute();
          hideCaptions(target);
          target.getIframe().title = tile.clip.title;
          target.getIframe().tabIndex = -1;
          seekToRandomPoint(target);
          tile.ready = true;
          setTileState(tile.root, 'ready');
          // Sound may have been turned on while the player was still loading.
          applySound(tile);
          syncPlayback(tile);
        },
        onStateChange: ({ target, data }) => {
          if (!current()) return;
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
          if (!current()) return;
          if (isFatalPlayerError(data)) removeTile(tile);
        },
      },
    });
  }

  async function mountPost(tile: PostTile): Promise<void> {
    const gen = generation;
    const epoch = tile.epoch;
    const current = (): boolean => gen === generation && epoch === tile.epoch;
    tile.live = true;
    setTileState(tile.root, 'loading');

    try {
      const x = await loadXWidgets(options.apiTimeoutMs);
      if (!current()) return;
      // Render into a fresh container so a cancelled mount can't leave an embed behind.
      const container = document.createElement('div');
      tile.mount.replaceChildren(container);
      const embed = await x.widgets.createTweet(tile.post.id, container, {
        theme: 'dark',
        dnt: true,
        conversation: 'none',
        align: 'center',
      });
      if (!current()) {
        container.remove();
        return;
      }
      if (!embed) {
        // Deleted, private or otherwise unavailable.
        removeTile(tile);
        return;
      }
      tile.ready = true;
      tile.root.style.minHeight = '';
      setTileState(tile.root, 'ready');
    } catch (error) {
      console.warn(error);
      if (current()) {
        tile.live = false;
        setTileState(tile.root, 'offline');
      }
    }
  }

  function destroyTile(tile: Tile): void {
    observer.unobserve(tile.root);
    seenObserver.unobserve(tile.root);
    clearTimers(tile);
    tile.epoch += 1;
    tile.live = false;
    if (tile.kind !== 'clip') return;
    if (tile === soundTile) soundTile = null;
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
    const fresh = {
      live: false,
      ready: false,
      visible: false,
      epoch: 0,
      hiddenSince: 0,
      mountTimer: null,
      unmountTimer: null,
    };
    const tile: Tile =
      item.kind === 'clip'
        ? {
            ...createClipTile(item.clip),
            ...fresh,
            id: item.clip.id,
            kind: 'clip',
            clip: item.clip,
            player: null,
          }
        : {
            ...createPostTile(item.post),
            ...fresh,
            id: item.post.id,
            kind: 'post',
            post: item.post,
          };
    byElement.set(tile.root, tile);
    if (options.pinned?.ids.includes(tile.id)) addTileBadge(tile.root, options.pinned.label);
    if (tile.kind === 'clip') wireSound(tile);
    return tile;
  }

  function wireSound(tile: ClipTile): void {
    const toggle = (): void => {
      setSoundTile(soundTile === tile ? null : tile);
    };
    tile.sound.addEventListener('click', toggle);
    tile.hit.addEventListener('click', toggle);
    // Hover mode only ever runs with a mouse; touch taps fire pointer events too. The tile's `hit`
    // layer keeps these events in this page instead of inside YouTube's iframe.
    tile.root.addEventListener('pointerenter', (event) => {
      if (hoverSound && event.pointerType === 'mouse') setSoundTile(tile);
    });
    tile.root.addEventListener('pointerleave', (event) => {
      if (hoverSound && event.pointerType === 'mouse' && soundTile === tile) setSoundTile(null);
    });
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
    order = orderWall(clips, posts, {
      seen: options.seen.load(),
      leadClips,
      pinned: options.pinned?.ids ?? [],
    });
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
    setHoverSound(enabled) {
      hoverSound = enabled;
      if (!enabled) setSoundTile(null);
    },
    muteAll() {
      setSoundTile(null);
    },
    loadAll() {
      while (nextIndex < order.length && columns.length > 0) addBatch();
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
