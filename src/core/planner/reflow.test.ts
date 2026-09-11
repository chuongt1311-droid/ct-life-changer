import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import type { DayPlan } from '../types';
import { reflow } from './reflow';

// wake 07:00 (420), bedtime 23:00 (1380) → wind-down 22:00 (1320)
function plan(): DayPlan {
  return {
    date: '2026-09-14',
    wake: 420,
    bedtime: 1380,
    blocks: [
      makeBlock({ id: 'deep', title: 'Deep work', start: 540, end: 660, tags: ['deepWork'] }),
      makeBlock({ id: 'lunch', title: 'Lunch', kind: 'routine', anchor: true, start: 720, end: 765 }),
      makeBlock({ id: 'study', title: 'xT study', start: 780, end: 870, priority: 2 }),
      makeBlock({
        id: 'push',
        title: 'Push + neck',
        kind: 'training',
        anchor: true,
        priority: 5,
        start: 1020,
        end: 1075,
        tags: ['hardTraining'],
        recoveryVariant: { title: 'Mobility + handstand practice', checklist: ['Deep squat hold'] },
      }),
      makeBlock({ id: 'game', title: 'Gaming', kind: 'rest', start: 1200, end: 1260, minMinutes: 15 }),
      makeBlock({ id: 'wind', title: 'Wind down', kind: 'routine', anchor: true, start: 1320, end: 1380, tags: ['windDown'] }),
    ],
  };
}

const find = (p: DayPlan, id: string) => p.blocks.find((b) => b.id === id)!;

describe('reflow', () => {
  it('late: re-places the current block after the delay and pushes what follows', () => {
    const { plan: next, diff } = reflow(plan(), 540, { type: 'late', minutes: 30 });
    expect([find(next, 'deep').start, find(next, 'deep').end]).toEqual([570, 690]);
    expect(find(next, 'lunch').start).toBe(720); // fixed anchor unaffected
    expect(diff.find((d) => d.blockId === 'deep')!.change).toBe('moved');
  });

  it('lostTime: moves flexible blocks past the gap and misses a fixed anchor inside it', () => {
    const { plan: next, diff } = reflow(plan(), 700, { type: 'lostTime', start: 960, end: 1140 });
    expect(find(next, 'push').status).toBe('missed');
    expect(diff.find((d) => d.blockId === 'push')).toMatchObject({
      change: 'missed',
      reason: 'Clashes with the time you lost',
    });
    expect(find(next, 'game').start).toBe(1200); // after the gap, untouched
  });

  it('urgent: inserts the new block now and pushes the current one after it', () => {
    const { plan: next, diff } = reflow(plan(), 780, {
      type: 'urgent',
      id: 'u1',
      title: 'Fix form for school',
      durationMin: 30,
      priority: 4,
    });
    expect([find(next, 'u1').start, find(next, 'u1').end]).toEqual([780, 810]);
    expect(find(next, 'study').start).toBe(810);
    expect(diff.find((d) => d.blockId === 'u1')!.change).toBe('added');
  });

  it('lowEnergy: adds a recharge block, shrinks tasks, swaps hard training for recovery', () => {
    const { plan: next, diff } = reflow(plan(), 530, { type: 'lowEnergy', restId: 'r1' });
    expect([find(next, 'r1').start, find(next, 'r1').end]).toEqual([530, 545]);
    expect(find(next, 'deep').end - find(next, 'deep').start).toBe(60);
    expect(find(next, 'push').title).toBe('Mobility + handstand practice');
    expect(diff.find((d) => d.blockId === 'deep')).toMatchObject({ change: 'shrunk', reason: 'Shortened — energy is low' });
    expect(diff.find((d) => d.blockId === 'push')!.change).toBe('swapped');
  });

  it('drops the lowest-priority block when a big loss leaves no room', () => {
    // lose 12:50–21:00: study (priority 2) and gaming can't fit before wind-down
    const { plan: next } = reflow(plan(), 700, { type: 'lostTime', start: 770, end: 1290 });
    expect(find(next, 'study').status).toBe('dropped');
    expect(find(next, 'game').status).toBe('planned');
    expect(find(next, 'game').end).toBeLessThanOrEqual(1320);
  });
});
