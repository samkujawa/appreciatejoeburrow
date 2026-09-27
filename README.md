# AppreciateJoeBurrow.com

A wall of Joe Burrow highlights; YouTube videos playing all at once, mixed with NFL clips from X —
in a different order every visit.

Built with Vite and TypeScript: a static site plus one tiny Cloudflare Worker for the Appreciate
counter. No framework, no cookies.

## Getting started

```sh
nvm use          # Node 22
npm install
npm run dev      # http://localhost:5173
```

The Appreciate counter needs the Worker. To run it locally too, start `npm run worker:dev` (serves
the built site plus `/api` on http://localhost:8787, needs Node 22) and `npm run dev` proxies `/api`
to it.

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
- **Performance and memory.** Every YouTube player and X post is a full page in an iframe, and
  iOS Safari kills the tab ("A problem repeatedly occurred") when too many pile up. So:
  - Tiles are added in batches of 24 as the visitor nears the end of the wall.
  - An embed only loads after its tile has stayed on screen for 350ms, so fast scrolling skips it.
  - Embeds are torn down 4 seconds after leaving the screen (videos go back to their thumbnail;
    X posts keep their height so nothing jumps).
  - At most 6 embeds per column are alive at once (6 on a phone); the ones off screen longest go
    first. Measured on a phone-sized screen, scrolling the whole wall now peaks at 6 live embeds
    instead of ~87.
  - Players pause when off screen or when the tab is hidden. All of these numbers are in
    `src/config.ts`.
- **Appreciate button.** A global counter under the tagline (`components/appreciate.ts`). Every tap
  shows instantly with a "+1" and is sent in batches (at most one request every ~0.8s, 25 taps
  each), so mashing the button costs a few requests. The Worker (`worker/index.ts`) keeps the
  count in a SQLite-backed **Durable Object**: a single instance that handles requests in order,
  so simultaneous taps are never lost (tested with 200 concurrent requests). Abuse limits in
  `worker/limits.ts`: 25 taps per request, 240 per visitor per minute (tracked by IP in memory
  only, never stored), and POSTs from other sites are refused. Reads are cached at the edge for 5
  seconds. Each visitor's own tally is kept in `localStorage`. If the API is unreachable, the
  button still animates and the count stays hidden. Fits Cloudflare's free plan (100k requests
  and 100k writes a day).
- **Milestones.** When a visitor's batch of taps takes the global count across 100, 200, 500,
  1,000, 2,000, 5,000, … (or Joe's number: 99, 999, 9,999, …), that visitor gets confetti and a
  "You were appreciation #1,000" banner (`lib/milestones.ts`). The server counts batches one at
  a time, so each milestone goes to exactly one visitor.
- **Stats page.** `/stats` (`stats.html`, `src/stats.ts`) shows career and current-season
  numbers, next round-number milestones, **Chasing Bengals history** (the franchise career
  leaderboard for yards, TDs and completions, with a tick for each Bengals great he's passing),
  **Bengals records he owns**, passing yards by season (plain SVG) and a season-by-season table.
  Data comes from ESPN via `GET /api/stats`, cached 10 minutes; the last good copy is kept in the
  Durable Object, so if ESPN is down or changes shape the page shows saved stats marked as such.
  - **Everything about Burrow is computed live** (`worker/records.ts`): who's next, how far to
    the record, when he breaks it (the row flips to "He owns the record"), and his best seasons.
    Only the other quarterbacks' Bengals totals are stored, and they're retired, so they don't
    change.
  - **Projections** (`src/lib/projection.ts`) spell out the pace ("He's averaged 269.3 yards a
    game over his career (21,271 in 79 games)") and turn it into a game on the schedule ("about
    2 games: around Week 4 vs. Jaguars (Oct 4)"). They use this season's average once he's played
    4 games, his career average before that; they count games, so bye weeks are skipped; TBD games
    get an estimated date; anything past the known schedule (including the offseason) says
    "next season".
  - **Just reached.** The Worker notes when each achievement (a round-number milestone, passing a
    Bengals great, a new single-season record) first appears in ESPN's numbers, and the page
    highlights anything from the last 7 days. On its first run it treated everything already
    achieved as old, so only new ones get highlighted.
- **Game day.** `src/data/schedule.ts` holds the season's kickoffs with their Eastern offsets
  (EDT `-04:00` through October, EST `-05:00` from the November clock change; a test checks
  every date). From midnight Eastern on game day a banner shows the matchup, kickoff in ET, the
  network and a countdown; at kickoff it switches to **Game on** with a pulsing dot for 3.5
  hours (`lib/gameday.ts`). During the game it polls `GET /api/live` every 30 seconds for the
  live score and clock and Burrow's passing line, then shows the **Final** for the rest of game day (at least
  4.5 hours past kickoff, for late games). If ESPN is unreachable it falls back to a plain
  "Game on". TBD games (`kickoff: null`) are skipped until the weekly job fills
  them in.
- **ESPN data.** `worker/espn.ts` parses ESPN's public but undocumented JSON (scoreboard, game
  summary, athlete stats) defensively, and `tests/espn.test.ts` checks the parsers against saved
  real responses in `tests/fixtures/`. The Worker calls `site.web.api.espn.com` with an
  identifying User-Agent; ESPN's CDN refuses requests without one (and `site.api.espn.com`
  refuses custom ones).
