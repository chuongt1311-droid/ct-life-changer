import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import { blockFromTemplate, defaultMinMinutes, toRecovery } from './blocks';

describe('defaultMinMinutes', () => {
  it('follows spec §5.2', () => {
    expect(defaultMinMinutes('training', true, 55)).toBe(55);
    expect(defaultMinMinutes('rest', false, 60)).toBe(15);
    expect(defaultMinMinutes('rest', false, 10)).toBe(10);
    expect(defaultMinMinutes('task', false, 45)).toBe(23);
  });
});

describe('blockFromTemplate', () => {
  it('converts times, ids, checklist and defaults', () => {
    const b = blockFromTemplate(
      {
        key: 'push',
        title: 'Push + neck',
        kind: 'training',
        anchor: true,
        priority: 5,
        start: '17:00',
        durationMin: 55,
        tags: ['hardTraining'],
        checklist: ['Clap push-ups 3x5'],
        window: { earliestStart: '16:00', latestEnd: '20:00' },
      },
      '2026-09-14',
    );
    expect(b).toMatchObject({
      id: '2026-09-14:push',
      start: 1020,
      end: 1075,
      minMinutes: 55,
      window: { earliestStart: 960, latestEnd: 1200 },
      checklist: [{ label: 'Clap push-ups 3x5', done: false }],
      status: 'planned',
      source: 'template',
    });
  });
});

describe('toRecovery', () => {
  const hard = makeBlock({
    id: 'push',
    start: 1020,
    end: 1075,
    kind: 'training',
    tags: ['hardTraining'],
    recoveryVariant: { title: 'Mobility + handstand practice', checklist: ['Deep squat hold 2x60s'] },
  });

  it('swaps title, checklist and tags', () => {
    expect(toRecovery(hard)).toMatchObject({
      title: 'Mobility + handstand practice',
      checklist: [{ label: 'Deep squat hold 2x60s', done: false }],
      tags: ['recovery'],
    });
  });

  it('leaves non-hard-training blocks alone', () => {
    const task = makeBlock({ id: 't', start: 600, end: 660 });
    expect(toRecovery(task)).toBe(task);
  });
});
