import { describe, expect, it } from 'vitest';
import { makeDay } from '../testing/fixtures';
import { DEFAULT_SETTINGS } from '../types';
import { adjustmentsFor, assess } from './assess';

const d = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;

describe('assess', () => {
  it('is ready with no flags when nothing fires, including no data at all', () => {
    expect(assess([], DEFAULT_SETTINGS)).toEqual({ state: 'ready', flags: [], adjustments: [] });
  });

  it('depleted beats drifting and keeps every flag for the mentor', () => {
    const days = [0, 1, 2].map((i) =>
      makeDay({ date: d(10 - i), sleepHours: 5, unplannedIndulgenceMin: 180 }),
    );
    const result = assess(days, DEFAULT_SETTINGS);
    expect(result.state).toBe('depleted');
    expect(result.flags.map((f) => f.code)).toEqual(['SLEEP_LOW', 'INDULGE_HIGH']);
    expect(result.adjustments.map((a) => a.type)).toEqual([
      'trainingToRecovery',
      'bedtimeEarlier',
      'dropLowPriority',
      'capDeepWork',
    ]);
  });

  it('grinding beats drifting', () => {
    const days = [0, 1].map((i) =>
      makeDay({ date: d(10 - i), trainedOnRestDay: true, unplannedIndulgenceMin: 180 }),
    );
    expect(assess(days, DEFAULT_SETTINGS).state).toBe('grinding');
  });
});

describe('adjustmentsFor', () => {
  it('scales deep-work caps from settings', () => {
    const settings = { ...DEFAULT_SETTINGS, deepWorkDailyCapMin: 300 };
    expect(adjustmentsFor('depleted', settings)).toContainEqual(expect.objectContaining({ type: 'capDeepWork', minutes: 150 }));
    expect(adjustmentsFor('grinding', settings)).toContainEqual(expect.objectContaining({ type: 'capDeepWork', minutes: 300 }));
  });
});
