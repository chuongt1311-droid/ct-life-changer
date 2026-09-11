import { describe, expect, it } from 'vitest';
import { makeDay } from '../testing/fixtures';
import { DEFAULT_SETTINGS } from '../types';
import { anchorSkip, energyLow, grindHours, grindRestDays, indulgeHigh, sleepLow, stressHigh } from './rules';

const S = DEFAULT_SETTINGS;
const d = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;

describe('sleepLow', () => {
  it('fires on 3 short nights out of the last 4 logged', () => {
    const days = [5.5, 7.5, 5, 5.8].map((h, i) => makeDay({ date: d(10 - i), sleepHours: h }));
    expect(sleepLow(days, S)).toMatchObject({ code: 'SLEEP_LOW', state: 'depleted' });
  });

  it('does not fire on 2 short nights', () => {
    const days = [5.5, 7.5, 8, 5.8].map((h, i) => makeDay({ date: d(10 - i), sleepHours: h }));
    expect(sleepLow(days, S)).toBeNull();
  });

  it('skips unlogged nights instead of counting them', () => {
    const days = [
      makeDay({ date: d(10), sleepHours: 5 }),
      makeDay({ date: d(9) }),
      makeDay({ date: d(8), sleepHours: 5 }),
      makeDay({ date: d(7) }),
      makeDay({ date: d(6), sleepHours: 5 }),
    ];
    expect(sleepLow(days, S)).not.toBeNull();
    expect(sleepLow(days.slice(0, 4), S)).toBeNull(); // only 2 logged nights
  });
});

describe('energyLow / stressHigh', () => {
  it('energy ≤ 4 on the last 3 logged days', () => {
    const low = [4, 3, 2].map((e, i) => makeDay({ date: d(10 - i), morningEnergy: e }));
    expect(energyLow(low, S)).toMatchObject({ code: 'ENERGY_LOW' });
    const mixed = [4, 6, 2].map((e, i) => makeDay({ date: d(10 - i), morningEnergy: e }));
    expect(energyLow(mixed, S)).toBeNull();
  });

  it('stress ≥ 8 on the last 2 logged days', () => {
    const high = [9, 8].map((s, i) => makeDay({ date: d(10 - i), stress: s }));
    expect(stressHigh(high, S)).toMatchObject({ code: 'STRESS_HIGH' });
    expect(stressHigh(high.slice(0, 1), S)).toBeNull();
  });
});

describe('grinding rules', () => {
  it('grindHours: 5 of 7 days over the cap with no rest taken', () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      makeDay({ date: d(10 - i), deepWorkMin: i < 5 ? 400 : 100, restSessionsTaken: 0 }),
    );
    expect(grindHours(days, S)).toMatchObject({ code: 'GRIND_HOURS', state: 'grinding' });
    const rested = days.map((day) => ({ ...day, restSessionsTaken: 1 }));
    expect(grindHours(rested, S)).toBeNull();
  });

  it('grindRestDays: trained on 2 rest days', () => {
    const days = [true, false, true].map((t, i) => makeDay({ date: d(10 - i), trainedOnRestDay: t }));
    expect(grindRestDays(days, S)).toMatchObject({ code: 'GRIND_REST_DAYS' });
  });
});

describe('drifting rules', () => {
  it('indulgeHigh: over 120 unplanned minutes on the last 2 logged days', () => {
    const days = [150, 130].map((m, i) => makeDay({ date: d(10 - i), unplannedIndulgenceMin: m }));
    expect(indulgeHigh(days, S)).toMatchObject({ code: 'INDULGE_HIGH', state: 'drifting' });
    expect(indulgeHigh([makeDay({ date: d(10), unplannedIndulgenceMin: 120 }), days[1]!], S)).toBeNull();
  });

  it('anchorSkip: half the anchors skipped on 2 days while average energy ≥ 6', () => {
    const days = [
      makeDay({ date: d(10), anchorsTotal: 4, anchorsSkipped: 2, morningEnergy: 7 }),
      makeDay({ date: d(9), anchorsTotal: 4, anchorsSkipped: 3, morningEnergy: 6 }),
    ];
    expect(anchorSkip(days, S)).toMatchObject({ code: 'ANCHOR_SKIP' });
    const tired = days.map((day) => ({ ...day, morningEnergy: 3 }));
    expect(anchorSkip(tired, S)).toBeNull(); // low energy → that's depletion, not drifting
  });
});
