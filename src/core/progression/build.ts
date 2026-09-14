import type { BlockStatus, GuardState } from '../types';
import type { ProgressDay } from './xp';

const DONE_STATUSES: BlockStatus[] = ['done', 'partial'];

export interface ProgressDayBlockInput {
  anchor: boolean;
  tags: string[];
  status: BlockStatus;
}

export interface ProgressDayInput {
  date: string;
  state: GuardState;
  isRestDay: boolean;
  sleepHours: number | null;
  morningCheckinDone: boolean;
  eveningCheckinDone: boolean;
  eveningBody: { training: 'done' | 'partial' | 'skipped' | 'rest'; protein: 'low' | 'ok' | 'hit'; waterL: number } | null;
  eveningMind: { regulated: string[] } | null;
  eveningWork: { footballAnalytics: { minutes: number; learned: string } } | null;
  eveningReflection: { gratitudeLines: string[]; lessonOfDay: string; winOfDay: string } | null;
  eveningPeople: { reachedOut: boolean } | null;
  blocks: ProgressDayBlockInput[];
  restSessionsCount: number;
  restReturnsOnTime: number;
}

/** Spec §8b.1: the progression-specific summary of one day, built from the
 * same raw rows `buildDaySummary` (Plan 1) reads — but for the guard's
 * coarser DaySummary, not this. Pure — no I/O, no clock. */
export function buildProgressDay(input: ProgressDayInput): ProgressDay {
  const training = input.eveningBody?.training ?? null;
  const trainedToday = training === 'done' || training === 'partial';
  const anchorsKept = input.blocks.filter((b) => b.anchor && DONE_STATUSES.includes(b.status)).length;
  const easyWinDone = input.blocks.some((b) => b.tags.includes('easyWin') && DONE_STATUSES.includes(b.status));
  const learned = input.eveningWork?.footballAnalytics.learned.trim() ?? '';
  const lesson = input.eveningReflection?.lessonOfDay.trim() ?? '';
  const win = input.eveningReflection?.winOfDay.trim() ?? '';

  return {
    date: input.date,
    state: input.state,
    trainingDone: training === 'done' ? 1 : 0,
    trainingPartial: training === 'partial' ? 1 : 0,
    proteinHit: input.eveningBody?.protein === 'hit',
    waterL: input.eveningBody?.waterL ?? null,
    sleepHours: input.sleepHours,
    restDayNoTraining: input.isRestDay && !trainedToday,
    restSessionsTaken: input.restSessionsCount,
    restReturnsOnTime: input.restReturnsOnTime,
    footballMinutes: input.eveningWork?.footballAnalytics.minutes ?? 0,
    learnedEntry: learned.length > 0,
    anchorsKept,
    easyWinDone,
    morningCheckin: input.morningCheckinDone,
    eveningCheckin: input.eveningCheckinDone,
    regulations: input.eveningMind?.regulated.length ?? 0,
    gratitudeLines: input.eveningReflection?.gratitudeLines.length ?? 0,
    winOrLesson: lesson.length > 0 || win.length > 0,
    reachedOut: input.eveningPeople?.reachedOut ?? false,
  };
}

/** Spec §8b.1 DIS bonus / §5.6 re-entry: "within 10 minutes of the planned end". */
export function restReturnedOnTime(endedAt: string, reentryAckAt: string | null): boolean {
  if (!reentryAckAt) return false;
  const diffMs = new Date(reentryAckAt).getTime() - new Date(endedAt).getTime();
  return diffMs >= 0 && diffMs <= 10 * 60 * 1000;
}
