import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCareer, parsePassingLine, parseScoreboard } from '../worker/espn';

// Real ESPN responses (trimmed) from Week 2, 2026 at Houston: Bengals 20, Texans 6.
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(`tests/fixtures/${name}.json`, 'utf8'));

describe('parseScoreboard', () => {
  it('finds the Bengals game among the week’s games', () => {
    expect(parseScoreboard(fixture('espn-scoreboard-week2'))).toEqual({
      eventId: '401872934',
      state: 'post',
      clock: 'Final',
      bengalsHome: false,
      bengals: { abbr: 'CIN', score: 20 },
      opponent: { abbr: 'HOU', score: 6 },
    });
  });

  it('formats an in-progress clock', () => {
    const body = fixture('espn-scoreboard-week2') as {
      events: { competitions: { status: Record<string, unknown> }[] }[];
    };
    const game = body.events.at(-1);
    const competition = game?.competitions[0];
    if (!competition) throw new Error('fixture changed');
    competition.status = {
      period: 3,
      displayClock: '4:12',
      type: { name: 'STATUS_IN_PROGRESS', state: 'in' },
    };
    expect(parseScoreboard(body)?.clock).toBe('Q3 4:12');
    competition.status = { period: 2, type: { name: 'STATUS_HALFTIME', state: 'in' } };
    expect(parseScoreboard(body)?.clock).toBe('Halftime');
  });

  it('returns null on a bye week or junk', () => {
    expect(parseScoreboard({ events: [] })).toBeNull();
    expect(parseScoreboard(null)).toBeNull();
    expect(parseScoreboard({ events: [{ id: 1 }] })).toBeNull();
  });
});

describe('parsePassingLine', () => {
  it('reads Burrow’s line from the box score', () => {
    expect(parsePassingLine(fixture('espn-summary-week2'))).toEqual({
      completions: 20,
      attempts: 31,
      yards: 207,
      touchdowns: 2,
      interceptions: 0,
    });
  });

  it('returns null when he has no line yet', () => {
    expect(parsePassingLine({ boxscore: { players: [] } })).toBeNull();
    expect(parsePassingLine('nope')).toBeNull();
  });
});

describe('parseCareer', () => {
  it('reads every season and the career totals', () => {
    const career = parseCareer(fixture('espn-career'));
    expect(career?.seasons.map((s) => s.year)).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    expect(career?.seasons.find((s) => s.year === 2021)).toMatchObject({
      yards: 4611,
      touchdowns: 34,
      completionPct: 70.4,
      rating: 108.3,
      rushYards: 118,
    });
    expect(career?.totals).toMatchObject({
      games: 79,
      yards: 21271,
      touchdowns: 160,
      interceptions: 52,
      rushTouchdowns: 12,
    });
  });

  it('returns null when passing stats are missing', () => {
    expect(parseCareer({ categories: [] })).toBeNull();
    expect(parseCareer(undefined)).toBeNull();
  });
});
