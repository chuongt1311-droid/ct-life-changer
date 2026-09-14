export type DayPhase = 'first-light' | 'day' | 'dusk' | 'night';

/** DESIGN.md "Day phases" / "The Labelled Phase Rule": the ground tint
 * follows a phase that is always also written in words. Boundaries chosen
 * to match the spec's 04:00 day start and a typical 23:00 bedtime. Pure. */
export function dayPhase(planMinute: number): DayPhase {
  const wall = planMinute % 1440;
  if (wall >= 240 && wall < 420) return 'first-light'; // 04:00–07:00
  if (wall >= 420 && wall < 1020) return 'day'; // 07:00–17:00
  if (wall >= 1020 && wall < 1260) return 'dusk'; // 17:00–21:00
  return 'night'; // 21:00–04:00
}
