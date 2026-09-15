'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { confirmReflow, previewEdits, previewReflow } from '@/lib/planner/reflowDay';
import type { PlanEdit } from '@/core/planner/edits';
import { summarizeDiff } from '@/core/planner/summarizeDiff';
import { planClock } from '@/core/time';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { DEFAULT_SETTINGS } from '@/core/types';
import { reflowComment } from '@/lib/mentor/routes/reflowComment';
import type { ReflowEvent } from '@/core/planner/reflow';
import type { DiffEntry } from '@/core/planner/diff';
import type { Block } from '@/core/types';

async function authedClient() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return { client: supabase as unknown as RepositoryClient, ownerId: user.id };
}

export async function previewReflowAction(event: ReflowEvent): Promise<{ date: string; blocks: Block[]; diff: DiffEntry[] }> {
  const { client } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate, minute } = planClock(new Date(), settings.timezone);
  const { plan, diff } = await previewReflow(client, planDate, event, minute);
  return { date: planDate, blocks: plan.blocks, diff };
}

export async function previewEditsAction(
  edits: PlanEdit[],
): Promise<{ date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[] }> {
  const { client } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate, minute } = planClock(new Date(), settings.timezone);
  const { plan, diff, conflicts, errors } = await previewEdits(client, planDate, edits, minute);
  return { date: planDate, blocks: plan.blocks, diff, conflicts, errors };
}

export async function confirmReflowAction(date: string, blocks: Block[]): Promise<void> {
  const { client, ownerId } = await authedClient();
  await confirmReflow(client, ownerId, date, { date, wake: 0, bedtime: 0, blocks });
  redirect('/');
}

/** Same persistence as confirmReflowAction, without the redirect. Today
 * confirms its own edits while already at '/' — redirect('/') from there
 * throws Next's NEXT_REDIRECT sentinel (by design, a terminal operation: any
 * code after it in the same call never runs), and even once that sentinel is
 * properly caught, a same-URL push does not reliably force a re-render.
 * Confirmed with a throwaway inspection script's unhandledrejection
 * listener, not guessed. The caller calls router.refresh() itself instead. */
export async function confirmEditsAction(date: string, blocks: Block[]): Promise<void> {
  const { client, ownerId } = await authedClient();
  await confirmReflow(client, ownerId, date, { date, wake: 0, bedtime: 0, blocks });
}

export async function askMentorAboutReflowAction(date: string, diff: DiffEntry[]): Promise<{ text: string; fallback: boolean }> {
  const { client, ownerId } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  return reflowComment(
    client,
    createAnthropicClient(),
    { ownerId, model: settingsRow?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    date,
    summarizeDiff(diff),
  );
}
