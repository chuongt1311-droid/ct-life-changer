'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { previewFutureEdits, confirmFuturePlan } from '@/lib/planner/planAhead';
import type { PlanEdit } from '@/core/planner/edits';
import type { Adjustment, Block, Flag, GuardState } from '@/core/types';
import type { DiffEntry } from '@/core/planner/diff';

async function authedClient() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return { client: supabase as unknown as RepositoryClient, ownerId: user.id };
}

/** Matches `EditableDay`'s `PreviewFn` shape exactly (`(date, edits) => ...`)
 * so it can be passed straight through as its `previewAction` prop. */
export async function previewPlanAheadAction(
  date: string,
  edits: PlanEdit[],
): Promise<{ date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[]; state: GuardState; flags: Flag[]; adjustments: Adjustment[] }> {
  const { client } = await authedClient();
  const result = await previewFutureEdits(client, date, edits, new Date());
  return { date, blocks: result.plan.blocks, diff: result.diff, conflicts: result.conflicts, errors: result.errors, state: result.state, flags: result.flags, adjustments: result.adjustments };
}

/** Matches `EditableDay`'s `ConfirmFn` shape exactly
 * (`(date, blocks, meta?) => Promise<void>`). `meta` is required in
 * practice — `previewPlanAheadAction` above always returns it, and
 * `EditableDay` always threads it straight through — the optional `?`
 * exists only so this function's type is assignable to `EditableDay`'s
 * shared prop type, which Today's simpler default must also satisfy. */
export async function confirmPlanAheadAction(
  date: string,
  blocks: Block[],
  meta?: { state: GuardState; flags: Flag[]; adjustments: Adjustment[] },
): Promise<void> {
  if (!meta) throw new Error('confirmPlanAheadAction requires guard-state metadata from previewPlanAheadAction');
  const { client, ownerId } = await authedClient();
  await confirmFuturePlan(client, ownerId, date, { date, wake: 0, bedtime: 0, blocks }, meta);
}
