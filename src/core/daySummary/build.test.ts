import { describe, expect, it } from 'vitest';
import { buildDaySummary, sleepHoursBetween } from './build';

describe('sleepHoursBetween', () => {
  it('computes hours across midnight', () => {
    expect(sleepHoursBetween('23:00', '07:00')).toBe(8);
  });

  it('computes hours within the same evening (no crossing needed)', () => {
    expect(sleepHoursBetween('22:00', '23:30')).toBe(1.5);
  });
});

describe('buildDaySummary', () => {
  const base = {
    date: '2026-09-15',
    isRestDay: false,
    checkins: [],
    blocks: [],
    restSessionsCount: 0,
    unplannedIndulgenceMinutes: [],
  };

  it('reports null for every field when nothing was logged', () => {
    const summary = buildDaySummary(base);
    expect(summary).toEqual({
      date: '2026-09-15',
      sleepHours: null,
      morningEnergy: null,
      stress: null,
      deepWorkMin: null,
      restSessionsTaken: 0,
      trainedOnRestDay: false,
      unplannedIndulgenceMin: null,
      anchorsTotal: 0,
      anchorsSkipped: 0,
    });
  });

  it('reads sleepHours and morningEnergy from the morning checkin', () => {
    const summary = buildDaySummary({
      ...base,
      checkins: [
        {
          type: 'morning',
          sections: { body: { bedtime: '23:00', wakeTime: '07:00', sleepQuality: 4, energy: 7 }, mind: { mood: 6, stress: 3, stressCause: [] } },
        },
      ],
    });
    expect(summary.sleepHours).toBe(8);
    expect(summary.morningEnergy).toBe(7);
  });

  it('takes the higher of morning and evening stress', () => {
    const summary = buildDaySummary({
      ...base,
      checkins: [
        { type: 'morning', sections: { mind: { mood: 6, stress: 3, stressCause: [] } } },
        { type: 'evening', sections: { mind: { peakStress: 8, stressCause: [], focusQuality: 3, regulated: [] } } },
      ],
    });
    expect(summary.stress).toBe(8);
  });

  it('sums minutes of done or partial deep-work blocks', () => {
    const summary = buildDaySummary({
      ...base,
      blocks: [
        { anchor: true, kind: 'task', status: 'done', start: 540, end: 660, tags: ['deepWork'] },
        { anchor: false, kind: 'task', status: 'partial', start: 660, end: 690, tags: ['deepWork'] },
        { anchor: false, kind: 'task', status: 'skipped', start: 690, end: 720, tags: ['deepWork'] },
        { anchor: false, kind: 'task', status: 'done', start: 720, end: 780, tags: [] },
      ],
    });
    expect(summary.deepWorkMin).toBe(120 + 30);
  });

  it('counts anchors total and skipped (skipped or missed)', () => {
    const summary = buildDaySummary({
      ...base,
      blocks: [
        { anchor: true, kind: 'training', status: 'done', start: 0, end: 60, tags: [] },
        { anchor: true, kind: 'routine', status: 'missed', start: 60, end: 90, tags: [] },
        { anchor: true, kind: 'routine', status: 'skipped', start: 90, end: 120, tags: [] },
        { anchor: false, kind: 'task', status: 'skipped', start: 120, end: 150, tags: [] },
      ],
    });
    expect(summary.anchorsTotal).toBe(3);
    expect(summary.anchorsSkipped).toBe(2);
  });

  it('flags trainedOnRestDay only when the day is a rest day and training happened', () => {
    const trained = buildDaySummary({
      ...base,
      isRestDay: true,
      blocks: [{ anchor: false, kind: 'training', status: 'done', start: 0, end: 60, tags: [] }],
    });
    expect(trained.trainedOnRestDay).toBe(true);

    const sameBlocksNotRestDay = buildDaySummary({
      ...base,
      isRestDay: false,
      blocks: [{ anchor: false, kind: 'training', status: 'done', start: 0, end: 60, tags: [] }],
    });
    expect(sameBlocksNotRestDay.trainedOnRestDay).toBe(false);
  });

  it('passes restSessionsCount through and sums unplannedIndulgenceMinutes', () => {
    const summary = buildDaySummary({ ...base, restSessionsCount: 2, unplannedIndulgenceMinutes: [30, 45] });
    expect(summary.restSessionsTaken).toBe(2);
    expect(summary.unplannedIndulgenceMin).toBe(75);
  });
});
