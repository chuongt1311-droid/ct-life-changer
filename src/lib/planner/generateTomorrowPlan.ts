import { assess } from '@/core/guard/assess';
import { buildDay } from '@/core/planner/buildDay';
import { addDays, weekdayOf } from '@/core/time';
import type { Block, DayTemplate } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { getDaySummaries } from '@/lib/db/daySummary';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { BlockRow } from '@/lib/db/schemas';

function blockToRow(block: Block, date: string, ownerId: string): BlockRow {
  return {
    id: block.id, owner_id: ownerId, date, title: block.title, kind: block.kind, anchor: block.anchor,
    priority: block.priority, start: block.start, end: block.end, min_minutes: block.minMinutes,
    window_start: block.window?.earliestStart ?? null, window_end: block.window?.latestEnd ?? null,
    tags: block.tags, checklist: block.checklist, recovery_variant: block.recoveryVariant, status: block.status, source: block.source,
  };
}

/** Spec §5.7 step 5: "Tomorrow's plan is generated." Idempotent — a second
 * evening submission on the same day (or Plan 6's future cron fallback)
 * finds tomorrow's plan already there and does nothing. */
export async function generateTomorrowPlan(client: RepositoryClient, ownerId: string, today: string): Promise<void> {
  const repos = repositories(client);
  const tomorrow = addDays(today, 1);
  const existing = await repos.plans.get(tomorrow, 'date');
  if (existing) return;

  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const templateRow = await repos.templates.get(weekdayOf(tomorrow));
  if (!templateRow) return;
  const template: DayTemplate = { weekday: templateRow.weekday, restDay: templateRow.rest_day, blocks: templateRow.blocks };

  const history = await getDaySummaries(client, addDays(today, -6), today);
  const assessment = assess(history, settings);
  const { plan } = buildDay(template, tomorrow, settings, assessment.adjustments);

  await repos.plans.upsert({ date: tomorrow, owner_id: ownerId, state: assessment.state, flags: assessment.flags, adjustments: assessment.adjustments, overridden: false });
  await Promise.all(plan.blocks.map((b) => repos.blocks.upsert(blockToRow(b, tomorrow, ownerId))));
}
