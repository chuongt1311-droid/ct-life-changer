import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import type { DayPlan } from '../types';
import { applyEdits, validateEdits } from './edits';

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

describe('applyEdits', () => {
  it('moves a block to exactly where CT put it', () => {
    const { plan: next, diff } = applyEdits(plan(), 480, [{ type: 'move', blockId: 'gym', toStart: 1140 }]);
    const gym = next.blocks.find((b) => b.id === 'gym')!;
    expect(gym.start).toBe(1140);
    expect(gym.end).toBe(1200);
    expect(diff.find((d) => d.blockId === 'gym')).toMatchObject({ change: 'moved', reason: 'You moved it' });
  });

  it('resizes a block and lowers minMinutes so the new length stays valid', () => {
    const { plan: next } = applyEdits(plan(), 480, [{ type: 'resize', blockId: 'deep', durationMin: 40 }]);
    const deep = next.blocks.find((b) => b.id === 'deep')!;
    expect(deep.end - deep.start).toBe(40);
    expect(deep.minMinutes).toBeLessThanOrEqual(40);
  });

  it('marks a dropped block skipped, never dropped', () => {
    const { plan: next, diff } = applyEdits(plan(), 480, [{ type: 'drop', blockId: 'deep' }]);
    expect(next.blocks.find((b) => b.id === 'deep')!.status).toBe('skipped');
    expect(diff.find((d) => d.blockId === 'deep')).toMatchObject({ change: 'skipped', reason: 'You skipped it' });
  });

  it('adds a block at the time CT chose and reports it as added', () => {
    const { plan: next, diff } = applyEdits(plan(), 480, [
      { type: 'add', id: 'coach', title: 'Call with coach', kind: 'task', start: 900, durationMin: 45, priority: 3 },
    ]);
    const coach = next.blocks.find((b) => b.id === 'coach')!;
    expect(coach.start).toBe(900);
    expect(coach.end).toBe(945);
    expect(coach.source).toBe('manual');
    expect(diff.find((d) => d.blockId === 'coach')).toMatchObject({ change: 'added', reason: 'You added it' });
  });

  it('applies several edits as one pass', () => {
    const { plan: next } = applyEdits(plan(), 480, [
      { type: 'drop', blockId: 'deep' },
      { type: 'move', blockId: 'gym', toStart: 1140 },
    ]);
    expect(next.blocks.find((b) => b.id === 'deep')!.status).toBe('skipped');
    expect(next.blocks.find((b) => b.id === 'gym')!.start).toBe(1140);
  });

  it('accepts a disruption and a block edit in the same list', () => {
    const { plan: next } = applyEdits(plan(), 480, [
      { type: 'late', minutes: 30 },
      { type: 'drop', blockId: 'deep' },
    ]);
    expect(next.blocks.find((b) => b.id === 'deep')!.status).toBe('skipped');
    expect(next.blocks.find((b) => b.id === 'gym')!.start).toBeGreaterThanOrEqual(510);
  });

  it('leaves a block CT did not touch describable as a consequence', () => {
    // Pinning gym over study's slot forces the planner to move study itself.
    const base = plan();
    base.blocks.push(makeBlock({ id: 'study', title: 'Study', start: 1080, end: 1140 }));
    const { diff } = applyEdits(base, 480, [{ type: 'move', blockId: 'gym', toStart: 1080 }]);
    const study = diff.find((d) => d.blockId === 'study')!;
    expect(study.reason).toBe('Moved to make room');
  });
});
