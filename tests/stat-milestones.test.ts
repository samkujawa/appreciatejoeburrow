import { describe, expect, it } from 'vitest';
import { gamesToReach, nextMilestone } from '../src/lib/stat-milestones';

describe('nextMilestone', () => {
  it('finds the next round number and progress toward it', () => {
    expect(nextMilestone(21_271, 5_000)).toEqual({
      previous: 20_000,
      target: 25_000,
      remaining: 3_729,
      progress: 1_271 / 5_000,
    });
    expect(nextMilestone(160, 25)).toEqual({
      previous: 150,
      target: 175,
      remaining: 15,
      progress: 10 / 25,
    });
  });

  it('moves on once a milestone is reached exactly', () => {
    expect(nextMilestone(25_000, 5_000).target).toBe(30_000);
    expect(nextMilestone(0, 25)).toEqual({ previous: 0, target: 25, remaining: 25, progress: 0 });
  });
});

describe('gamesToReach', () => {
  it('rounds up to whole games', () => {
    expect(gamesToReach(3_729, 230.5)).toBe(17);
    expect(gamesToReach(15, 1.5)).toBe(10);
  });

  it('returns null without a pace', () => {
    expect(gamesToReach(100, 0)).toBeNull();
    expect(gamesToReach(100, Number.NaN)).toBeNull();
    expect(gamesToReach(0, 200)).toBeNull();
  });
});
