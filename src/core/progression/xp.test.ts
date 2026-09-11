import { describe, expect, it } from 'vitest';
import { makeGoodDay, makeProgressDay } from '../testing/progressFixtures';
import { ATTRS, dayXp, totalXp } from './xp';

const D = '2026-09-14';

describe('dayXp', () => {
  it('earns nothing on an empty day', () => {
    expect(dayXp(makeProgressDay({ date: D }))).toEqual({ PHY: 0, REC: 0, ANL: 0, DIS: 0, MEN: 0, CHR: 0 });
  });

  it('applies the spec §8b.1 table on a ready day', () => {
    // PHY 40 + 10 + 5 = 55 · REC 30 + 10 = 40 · ANL 90 + 15 = 105
    // DIS 30 + 15 = 45 · MEN 10 + 15 + 5 = 30 · CHR 5 + 5 = 10
    expect(dayXp(makeGoodDay(D))).toEqual({ PHY: 55, REC: 40, ANL: 105, DIS: 45, MEN: 30, CHR: 10 });
  });

  it('caps analytics minutes, regulations and gratitude lines', () => {
    const xp = dayXp(makeProgressDay({ date: D, footballMinutes: 500, regulations: 9, gratitudeLines: 7 }));
    expect(xp.ANL).toBe(240);
    expect(xp.MEN).toBe(15);
    expect(xp.CHR).toBe(15);
  });

  it('gives partial sleep credit between 6 and 7 hours', () => {
    expect(dayXp(makeProgressDay({ date: D, sleepHours: 6.5 })).REC).toBe(10);
    expect(dayXp(makeProgressDay({ date: D, sleepHours: 5.9 })).REC).toBe(0);
  });

  it('depleted: work XP halved, recovery doubled', () => {
    expect(dayXp(makeGoodDay(D, { state: 'depleted' }))).toEqual({ PHY: 27, REC: 80, ANL: 52, DIS: 22, MEN: 30, CHR: 10 });
  });

  it('grinding: training earns nothing (injury risk), analytics halved, recovery doubled', () => {
    expect(dayXp(makeGoodDay(D, { state: 'grinding' }))).toEqual({ PHY: 15, REC: 80, ANL: 52, DIS: 45, MEN: 30, CHR: 10 });
  });

  it('drifting: the easy win is the biggest single discipline reward', () => {
    expect(dayXp(makeProgressDay({ date: D, state: 'drifting', easyWinDone: true })).DIS).toBe(30);
  });

  it('never returns negative XP', () => {
    for (const state of ['ready', 'drifting', 'depleted', 'grinding'] as const) {
      const xp = dayXp(makeGoodDay(D, { state }));
      for (const a of ATTRS) expect(xp[a]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('totalXp', () => {
  it('sums days per attribute', () => {
    const total = totalXp([makeGoodDay('2026-09-14'), makeGoodDay('2026-09-15')]);
    expect(total).toEqual({ PHY: 110, REC: 80, ANL: 210, DIS: 90, MEN: 60, CHR: 20 });
  });
});
