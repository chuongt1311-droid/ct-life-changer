import type { Adjustment, Assessment, DaySummary, GuardState, Settings } from '../types';
import { RULES } from './rules';

/** When several states fire, the more protective one wins. */
const PRECEDENCE: GuardState[] = ['depleted', 'grinding', 'drifting'];

/** Spec §7 adjustments table. */
export function adjustmentsFor(state: GuardState, settings: Settings): Adjustment[] {
  const cap = settings.deepWorkDailyCapMin;
  switch (state) {
    case 'ready':
      return [];
    case 'drifting':
      return [
        { type: 'addEasyWin', reason: 'Start with a 15-minute win to get moving' },
        { type: 'addMorningAnchor', reason: 'A fixed start to the day gives it a spine' },
        { type: 'capRest', minutes: 45, reason: 'Shorter rest blocks make coming back easier' },
      ];
    case 'depleted':
      return [
        { type: 'trainingToRecovery', reason: "You're running low — recovery session instead of hard training" },
        { type: 'bedtimeEarlier', minutes: 30, reason: 'Sleep is the fix — bedtime 30 minutes earlier' },
        { type: 'dropLowPriority', maxPriority: 2, reason: 'Low-priority tasks can wait a day' },
        { type: 'capDeepWork', minutes: Math.floor(cap * 0.5), reason: 'Half your usual deep work, done well' },
      ];
    case 'grinding':
      return [
        { type: 'addMandatoryRest', at: '15:00', reason: "You've been grinding — a real break mid-afternoon" },
        { type: 'capDeepWork', minutes: cap, reason: 'Deep work capped at your daily limit' },
        { type: 'removeRestDayTraining', reason: 'Rest days are for resting' },
      ];
  }
}

/** Classify the last 7 days and propose adjustments for the next plan. */
export function assess(days: DaySummary[], settings: Settings): Assessment {
  const flags = RULES.map((rule) => rule(days, settings)).filter((f) => f !== null);
  const state = PRECEDENCE.find((s) => flags.some((f) => f.state === s)) ?? 'ready';
  return { state, flags, adjustments: adjustmentsFor(state, settings) };
}
