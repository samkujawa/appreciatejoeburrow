# AppreciateJoeBurrow.com

A wall of Joe Burrow highlights — YouTube videos playing all at once, mixed with NFL clips from X —
in a different order every visit.

Static site built with Vite and TypeScript. No framework, no backend, no tracking.

## Getting started

```sh
nvm use          # Node 22
npm install
npm run dev      # http://localhost:5173
```

| Script                | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | Local dev server with hot reload                    |
| `npm run build`       | Type-checks, then builds to `dist/`                 |
| `npm run preview`     | Serves the production build locally                 |
| `npm test`            | Unit tests (Vitest)                                 |
| `npm run lint`        | ESLint with strict type-checked rules               |
| `npm run format`      | Prettier                                            |
| `npm run check:clips` | Confirms every YouTube clip and X post still exists |
| `npm run ci`          | Everything CI runs, in order                        |

## How it works

- **Shuffle and mix.** `src/data/clips.ts` holds the YouTube videos and `src/data/posts.ts` the X
  posts (video and photo posts). Each list is shuffled (Fisher–Yates) on every load and whenever
  someone presses **Reshuffle the wall** (`lib/order.ts`). The first row is always videos (at
  least three on narrow screens); after that, posts are spread evenly between the videos.
- **Fresh every visit.** Tiles a visitor actually sees (half on screen) are remembered in their
  browser's `localStorage` (`lib/seen.ts`, last 60), and pushed behind unseen tiles on the next
  visit or reshuffle. Nothing leaves the browser; without storage it's a plain shuffle.
- **Masonry layout.** `components/wall.ts` builds the columns itself, adding each tile to the
  shortest column, so the reading order runs across rows (CSS `columns` would fill top to bottom
  and put random tiles in the first row). The column count follows the wall's width and the
  layout is rebuilt only when that count changes.
- **Why both.** Most NFL-owned YouTube uploads refuse to play on other sites (player error 150),
  so NFL-era single plays come from the NFL's own X posts instead. X embeds are click-to-play,
  so the YouTube tiles provide the constant motion.
- **Players.** Each tile uses the YouTube IFrame Player API on `youtube-nocookie.com`, muted with
  no controls. When a player is ready it jumps to a random point in the video, so long
  compilations show different plays each visit. When a video ends it jumps to a new random
  point instead of restarting at 0:00.
- **Performance.** Tiles are added in batches of 24 as the visitor nears the end of the wall.
  Players are only created when a tile scrolls within 300px of the viewport, pause when they
  leave the screen or the tab is hidden, and are destroyed back to their thumbnail after 20
  seconds off screen, so scrolling through ~100 videos never leaves ~100 players alive. All of
  these numbers are in `src/config.ts`.
- **Broken tiles remove themselves.** If YouTube reports a video as removed, private or not
  embeddable (error codes 2, 5, 100, 101, 150), or X can't render a post, that tile is removed.
- **X posts load lazily.** X's `widgets.js` is only fetched once a post scrolls near the screen,
  with Do Not Track set.
- **Offline fallback.** Each tile shows the video thumbnail until its player is ready. If
  YouTube's player script can't load (blocked by an extension, network issue), tiles keep the
  thumbnail and show a "watch on YouTube" link.
- **Accessibility.** There's a **Pause all** control (auto-playing video needs one), visitors
  with reduced motion turned on start paused, tile links are keyboard reachable, and titles stay
  visible on touch screens.

## Editing the clips and posts

YouTube videos go in `src/data/clips.ts`. The `id` is the part after `v=` in the URL:

```ts
{ id: '548KO30-UBs', title: '"It Is Us" · NFL Films on the 2021 Bengals' },
```

X posts go in `src/data/posts.ts`. The `id` is the number after `/status/`:

```ts
{ id: '2101735938896633876', title: 'Launches it to Chase · 2026' },
```

Then check them:

1. `npm run check:clips` confirms every video and post still exists (and that posts have video).
   A GitHub Action runs this weekly and on any PR that touches either list.
2. For new YouTube videos, also run `npm run dev` and open
   [localhost:5173/check.html](http://localhost:5173/check.html). It starts each video in a real
   embedded player. This is the only way to catch videos that pass step 1 but refuse to play on
   other sites — which is most NFL-channel uploads. The page is dev-only and not deployed.

## Adding a photo

Put an image in `public/` (for example `public/joe-photo.jpg`) and set `photoSrc` in
`src/config.ts` to `'/joe-photo.jpg'`. It shows as a round headshot above the title. Make sure
you have the rights to whatever photo you use.

## Deploying

Set `VITE_SITE_URL` in `.env` to your real domain (it's used for the canonical and Open Graph
tags), then deploy `dist/` anywhere that serves static files.

- **Netlify:** connect the repo. `netlify.toml` sets the build, and `public/_headers` sets the
  security headers.
- **Cloudflare Pages:** build command `npm run build`, output `dist`. Uses `public/_headers`.
- **Vercel:** connect the repo. `vercel.json` sets the build and headers.

### Security headers

The Content Security Policy only allows scripts from this site, `www.youtube.com` (the player
API) and X (`platform.twitter.com`, `cdn.syndication.twimg.com`), frames from
`youtube-nocookie.com` / `youtube.com` / `platform.twitter.com`, and images from `i.ytimg.com`
(thumbnails). The policy lives in `public/_headers`; `vercel.json` repeats it, and a unit test
fails if the two drift apart. `npm run preview` serves these same headers, so check CSP changes
there before deploying.

`Referrer-Policy` is `strict-origin-when-cross-origin` on purpose: YouTube refuses to play
embeds that arrive with no referrer at all.

## Project layout

```
index.html                 Page markup and meta tags
src/
  main.ts                  Wires up the wall, buttons and page visibility
  config.ts                Photo, preload distance, timeouts
  data/clips.ts            YouTube videos
  data/posts.ts            X posts
  components/wall.ts       Tile lifecycle: lazy players, pause/play, removal
  components/tile.ts       Tile DOM
  lib/youtube-api.ts       Loads the IFrame API once
  lib/x-widgets.ts         Loads X's widgets.js once
  lib/mix.ts               Spreads posts evenly between videos
  lib/playback.ts          Random start points, error codes, URLs
  lib/random.ts            Shuffle and seeded RNG
  styles/                  Tokens, base, masthead, wall, footer
public/                    Favicon, OG image, robots.txt, _headers
check.html                 Dev-only real-player embed check (not deployed)
scripts/check-clips.ts     Existence check for every clip and post
scripts/check-embeds.ts    Script behind check.html
scripts/headers.ts         Parses public/_headers (preview server + sync test)
tests/                     Vitest unit tests
```

## Disclaimer

A fan site. Not affiliated with Joe Burrow, the Cincinnati Bengals or the NFL. Videos are
embedded from YouTube and X and belong to their owners.
