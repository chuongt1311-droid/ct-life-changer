import type { DaySummary, Flag, Settings } from '../types';

/** Spec §7. Every rule ignores days where its data wasn't logged. */
export type Rule = (days: DaySummary[], settings: Settings) => Flag | null;

/** Newest first, at most 7 days. */
export function recent(days: DaySummary[]): DaySummary[] {
  return [...days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
}

/** The newest `n` logged values of a field, or null if fewer than `n` were logged. */
function lastLogged(days: DaySummary[], pick: (d: DaySummary) => number | null, n: number): number[] | null {
  const values = recent(days)
    .map(pick)
    .filter((v): v is number => v !== null)
    .slice(0, n);
  return values.length === n ? values : null;
}

export const sleepLow: Rule = (days, { thresholds: t }) => {
  const nights = recent(days)
    .map((d) => d.sleepHours)
    .filter((v): v is number => v !== null)
    .slice(0, t.sleepLowWindow);
  const short = nights.filter((h) => h < t.sleepLowHours).length;
  if (short < t.sleepLowNights) return null;
  return {
    code: 'SLEEP_LOW',
    state: 'depleted',
    reason: `Under ${t.sleepLowHours}h sleep on ${short} of your last ${nights.length} nights`,
  };
};

export const energyLow: Rule = (days, { thresholds: t }) => {
  const values = lastLogged(days, (d) => d.morningEnergy, t.energyLowDays);
  if (!values || !values.every((v) => v <= t.energyLowMax)) return null;
  return {
    code: 'ENERGY_LOW',
    state: 'depleted',
    reason: `Morning energy ${t.energyLowMax} or lower for ${t.energyLowDays} logged days in a row`,
  };
};

export const stressHigh: Rule = (days, { thresholds: t }) => {
  const values = lastLogged(days, (d) => d.stress, t.stressHighDays);
  if (!values || !values.every((v) => v >= t.stressHighMin)) return null;
  return {
    code: 'STRESS_HIGH',
    state: 'depleted',
    reason: `Stress ${t.stressHighMin}+ for ${t.stressHighDays} logged days in a row`,
  };
};

export const grindHours: Rule = (days, { thresholds: t, deepWorkDailyCapMin }) => {
  const heavy = recent(days)
    .slice(0, t.grindWindow)
    .filter((d) => d.deepWorkMin !== null && d.deepWorkMin > deepWorkDailyCapMin && d.restSessionsTaken === 0);
  if (heavy.length < t.grindDays) return null;
  return {
    code: 'GRIND_HOURS',
    state: 'grinding',
    reason: `Over ${Math.round(deepWorkDailyCapMin / 60)}h of deep work with no rest on ${heavy.length} of the last ${t.grindWindow} days`,
  };
};

export const grindRestDays: Rule = (days, { thresholds: t }) => {
  const count = recent(days).filter((d) => d.trainedOnRestDay).length;
  if (count < t.grindRestDayTrainings) return null;
  return {
    code: 'GRIND_REST_DAYS',
    state: 'grinding',
    reason: `Trained on ${count} rest days this week`,
  };
};

export const indulgeHigh: Rule = (days, { thresholds: t }) => {
  const values = lastLogged(days, (d) => d.unplannedIndulgenceMin, t.indulgeHighDays);
  if (!values || !values.every((v) => v > t.indulgeHighMin)) return null;
  return {
    code: 'INDULGE_HIGH',
    state: 'drifting',
    reason: `More than ${t.indulgeHighMin / 60}h of unplanned screen time ${t.indulgeHighDays} days running`,
  };
};

export const anchorSkip: Rule = (days, { thresholds: t }) => {
  const withAnchors = recent(days)
    .filter((d) => d.anchorsTotal > 0)
    .slice(0, t.anchorSkipDays);
  if (withAnchors.length < t.anchorSkipDays) return null;
  if (!withAnchors.every((d) => d.anchorsSkipped / d.anchorsTotal >= t.anchorSkipRatio)) return null;
  const energies = withAnchors.map((d) => d.morningEnergy).filter((v): v is number => v !== null);
  if (energies.length === 0) return null;
  const avg = energies.reduce((sum, v) => sum + v, 0) / energies.length;
  if (avg < t.anchorSkipMinEnergy) return null;
  return {
    code: 'ANCHOR_SKIP',
    state: 'drifting',
    reason: `Skipped half your anchors ${t.anchorSkipDays} days running while energy was fine`,
  };
};

export const RULES: Rule[] = [sleepLow, energyLow, stressHigh, grindHours, grindRestDays, indulgeHigh, anchorSkip];
