import { addDays, weekdayOf } from '@/core/time';
import { buildProgressDay, restReturnedOnTime } from '@/core/progression/build';
import { playerCard, type PlayerCard } from '@/core/progression/card';
import type { ProgressDay } from '@/core/progression/xp';
import type { RepositoryClient } from './repository';
import { repositories } from './repositories';

type ProgressDayInputBody = { training: 'done' | 'partial' | 'skipped' | 'rest'; protein: 'low' | 'ok' | 'hit'; waterL: number };
type ProgressDayInputReflection = { gratitudeLines: string[]; lessonOfDay: string; winOfDay: string };

/** Fetch every table `buildProgressDay` needs for [`fromDate`, `toDate`]
 * (inclusive) and map each date to a `ProgressDay`. Mirrors
 * `getDaySummaries`'s shape exactly — same repos, same per-date loop — but
 * builds the progression-specific summary instead of the guard's. */
export async function getProgressDays(client: RepositoryClient, fromDate: string, toDate: string): Promise<ProgressDay[]> {
  const repos = repositories(client);
  const [templates, plans, checkins, blocks, restSessions] = await Promise.all([
    repos.templates.list(),
    repos.plans.list(),
    repos.checkins.list(),
    repos.blocks.list(),
    repos.restSessions.list(),
  ]);
  const templateByWeekday = new Map(templates.map((t) => [t.weekday, t]));
  const planByDate = new Map(plans.map((p) => [p.date, p]));

  const dates: string[] = [];
  for (let d = new Date(`${fromDate}T00:00:00Z`); d <= new Date(`${toDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates.map((date) => {
    const morning = checkins.find((c) => c.date === date && c.type === 'morning');
    const evening = checkins.find((c) => c.date === date && c.type === 'evening');
    const dayRestSessions = restSessions.filter((r) => r.date === date && r.ended_at !== null);

    return buildProgressDay({
      date,
      state: planByDate.get(date)?.state ?? 'ready',
      isRestDay: templateByWeekday.get(weekdayOf(date))?.rest_day ?? false,
      sleepHours: (morning?.sections.body as { sleepHours?: number } | undefined)?.sleepHours ?? null,
      morningCheckinDone: morning !== undefined,
      eveningCheckinDone: evening !== undefined,
      eveningBody: (evening?.sections.body as ProgressDayInputBody) ?? null,
      eveningMind: (evening?.sections.mind as { regulated: string[] }) ?? null,
      eveningWork: (evening?.sections.work as { footballAnalytics: { minutes: number; learned: string } }) ?? null,
      eveningReflection: (evening?.sections.reflection as ProgressDayInputReflection) ?? null,
      eveningPeople: (evening?.sections.people as { reachedOut: boolean }) ?? null,
      blocks: blocks.filter((b) => b.date === date).map((b) => ({ anchor: b.anchor, tags: b.tags, status: b.status })),
      restSessionsCount: dayRestSessions.length,
      restReturnsOnTime: dayRestSessions.filter((r) => restReturnedOnTime(r.ended_at!, r.reentry_ack_at)).length,
    });
  });
}

/** Spec §8b.1: "recomputable from the database at any time" — look back far
 * enough that no real history is cut off (attributes cap around 10,000 XP,
 * which even a perfect day never reaches in under ~100 days) without
 * unbounded growth as CT's history gets longer. `repos.*.list()` only
 * returns rows that exist, so a wide window costs nothing when history is
 * short. */
export async function getPlayerCard(client: RepositoryClient, today: string): Promise<PlayerCard> {
  const days = await getProgressDays(client, addDays(today, -400), today);
  return playerCard(days, today);
}
