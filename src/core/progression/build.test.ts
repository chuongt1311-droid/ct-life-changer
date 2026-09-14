import { describe, expect, it } from 'vitest';
import { buildProgressDay, restReturnedOnTime, type ProgressDayInput } from './build';

function baseInput(overrides: Partial<ProgressDayInput> = {}): ProgressDayInput {
  return {
    date: '2026-09-14',
    state: 'ready',
    isRestDay: false,
    sleepHours: null,
    morningCheckinDone: false,
    eveningCheckinDone: false,
    eveningBody: null,
    eveningMind: null,
    eveningWork: null,
    eveningReflection: null,
    eveningPeople: null,
    blocks: [],
    restSessionsCount: 0,
    restReturnsOnTime: 0,
    ...overrides,
  };
}

describe('buildProgressDay', () => {
  it('an unlogged day maps to all-zero/false progression fields', () => {
    const day = buildProgressDay(baseInput());
    expect(day).toMatchObject({
      date: '2026-09-14',
      state: 'ready',
      trainingDone: 0,
      trainingPartial: 0,
      proteinHit: false,
      waterL: null,
      restDayNoTraining: false,
      footballMinutes: 0,
      learnedEntry: false,
      anchorsKept: 0,
      easyWinDone: false,
      morningCheckin: false,
      eveningCheckin: false,
      regulations: 0,
      gratitudeLines: 0,
      winOrLesson: false,
      reachedOut: false,
    });
  });

  it('maps a fully logged training day', () => {
    const day = buildProgressDay(
      baseInput({
        sleepHours: 7.5,
        morningCheckinDone: true,
        eveningCheckinDone: true,
        eveningBody: { training: 'done', protein: 'hit', waterL: 3.2 },
        eveningMind: { regulated: ['guitar', 'walk'] },
        eveningWork: { footballAnalytics: { minutes: 90, learned: 'xT per shot matters more than volume.' } },
        eveningReflection: { gratitudeLines: ['a', 'b', 'c'], lessonOfDay: 'Ship smaller.', winOfDay: '' },
        eveningPeople: { reachedOut: true },
        blocks: [
          { anchor: true, tags: [], status: 'done' },
          { anchor: true, tags: [], status: 'partial' },
          { anchor: false, tags: ['easyWin'], status: 'done' },
        ],
        restSessionsCount: 1,
        restReturnsOnTime: 1,
      }),
    );
    expect(day).toMatchObject({
      trainingDone: 1,
      trainingPartial: 0,
      proteinHit: true,
      waterL: 3.2,
      sleepHours: 7.5,
      restSessionsTaken: 1,
      restReturnsOnTime: 1,
      footballMinutes: 90,
      learnedEntry: true,
      anchorsKept: 2,
      easyWinDone: true,
      morningCheckin: true,
      eveningCheckin: true,
      regulations: 2,
      gratitudeLines: 3,
      winOrLesson: true,
      reachedOut: true,
    });
  });

  it('training "partial" sets trainingPartial, not trainingDone', () => {
    const day = buildProgressDay(baseInput({ eveningBody: { training: 'partial', protein: 'low', waterL: 0 } }));
    expect(day.trainingDone).toBe(0);
    expect(day.trainingPartial).toBe(1);
  });

  it('a rest day with no training sets restDayNoTraining', () => {
    const day = buildProgressDay(baseInput({ isRestDay: true, eveningBody: { training: 'rest', protein: 'low', waterL: 0 } }));
    expect(day.restDayNoTraining).toBe(true);
  });

  it('training on a rest day does not set restDayNoTraining', () => {
    const day = buildProgressDay(baseInput({ isRestDay: true, eveningBody: { training: 'done', protein: 'hit', waterL: 3 } }));
    expect(day.restDayNoTraining).toBe(false);
  });

  it('a blank "learned" or win/lesson text does not count', () => {
    const day = buildProgressDay(
      baseInput({
        eveningWork: { footballAnalytics: { minutes: 0, learned: '   ' } },
        eveningReflection: { gratitudeLines: [], lessonOfDay: '  ', winOfDay: '' },
      }),
    );
    expect(day.learnedEntry).toBe(false);
    expect(day.winOrLesson).toBe(false);
  });

  it('anchorsKept counts only done or partial anchors, not skipped/missed ones', () => {
    const day = buildProgressDay(
      baseInput({
        blocks: [
          { anchor: true, tags: [], status: 'done' },
          { anchor: true, tags: [], status: 'skipped' },
          { anchor: true, tags: [], status: 'missed' },
          { anchor: false, tags: [], status: 'done' },
        ],
      }),
    );
    expect(day.anchorsKept).toBe(1);
  });
});

describe('restReturnedOnTime', () => {
  it('true when the ack lands within 10 minutes of the session ending', () => {
    expect(restReturnedOnTime('2026-09-14T20:00:00.000Z', '2026-09-14T20:09:00.000Z')).toBe(true);
  });

  it('false when the ack is more than 10 minutes late', () => {
    expect(restReturnedOnTime('2026-09-14T20:00:00.000Z', '2026-09-14T20:11:00.000Z')).toBe(false);
  });

  it('false when never acknowledged', () => {
    expect(restReturnedOnTime('2026-09-14T20:00:00.000Z', null)).toBe(false);
  });
});
