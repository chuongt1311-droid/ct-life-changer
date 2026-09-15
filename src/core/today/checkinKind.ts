import { dayPhase } from './phase';

export type CheckinKind = 'morning' | 'evening';

/** Which check-in a plan minute belongs to, so one "Check-in" destination can
 * land on the right form instead of always opening the morning one. Derived
 * from `dayPhase` so there is a single set of day boundaries, not two. Pure. */
export function checkinKindFor(planMinute: number): CheckinKind {
  const phase = dayPhase(planMinute);
  return phase === 'first-light' || phase === 'day' ? 'morning' : 'evening';
}
