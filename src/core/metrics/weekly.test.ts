import { describe, expect, it } from 'vitest';
import type { GuardState } from '../types';
import { type WeekDay, weeklyMetrics } from './weekly';

function week(states: (GuardState | null)[], sleep: (number | null)[], checkins: boolean[]): WeekDay[] {
  return states.map((state, i) => ({
    date: `2026-09-${String(7 + i).padStart(2, '0')}`,
    hasCheckin: checkins[i]!,
    sleepHours: sleep[i]!,
    state,
    trainingPlanned: i < 4 ? 1 : 0,
    trainingDone: i < 3 ? 1 : 0,
    footballMinutes: 45,
    learnedNotes: 1,
  }));
}

describe('weeklyMetrics', () => {
  const good = week(
    ['ready', 'ready', 'drifting', 'ready', 'ready', 'ready', 'ready'],
    [7.5, 7, 6, 8, 7.2, null, 7],
    [true, true, true, true, false, true, false],
  );
  const bad = week(
    ['depleted', 'depleted', 'drifting', 'ready', 'ready', 'ready', 'ready'],
    [5, 5, 6, 7, 7, 7, 6],
    [true, false, false, false, true, false, false],
  );

  it('computes S1–S4 for a good week that improved on the last one', () => {
    const m = weeklyMetrics(good, [{ ackDelayMin: 3 }, { ackDelayMin: 12 }, { ackDelayMin: 0 }, { ackDelayMin: null }], bad);
    expect(m.s1).toEqual({ checkinDays: 5, target: 5, met: true });
    expect(m.s2).toMatchObject({ nightsSleep7: 5, depletedOrDriftingDays: 1, previousDepletedOrDriftingDays: 3, improving: true, met: true });
    expect(m.s3).toEqual({ returned: 2, ended: 4, rate: 0.5, target: 0.7, met: false });
    expect(m.s4).toEqual({ trainingDone: 3, trainingPlanned: 4, footballMinutes: 315, learnedNotes: 7 });
  });

  it('reports "unknown" instead of failing when there is nothing to measure', () => {
    const m = weeklyMetrics(bad, [], null);
    expect(m.s1.met).toBe(false);
    expect(m.s2.improving).toBeNull();
    expect(m.s2.met).toBe(false); // only 3 nights of 7h+
    expect(m.s3).toMatchObject({ rate: null, met: null });
  });
});
