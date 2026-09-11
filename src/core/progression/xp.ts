import type { GuardState } from '../types';

/** Spec §8b.1: the six attributes of CT's player card. */
export const ATTRS = ['PHY', 'REC', 'ANL', 'DIS', 'MEN', 'CHR'] as const;
export type Attr = (typeof ATTRS)[number];

export const ATTR_NAMES: Record<Attr, string> = {
  PHY: 'Physical',
  REC: 'Recovery',
  ANL: 'Analytics',
  DIS: 'Discipline',
  MEN: 'Mentality',
  CHR: 'Character',
};

/** One logged day, as progression sees it. Built from check-ins, blocks and rest sessions. */
export interface ProgressDay {
  date: string; // YYYY-MM-DD
  state: GuardState;
  trainingDone: number;
  trainingPartial: number;
  proteinHit: boolean;
  waterL: number | null;
  sleepHours: number | null;
  restDayNoTraining: boolean;
  restSessionsTaken: number;
  /** Rest sessions whose "I'm back" came within 10 minutes of the planned end. */
  restReturnsOnTime: number;
  footballMinutes: number;
  learnedEntry: boolean;
  anchorsKept: number;
  easyWinDone: boolean;
  morningCheckin: boolean;
  eveningCheckin: boolean;
  /** Regulation tools used (guitar, walk, stretching, breathing, talked to someone). */
  regulations: number;
  gratitudeLines: number;
  winOrLesson: boolean;
  reachedOut: boolean;
}

export type XpByAttr = Record<Attr, number>;

export function zeroXp(): XpByAttr {
  return { PHY: 0, REC: 0, ANL: 0, DIS: 0, MEN: 0, CHR: 0 };
}

/** Spec §8b.1: XP earned by one day, after the guard-state multipliers, floored. Never negative. */
export function dayXp(d: ProgressDay): XpByAttr {
  const training = 40 * d.trainingDone + 20 * d.trainingPartial;
  const nutrition = (d.proteinHit ? 10 : 0) + (d.waterL !== null && d.waterL >= 3 ? 5 : 0);
  const sleep = d.sleepHours === null ? 0 : d.sleepHours >= 7 ? 30 : d.sleepHours >= 6 ? 10 : 0;
  const rec = sleep + 10 * d.restSessionsTaken + (d.restDayNoTraining ? 20 : 0);
  const anl = Math.min(d.footballMinutes, 240) + (d.learnedEntry ? 15 : 0);
  const dis = 10 * d.anchorsKept + 15 * d.restReturnsOnTime + (d.easyWinDone ? 30 : 0);
  const men = (d.morningCheckin ? 10 : 0) + (d.eveningCheckin ? 15 : 0) + 5 * Math.min(d.regulations, 3);
  const chr = 5 * Math.min(d.gratitudeLines, 3) + (d.winOrLesson ? 5 : 0) + (d.reachedOut ? 15 : 0);

  let phy = training + nutrition;
  let recM = 1;
  let anlM = 1;
  let disM = 1;
  if (d.state === 'depleted') {
    phy = (training + nutrition) * 0.5;
    anlM = 0.5;
    disM = 0.5;
    recM = 2;
  } else if (d.state === 'grinding') {
    phy = nutrition; // injury risk: training earns nothing
    anlM = 0.5;
    recM = 2;
  }

  return {
    PHY: Math.floor(phy),
    REC: Math.floor(rec * recM),
    ANL: Math.floor(anl * anlM),
    DIS: Math.floor(dis * disM),
    MEN: men,
    CHR: chr,
  };
}

/** Total XP per attribute over any set of days. */
export function totalXp(days: ProgressDay[]): XpByAttr {
  const total = zeroXp();
  for (const d of days) {
    const xp = dayXp(d);
    for (const a of ATTRS) total[a] += xp[a];
  }
  return total;
}
