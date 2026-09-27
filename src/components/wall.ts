import type { Clip } from '../data/clips';
import type { Post } from '../data/posts';
import { interleave } from '../lib/mix';
import { isFatalPlayerError, pickStartSeconds, watchUrl } from '../lib/playback';
import { shuffle } from '../lib/random';
import { loadXWidgets } from '../lib/x-widgets';
import { loadYouTubeApi } from '../lib/youtube-api';
import { createClipTile, createPostTile, setTileState, type TileElements } from './tile';

export interface WallOptions {
  preloadMargin: string;
  apiTimeoutMs: number;
  endBufferSeconds: number;
  startPaused: boolean;
  /** Called whenever the number of tiles changes (after load or removals). */
  onTileCountChange?: (count: number) => void;
}

interface BaseTile extends TileElements {
  mounting: boolean;
  ready: boolean;
  visible: boolean;
}

interface ClipTile extends BaseTile {
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
  let paused = options.startPaused;
  let pageHidden = document.hidden;
  // Bumped on every render so async work from an old layout can tell it's stale.
  let generation = 0;

  const byElement = new WeakMap<Element, Tile>();
  const observer = new IntersectionObserver(handleIntersections, {
    rootMargin: options.preloadMargin,
  });

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
      if (tile.visible && !tile.ready && !tile.mounting) {
        if (tile.kind === 'clip' && !tile.player) void mountPlayer(tile);
        else if (tile.kind === 'post') void mountPost(tile);
      }
      syncPlayback(tile);
    }
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
    if (tile.kind !== 'clip') return;
    try {
      tile.player?.destroy();
    } catch {
      // Player may already be torn down by YouTube; nothing to clean up.
    }
    tile.player = null;
  }

  function removeTile(tile: Tile): void {
    destroyTile(tile);
    tile.root.remove();
    tiles = tiles.filter((t) => t !== tile);
    options.onTileCountChange?.(tiles.length);
  }

  function track<T extends Tile>(tile: T): T {
    byElement.set(tile.root, tile);
    return tile;
  }

  function render(): void {
    generation += 1;
    tiles.forEach(destroyTile);
    root.setAttribute('aria-busy', 'true');

    const fresh = { mounting: false, ready: false, visible: false };
    tiles = interleave<Tile, Tile>(
      shuffle(clips).map((clip) =>
        track({ ...createClipTile(clip), ...fresh, kind: 'clip', clip, player: null }),
      ),
      shuffle(posts).map((post) =>
        track({ ...createPostTile(post), ...fresh, kind: 'post', post }),
      ),
    );

    root.replaceChildren(...tiles.map((t) => t.root));
    tiles.forEach((t) => {
      observer.observe(t.root);
    });
    root.setAttribute('aria-busy', 'false');
    options.onTileCountChange?.(tiles.length);
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
      tiles = [];
      root.replaceChildren();
    },
  };
}
