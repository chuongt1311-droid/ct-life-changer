import { describe, expect, it } from 'vitest';
import { capStatus, computeCostUsd } from './cost';

describe('computeCostUsd', () => {
  it('prices each token type separately', () => {
    // Sonnet 5: 10k input ($0.02) + 1k output ($0.01) + 20k cache read ($0.004) + 5k cache write ($0.0125)
    expect(
      computeCostUsd('claude-sonnet-5', { inputTokens: 10_000, outputTokens: 1_000, cacheReadTokens: 20_000, cacheWriteTokens: 5_000 }),
    ).toBeCloseTo(0.0465, 6);
  });

  it('refuses unknown models so a typo in settings is noticed', () => {
    expect(() => computeCostUsd('claude-typo', { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 })).toThrow(
      'No price configured',
    );
  });
});

describe('capStatus', () => {
  it('reports remaining budget and pauses at the cap', () => {
    expect(capStatus(4.5, 12)).toEqual({ spentUsd: 4.5, capUsd: 12, remainingUsd: 7.5, over: false });
    expect(capStatus(12, 12).over).toBe(true);
    expect(capStatus(13, 12).remainingUsd).toBe(0);
  });
});
