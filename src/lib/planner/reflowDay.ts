import { reflow, type ReflowEvent } from '@/core/planner/reflow';
import { applyEdits, validateEdits, type PlanEdit } from '@/core/planner/edits';
import { toPlanMinute } from '@/core/time';
import type { Block, DayPlan } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { BlockRow } from '@/lib/db/schemas';
import type { DiffEntry } from '@/core/planner/diff';

export function rowToBlock(row: BlockRow): Block {
  return {
    id: row.id, title: row.title, kind: row.kind, anchor: row.anchor, priority: row.priority,
    start: row.start, end: row.end, minMinutes: row.min_minutes,
    window: row.window_start !== null && row.window_end !== null ? { earliestStart: row.window_start, latestEnd: row.window_end } : null,
    tags: row.tags, checklist: row.checklist, recoveryVariant: row.recovery_variant, status: row.status, source: row.source,
  };
}

export function blockToRow(block: Block, date: string, ownerId: string): BlockRow {
  return {
    id: block.id, owner_id: ownerId, date, title: block.title, kind: block.kind, anchor: block.anchor,
    priority: block.priority, start: block.start, end: block.end, min_minutes: block.minMinutes,
    window_start: block.window?.earliestStart ?? null, window_end: block.window?.latestEnd ?? null,
    tags: block.tags, checklist: block.checklist, recovery_variant: block.recoveryVariant, status: block.status, source: block.source,
  };
}

/** Spec §5.4: "planner reflows → show diff … → Confirm." Nothing is written
 * here — the diff sheet (Task 11's UI) shows this result and only
 * `confirmReflow` persists it, matching the prototype copy exactly:
 * "Nothing is logged until you accept." */
export async function previewReflow(
  client: RepositoryClient,
  date: string,
  event: ReflowEvent,
  now: number,
): Promise<{ plan: DayPlan; diff: DiffEntry[] }> {
  const repos = repositories(client);
  const [settingsRow, blockRows] = await Promise.all([repos.settings.get(), repos.blocks.list({ date } as never)]);
  const settings = settingsToDomain(settingsRow!);
  const plan: DayPlan = { date, wake: toPlanMinute(settings.wakeTime), bedtime: toPlanMinute(settings.bedtime), blocks: blockRows.map(rowToBlock) };
  const result = reflow(plan, now, event);
  return { plan: result.plan, diff: result.diff };
}

/** Lay out today with CT's edits applied, without writing anything. Validation
 *  runs first so an impossible edit is reported rather than silently reshaping
 *  the day; only `confirmReflow` persists. */
export async function previewEdits(
  client: RepositoryClient,
  date: string,
  edits: PlanEdit[],
  now: number,
): Promise<{ plan: DayPlan; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[] }> {
  const repos = repositories(client);
  const [settingsRow, blockRows] = await Promise.all([repos.settings.get(), repos.blocks.list({ date } as never)]);
  const settings = settingsToDomain(settingsRow!);
  const plan: DayPlan = {
    date,
    wake: toPlanMinute(settings.wakeTime),
    bedtime: toPlanMinute(settings.bedtime),
    blocks: blockRows.map(rowToBlock),
  };

  const errors = validateEdits(plan, now, edits);
  if (errors.length > 0) return { plan, diff: [], conflicts: [], errors };

  const result = applyEdits(plan, now, edits);
  return { plan: result.plan, diff: result.diff, conflicts: result.conflicts, errors: [] };
}

/** Persists the previewed plan's blocks — "Take the new day" in the UI. */
export async function confirmReflow(client: RepositoryClient, ownerId: string, date: string, plan: DayPlan): Promise<void> {
  const repos = repositories(client);
  await Promise.all(plan.blocks.map((b) => repos.blocks.upsert(blockToRow(b, date, ownerId))));
}
