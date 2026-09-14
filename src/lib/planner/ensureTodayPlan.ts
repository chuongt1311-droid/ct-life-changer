import { assess } from '@/core/guard/assess';
import { buildDay } from '@/core/planner/buildDay';
import { addDays, planClock, weekdayOf } from '@/core/time';
import type { Block, DayTemplate } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { getDaySummaries } from '@/lib/db/daySummary';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { BlockRow, PlanRow } from '@/lib/db/schemas';

function blockToRow(block: Block, date: string, ownerId: string): BlockRow {
  return {
    id: block.id,
    owner_id: ownerId,
    date,
    title: block.title,
    kind: block.kind,
    anchor: block.anchor,
    priority: block.priority,
    start: block.start,
    end: block.end,
    min_minutes: block.minMinutes,
    window_start: block.window?.earliestStart ?? null,
    window_end: block.window?.latestEnd ?? null,
    tags: block.tags,
    checklist: block.checklist,
    recovery_variant: block.recoveryVariant,
    status: block.status,
    source: block.source,
  };
}

/** Spec §5.2's fallback for "no plan exists yet for a date whose 04:00
 * boundary has passed" — until Plan 6's cron exists, Today's own load is
 * that trigger. Idempotent: a second call on the same day is a no-op read. */
export async function ensureTodayPlan(
  client: RepositoryClient,
  ownerId: string,
  now: Date,
): Promise<{ plan: PlanRow; blocks: BlockRow[] }> {
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  if (!settingsRow) throw new Error('No settings row yet — onboarding (Task 22) must run first.');
  const settings = settingsToDomain(settingsRow);

  const { planDate } = planClock(now, settings.timezone);
  const existingPlan = await repos.plans.get(planDate, 'date');
  if (existingPlan) {
    const blocks = await repos.blocks.list({ date: planDate } as never);
    return { plan: existingPlan, blocks };
  }

  const templateRow = await repos.templates.get(weekdayOf(planDate));
  if (!templateRow) throw new Error(`No template for weekday ${weekdayOf(planDate)} — onboarding (Task 22) must run first.`);
  const template: DayTemplate = { weekday: templateRow.weekday, restDay: templateRow.rest_day, blocks: templateRow.blocks };

  const history = await getDaySummaries(client, addDays(planDate, -7), addDays(planDate, -1));
  const assessment = assess(history, settings);
  const { plan } = buildDay(template, planDate, settings, assessment.adjustments);

  const planRow: PlanRow = {
    date: planDate,
    owner_id: ownerId,
    state: assessment.state,
    flags: assessment.flags,
    adjustments: assessment.adjustments,
    overridden: false,
  };
  await repos.plans.upsert(planRow);
  const blockRows = await Promise.all(plan.blocks.map((b) => repos.blocks.upsert(blockToRow(b, planDate, ownerId))));

  return { plan: planRow, blocks: blockRows };
}
