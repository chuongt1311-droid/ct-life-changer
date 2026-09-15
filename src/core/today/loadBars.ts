import type { Block, DaySummary, Settings } from '../types';
import type { LoadBarInput } from './loadBarInput';

export type { LoadBarInput };

export interface ComputeLoadBarsInput {
  blocks: Block[];
  today: DaySummary;
  settings: Settings;
}

const formatMin = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

/** Today screen's four load-bar readings (design/prototype/today.html
 * "Today's load"). Pure — every input is already-fetched data, no I/O. */
export function computeLoadBars({ blocks, today, settings }: ComputeLoadBarsInput): LoadBarInput[] {
  const training = blocks.filter((b) => b.kind === 'training');
  const trainingDone = training.filter((b) => b.status === 'done' || b.status === 'partial').length;
  // Nothing planned is an EMPTY track, never a full one: a filled bar reads as
  // "done" and would claim credit for training that was never scheduled.
  const bodyPercent = training.length === 0 ? 0 : Math.round((trainingDone / training.length) * 100);

  const deepWorkMin = today.deepWorkMin ?? 0;
  const cap = settings.deepWorkDailyCapMin;
  const workPercent = Math.min(100, Math.round((deepWorkMin / cap) * 100));
  const workRead = deepWorkMin > cap ? 'over' : deepWorkMin >= cap * 0.8 ? 'warn' : 'ok';

  const indulgeMin = today.unplannedIndulgenceMin ?? 0;
  const indulgeThreshold = settings.thresholds.indulgeHighMin;
  const screenPercent = Math.min(100, Math.round((indulgeMin / indulgeThreshold) * 100));
  const screenRead = indulgeMin > indulgeThreshold ? 'over' : indulgeMin >= indulgeThreshold * 0.8 ? 'warn' : 'ok';

  const restPlanned = blocks.filter((b) => b.kind === 'rest').length;
  const restTaken = today.restSessionsTaken;
  // Rest taken off-plan divided by zero planned and printed "1 of 0" on a full
  // bar. With none planned the count is reported on its own, and a plan that is
  // over-fulfilled still caps the track at full rather than overflowing it.
  const restPercent =
    restPlanned === 0 ? (restTaken > 0 ? 100 : 0) : Math.min(100, Math.round((restTaken / restPlanned) * 100));
  const restText =
    restPlanned === 0
      ? restTaken > 0
        ? `${restTaken} taken, none planned`
        : 'None planned'
      : `${restTaken} of ${restPlanned} rest sessions`;

  return [
    {
      name: 'Body',
      valueText: training.length === 0 ? 'None planned' : `${trainingDone} of ${training.length} sessions`,
      percent: bodyPercent,
      read: 'ok',
    },
    {
      name: 'Work & growth',
      valueText: deepWorkMin === 0 ? 'No deep work yet' : `${formatMin(deepWorkMin)} of ${formatMin(cap)} cap`,
      percent: workPercent,
      read: workRead,
    },
    {
      name: 'Screen time',
      valueText: indulgeMin === 0 ? 'Nothing unplanned logged' : `${formatMin(indulgeMin)} unplanned`,
      percent: screenPercent,
      read: screenRead,
    },
    {
      name: 'Rest & reflection',
      valueText: restText,
      percent: restPercent,
      read: 'ok',
    },
  ];
}
