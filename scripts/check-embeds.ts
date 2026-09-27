/**
 * Browser-side clip check, served by the dev server at /check.html.
 *
 * YouTube's oEmbed endpoint (scripts/check-clips.ts) only catches removed or private videos.
 * Many uploads, including most NFL-owned ones, pass oEmbed but refuse to play on other sites
 * (player error 150). The only reliable test is starting a real embedded player, which is
 * what this does.
 */
import { CLIPS, type Clip } from '../src/data/clips';
import { loadYouTubeApi } from '../src/lib/youtube-api';

const TIMEOUT_MS = 15_000;
const BATCH_SIZE = 6;

type Outcome = 'plays' | `error ${number}` | 'timed out';

function checkClip(api: typeof YT, host: HTMLElement, clip: Clip): Promise<Outcome> {
  return new Promise((resolve) => {
    const mount = document.createElement('div');
    host.append(mount);
    let settled = false;

    const finish = (outcome: Outcome): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        player.destroy();
      } catch {
        // Already torn down.
      }
      resolve(outcome);
    };

    const timer = window.setTimeout(() => {
      finish('timed out');
    }, TIMEOUT_MS);

    const player = new api.Player(mount, {
      host: 'https://www.youtube-nocookie.com',
      width: 160,
      height: 90,
      videoId: clip.id,
      playerVars: { mute: 1, playsinline: 1 },
      events: {
        onReady: ({ target }) => {
          target.mute();
          target.playVideo();
        },
        onStateChange: ({ data }) => {
          if (data === api.PlayerState.PLAYING) finish('plays');
        },
        onError: ({ data }) => {
          finish(`error ${data}`);
        },
      },
    });
  });
}

async function run(): Promise<void> {
  const log = document.querySelector('#log');
  const host = document.querySelector<HTMLElement>('#players');
  if (!log || !host) return;

  const api = await loadYouTubeApi(TIMEOUT_MS);
  log.textContent = '';
  let failures = 0;

  for (let i = 0; i < CLIPS.length; i += BATCH_SIZE) {
    const batch = CLIPS.slice(i, i + BATCH_SIZE);
    const outcomes = await Promise.all(batch.map((clip) => checkClip(api, host, clip)));
    batch.forEach((clip, j) => {
      const outcome = outcomes[j] ?? 'timed out';
      const ok = outcome === 'plays';
      if (!ok) failures += 1;
      const line = document.createElement('span');
      line.className = ok ? 'ok' : 'fail';
      line.textContent = `${ok ? '✔' : '✘'} ${clip.id}  ${clip.title.padEnd(44)} ${outcome}\n`;
      log.append(line);
    });
  }

  log.append(`\n${CLIPS.length - failures}/${CLIPS.length} clips play when embedded.\n`);
  document.title = failures === 0 ? '✔ Clip check' : `✘ ${failures} failing · Clip check`;
}

void run();
