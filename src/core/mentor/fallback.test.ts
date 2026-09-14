import { describe, expect, it } from 'vitest';
import { capReachedMessage, eveningReviewFallback, routeFallbackText, weeklyReviewFallback } from './fallback';

describe('capReachedMessage', () => {
  it('names the first of the following month when today is mid-month', () => {
    const msg = capReachedMessage(new Date('2026-09-14T12:00:00Z'));
    expect(msg).toBe("Mentor's resting until October 1 — your plan, nudges and guard are all still running.");
  });

  it('rolls over the year when today is in December', () => {
    const msg = capReachedMessage(new Date('2026-12-20T12:00:00Z'));
    expect(msg).toBe("Mentor's resting until January 1 — your plan, nudges and guard are all still running.");
  });
});

describe('routeFallbackText', () => {
  it('gives each text route its own fallback, none of them shame-worded', () => {
    for (const route of ['briefing', 'chat', 'reflowComment'] as const) {
      const text = routeFallbackText(route);
      expect(text.length).toBeGreaterThan(0);
      expect(text.toLowerCase()).not.toContain('fail');
      expect(text.toLowerCase()).not.toContain('streak');
    }
  });
});

describe('eveningReviewFallback', () => {
  it('is a well-formed non-crisis structured fallback', () => {
    const fallback = eveningReviewFallback();
    expect(fallback.crisis).toBe(false);
    expect(fallback.message.length).toBeGreaterThan(0);
    expect(fallback.digest.length).toBeGreaterThan(0);
  });
});

describe('weeklyReviewFallback', () => {
  it('is a well-formed non-crisis structured fallback with no profile changes', () => {
    const fallback = weeklyReviewFallback();
    expect(fallback.crisis).toBe(false);
    expect(fallback.changes).toEqual([]);
    expect(fallback.letter.length).toBeGreaterThan(0);
  });
});
