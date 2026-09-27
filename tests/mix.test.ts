import { describe, expect, it } from 'vitest';
import { interleave } from '../src/lib/mix';

describe('interleave', () => {
  it('keeps every item from both lists, in their own order', () => {
    const out = interleave([1, 2, 3, 4, 5], ['a', 'b']);
    expect(out).toHaveLength(7);
    expect(out.filter((x) => typeof x === 'number')).toEqual([1, 2, 3, 4, 5]);
    expect(out.filter((x) => typeof x === 'string')).toEqual(['a', 'b']);
  });

  it('spreads extras out instead of clumping them', () => {
    const out = interleave(
      Array.from({ length: 19 }, (_, i) => i),
      'abcdefghijkl'.split(''),
    );
    const extraPositions = out.flatMap((x, i) => (typeof x === 'string' ? [i] : []));
    const gaps = extraPositions.slice(1).map((p, i) => p - (extraPositions[i] ?? 0));
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(3);
  });

  it('handles empty lists', () => {
    expect(interleave([], ['a'])).toEqual(['a']);
    expect(interleave([1], [])).toEqual([1]);
    expect(interleave([], [])).toEqual([]);
  });
});
