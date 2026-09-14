import { addDays } from '@/core/time';
import { buildWeekDay, restOutcomeFor } from '@/core/metrics/build';
import { weeklyMetrics, type WeeklyMetrics } from '@/core/metrics/weekly';
import type { RepositoryClient } from './repository';
import { repositories } from './repositories';

/** Spec §5.8 / §2: S1–S4 for the week starting `weekStart` (a Sunday,
 * `YYYY-MM-DD`), against the 7 days before it for S2's "trending down"
 * comparison. `null` previous-week metrics (not enough history yet) are
 * handled by `weeklyMetrics` itself — this only fetches and shapes. */
export async function getWeeklyMetrics(client: RepositoryClient, weekStart: string): Promise<WeeklyMetrics> {
  const repos = repositories(client);
  const weekEnd = addDays(weekStart, 6);
  const previousStart = addDays(weekStart, -7);
  const previousEnd = addDays(weekStart, -1);

  const [plans, checkins, blocks, restSessions] = await Promise.all([
    repos.plans.list(),
    repos.checkins.list(),
    repos.blocks.list(),
    repos.restSessions.list(),
  ]);
  const planByDate = new Map(plans.map((p) => [p.date, p]));

  function weekDaysFor(start: string, end: string) {
    const dates: string[] = [];
    for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates.map((date) => {
      const morning = checkins.find((c) => c.date === date && c.type === 'morning');
      const evening = checkins.find((c) => c.date === date && c.type === 'evening');
      const dayBlocks = blocks.filter((b) => b.date === date);
      const trainingBlocks = dayBlocks.filter((b) => b.kind === 'training');
      const learned = (evening?.sections.work as { footballAnalytics?: { learned?: string } } | undefined)?.footballAnalytics
        ?.learned;
      return buildWeekDay({
        date,
        hasCheckin: morning !== undefined || evening !== undefined,
        sleepHours: (morning?.sections.body as { sleepHours?: number } | undefined)?.sleepHours ?? null,
        state: planByDate.get(date)?.state ?? null,
        trainingPlannedCount: trainingBlocks.length,
        trainingDoneCount: trainingBlocks.filter((b) => b.status === 'done' || b.status === 'partial').length,
        footballMinutes:
          (evening?.sections.work as { footballAnalytics?: { minutes?: number } } | undefined)?.footballAnalytics?.minutes ?? 0,
        learnedEntry: (learned ?? '').trim().length > 0,
      });
    });
  }

  const week = weekDaysFor(weekStart, weekEnd);
  const previousWeek = weekDaysFor(previousStart, previousEnd);
  const hasPreviousHistory = previousWeek.some((d) => d.hasCheckin);

  const restOutcomes = restSessions
    .filter((r) => r.date >= weekStart && r.date <= weekEnd && r.ended_at !== null)
    .map((r) => restOutcomeFor(r.ended_at!, r.reentry_ack_at));

  return weeklyMetrics(week, restOutcomes, hasPreviousHistory ? previousWeek : null);
}
