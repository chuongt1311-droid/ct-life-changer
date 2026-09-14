import { toPlanMinute } from '@/core/time';
import type { DayPlan, Settings } from '@/core/types';
import type { NudgeInput, RestSessionInfo } from '@/core/nudges/dueNudges';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { BlockRow, PlanRow } from '@/lib/db/schemas';
import { blockRowToCore } from '@/lib/db/blockMapping';
import { missedDaysStatus } from './missedDaysStatus';

/** Turns today's DB rows into the pure `dueNudges`' input shape. */
export async function assembleNudgeInput(
  client: RepositoryClient,
  ownerId: string,
  planDate: string,
  minute: number,
  settings: Settings,
  plan: PlanRow,
  blockRows: BlockRow[],
): Promise<NudgeInput> {
  const repos = repositories(client);
  const blocks = blockRows.map(blockRowToCore);
  const blockById = new Map(blocks.map((b) => [b.id, b]));

  const restSessionRows = await repos.restSessions.list({ owner_id: ownerId, date: planDate } as never);
  const restSessions: RestSessionInfo[] = restSessionRows
    .filter((r) => r.block_id !== null && blockById.has(r.block_id))
    .map((r) => ({
      id: r.id,
      blockId: r.block_id,
      plannedEnd: blockById.get(r.block_id!)!.end,
      closed: r.reentry_ack_at !== null,
    }));

  const sentRows = await repos.nudgesSent.list({ owner_id: ownerId, date: planDate } as never);
  const sentKeys = sentRows.map((r) => r.key);

  const { missedDaysInARow, welcomeBackSent } = await missedDaysStatus(client, ownerId, planDate);

  const dayPlan: DayPlan = {
    date: plan.date,
    wake: toPlanMinute(settings.wakeTime),
    bedtime: toPlanMinute(settings.bedtime),
    blocks,
  };

  return { plan: dayPlan, now: minute, restSessions, sentKeys, settings, missedDaysInARow, welcomeBackSent };
}
