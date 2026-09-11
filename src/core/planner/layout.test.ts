import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import type { Block } from '../types';
import { layout } from './layout';

// Day: wake 07:00 (420), wind-down starts 22:00 (1320)
const WAKE = 420;
const UNTIL = 1320;

const times = (blocks: Block[]) =>
  Object.fromEntries(blocks.map((b) => [b.id, [b.start, b.end, b.status] as const]));

describe('layout', () => {
  it('leaves a plan that already fits untouched', () => {
    const blocks = [
      makeBlock({ id: 'a', start: 540, end: 600 }),
      makeBlock({ id: 'b', start: 900, end: 960 }),
    ];
    const result = layout({ blocks, now: 480, wake: WAKE, until: UNTIL });
    expect(times(result.blocks)).toEqual({ a: [540, 600, 'planned'], b: [900, 960, 'planned'] });
    expect(result.conflicts).toEqual([]);
  });

  it('never pulls flexible blocks earlier than their original start', () => {
    const blocks = [makeBlock({ id: 'rest', kind: 'rest', start: 900, end: 960 })];
    const result = layout({ blocks, now: 480, wake: WAKE, until: UNTIL });
    expect(times(result.blocks)).toEqual({ rest: [900, 960, 'planned'] });
  });

  it('pulls a block earlier only when the day would not fit otherwise', () => {
    // wind-down moved to 21:00 (1260); b was planned at 21:00 and must move up to 20:30
    const blocks = [
      makeBlock({ id: 'a', start: 1200, end: 1230, minMinutes: 30 }),
      makeBlock({ id: 'b', start: 1260, end: 1290, minMinutes: 30 }),
    ];
    const result = layout({ blocks, now: 1100, wake: WAKE, until: 1260 });
    expect(times(result.blocks)).toEqual({ a: [1200, 1230, 'planned'], b: [1230, 1260, 'planned'] });
  });

  it('running late pushes flexible blocks back and keeps their order', () => {
    const blocks = [
      makeBlock({ id: 'a', start: 540, end: 600 }),
      makeBlock({ id: 'b', start: 600, end: 660 }),
    ];
    const result = layout({ blocks, now: 540, earliest: 570, wake: WAKE, until: UNTIL, keepRunning: false });
    expect(times(result.blocks)).toEqual({ a: [570, 630, 'planned'], b: [630, 690, 'planned'] });
  });

  it('keeps fixed anchors in place and flows flexible blocks around them', () => {
    const blocks = [
      makeBlock({ id: 'task', start: 540, end: 660 }),
      makeBlock({ id: 'gym', anchor: true, kind: 'training', start: 600, end: 660 }),
    ];
    const result = layout({ blocks, now: 480, wake: WAKE, until: UNTIL });
    // task can't fit 540–600 (60 min free) at 120 min, so it moves after the anchor
    expect(times(result.blocks)).toEqual({ task: [660, 780, 'planned'], gym: [600, 660, 'planned'] });
  });

  it('marks a fixed anchor inside lost time as missed', () => {
    const blocks = [makeBlock({ id: 'gym', anchor: true, start: 900, end: 960 })];
    const result = layout({
      blocks,
      now: 600,
      wake: WAKE,
      until: UNTIL,
      unavailable: [{ start: 840, end: 1020 }],
    });
    expect(result.blocks[0]!.status).toBe('missed');
    expect(result.missedReasons).toEqual({ gym: 'Clashes with the time you lost' });
  });

  it('moves a windowed anchor inside its window, or marks it missed when there is no room', () => {
    const windowed = makeBlock({
      id: 'deep',
      anchor: true,
      start: 540,
      end: 660,
      window: { earliestStart: 480, latestEnd: 780 },
    });
    const moved = layout({ blocks: [windowed], now: 480, wake: WAKE, until: UNTIL, unavailable: [{ start: 500, end: 600 }] });
    expect(times(moved.blocks)).toEqual({ deep: [600, 720, 'planned'] });

    const noRoom = layout({ blocks: [windowed], now: 480, wake: WAKE, until: UNTIL, unavailable: [{ start: 480, end: 700 }] });
    expect(noRoom.blocks[0]!.status).toBe('missed');
    expect(noRoom.missedReasons.deep).toBe('No free time left inside its window');
  });

  it('shrinks lowest priority first, then drops lowest priority first', () => {
    // 60 free minutes (1200–1260) for three blocks
    const blocks = [
      makeBlock({ id: 'high', priority: 5, start: 1200, end: 1240, minMinutes: 20 }),
      makeBlock({ id: 'mid', priority: 3, start: 1240, end: 1280, minMinutes: 20 }),
      makeBlock({ id: 'low', priority: 1, start: 1280, end: 1320, minMinutes: 20 }),
    ];
    // now = 1199 so nothing is "running" yet (a block starting exactly at now counts as running)
    const result = layout({ blocks, now: 1199, wake: WAKE, until: 1260 });
    // shrink low→20, mid→20, high→20 = 60 → fits
    expect(times(result.blocks)).toEqual({
      high: [1200, 1220, 'planned'],
      mid: [1220, 1240, 'planned'],
      low: [1240, 1260, 'planned'],
    });

    const tighter = layout({ blocks, now: 1199, wake: WAKE, until: 1240 });
    expect(times(tighter.blocks)).toEqual({
      high: [1200, 1220, 'planned'],
      mid: [1220, 1240, 'planned'],
      low: [1280, 1320, 'dropped'],
    });
  });

  it('breaks priority ties by dropping the later block first', () => {
    const blocks = [
      makeBlock({ id: 'early', start: 1200, end: 1230, minMinutes: 30 }),
      makeBlock({ id: 'late', start: 1230, end: 1260, minMinutes: 30 }),
    ];
    const result = layout({ blocks, now: 1199, wake: WAKE, until: 1230 });
    expect(result.blocks.find((b) => b.id === 'late')!.status).toBe('dropped');
    expect(result.blocks.find((b) => b.id === 'early')!.status).toBe('planned');
  });

  it('keeps running blocks in place by default and moves them when keepRunning is false', () => {
    const running = makeBlock({ id: 'run', start: 600, end: 720 });
    const kept = layout({ blocks: [running], now: 630, wake: WAKE, until: UNTIL, unavailable: [{ start: 900, end: 960 }] });
    expect(times(kept.blocks)).toEqual({ run: [600, 720, 'planned'] });

    const moved = layout({ blocks: [running], now: 630, earliest: 650, wake: WAKE, until: UNTIL, keepRunning: false });
    expect(times(moved.blocks)).toEqual({ run: [650, 770, 'planned'] });
  });

  it('places placeFirst blocks at the earliest free minute, before everything else', () => {
    const blocks = [
      makeBlock({ id: 'task', start: 600, end: 660 }),
      makeBlock({ id: 'urgent', start: 600, end: 630, minMinutes: 30 }),
    ];
    const result = layout({ blocks, now: 600, wake: WAKE, until: UNTIL, keepRunning: false, placeFirst: ['urgent'] });
    expect(times(result.blocks)).toEqual({ urgent: [600, 630, 'planned'], task: [630, 690, 'planned'] });
  });

  it('never touches finished, skipped or past blocks', () => {
    const blocks = [
      makeBlock({ id: 'done', start: 600, end: 660, status: 'done' }),
      makeBlock({ id: 'skipped', start: 900, end: 960, status: 'skipped' }),
      makeBlock({ id: 'past', start: 480, end: 540 }),
    ];
    const result = layout({ blocks, now: 700, wake: WAKE, until: UNTIL, unavailable: [{ start: 880, end: 1000 }] });
    expect(times(result.blocks)).toEqual({
      past: [480, 540, 'planned'],
      done: [600, 660, 'done'],
      skipped: [900, 960, 'skipped'],
    });
  });

  it('reports overlapping fixed anchors as conflicts instead of dropping one', () => {
    const blocks = [
      makeBlock({ id: 'gym', anchor: true, start: 1020, end: 1080 }),
      makeBlock({ id: 'dinner', anchor: true, kind: 'routine', start: 1050, end: 1110 }),
    ];
    const result = layout({ blocks, now: 480, wake: WAKE, until: UNTIL });
    expect(result.conflicts).toEqual([['gym', 'dinner']]);
    expect(result.blocks.every((b) => b.status === 'planned')).toBe(true);
  });

  it('is deterministic', () => {
    const blocks = [
      makeBlock({ id: 'a', priority: 2, start: 600, end: 700 }),
      makeBlock({ id: 'b', priority: 2, start: 650, end: 800 }),
      makeBlock({ id: 'c', anchor: true, start: 720, end: 780 }),
    ];
    const input = { blocks, now: 600, wake: WAKE, until: 800, unavailable: [{ start: 610, end: 640 }] };
    expect(layout(input)).toEqual(layout(input));
  });
});