- **Navigation.** A bar pinned to the top of every page (`.sitenav` in each HTML page, styles in
  `base.css`): Highlights · Stats · About, with the current page underlined, plus an Instagram
  link to [@appreciatejoeburrow](https://www.instagram.com/appreciatejoeburrow/) (also in the
  footers).
- **Joe Cool mode.** The sunglasses button in the nav (every page) switches to an ice-blue
  "Joe Brrr" theme with sunglasses on the headshot and a new tagline; typing "joecool" also
  toggles it. It's a class on `<html>` that swaps the color tokens (`tokens.css`), remembered in
  `localStorage` (`lib/joe-cool.ts`).
- **About.** A short section above the footer, linked from the nav and footer. The wall
  loads every tile before jumping there, so the link lands even though the wall keeps growing.
- **Last game.** `src/data/last-game.ts` names the most recent game (label, result, date) and
  lists the IDs of its clips and posts, which must also be in the clip lists. Those tiles are
  pinned to the top with a **Last game** label under a banner. The section hides itself 10 days
  after the game date (`lastGameDays` in `src/config.ts`) so it never advertises a stale game.
  The weekly clip job updates it after each game.
- **Sound.** Everything starts muted. Each video has a speaker button (always visible on touch
  screens, 44px), and clicking or tapping anywhere on a video toggles its sound. Only one video is
  audible at a time; it gets an orange frame, plays even when **Pause all** is on, and goes
  quiet when it scrolls off screen. **Esc** mutes it. On desktop, **Sound on hover** makes
  hovering a video play its sound. Browsers only allow sound after a click, so hover mode is an
  opt-in switch (that click unlocks audio) and isn't remembered between visits; the switch is
  hidden on touch screens. A transparent `.tile__hit` layer over each player keeps pointer
  events in this page (YouTube's iframe would swallow them) and hides YouTube's hover chrome.
- **Broken tiles remove themselves.** If YouTube reports a video as removed, private or not
  embeddable (error codes 2, 5, 100, 101, 150), or X can't render a post, that tile is removed.
- **X posts load lazily.** X's `widgets.js` is only fetched once a post scrolls near the screen,
  with Do Not Track set.
- **Offline fallback.** Each tile shows the video thumbnail until its player is ready. If
  YouTube's player script can't load (blocked by an extension, network issue), tiles keep the
  thumbnail and show a "watch on YouTube" link.
- **Accessibility.** There's a **Pause all** control (auto-playing video needs one), visitors
  with reduced motion turned on (or phones in data-saver mode) start paused, speaker buttons are
  real buttons with `aria-pressed`, tile links are keyboard reachable, and titles stay
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

## The photo

The headshot above the title is `public/joe-photo.jpg`: an official White House photo from
January 2020 (public domain, so no credit is required), cropped to 256×256. The source link is in
`src/config.ts`. To swap it, replace the file with another square image you have the rights to
(256×256 or larger), or set `photoSrc` to `null` to hide it.

## Deploying

The live site runs on **Cloudflare Workers** (static assets), built from `main` by Workers
Builds, which is connected to this GitHub repo. Merging to `main` deploys to
[appreciatejoeburrow.com](https://appreciatejoeburrow.com) in a minute or two. Every pull request gets
its own preview deploy: open the **Workers Builds** check on the PR and use the **Preview URL**
in its summary.

`wrangler.jsonc` configures the Worker: it serves `dist/` as static assets and answers unknown
URLs with `dist/404.html` (built from `404.html`) and a 404 status. Build settings live in the
Cloudflare dashboard (Workers & Pages → appreciatejoeburrow → Settings → Build):

| Setting         | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Build command   | `npm run build`                                                                                           |
| Deploy command  | `npx wrangler deploy --assets=./dist --name=appreciatejoeburrow --compatibility-date=2026-09-01`          |
| Preview command | `npx wrangler versions upload --assets=./dist --name=appreciatejoeburrow --compatibility-date=2026-09-01` |

The flags duplicate what's in `wrangler.jsonc` and Wrangler merges the two (the 404 handling
applies either way), so the commands could be shortened to plain `npx wrangler deploy` /
`npx wrangler versions upload`. If you change a value, change it in both places.

Workers serves `dist/_headers` (copied from `public/_headers`), so the security headers below apply
in production.

### Domain

- Registered at **GoDaddy**; its nameservers point to Cloudflare, so all DNS is managed in
  Cloudflare, not GoDaddy.
- `appreciatejoeburrow.com` is a custom domain on the Worker.
- `www` is a proxied CNAME to the root plus a Cloudflare Redirect Rule
  (`https://www.appreciatejoeburrow.com/*` → `https://appreciatejoeburrow.com/${1}`, 301).
- **Always Use HTTPS** is on, so `http://` requests upgrade before the redirect.
- `VITE_SITE_URL` in `.env` is used for the canonical and Open Graph tags; change it if the
  domain ever changes.

### Analytics

Cloudflare Web Analytics is turned on for the domain. Cloudflare injects its beacon script
automatically, and it's cookie-free. Stats are in the Cloudflare dashboard under
**Analytics & Logs → Web Analytics**.

### Other hosts

`netlify.toml` and `vercel.json` are kept so the site can move to Netlify or Vercel without
changes. Cloudflare Pages would also work with the same build settings and `public/_headers`.

### Security headers

The Content Security Policy only allows scripts from this site, `www.youtube.com` (the player
API), X (`platform.twitter.com`, `cdn.syndication.twimg.com`) and Cloudflare Web Analytics
(`static.cloudflareinsights.com`, which reports to `cloudflareinsights.com`), frames from
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
  components/appreciate.ts The Appreciate button, count and milestone celebration
  components/gameday.ts    Game-day banner: countdown, live score, final
  stats.ts                 Stats page
  data/clips.ts            YouTube videos
  data/posts.ts            X posts
  data/schedule.ts         2026 schedule for the game-day banner
  components/wall.ts       Tile lifecycle: lazy players, pause/play, removal
  components/tile.ts       Tile DOM
  lib/youtube-api.ts       Loads the IFrame API once
  lib/x-widgets.ts         Loads X's widgets.js once
  lib/mix.ts               Spreads posts evenly between videos
  lib/playback.ts          Random start points, error codes, URLs
  lib/random.ts            Shuffle and seeded RNG
  styles/                  Tokens, base, masthead, wall, footer
public/                    Favicon, OG image, robots.txt, _headers
worker/index.ts            Cloudflare Worker: /api/appreciate and the counter Durable Object
worker/limits.ts           Request validation and per-visitor rate limiting
worker/espn.ts             ESPN scoreboard, box score and career stats parsers
worker/records.ts          Bengals leaderboards, records he owns, achievements
wrangler.jsonc             Worker, static assets, 404 page and Durable Object config
check.html                 Dev-only real-player embed check (not deployed)
scripts/check-clips.ts     Existence check for every clip and post
scripts/check-embeds.ts    Script behind check.html
scripts/headers.ts         Parses public/_headers (preview server + sync test)
tests/                     Vitest unit tests
```

## Disclaimer

A fan site. Not affiliated with Joe Burrow, the Cincinnati Bengals or the NFL. Videos are
embedded from YouTube and X and belong to their owners.
