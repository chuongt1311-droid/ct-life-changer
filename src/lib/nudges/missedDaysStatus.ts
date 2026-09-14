import { addDays } from '@/core/time';
import { countTrailingMisses, welcomeBackAlreadySent, type DayCheckinStatus } from '@/core/nudges/missedDays';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

const LOOKBACK_DAYS = 30;

/** Derives spec §9's missedDaysInARow/welcomeBackSent from existing
 * checkins/nudges_sent rows — no new mutable counter table. */
export async function missedDaysStatus(
  client: RepositoryClient,
  ownerId: string,
  planDate: string,
): Promise<{ missedDaysInARow: number; welcomeBackSent: boolean }> {
  const repos = repositories(client);
  const checkins = await repos.checkins.list({ owner_id: ownerId } as never);
  const checkinDates = new Set(checkins.map((c) => c.date));

  const fromDate = addDays(planDate, -LOOKBACK_DAYS);
  const toDate = addDays(planDate, -1);
  const days: DayCheckinStatus[] = [];
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
    days.push({ date: d, hadCheckin: checkinDates.has(d) });
  }
  const missedDaysInARow = countTrailingMisses(days);

  const lastCheckinDate = [...checkinDates].sort().at(-1) ?? null;
  const droughtStart = lastCheckinDate ? addDays(lastCheckinDate, 1) : fromDate;
  const welcomeBackRows = await repos.nudgesSent.list({ owner_id: ownerId, type: 'welcomeBack' } as never);
  const welcomeBackSent = welcomeBackAlreadySent(
    welcomeBackRows.map((r) => r.date),
    droughtStart,
  );

  return { missedDaysInARow, welcomeBackSent };
}
