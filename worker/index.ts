/**
 * Cloudflare Worker for AppreciateJoeBurrow.com. Static files are served straight from dist/
 * (see wrangler.jsonc); only /api/* runs this code.
 *
 *   GET  /api/appreciate          -> { count }
 *   POST /api/appreciate {taps:n} -> { count, accepted }
 */
import { DurableObject } from 'cloudflare:workers';
import { isAllowedOrigin, parseTaps, TapLimiter } from './limits';

export interface Env {
  ASSETS: Fetcher;
  APPRECIATION: DurableObjectNamespace<AppreciationCounter>;
}

/** Seconds a GET response may be reused, so page loads rarely reach the Durable Object. */
const READ_CACHE_SECONDS = 5;

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
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
