import type { GuardState } from '../types';
import type { RestOutcome, WeekDay } from './weekly';

export interface WeekDayInput {
  date: string;
  hasCheckin: boolean;
  sleepHours: number | null;
  state: GuardState | null;
  trainingPlannedCount: number;
  trainingDoneCount: number;
  footballMinutes: number;
  learnedEntry: boolean;
}

/** Shapes one raw day into the `WeekDay` `weeklyMetrics` (Plan 1) consumes. Pure. */
export function buildWeekDay(input: WeekDayInput): WeekDay {
  return {
    date: input.date,
    hasCheckin: input.hasCheckin,
    sleepHours: input.sleepHours,
    state: input.state,
    trainingPlanned: input.trainingPlannedCount,
    trainingDone: input.trainingDoneCount,
    footballMinutes: input.footballMinutes,
    learnedNotes: input.learnedEntry ? 1 : 0,
  };
}

/** Spec §2 S3: minutes between a rest session ending and CT's "I'm back". Pure. */
export function restOutcomeFor(endedAt: string, reentryAckAt: string | null): RestOutcome {
  if (!reentryAckAt) return { ackDelayMin: null };
  const diffMs = new Date(reentryAckAt).getTime() - new Date(endedAt).getTime();
  return { ackDelayMin: Math.round(diffMs / 60000) };
}
