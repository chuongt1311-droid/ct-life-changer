import { describe, expect, it } from 'vitest';
import { summarizeDiff } from './summarizeDiff';

describe('summarizeDiff', () => {
  it('one line per non-kept entry, kept entries omitted', () => {
    const summary = summarizeDiff([
      { blockId: '1', title: 'FPL pipeline', change: 'moved', from: { start: 1020, end: 1110 }, to: { start: 1065, end: 1155 }, reason: 'Moved to make room' },
      { blockId: '2', title: 'Dinner', change: 'kept', from: { start: 1140, end: 1170 }, to: { start: 1140, end: 1170 }, reason: '' },
      { blockId: '3', title: 'Second walk', change: 'dropped', from: { start: 1000, end: 1020 }, to: null, reason: "Lowest priority — it didn't fit" },
    ]);
    expect(summary).toBe('FPL pipeline: moved — Moved to make room. Second walk: dropped — Lowest priority — it did not fit.');
  });

  it('empty or all-kept diff summarizes as no changes', () => {
    expect(summarizeDiff([])).toBe('Nothing changed.');
  });
});
