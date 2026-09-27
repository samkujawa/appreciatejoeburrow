import { describe, expect, it } from 'vitest';
import { seededRng, shuffle } from '../src/lib/random';

describe('seededRng', () => {
  it('is deterministic for the same seed', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays in [0, 1)', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 10_000; i++) {
      const n = rng();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  const items = Array.from({ length: 16 }, (_, i) => i);

  it('returns a permutation of the input', () => {
    const out = shuffle(items, seededRng(1));
    expect(out).toHaveLength(items.length);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
  });

  it('does not mutate the input', () => {
    const copy = items.slice();
    shuffle(items, seededRng(2));
    expect(items).toEqual(copy);
  });

  it('produces different orders for different seeds', () => {
    expect(shuffle(items, seededRng(3))).not.toEqual(shuffle(items, seededRng(4)));
  });

  it('handles empty and single-item arrays', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['only'])).toEqual(['only']);
  });

  it('puts each item first roughly equally often', () => {
    const rng = seededRng(99);
    const counts = new Array<number>(4).fill(0);
    const runs = 40_000;
    for (let i = 0; i < runs; i++) {
      const first = shuffle([0, 1, 2, 3], rng)[0] ?? -1;
      counts[first] = (counts[first] ?? 0) + 1;
    }
    for (const c of counts) expect(c / runs).toBeCloseTo(0.25, 1);
  });
});
