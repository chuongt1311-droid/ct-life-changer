import type { ProgressDay } from '../progression/xp';

/** A ProgressDay where nothing was logged; override what the test needs. */
export function makeProgressDay(overrides: Partial<ProgressDay> & Pick<ProgressDay, 'date'>): ProgressDay {
  return {
    state: 'ready',
    trainingDone: 0,
    trainingPartial: 0,
    proteinHit: false,
    waterL: null,
    sleepHours: null,
    restDayNoTraining: false,
    restSessionsTaken: 0,
    restReturnsOnTime: 0,
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
    ...overrides,
  };
}

/** A solid, fully logged day (used to build long histories). */
export function makeGoodDay(date: string, overrides: Partial<ProgressDay> = {}): ProgressDay {
  return makeProgressDay({
    date,
    trainingDone: 1,
    proteinHit: true,
    waterL: 3,
    sleepHours: 7.5,
    restSessionsTaken: 1,
    restReturnsOnTime: 1,
    footballMinutes: 90,
    learnedEntry: true,
    anchorsKept: 3,
    morningCheckin: true,
    eveningCheckin: true,
    regulations: 1,
    gratitudeLines: 1,
    winOrLesson: true,
    ...overrides,
  });
}
