import { describe, expect, it } from 'vitest';
import { isFatalPlayerError, pickStartSeconds, thumbnailUrl, watchUrl } from '../src/lib/playback';

describe('isFatalPlayerError', () => {
  it.each([2, 5, 100, 101, 150])('treats %i as fatal', (code) => {
    expect(isFatalPlayerError(code)).toBe(true);
  });

  it.each([0, 1, 3, 153, 999])('does not treat %i as fatal', (code) => {
    expect(isFatalPlayerError(code)).toBe(false);
  });
});

describe('pickStartSeconds', () => {
  it('returns 0 for unknown or unusable durations', () => {
    expect(pickStartSeconds(0, 20)).toBe(0);
    expect(pickStartSeconds(Number.NaN, 20)).toBe(0);
    expect(pickStartSeconds(Number.POSITIVE_INFINITY, 20)).toBe(0);
  });

  it('returns 0 when the video is too short for the end buffer', () => {
    expect(pickStartSeconds(40, 20, () => 0.99)).toBe(0);
  });

  it('keeps the start at least the buffer away from the end', () => {
    expect(pickStartSeconds(600, 20, () => 0.999999)).toBeLessThanOrEqual(580);
    expect(pickStartSeconds(600, 20, () => 0)).toBe(0);
  });

  it('returns whole seconds', () => {
    expect(Number.isInteger(pickStartSeconds(2700, 20, () => 0.3141))).toBe(true);
  });
});

describe('URLs', () => {
  it('builds a watch URL with an optional timestamp', () => {
    expect(watchUrl('Qa_0_ATCmkA')).toBe('https://www.youtube.com/watch?v=Qa_0_ATCmkA');
    expect(watchUrl('Qa_0_ATCmkA', 95)).toBe('https://www.youtube.com/watch?v=Qa_0_ATCmkA&t=95s');
  });

  it('builds a thumbnail URL', () => {
    expect(thumbnailUrl('g-6sNXtirIY')).toBe('https://i.ytimg.com/vi/g-6sNXtirIY/hqdefault.jpg');
  });
});
