/**
 * Plan-day clock. A plan day runs 04:00 → 04:00 local time, so a late night
 * belongs to the day it started. Times inside a plan day are "plan minutes":
 * minutes since local midnight of the plan date, in [240, 1680).
 * 01:30 after midnight is therefore 1530, not 90.
 */
export const DAY_START_MIN = 240;
export const DAY_END_MIN = 1680;

/** "HH:MM" → plan minute. Times before 04:00 belong to the next calendar day. */
export function toPlanMinute(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time "${hhmm}", expected HH:MM`);
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < DAY_START_MIN ? minutes + 1440 : minutes;
}

/** Plan minute → "HH:MM" wall-clock time. */
export function formatPlanMinute(minute: number): string {
  const wall = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(wall / 60);
  const m = wall % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** True if `timeZone` is a real IANA identifier `Intl` can resolve — e.g.
 * "Asia/Ho_Chi_Minh", not the abbreviation "ICT". Used to reject bad values
 * at Settings-save time instead of letting them reach `planClock` (which
 * throws) on every later page load. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export interface PlanClock {
  planDate: string; // YYYY-MM-DD
  minute: number; // plan minute
}

/** Where an instant falls on CT's plan-day clock in an IANA time zone. */
export function planClock(instant: Date, timeZone: string): PlanClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Missing ${type} in formatted date`);
    return part.value;
  };
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  if (minutes >= DAY_START_MIN) return { planDate: date, minute: minutes };
  return { planDate: addDays(date, -1), minute: minutes + 1440 };
}

/** Add days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weekday of a YYYY-MM-DD date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
