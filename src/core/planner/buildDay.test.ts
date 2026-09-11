import { describe, expect, it } from 'vitest';
import { type Block, DEFAULT_SETTINGS, type DayTemplate } from '../types';
import { buildDay } from './buildDay';

const monday: DayTemplate = {
  weekday: 1,
  restDay: false,
  blocks: [
    { key: 'deep', title: 'Deep work', kind: 'task', anchor: false, priority: 4, start: '09:00', durationMin: 240, tags: ['deepWork'] },
    { key: 'lunch', title: 'Lunch', kind: 'routine', anchor: true, priority: 3, start: '13:00', durationMin: 45 },
    { key: 'chores', title: 'Chores', kind: 'task', anchor: false, priority: 2, start: '14:00', durationMin: 60 },
    { key: 'study', title: 'xT study', kind: 'task', anchor: false, priority: 3, start: '15:00', durationMin: 180, tags: ['deepWork'] },
    {
      key: 'push',
      title: 'Push + neck',
      kind: 'training',
      anchor: true,
      priority: 5,
      start: '18:00',
      durationMin: 55,
      tags: ['hardTraining'],
      recoveryVariant: { title: 'Mobility + handstand practice', checklist: ['Deep squat hold 2x60s'] },
    },
    { key: 'game', title: 'Gaming', kind: 'rest', anchor: false, priority: 3, start: '20:00', durationMin: 90 },
    { key: 'late', title: 'Reading', kind: 'task', anchor: false, priority: 3, start: '21:30', durationMin: 30 },
  ],
};

const DATE = '2026-09-14';
const find = (blocks: Block[], key: string) => blocks.find((b) => b.id === `${DATE}:${key}`)!;

describe('buildDay', () => {
  it('builds the template as-is and adds wind-down 60 min before bedtime', () => {
    const { plan, conflicts } = buildDay(monday, DATE, DEFAULT_SETTINGS);
    expect(plan).toMatchObject({ date: DATE, wake: 420, bedtime: 1380 });
    expect(find(plan.blocks, 'deep')).toMatchObject({ start: 540, end: 780, status: 'planned' });
    expect(find(plan.blocks, 'wind-down')).toMatchObject({ start: 1320, end: 1380, anchor: true });
    expect(conflicts).toEqual([]);
  });

  it('depleted: recovery training, earlier bedtime, low priority dropped, deep work capped', () => {
    const { plan } = buildDay(monday, DATE, DEFAULT_SETTINGS, [
      { type: 'trainingToRecovery', reason: '' },
      { type: 'bedtimeEarlier', minutes: 30, reason: '' },
      { type: 'dropLowPriority', maxPriority: 2, reason: '' },
      { type: 'capDeepWork', minutes: 180, reason: '' },
    ]);
    expect(plan.bedtime).toBe(1350);
    expect(find(plan.blocks, 'wind-down')).toMatchObject({ start: 1290, end: 1350 });
    expect(find(plan.blocks, 'push').title).toBe('Mobility + handstand practice');
    expect(find(plan.blocks, 'chores').status).toBe('dropped');
    // 180 min cap: deep (240) is cut to 180, study (180) no longer fits in the cap → dropped
    expect(find(plan.blocks, 'deep')).toMatchObject({ start: 540, end: 720 });
    expect(find(plan.blocks, 'study').status).toBe('dropped');
    // reading was at 21:30, wind-down now starts 21:30 → it moves up to fit
    expect(find(plan.blocks, 'late')).toMatchObject({ start: 1260, end: 1290, status: 'planned' });
  });

  it('drifting: easy win first thing, morning anchor, rest capped at 45', () => {
    const { plan } = buildDay(monday, DATE, DEFAULT_SETTINGS, [
      { type: 'capRest', minutes: 45, reason: '' },
      { type: 'addEasyWin', reason: '' },
      { type: 'addMorningAnchor', reason: '' },
    ]);
    expect(find(plan.blocks, 'morning-routine')).toMatchObject({ start: 420, end: 450, anchor: true, source: 'guard' });
    expect(find(plan.blocks, 'easy-win')).toMatchObject({ start: 450, end: 465 });
    expect(find(plan.blocks, 'game')).toMatchObject({ start: 1200, end: 1245 });
  });

  it('grinding: mandatory rest lands in its afternoon window', () => {
    const { plan } = buildDay(monday, DATE, DEFAULT_SETTINGS, [{ type: 'addMandatoryRest', at: '15:00', reason: '' }]);
    const rest = find(plan.blocks, 'mandatory-rest');
    expect(rest).toMatchObject({ start: 900, end: 930, anchor: true });
    // study was 15:00–18:00; it now starts after the rest
    expect(find(plan.blocks, 'study').start).toBeGreaterThanOrEqual(930);
  });

  it('applies adjustments in a fixed order no matter how they arrive', () => {
    const a = buildDay(monday, DATE, DEFAULT_SETTINGS, [
      { type: 'addEasyWin', reason: '' },
      { type: 'bedtimeEarlier', minutes: 30, reason: '' },
    ]);
    const b = buildDay(monday, DATE, DEFAULT_SETTINGS, [
      { type: 'bedtimeEarlier', minutes: 30, reason: '' },
      { type: 'addEasyWin', reason: '' },
    ]);
    expect(a).toEqual(b);
  });

  it('rejects settings where bedtime is not after wake + 60', () => {
    expect(() => buildDay(monday, DATE, { ...DEFAULT_SETTINGS, wakeTime: '22:30', bedtime: '23:00' })).toThrow('Bedtime');
  });
});
