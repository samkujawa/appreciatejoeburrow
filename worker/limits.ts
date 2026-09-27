/**
 * Pure logic for the Appreciate counter, kept free of Cloudflare types so it can be unit tested.
 */

/** Most taps one request may add. The page batches taps and flushes about once a second. */
export const MAX_TAPS_PER_REQUEST = 25;

/** Most taps one visitor (by IP) may add per window; a fast human tops out well below this. */
export const MAX_TAPS_PER_WINDOW = 240;
export const WINDOW_MS = 60_000;

/** Reads `{ "taps": n }` and returns n if it's a whole number from 1 to the per-request cap. */
export function parseTaps(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) return null;
  const taps = (body as { taps?: unknown }).taps;
  if (typeof taps !== 'number' || !Number.isInteger(taps)) return null;
  if (taps < 1 || taps > MAX_TAPS_PER_REQUEST) return null;
  return taps;
}

/**
 * Browsers send an Origin header on POSTs. Reject ones from other sites so a page elsewhere
 * can't pump the count; allow a missing header (some privacy tools strip it).
 */
export function isAllowedOrigin(origin: string | null, requestUrl: string): boolean {
  if (origin === null) return true;
  return origin === new URL(requestUrl).origin;
}

interface TapWindow {
  start: number;
  taps: number;
}

/**
 * Fixed-window limiter keyed by visitor. Lives in memory only (IPs are never stored), which is
 * fine: the counter's Durable Object is a single instance that sees every request.
 */
export class TapLimiter {
  private readonly windows = new Map<string, TapWindow>();

  constructor(
    private readonly maxTaps = MAX_TAPS_PER_WINDOW,
    private readonly windowMs = WINDOW_MS,
    private readonly maxKeys = 50_000,
  ) {}

  /** Returns how many of `taps` this visitor may add right now (0 when they're over the cap). */
  take(key: string, taps: number, now: number): number {
    let window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      if (this.windows.size >= this.maxKeys) this.prune(now);
      window = { start: now, taps: 0 };
      this.windows.set(key, window);
    }
    const allowed = Math.max(0, Math.min(taps, this.maxTaps - window.taps));
    window.taps += allowed;
    return allowed;
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.windowMs) this.windows.delete(key);
    }
    // Still full (a flood of distinct keys): start over rather than grow without bound.
    if (this.windows.size >= this.maxKeys) this.windows.clear();
  }
}
