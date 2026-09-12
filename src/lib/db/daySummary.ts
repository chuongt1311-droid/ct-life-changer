import { weekdayOf } from '@/core/time';
import type { DaySummary } from '@/core/types';
import { buildDaySummary } from '@/core/daySummary/build';
import type { RepositoryClient } from './repository';
import { repositories } from './repositories';

/** Fetch every table `buildDaySummary` needs for the dates in
 * [`fromDate`, `toDate`] (inclusive, `YYYY-MM-DD`) and map each date to a
 * `DaySummary`. Dates with no rows at all still produce a summary — every
 * field lands on `buildDaySummary`'s all-null-for-that-day default. */
export async function getDaySummaries(client: RepositoryClient, fromDate: string, toDate: string): Promise<DaySummary[]> {
  const repos = repositories(client);
  const [templates, checkins, blocks, restSessions, indulgence] = await Promise.all([
    repos.templates.list(),
    repos.checkins.list(),
    repos.blocks.list(),
    repos.restSessions.list(),
    repos.unplannedIndulgence.list(),
  ]);
  const templateByWeekday = new Map(templates.map((t) => [t.weekday, t]));

  const dates: string[] = [];
  for (let d = new Date(`${fromDate}T00:00:00Z`); d <= new Date(`${toDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates.map((date) =>
    buildDaySummary({
      date,
      isRestDay: templateByWeekday.get(weekdayOf(date))?.rest_day ?? false,
      checkins: checkins.filter((c) => c.date === date).map((c) => ({ type: c.type, sections: c.sections })),
      blocks: blocks
        .filter((b) => b.date === date)
        .map((b) => ({ anchor: b.anchor, kind: b.kind, status: b.status, start: b.start, end: b.end, tags: b.tags })),
      restSessionsCount: restSessions.filter((r) => r.date === date).length,
      unplannedIndulgenceMinutes: indulgence.filter((i) => i.date === date).map((i) => i.minutes),
    }),
  );
}
