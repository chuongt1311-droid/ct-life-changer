import { assess } from '@/core/guard/assess';
import { buildDay } from '@/core/planner/buildDay';
import { addDays } from '@/core/time';
import type { Adjustment, Block, DayPlan, DayTemplate, Flag, GuardState } from '@/core/types';
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

export interface ReassessResult {
  changed: boolean;
  state: GuardState;
  flags: Flag[];
  adjustments: Adjustment[];
  plan: DayPlan | null;
}

/** Re-runs the guard now that last night's sleep is logged. Does not write
 * anything — the caller (the morning check-in banner) decides Apply or Keep
 * original before either `applyMorningAdjustments` or `keepOriginalPlan` runs. */
export async function reassessMorning(client: RepositoryClient, date: string): Promise<ReassessResult> {
  const repos = repositories(client);
  const [settingsRow, planRow, templates] = await Promise.all([repos.settings.get(), repos.plans.get(date, 'date'), repos.templates.list()]);
  const settings = settingsToDomain(settingsRow!);
  const history = await getDaySummaries(client, addDays(date, -7), date);
  const assessment = assess(history, settings);

  if (!planRow || assessment.state === planRow.state) {
    return {
      changed: false,
      state: planRow?.state ?? assessment.state,
      flags: (planRow?.flags as Flag[] | undefined) ?? assessment.flags,
      adjustments: (planRow?.adjustments as Adjustment[] | undefined) ?? assessment.adjustments,
      plan: null,
    };
  }

  const templateRow = templates.find((t) => t.weekday === new Date(`${date}T00:00:00Z`).getUTCDay());
  const template: DayTemplate = { weekday: templateRow!.weekday, restDay: templateRow!.rest_day, blocks: templateRow!.blocks };
  const { plan } = buildDay(template, date, settings, assessment.adjustments);

  return { changed: true, state: assessment.state, flags: assessment.flags, adjustments: assessment.adjustments, plan };
}

export async function applyMorningAdjustments(
  client: RepositoryClient,
  ownerId: string,
  date: string,
  result: ReassessResult,
): Promise<void> {
  if (!result.plan) return;
  const repos = repositories(client);
  await repos.plans.upsert({ date, owner_id: ownerId, state: result.state, flags: result.flags, adjustments: result.adjustments, overridden: false });
  await Promise.all(result.plan.blocks.map((b) => repos.blocks.upsert(blockToRow(b, date, ownerId))));
}

export async function keepOriginalPlan(client: RepositoryClient, ownerId: string, date: string): Promise<void> {
  const repos = repositories(client);
  const plan = await repos.plans.get(date, 'date');
  if (!plan) return;
  await repos.plans.upsert({ ...plan, owner_id: ownerId, overridden: true });
}
