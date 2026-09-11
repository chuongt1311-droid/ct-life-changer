import type { Block, DaySummary } from '../types';

/** Build a Block for tests. Defaults: flexible task, priority 3, planned, 60-min minimum-shrink 30. */
export function makeBlock(overrides: Partial<Block> & Pick<Block, 'id' | 'start' | 'end'>): Block {
  const duration = overrides.end - overrides.start;
  return {
    title: overrides.id,
    kind: 'task',
    anchor: false,
    priority: 3,
    minMinutes: overrides.anchor ? duration : Math.ceil(duration / 2),
    window: null,
    tags: [],
    checklist: [],
    recoveryVariant: null,
    status: 'planned',
    source: 'template',
    ...overrides,
  };
}

/** Build a DaySummary for tests with everything "not logged" by default. */
export function makeDay(overrides: Partial<DaySummary> & Pick<DaySummary, 'date'>): DaySummary {
  return {
    sleepHours: null,
    morningEnergy: null,
    stress: null,
    deepWorkMin: null,
    restSessionsTaken: 0,
    trainedOnRestDay: false,
    unplannedIndulgenceMin: null,
    anchorsTotal: 0,
    anchorsSkipped: 0,
    ...overrides,
  };
}
