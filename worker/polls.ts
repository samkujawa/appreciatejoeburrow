/** Pure rules for the Play of the Week vote (no Cloudflare types, so it can be unit tested). */
import type { Poll } from '../src/data/play-of-the-week';

/** Most votes one visitor (by IP) may cast in one poll: room for a household, not a ballot box. */
export const MAX_VOTES_PER_VISITOR = 3;

export type VoteCheck =
  { ok: true; choice: string } | { ok: false; status: 400 | 409; error: string };

/** Validates `{ poll, choice }` against the current poll. */
export function checkVote(body: unknown, poll: Poll | null, now: number): VoteCheck {
  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (!poll || b.poll !== poll.id) return { ok: false, status: 409, error: 'not the current poll' };
  if (now >= Date.parse(poll.closes)) return { ok: false, status: 409, error: 'voting is closed' };
  const choice = b.choice;
  if (typeof choice !== 'string' || !poll.candidates.includes(choice)) {
    return { ok: false, status: 400, error: 'not a candidate' };
  }
  return { ok: true, choice };
}

/** Tallies with every candidate present (0 for none yet), in candidate order. */
export function fullTally(poll: Poll, stored: Record<string, number>): Record<string, number> {
  return Object.fromEntries(poll.candidates.map((id) => [id, stored[id] ?? 0]));
}

/** Per-visitor vote counts for one poll, in memory only (IPs are never stored). */
export class VoteLimiter {
  private readonly counts = new Map<string, number>();

  constructor(
    private readonly max = MAX_VOTES_PER_VISITOR,
    private readonly maxKeys = 100_000,
  ) {}

  take(pollId: string, visitor: string): boolean {
    const key = `${pollId}|${visitor}`;
    const used = this.counts.get(key) ?? 0;
    if (used >= this.max) return false;
    if (this.counts.size >= this.maxKeys) this.counts.clear();
    this.counts.set(key, used + 1);
    return true;
  }
}
