'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/core/types';
import { submitEveningCheckin, type EveningCheckinInput } from '@/lib/checkins/submitCheckin';
import { generateTomorrowPlan } from '@/lib/planner/generateTomorrowPlan';
import { eveningReview } from '@/lib/mentor/routes/eveningReview';
import { writeMemory } from '@/lib/memory/client';

export async function submitEveningCheckinAction(
  input: EveningCheckinInput,
): Promise<{ message: string; digest: string; tomorrowNote: string; crisis: boolean; fallback: boolean }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);

  await submitEveningCheckin(client, user.id, planDate, input);

  const review = await eveningReview(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settingsRow?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    planDate,
  );
  await repos.digests.upsert({
    date: planDate,
    owner_id: user.id,
    text: review.fallback ? null : review.digest,
    attempts: 1,
  });
  if (!review.fallback) void writeMemory('DailyDigest', { date: planDate, text: review.digest });

  await generateTomorrowPlan(client, user.id, planDate);

  return review;
}
