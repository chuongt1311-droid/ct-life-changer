import { describe, expect, it } from 'vitest';
import { makeGoodDay, makeProgressDay } from '../testing/progressFixtures';
import { addDays } from '../time';
import { badgeProgress } from './badges';

const days = (n: number, overrides = {}) => Array.from({ length: n }, (_, i) => makeGoodDay(addDays('2026-09-01', i), overrides));
const find = (id: string, list: ReturnType<typeof badgeProgress>) => list.find((b) => b.id === id)!;

describe('badgeProgress', () => {
  it('starts with no tiers and shows the first target', () => {
    expect(find('workhorse', badgeProgress([]))).toMatchObject({ count: 0, tier: null, nextAt: 10 });
  });

  it('earns tiers from cumulative totals', () => {
    const list = badgeProgress(days(40));
    expect(find('workhorse', list)).toMatchObject({ count: 40, tier: 'silver', nextAt: 120 });
    expect(find('iron-sleeper', list)).toMatchObject({ tier: 'silver' });
    expect(find('anchor', list)).toMatchObject({ count: 120, tier: 'silver', nextAt: 300 });
    // 40 days × 90 min = 60 h
    expect(find('film-room', list)).toMatchObject({ count: 60, tier: 'silver', nextAt: 150 });
  });

  it('counts totals, not streaks: gaps between days change nothing', () => {
    const spaced = Array.from({ length: 10 }, (_, i) => makeGoodDay(addDays('2026-09-01', i * 3)));
    expect(find('clutch-returner', badgeProgress(spaced))).toMatchObject({ count: 10, tier: 'bronze' });
  });

  it('only counts evenings that include a reflection for Open Book', () => {
    const list = badgeProgress([
      makeProgressDay({ date: '2026-09-01', eveningCheckin: true, winOrLesson: true }),
      makeProgressDay({ date: '2026-09-02', eveningCheckin: true }),
      makeProgressDay({ date: '2026-09-03', gratitudeLines: 2 }),
    ]);
    expect(find('open-book', list).count).toBe(1);
  });

  it('stops at Hall of Fame', () => {
    expect(find('workhorse', badgeProgress(days(300)))).toMatchObject({ tier: 'hof', nextAt: null });
  });
});
