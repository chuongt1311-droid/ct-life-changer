import { describe, expect, it } from 'vitest';
import { costToNext, levelFromXp, MAX_RATING, START_RATING, xpToMax } from './curve';

describe('costToNext', () => {
  it('matches the spec §8b.1 anchor points', () => {
    expect(costToNext(40)).toBe(20);
    expect(costToNext(60)).toBe(64);
    expect(costToNext(80)).toBe(206);
    expect(costToNext(98)).toBe(587);
  });
});

describe('levelFromXp', () => {
  it('starts every attribute at 40', () => {
    expect(levelFromXp(0)).toEqual({ rating: START_RATING, intoLevel: 0, toNext: 20 });
  });

  it('carries leftover XP into the next point', () => {
    // 40→41 costs 20, 41→42 costs 21
    expect(levelFromXp(30)).toEqual({ rating: 41, intoLevel: 10, toNext: 11 });
  });

  it('caps at 99 and reports nothing left to earn', () => {
    expect(levelFromXp(xpToMax())).toEqual({ rating: MAX_RATING, intoLevel: 0, toNext: 0 });
    expect(levelFromXp(1_000_000).rating).toBe(MAX_RATING);
  });

  it('reaching 99 takes roughly 10,000 XP', () => {
    expect(xpToMax()).toBeGreaterThan(9_500);
    expect(xpToMax()).toBeLessThan(10_500);
  });

  it('never gives a lower rating for more XP', () => {
    let previous = START_RATING;
    for (let xp = 0; xp <= 12_000; xp += 37) {
      const { rating } = levelFromXp(xp);
      expect(rating).toBeGreaterThanOrEqual(previous);
      previous = rating;
    }
  });
});
