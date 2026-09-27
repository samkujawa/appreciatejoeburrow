import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { achievementCard, counterCard, historyCard, statsCard } from '../src/lib/card-content';
import { parseCareer } from '../worker/espn';
import { LADDERS, ladderStatus } from '../worker/records';

const career = parseCareer(JSON.parse(readFileSync('tests/fixtures/espn-career.json', 'utf8')));
if (!career) throw new Error('fixture did not parse');
const ladder = (stat: string) => {
  const l = LADDERS.find((x) => x.stat === stat);
  if (!l) throw new Error(stat);
  return l;
};

describe('share card content', () => {
  it('builds the career snapshot', () => {
    const card = statsCard(career);
    expect(card).toMatchObject({ big: '21,271', label: 'Career passing yards' });
    expect(card.lines[0]).toBe('160 TD passes · 68.5% completions · 101.0 rating');
  });

  it('builds a history card for the next Bengals great', () => {
    const card = historyCard(ladderStatus(career, ladder('touchdowns')));
    expect(card).toMatchObject({
      kicker: 'Chasing Bengals history',
      big: '28',
      label: 'TD passes to pass Boomer Esiason',
    });
    expect(card.lines).toEqual([
      '160 career TD passes and climbing.',
      'Bengals record: Andy Dalton, 204.',
    ]);
  });

  it('switches to a record card once he holds it', () => {
    const later = { ...career, totals: { ...career.totals, touchdowns: 210 } };
    expect(historyCard(ladderStatus(later, ladder('touchdowns')))).toMatchObject({
      kicker: 'Bengals record',
      big: '210',
    });
  });

  it('builds achievement cards for each kind of key', () => {
    expect(
      achievementCard({ key: 'completions:2000', label: '2,000 career completions' }),
    ).toMatchObject({ big: '2,000', label: 'career completions', kicker: 'Just reached' });
    expect(
      achievementCard({
        key: 'passed:completions:Boomer Esiason',
        label: 'Passed Boomer Esiason in Bengals career completions',
      }),
    ).toMatchObject({
      big: 'Passed',
      label: 'Boomer Esiason',
      lines: ['In Bengals career completions'],
    });
    expect(
      achievementCard({
        key: 'season-record:yards:2026',
        label: 'A new Bengals single-season record for passing yards (2026)',
      }),
    ).toMatchObject({ kicker: 'New Bengals record', label: 'Single-season passing yards' });
  });

  it('builds a counter milestone card', () => {
    expect(counterCard(5000)).toMatchObject({ big: '5,000', slug: 'appreciation-5000' });
  });
});
