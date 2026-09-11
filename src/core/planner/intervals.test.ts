import { describe, expect, it } from 'vitest';
import { contains, earliestFit, latestFit, normalize, overlaps, subtract } from './intervals';

describe('overlaps', () => {
  it('treats intervals as half-open', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(overlaps({ start: 0, end: 11 }, { start: 10, end: 20 })).toBe(true);
  });
});

describe('normalize', () => {
  it('sorts, merges touching and overlapping, drops empty', () => {
    expect(
      normalize([
        { start: 30, end: 40 },
        { start: 0, end: 10 },
        { start: 10, end: 15 },
        { start: 35, end: 50 },
        { start: 60, end: 60 },
      ]),
    ).toEqual([
      { start: 0, end: 15 },
      { start: 30, end: 50 },
    ]);
  });
});

describe('subtract', () => {
  it('cuts holes out of the base', () => {
    expect(subtract([{ start: 0, end: 100 }], [{ start: 20, end: 30 }, { start: 50, end: 60 }])).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 50 },
      { start: 60, end: 100 },
    ]);
  });

  it('removes base intervals that are fully covered', () => {
    expect(subtract([{ start: 10, end: 20 }], [{ start: 0, end: 30 }])).toEqual([]);
  });
});

describe('contains / earliestFit', () => {
  const free = [
    { start: 0, end: 20 },
    { start: 30, end: 100 },
  ];

  it('contains checks a single interval holds the target', () => {
    expect(contains(free, { start: 5, end: 20 })).toBe(true);
    expect(contains(free, { start: 15, end: 35 })).toBe(false);
  });

  it('earliestFit skips intervals that are too small', () => {
    expect(earliestFit(free, 0, 25)).toBe(30);
    expect(earliestFit(free, 10, 5)).toBe(10);
    expect(earliestFit(free, 0, 80)).toBeNull();
  });

  it('latestFit finds the latest start that ends by the deadline', () => {
    expect(latestFit(free, 100, 10)).toBe(90);
    expect(latestFit(free, 40, 10)).toBe(30);
    expect(latestFit(free, 35, 10)).toBe(10); // 30–35 too small, falls back to 0–20
    expect(latestFit(free, 100, 90)).toBeNull();
  });
});
