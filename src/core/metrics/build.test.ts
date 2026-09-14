import { describe, expect, it } from 'vitest';
import { buildWeekDay, restOutcomeFor, type WeekDayInput } from './build';

describe('buildWeekDay', () => {
  it('maps every field straight through', () => {
    const input: WeekDayInput = {
      date: '2026-09-14',
      hasCheckin: true,
      sleepHours: 7.5,
      state: 'ready',
      trainingPlannedCount: 1,
      trainingDoneCount: 1,
      footballMinutes: 90,
      learnedEntry: true,
    };
    expect(buildWeekDay(input)).toEqual({
      date: '2026-09-14',
      hasCheckin: true,
      sleepHours: 7.5,
      state: 'ready',
      trainingPlanned: 1,
      trainingDone: 1,
      footballMinutes: 90,
      learnedNotes: 1,
    });
  });

  it('no learned entry means zero learnedNotes', () => {
    const day = buildWeekDay({
      date: '2026-09-14',
      hasCheckin: false,
      sleepHours: null,
      state: null,
      trainingPlannedCount: 0,
      trainingDoneCount: 0,
      footballMinutes: 0,
      learnedEntry: false,
    });
    expect(day.learnedNotes).toBe(0);
  });
});

describe('restOutcomeFor', () => {
  it('acked within 10 minutes', () => {
    expect(restOutcomeFor('2026-09-14T20:00:00.000Z', '2026-09-14T20:07:00.000Z')).toEqual({ ackDelayMin: 7 });
  });

  it('acked late', () => {
    expect(restOutcomeFor('2026-09-14T20:00:00.000Z', '2026-09-14T20:25:00.000Z')).toEqual({ ackDelayMin: 25 });
  });

  it('never acked', () => {
    expect(restOutcomeFor('2026-09-14T20:00:00.000Z', null)).toEqual({ ackDelayMin: null });
  });
});
