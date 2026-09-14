import { describe, expect, it } from 'vitest';
import { countTrailingMisses, welcomeBackAlreadySent, type DayCheckinStatus } from './missedDays';

describe('countTrailingMisses', () => {
  it('is 0 for an empty history', () => {
    expect(countTrailingMisses([])).toBe(0);
  });

  it('is 0 when the most recent day had a check-in', () => {
    const days: DayCheckinStatus[] = [
      { date: '2026-09-10', hadCheckin: false },
      { date: '2026-09-11', hadCheckin: true },
    ];
    expect(countTrailingMisses(days)).toBe(0);
  });

  it('counts only the trailing run of missed days', () => {
    const days: DayCheckinStatus[] = [
      { date: '2026-09-09', hadCheckin: false },
      { date: '2026-09-10', hadCheckin: true },
      { date: '2026-09-11', hadCheckin: false },
      { date: '2026-09-12', hadCheckin: false },
      { date: '2026-09-13', hadCheckin: false },
    ];
    expect(countTrailingMisses(days)).toBe(3);
  });
});

describe('welcomeBackAlreadySent', () => {
  it('is false when no welcome-back nudge has gone out since the drought began', () => {
    expect(welcomeBackAlreadySent(['2026-09-01'], '2026-09-10')).toBe(false);
  });

  it('is true once a welcome-back nudge was sent on or after the drought start', () => {
    expect(welcomeBackAlreadySent(['2026-09-01', '2026-09-11'], '2026-09-10')).toBe(true);
  });
});
