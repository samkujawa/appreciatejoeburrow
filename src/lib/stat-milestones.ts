export interface NextMilestone {
  /** The last round number at or below the current value, e.g. 20,000. */
  previous: number;
  /** The next round number above the current value, e.g. 25,000. */
  target: number;
  remaining: number;
  /** 0..1 progress from the previous round number to the target. */
  progress: number;
}

/** Next multiple of `step` above `value` (strictly above, so hitting one moves to the next). */
export function nextMilestone(value: number, step: number): NextMilestone {
  const target = (Math.floor(value / step) + 1) * step;
  const previous = target - step;
  return { previous, target, remaining: target - value, progress: (value - previous) / step };
}

/** Games needed to cover `remaining` at `perGame`; null when there's no pace to project from. */
export function gamesToReach(remaining: number, perGame: number): number | null {
  if (!(perGame > 0) || remaining <= 0) return null;
  return Math.ceil(remaining / perGame);
}
