'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/core/types';
import { briefing } from '@/lib/mentor/routes/briefing';

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
