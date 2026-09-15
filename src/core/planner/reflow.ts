import type { DayPlan } from '../types';
import { applyEdits, type ReflowEvent, type ReflowResult } from './edits';

// Re-exported so the many existing importers of these types keep working.
export type { ReflowEvent, ReflowResult };

/** Rebuild the rest of the day after a disruption. Wind-down starts 60 min
 *  before bedtime. A disruption is one PlanEdit, so this is a thin alias over
 *  applyEdits — kept because it names the spec §5.4 concept its callers use. */
export function reflow(plan: DayPlan, now: number, event: ReflowEvent): ReflowResult {
  return applyEdits(plan, now, [event]);
}
