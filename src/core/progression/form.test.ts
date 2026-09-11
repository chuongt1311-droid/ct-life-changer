import { describe, expect, it } from 'vitest';
import { makeGoodDay, makeProgressDay } from '../testing/progressFixtures';
import { addDays } from '../time';
import { formOn } from './form';
import type { ProgressDay } from './xp';

const TODAY = '2026-10-10';

/** 28 days ending today: the first 21 are "good days", the last 7 come from `recent`. */
function history(recent: (date: string) => ProgressDay): ProgressDay[] {
  return Array.from({ length: 28 }, (_, i) => {
    const date = addDays(TODAY, i - 27);
    return i < 21 ? makeGoodDay(date) : recent(date);
  });
}

describe('formOn', () => {
  it('is "Settling in" with under 14 days of history', () => {
    const days = Array.from({ length: 13 }, (_, i) => makeGoodDay(addDays(TODAY, -i)));
    expect(formOn(days, TODAY)).toEqual({ band: 'settling', label: 'Settling in', ratio: null });
  });

  it('is Steady when the last week matches the three before', () => {
    expect(formOn(history((d) => makeGoodDay(d)), TODAY)).toMatchObject({ band: 'steady', label: 'Steady', ratio: 1 });
  });

  it('rises to Excellent on a much bigger week', () => {
    const big = (d: string) => makeGoodDay(d, { footballMinutes: 240, trainingDone: 2 });
    expect(formOn(history(big), TODAY).band).toBe('excellent');
  });

  it('drops to Dipping, then Rebuilding, as the week thins out', () => {
    const lighter = (d: string) => makeGoodDay(d, { footballMinutes: 0, learnedEntry: false });
    expect(formOn(history(lighter), TODAY).band).toBe('dipping');
    const empty = (d: string) => makeProgressDay({ date: d });
    expect(formOn(history(empty), TODAY)).toMatchObject({ band: 'rebuilding', label: 'Rebuilding', ratio: 0 });
  });

  it('treats a comeback after a blank stretch as Excellent', () => {
    const days = [makeGoodDay(addDays(TODAY, -40)), makeGoodDay(TODAY)];
    expect(formOn(days, TODAY).band).toBe('excellent');
  });
});
