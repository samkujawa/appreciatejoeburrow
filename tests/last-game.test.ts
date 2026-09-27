import { describe, expect, it } from 'vitest';
import { CLIPS } from '../src/data/clips';
import { LAST_GAME, type LastGame } from '../src/data/last-game';
import { POSTS } from '../src/data/posts';
import { isLastGameCurrent } from '../src/lib/last-game';

const game: LastGame = {
  label: 'Week 2 at Houston',
  result: 'W 20–6',
  date: '2026-09-20',
  ids: ['a'],
};

describe('isLastGameCurrent', () => {
  it('shows from game day until the cutoff', () => {
    expect(isLastGameCurrent(game, new Date('2026-09-20T23:00:00Z'), 10)).toBe(true);
    expect(isLastGameCurrent(game, new Date('2026-09-29T12:00:00Z'), 10)).toBe(true);
  });

  it('hides once the game is older than the cutoff', () => {
    expect(isLastGameCurrent(game, new Date('2026-10-01T12:00:00Z'), 10)).toBe(false);
  });

  it('hides when there is no game, no items or a bad date', () => {
    expect(isLastGameCurrent(null, new Date('2026-09-21'), 10)).toBe(false);
    expect(isLastGameCurrent({ ...game, ids: [] }, new Date('2026-09-21'), 10)).toBe(false);
    expect(isLastGameCurrent({ ...game, date: 'Sunday' }, new Date('2026-09-21'), 10)).toBe(false);
  });
});

describe('LAST_GAME data', () => {
  it('only references clips and posts that are on the wall', () => {
    const known = new Set([...CLIPS, ...POSTS].map((x) => x.id));
    for (const id of LAST_GAME?.ids ?? []) expect(known.has(id), id).toBe(true);
  });

  it('uses a YYYY-MM-DD date and has a label and result', () => {
    if (!LAST_GAME) return;
    expect(LAST_GAME.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LAST_GAME.label.trim()).not.toBe('');
    expect(LAST_GAME.result.trim()).not.toBe('');
  });
});
