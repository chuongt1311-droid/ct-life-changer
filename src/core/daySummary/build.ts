import type { BlockKind, BlockStatus, DaySummary } from '../types';

/** Hours of sleep between an evening bedtime and the next morning's wake time.
 * Assumes bedtime is in the evening (matches the default 23:00 and every
 * template CT has defined) — a bedtime after midnight is out of scope for v1. */
export function sleepHoursBetween(bedtime: string, wakeTime: string): number {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const bed = toMinutes(bedtime);
  const wake = toMinutes(wakeTime);
  const diff = wake <= bed ? wake + 1440 - bed : wake - bed;
  return Math.round((diff / 60) * 100) / 100;
}

export interface DaySummaryCheckin {
  type: 'morning' | 'evening';
  sections: Record<string, Record<string, unknown>>;
}

export interface DaySummaryBlock {
  anchor: boolean;
  kind: BlockKind;
  status: BlockStatus;
  start: number;
  end: number;
  tags: string[];
}

export interface DaySummaryInput {
  date: string;
  /** Whether this date's weekday template is a rest day. */
  isRestDay: boolean;
  checkins: DaySummaryCheckin[];
  blocks: DaySummaryBlock[];
  restSessionsCount: number;
  unplannedIndulgenceMinutes: number[];
}

const DONE_STATUSES: BlockStatus[] = ['done', 'partial'];
const SKIPPED_STATUSES: BlockStatus[] = ['skipped', 'missed'];

/** Turn one day's raw logged rows into the `DaySummary` the (already-built,
 * unmodified) burnout guard consumes. Pure — no I/O, no clock. */
export function buildDaySummary(input: DaySummaryInput): DaySummary {
  const morning = input.checkins.find((c) => c.type === 'morning');
  const evening = input.checkins.find((c) => c.type === 'evening');

  const morningBody = morning?.sections.body as { bedtime?: string; wakeTime?: string; energy?: number } | undefined;
  const morningMind = morning?.sections.mind as { stress?: number } | undefined;
  const eveningMind = evening?.sections.mind as { peakStress?: number } | undefined;

  const sleepHours =
    morningBody?.bedtime && morningBody?.wakeTime ? sleepHoursBetween(morningBody.bedtime, morningBody.wakeTime) : null;
  const morningEnergy = typeof morningBody?.energy === 'number' ? morningBody.energy : null;

  const stressValues = [morningMind?.stress, eveningMind?.peakStress].filter((v): v is number => typeof v === 'number');
  const stress = stressValues.length > 0 ? Math.max(...stressValues) : null;

  const deepWorkBlocks = input.blocks.filter((b) => b.tags.includes('deepWork') && DONE_STATUSES.includes(b.status));
  const deepWorkMin = deepWorkBlocks.length > 0 ? deepWorkBlocks.reduce((sum, b) => sum + (b.end - b.start), 0) : null;

  const anchorBlocks = input.blocks.filter((b) => b.anchor);
  const anchorsTotal = anchorBlocks.length;
  const anchorsSkipped = anchorBlocks.filter((b) => SKIPPED_STATUSES.includes(b.status)).length;

  const trainedOnRestDay =
    input.isRestDay && input.blocks.some((b) => b.kind === 'training' && DONE_STATUSES.includes(b.status));

  const unplannedIndulgenceMin =
    input.unplannedIndulgenceMinutes.length > 0 ? input.unplannedIndulgenceMinutes.reduce((sum, m) => sum + m, 0) : null;

  return {
    date: input.date,
    sleepHours,
    morningEnergy,
    stress,
    deepWorkMin,
    restSessionsTaken: input.restSessionsCount,
    trainedOnRestDay,
    unplannedIndulgenceMin,
    anchorsTotal,
    anchorsSkipped,
  };
}
