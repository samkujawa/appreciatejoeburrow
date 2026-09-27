import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, MAX_TAPS_PER_REQUEST, parseTaps, TapLimiter } from '../worker/limits';

describe('parseTaps', () => {
  it('accepts whole numbers from 1 to the per-request cap', () => {
    expect(parseTaps({ taps: 1 })).toBe(1);
    expect(parseTaps({ taps: MAX_TAPS_PER_REQUEST })).toBe(MAX_TAPS_PER_REQUEST);
  });

  it('rejects anything else', () => {
    for (const body of [
      null,
      'taps',
      {},
      { taps: 0 },
      { taps: -3 },
      { taps: 1.5 },
      { taps: '5' },
      { taps: MAX_TAPS_PER_REQUEST + 1 },
      { taps: Number.POSITIVE_INFINITY },
    ]) {
      expect(parseTaps(body), JSON.stringify(body)).toBeNull();
    }
  });
});

describe('isAllowedOrigin', () => {
  const url = 'https://appreciatejoeburrow.com/api/appreciate';

  it('allows the same site and requests without an Origin header', () => {
    expect(isAllowedOrigin('https://appreciatejoeburrow.com', url)).toBe(true);
    expect(isAllowedOrigin(null, url)).toBe(true);
  });

  it('rejects other sites', () => {
    expect(isAllowedOrigin('https://evil.example', url)).toBe(false);
    expect(isAllowedOrigin('http://appreciatejoeburrow.com', url)).toBe(false);
  });
});

describe('TapLimiter', () => {
  it('counts taps up to the cap, then only the remainder, then nothing', () => {
    const limiter = new TapLimiter(10, 60_000);
    expect(limiter.take('a', 6, 0)).toBe(6);
    expect(limiter.take('a', 6, 1_000)).toBe(4);
    expect(limiter.take('a', 6, 2_000)).toBe(0);
  });

  it('tracks visitors separately and resets after the window', () => {
    const limiter = new TapLimiter(10, 60_000);
    expect(limiter.take('a', 10, 0)).toBe(10);
    expect(limiter.take('b', 10, 0)).toBe(10);
    expect(limiter.take('a', 1, 59_999)).toBe(0);
    expect(limiter.take('a', 1, 60_000)).toBe(1);
  });

  it('stays bounded when flooded with distinct visitors', () => {
    const limiter = new TapLimiter(10, 60_000, 100);
    for (let i = 0; i < 1_000; i++) limiter.take(`ip${i}`, 1, 0);
    // Still answers sensibly after pruning.
    expect(limiter.take('fresh', 3, 0)).toBe(3);
  });
});
