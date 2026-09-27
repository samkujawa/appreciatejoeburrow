/**
 * Appreciation counts worth celebrating: 100, 200, 500, 1,000, 2,000, 5,000, … and Joe's number,
 * 99, 999, 9,999, ….
 */
export function isMilestone(n: number): boolean {
  if (!Number.isInteger(n) || n < 99) return false;
  return /^[125]0{2,}$/.test(String(n)) || isNines(n);
}

/**
 * Milestones in (from, to], i.e. the ones a batch of taps took the count across. The server
 * handles batches one at a time, so each milestone lands in exactly one visitor's batch.
 */
export function crossedMilestones(from: number, to: number): number[] {
  const out: number[] = [];
  // Batches are at most a few dozen taps, so a straight scan is cheap.
  for (let n = Math.max(from + 1, 99); n <= to && to - from <= 1_000; n++) {
    if (isMilestone(n)) out.push(n);
  }
  return out;
}

/** Joe wears 9. */
export function isNines(n: number): boolean {
  return /^9+$/.test(String(n));
}
