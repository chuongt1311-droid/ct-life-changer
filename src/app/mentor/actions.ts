'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/core/types';
import { briefing } from '@/lib/mentor/routes/briefing';
import { confirmReflow, previewEdits } from '@/lib/planner/reflowDay';
import { confirmFuturePlan, previewFutureEdits } from '@/lib/planner/planAhead';
import type { PlanEdit } from '@/core/planner/edits';

export async function fetchBriefingAction(): Promise<{ text: string; fallback: boolean }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);

  return briefing(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settingsRow?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    planDate,
  );
}

/** The decision logic behind `confirmProposalAction`, split out so it's
 * testable without the request-bound auth boundary `createServerSupabase()`
 * needs. Re-runs the proposal's edits against the CURRENT state of that
 * date/template — not the diff stored at proposal time — so a schedule that
 * moved on since the mentor proposed this doesn't get an edit applied
 * against a base CT never actually saw; a fresh conflict here is reported
 * instead of silently persisted. */
export async function resolveProposalConfirmation(client: RepositoryClient, ownerId: string, proposalId: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const repos = repositories(client);
  const proposal = await repos.mentorProposals.get(proposalId);
  if (!proposal || proposal.status !== 'pending') return { ok: false, errors: ['This proposal was already acted on.'] };

  if (proposal.kind === 'schedule') {
    const edits = proposal.edits as unknown as PlanEdit[];
    const settingsRow = await repos.settings.get();
    const settings = settingsToDomain(settingsRow!);
    const { planDate, minute } = planClock(new Date(), settings.timezone);

    if (proposal.target === planDate) {
      const result = await previewEdits(client, proposal.target, edits, minute);
      if (result.errors.length > 0) return { ok: false, errors: result.errors };
      await confirmReflow(client, ownerId, proposal.target, { date: proposal.target, wake: 0, bedtime: 0, blocks: result.plan.blocks });
    } else {
      const result = await previewFutureEdits(client, proposal.target, edits, new Date());
      if (result.errors.length > 0) return { ok: false, errors: result.errors };
      await confirmFuturePlan(client, ownerId, proposal.target, result.plan, { state: result.state, flags: result.flags, adjustments: result.adjustments });
    }
  } else {
    const { weekday, restDay, blocks } = (proposal.edits as unknown as [{ weekday: number; restDay: boolean; blocks: unknown }])[0]!;
    await repos.templates.upsert({ weekday, owner_id: ownerId, rest_day: restDay, blocks: blocks as never });
  }

  await repos.mentorProposals.upsert({ ...proposal, status: 'confirmed' });
  return { ok: true };
}

export async function confirmProposalAction(proposalId: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return resolveProposalConfirmation(supabase as unknown as RepositoryClient, user.id, proposalId);
}

export async function discardProposalAction(proposalId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const client = supabase as unknown as RepositoryClient;
  const proposal = await repositories(client).mentorProposals.get(proposalId);
  if (!proposal || proposal.status !== 'pending') return;
  await repositories(client).mentorProposals.upsert({ ...proposal, status: 'discarded' });
}
