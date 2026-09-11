import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import { diffBlocks } from './diff';

describe('diffBlocks', () => {
  const before = [
    makeBlock({ id: 'kept', start: 600, end: 660 }),
    makeBlock({ id: 'moved', start: 700, end: 760 }),
    makeBlock({ id: 'shrunk', start: 800, end: 860 }),
    makeBlock({ id: 'dropped', start: 900, end: 960 }),
    makeBlock({ id: 'missed', anchor: true, start: 1000, end: 1060 }),
    makeBlock({ id: 'done', start: 500, end: 560, status: 'done' }),
  ];
  const after = [
    before[0]!,
    { ...before[1]!, start: 720, end: 780 },
    { ...before[2]!, end: 830 },
    { ...before[3]!, status: 'dropped' as const },
    { ...before[4]!, status: 'missed' as const },
    before[5]!,
    makeBlock({ id: 'new', start: 1100, end: 1130 }),
  ];

  it('classifies each open block and skips finished ones', () => {
    const diff = diffBlocks(before, after, {
      addedIds: ['new'],
      missedReasons: { missed: 'Clashes with the time you lost' },
    });
    expect(diff.map((d) => [d.blockId, d.change, d.reason])).toEqual([
      ['kept', 'kept', ''],
      ['moved', 'moved', 'Moved to make room'],
      ['shrunk', 'shrunk', 'Shortened to fit the day'],
      ['dropped', 'dropped', "Lowest priority — it didn't fit"],
      ['missed', 'missed', 'Clashes with the time you lost'],
      ['new', 'added', 'New block'],
    ]);
    expect(diff.find((d) => d.blockId === 'moved')).toMatchObject({
      from: { start: 700, end: 760 },
      to: { start: 720, end: 780 },
    });
  });

  it('uses the custom shrink reason and detects recovery swaps', () => {
    const training = makeBlock({ id: 'push', kind: 'training', start: 1000, end: 1055, title: 'Push' });
    const diff = diffBlocks([training], [{ ...training, title: 'Mobility' }], { shrinkReason: 'Energy is low' });
    expect(diff[0]).toMatchObject({ change: 'swapped', reason: 'Swapped from "Push" for the recovery version' });

    const task = makeBlock({ id: 't', start: 600, end: 660 });
    const shrunk = diffBlocks([task], [{ ...task, end: 630 }], { shrinkReason: 'Shortened — energy is low' });
    expect(shrunk[0]!.reason).toBe('Shortened — energy is low');
  });
});
