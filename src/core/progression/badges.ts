import type { ProgressDay } from './xp';

export type Tier = 'bronze' | 'silver' | 'gold' | 'hof';
export const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'hof'];
export const TIER_NAMES: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', hof: 'Hall of Fame' };

export interface BadgeDef {
  id: string;
  name: string;
  /** What the badge counts, in plain words. */
  counts: string;
  /** Thresholds for bronze, silver, gold, Hall of Fame. */
  thresholds: [number, number, number, number];
  /** Cumulative count over all days. Totals only — never consecutive days. */
  count: (days: ProgressDay[]) => number;
}

const sum = (days: ProgressDay[], pick: (d: ProgressDay) => number) => days.reduce((t, d) => t + pick(d), 0);

/** Spec §8b.3. */
export const BADGES: BadgeDef[] = [
  { id: 'clutch-returner', name: 'Clutch Returner', counts: 'rests you came back from on time', thresholds: [10, 40, 120, 300], count: (ds) => sum(ds, (d) => d.restReturnsOnTime) },
  { id: 'iron-sleeper', name: 'Iron Sleeper', counts: 'nights of 7 hours or more', thresholds: [10, 40, 120, 300], count: (ds) => sum(ds, (d) => (d.sleepHours !== null && d.sleepHours >= 7 ? 1 : 0)) },
  { id: 'film-room', name: 'Film Room', counts: 'hours of football analytics', thresholds: [10, 50, 150, 400], count: (ds) => Math.floor(sum(ds, (d) => d.footballMinutes) / 60) },
  { id: 'anchor', name: 'Anchor', counts: 'anchors kept', thresholds: [25, 100, 300, 800], count: (ds) => sum(ds, (d) => d.anchorsKept) },
  { id: 'workhorse', name: 'Workhorse', counts: 'training sessions done', thresholds: [10, 40, 120, 300], count: (ds) => sum(ds, (d) => d.trainingDone) },
  { id: 'open-book', name: 'Open Book', counts: 'evenings with a reflection', thresholds: [10, 40, 120, 300], count: (ds) => sum(ds, (d) => (d.eveningCheckin && (d.winOrLesson || d.gratitudeLines > 0) ? 1 : 0)) },
];

export interface BadgeProgress {
  id: string;
  name: string;
  counts: string;
  count: number;
  /** Highest tier earned, or null. */
  tier: Tier | null;
  /** Count needed for the next tier, or null once Hall of Fame is earned. */
  nextAt: number | null;
}

export function badgeProgress(days: ProgressDay[]): BadgeProgress[] {
  return BADGES.map((b) => {
    const count = b.count(days);
    const earned = b.thresholds.filter((t) => count >= t).length;
    return {
      id: b.id,
      name: b.name,
      counts: b.counts,
      count,
      tier: earned === 0 ? null : TIERS[earned - 1]!,
      nextAt: earned === TIERS.length ? null : b.thresholds[earned]!,
    };
  });
}
