/**
 * Cloudflare Worker for AppreciateJoeBurrow.com. Static files are served straight from dist/
 * (see wrangler.jsonc); only /api/* runs this code.
 *
 *   GET  /api/appreciate          -> { count }
 *   POST /api/appreciate {taps:n} -> { count, accepted }
 *   GET  /api/live                -> { game, burrow, asOf }                      (ESPN, 20s cache)
 *   GET  /api/stats               -> { career, asOf, stale }                     (ESPN, 10min cache)
 */
import { DurableObject } from 'cloudflare:workers';
import {
  CAREER_URL,
  parseCareer,
  parsePassingLine,
  parseScoreboard,
  SCOREBOARD_URL,
  summaryUrl,
  type Career,
} from './espn';
import { isAllowedOrigin, parseTaps, TapLimiter } from './limits';

export interface Env {
  ASSETS: Fetcher;
  APPRECIATION: DurableObjectNamespace<AppreciationCounter>;
}

/** Seconds a GET response may be reused, so page loads rarely reach the Durable Object. */
const READ_CACHE_SECONDS = 5;
/** Live score refresh; every visitor polls, but ESPN and the counter see one request per window. */
const LIVE_CACHE_SECONDS = 20;
const STATS_CACHE_SECONDS = 600;
const ESPN_TIMEOUT_MS = 5_000;

interface StatsSnapshot {
  career: Career;
  asOf: string;
}

/** The one global counter. A single instance handles requests in order, so no tap is lost. */
export class AppreciationCounter extends DurableObject<Env> {
  private count: number | null = null;
  private readonly limiter = new TapLimiter();

  private async current(): Promise<number> {
    this.count ??= (await this.ctx.storage.get<number>('count')) ?? 0;
    return this.count;
  }

  async getCount(): Promise<number> {
    return this.current();
  }

  /** Adds up to `taps` for this visitor and returns the new total and how many were counted. */
  async add(visitor: string, taps: number): Promise<{ count: number; accepted: number }> {
    const accepted = this.limiter.take(visitor, taps, Date.now());
    let count = await this.current();
    if (accepted > 0) {
      count += accepted;
      this.count = count;
      await this.ctx.storage.put('count', count);
    }
    return { count, accepted };
  }

  /** Last good stats from ESPN, served (marked stale) if ESPN is down or changes shape. */
  async saveStats(snapshot: StatsSnapshot): Promise<void> {
    await this.ctx.storage.put('stats', snapshot);
  }

  async loadStats(): Promise<StatsSnapshot | null> {
    return (await this.ctx.storage.get<StatsSnapshot>('stats')) ?? null;
  }
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function counter(env: Env): DurableObjectStub<AppreciationCounter> {
  return env.APPRECIATION.get(env.APPRECIATION.idFromName('global'));
}

async function readCount(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cache = caches.default;
  const key = new Request(new URL('/api/appreciate', request.url).toString());
  const cached = await cache.match(key);
  if (cached) return cached;

  const count = await counter(env).getCount();
  const response = json(
    { count },
    { headers: { 'Cache-Control': `public, max-age=${READ_CACHE_SECONDS}` } },
  );
  ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

/** Serves `produce()` through the edge cache for `seconds` (shorter when it failed). */
async function cachedJson(
  request: Request,
  ctx: ExecutionContext,
  seconds: number,
  produce: () => Promise<{ body: unknown; ok: boolean }>,
): Promise<Response> {
  const cache = caches.default;
  const key = new Request(new URL(new URL(request.url).pathname, request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const { body, ok } = await produce();
  const ttl = ok ? seconds : Math.min(seconds, 10);
  const response = json(body, {
    status: ok ? 200 : 503,
    headers: { 'Cache-Control': `public, max-age=${ttl}` },
  });
  ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    // ESPN's CDN refuses requests without a real user agent; identify the site honestly.
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AppreciateJoeBurrow.com/1.0 (+https://appreciatejoeburrow.com)',
    },
    signal: AbortSignal.timeout(ESPN_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function readLive(): Promise<{ body: unknown; ok: boolean }> {
  let game;
  try {
    game = parseScoreboard(await fetchJson(SCOREBOARD_URL));
  } catch {
    return { body: { error: 'scores unavailable' }, ok: false };
  }
  if (!game) return { body: { game: null, burrow: null }, ok: true };

  const underway = game.state !== 'pre';
  const burrow = underway
    ? await fetchJson(summaryUrl(game.eventId))
        .then(parsePassingLine)
        .catch(() => null)
    : null;
  return {
    body: { game, burrow, asOf: new Date().toISOString() },
    ok: true,
  };
}

async function readStats(env: Env): Promise<{ body: unknown; ok: boolean }> {
  try {
    const career = parseCareer(await fetchJson(CAREER_URL));
    if (career) {
      const snapshot = { career, asOf: new Date().toISOString() };
      await counter(env).saveStats(snapshot);
      return { body: { ...snapshot, stale: false }, ok: true };
    }
  } catch {
    // Fall through to the last good copy.
  }
  const saved = await counter(env).loadStats();
  return saved
    ? { body: { ...saved, stale: true }, ok: true }
    : { body: { error: 'stats unavailable' }, ok: false };
}

async function addTaps(request: Request, env: Env): Promise<Response> {
  if (!isAllowedOrigin(request.headers.get('Origin'), request.url)) {
    return json({ error: 'forbidden' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid body' }, { status: 400 });
  }
  const taps = parseTaps(body);
  if (taps === null) return json({ error: 'invalid taps' }, { status: 400 });

  const visitor = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const result = await counter(env).add(visitor, taps);
  return json(result, { status: result.accepted > 0 ? 200 : 429 });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/appreciate') {
      if (request.method === 'GET') return readCount(request, env, ctx);
      if (request.method === 'POST') return addTaps(request, env);
      return json(
        { error: 'method not allowed' },
        { status: 405, headers: { Allow: 'GET, POST' } },
      );
    }
    if (request.method === 'GET' && url.pathname === '/api/live') {
      return cachedJson(request, ctx, LIVE_CACHE_SECONDS, () => readLive());
    }
    if (request.method === 'GET' && url.pathname === '/api/stats') {
      return cachedJson(request, ctx, STATS_CACHE_SECONDS, () => readStats(env));
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
