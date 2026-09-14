'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { submitMorningCheckin, type MorningCheckinInput } from '@/lib/checkins/submitCheckin';
import { applyMorningAdjustments, keepOriginalPlan, reassessMorning, type ReassessResult } from '@/lib/checkins/reassessMorning';
import { planClock } from '@/core/time';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';

async function authedClient() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return { client: supabase as unknown as RepositoryClient, ownerId: user.id };
}

export async function submitMorningCheckinAction(input: MorningCheckinInput): Promise<ReassessResult> {
  const { client, ownerId } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  await submitMorningCheckin(client, ownerId, planDate, input);
  return reassessMorning(client, planDate);
}

export async function applyAdjustmentsAction(result: ReassessResult): Promise<void> {
  const { client, ownerId } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  await applyMorningAdjustments(client, ownerId, planDate, result);
  redirect('/');
}

export async function keepOriginalAction(): Promise<void> {
  const { client, ownerId } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  await keepOriginalPlan(client, ownerId, planDate);
  redirect('/');
}
