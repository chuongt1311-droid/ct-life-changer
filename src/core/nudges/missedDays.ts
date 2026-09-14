export interface DayCheckinStatus {
  date: string;
  /** True if a morning or evening checkin row exists for this date. */
  hadCheckin: boolean;
}

/** Spec §5.9: "after 2 consecutive days with no check-in". `days` must be
 * sorted ascending by date, ending the day before "today". Counts only the
 * trailing run of misses — a check-in anywhere breaks the streak. */
export function countTrailingMisses(days: DayCheckinStatus[]): number {
  let count = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]!.hadCheckin) break;
    count++;
  }
  return count;
}

/** Spec §9: welcome-back fires "once", then nothing more until CT returns.
 * True once a welcome-back nudge has already gone out on or after the day
 * the current drought began (the day after CT's last check-in). */
export function welcomeBackAlreadySent(sentWelcomeBackDates: string[], droughtStartDate: string): boolean {
  return sentWelcomeBackDates.some((d) => d >= droughtStartDate);
}
