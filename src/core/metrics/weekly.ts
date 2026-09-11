import type { GuardState } from '../types';

export interface WeekDay {
  date: string;
  hasCheckin: boolean;
  sleepHours: number | null;
  state: GuardState | null;
  trainingPlanned: number;
  trainingDone: number;
  footballMinutes: number;
  learnedNotes: number;
}

export interface RestOutcome {
  /** Minutes between the rest block's end and "I'm back"; null if CT never acknowledged. */
  ackDelayMin: number | null;
}

export interface WeeklyMetrics {
  s1: { checkinDays: number; target: number; met: boolean };
  s2: {
    nightsSleep7: number;
    target: number;
    depletedOrDriftingDays: number;
    previousDepletedOrDriftingDays: number | null;
    improving: boolean | null;
    met: boolean;
  };
  s3: { returned: number; ended: number; rate: number | null; target: number; met: boolean | null };
  s4: { trainingDone: number; trainingPlanned: number; footballMinutes: number; learnedNotes: number };
}

const badDays = (week: WeekDay[]) => week.filter((d) => d.state === 'depleted' || d.state === 'drifting').length;
const sum = (week: WeekDay[], pick: (d: WeekDay) => number) => week.reduce((total, d) => total + pick(d), 0);

/** Spec §2 success criteria S1–S4 for one week. `restOutcomes` holds only rest sessions that have ended. */
export function weeklyMetrics(week: WeekDay[], restOutcomes: RestOutcome[], previousWeek: WeekDay[] | null): WeeklyMetrics {
  const checkinDays = week.filter((d) => d.hasCheckin).length;

  const nightsSleep7 = week.filter((d) => d.sleepHours !== null && d.sleepHours >= 7).length;
  const current = badDays(week);
  const previous = previousWeek ? badDays(previousWeek) : null;
  const improving = previous === null ? null : current < previous || current === 0;

  const returned = restOutcomes.filter((r) => r.ackDelayMin !== null && r.ackDelayMin <= 10).length;
  const ended = restOutcomes.length;
  const rate = ended === 0 ? null : returned / ended;

  return {
    s1: { checkinDays, target: 5, met: checkinDays >= 5 },
    s2: {
      nightsSleep7,
      target: 5,
      depletedOrDriftingDays: current,
      previousDepletedOrDriftingDays: previous,
      improving,
      met: nightsSleep7 >= 5 && improving !== false,
    },
    s3: { returned, ended, rate, target: 0.7, met: rate === null ? null : rate >= 0.7 },
    s4: {
      trainingDone: sum(week, (d) => d.trainingDone),
      trainingPlanned: sum(week, (d) => d.trainingPlanned),
      footballMinutes: sum(week, (d) => d.footballMinutes),
      learnedNotes: sum(week, (d) => d.learnedNotes),
    },
  };
}
