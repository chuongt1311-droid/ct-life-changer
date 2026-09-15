import { describe, expect, it } from 'vitest';
import { addDays, formatPlanMinute, isValidTimeZone, planClock, toPlanMinute, weekdayOf } from './time';

describe('toPlanMinute', () => {
  it('converts daytime HH:MM to minutes since midnight', () => {
    expect(toPlanMinute('07:00')).toBe(420);
    expect(toPlanMinute('23:30')).toBe(1410);
  });

  it('puts times before 04:00 on the next calendar day', () => {
    expect(toPlanMinute('00:30')).toBe(1470);
    expect(toPlanMinute('03:59')).toBe(1679);
    expect(toPlanMinute('04:00')).toBe(240);
  });

  it('rejects malformed input', () => {
    expect(() => toPlanMinute('7:00')).toThrow('Invalid time');
    expect(() => toPlanMinute('24:00')).toThrow('Invalid time');
  });
});

describe('formatPlanMinute', () => {
  it('round-trips with toPlanMinute', () => {
    for (const t of ['04:00', '07:05', '13:45', '23:59', '00:00', '03:30']) {
      expect(formatPlanMinute(toPlanMinute(t))).toBe(t);
    }
  });
});

describe('planClock', () => {
  it('keeps daytime on the same date', () => {
    expect(planClock(new Date('2026-09-11T14:20:00Z'), 'UTC')).toEqual({
      planDate: '2026-09-11',
      minute: 860,
    });
  });

  it('assigns 00:00–03:59 to the previous plan day', () => {
    expect(planClock(new Date('2026-09-11T02:30:00Z'), 'UTC')).toEqual({
      planDate: '2026-09-10',
      minute: 1590,
    });
  });

  it('respects the time zone', () => {
    // 01:30 UTC = 21:30 the previous evening in New York (UTC-4 in September)
    expect(planClock(new Date('2026-09-11T01:30:00Z'), 'America/New_York')).toEqual({
      planDate: '2026-09-10',
      minute: 1290,
    });
  });
});

describe('isValidTimeZone', () => {
  it('accepts real IANA identifiers', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
  });

  it('rejects common non-IANA abbreviations ICU has no alias for', () => {
    // "ICT" (Indochina Time) is exactly the invalid value that broke
    // ensureTodayPlan in production — it has no ICU legacy alias, unlike
    // e.g. "PST", which Intl does resolve.
    expect(isValidTimeZone('ICT')).toBe(false);
    expect(isValidTimeZone('GMT+7')).toBe(false);
  });

  it('rejects empty and garbage input', () => {
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('not a timezone')).toBe(false);
  });
});

describe('date helpers', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('returns weekday with Sunday = 0', () => {
    expect(weekdayOf('2026-09-13')).toBe(0); // Sunday
    expect(weekdayOf('2026-09-14')).toBe(1); // Monday
  });
});
