import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import type { DayPlan } from '../types';
import { validateEdits } from './edits';

// wake 07:00 (420), bedtime 23:00 (1380) → wind-down starts 22:00 (1320)
function plan(): DayPlan {
  return {
    date: '2026-09-15',
    wake: 420,
    bedtime: 1380,
    blocks: [
      makeBlock({ id: 'deep', title: 'Deep work', start: 540, end: 660 }),
      makeBlock({ id: 'gym', title: 'Gym', start: 1020, end: 1080 }),
      makeBlock({ id: 'past', title: 'Breakfast', start: 450, end: 480, status: 'done' }),
    ],
  };
}

describe('validateEdits', () => {
  it('accepts a valid set of edits', () => {
    expect(
      validateEdits(plan(), 480, [
        { type: 'move', blockId: 'gym', toStart: 1080 },
        { type: 'drop', blockId: 'deep' },
      ]),
    ).toEqual([]);
  });

  it('refuses to move a block into the past', () => {
    const errors = validateEdits(plan(), 600, [{ type: 'move', blockId: 'gym', toStart: 540 }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('past');
  });

  it('refuses a block that would run past wind-down', () => {
    const errors = validateEdits(plan(), 480, [{ type: 'move', blockId: 'gym', toStart: 1290 }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('wind-down');
  });

  it('refuses to change a block that is already finished', () => {
    const errors = validateEdits(plan(), 480, [{ type: 'drop', blockId: 'past' }]);
    expect(errors).toHaveLength(1);
  });

  it('refuses a zero-length block', () => {
    const errors = validateEdits(plan(), 480, [{ type: 'resize', blockId: 'deep', durationMin: 0 }]);
    expect(errors).toHaveLength(1);
  });

  it('refuses a new block with no title', () => {
    const errors = validateEdits(plan(), 480, [
      { type: 'add', id: 'x', title: '   ', kind: 'task', start: 600, durationMin: 30, priority: 3 },
    ]);
    expect(errors).toHaveLength(1);
  });

  it('refuses two disruptions in one list', () => {
    const errors = validateEdits(plan(), 480, [
      { type: 'late', minutes: 30 },
      { type: 'lowEnergy', restId: 'r1' },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('one disruption');
  });
});
