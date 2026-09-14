import { NextResponse } from 'next/server';
import { DEFAULT_SETTINGS } from '@/core/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { briefing } from '@/lib/mentor/routes/briefing';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { date } = (await request.json()) as { date: string };
  const client = supabase as unknown as RepositoryClient;
  const settings = await repositories(client).settings.get();

  const result = await briefing(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settings?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settings?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    date,
  );
  return NextResponse.json(result);
}
