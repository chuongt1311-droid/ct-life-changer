'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { DEFAULT_SETTINGS } from '@/core/types';
import type { ProfileSection } from '@/core/mentor/profile';
import { revertProfileSection, runWeeklyReview, type WeeklyReviewResult } from '@/lib/mentor/runWeeklyReview';

export async function runWeeklyReviewAction(weekStart: string): Promise<WeeklyReviewResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  return runWeeklyReview(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settingsRow?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    weekStart,
  );
}

export async function revertProfileSectionAction(section: ProfileSection): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  await revertProfileSection(supabase as unknown as RepositoryClient, user.id, section);
}
