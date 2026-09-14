'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { acknowledgeReentry } from '@/lib/planner/restSessions';

export async function acknowledgeReentryAction(sessionId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const session = await repositories(client).restSessions.get(sessionId);
  if (!session) throw new Error('Rest session not found');
  await acknowledgeReentry(client, session, new Date());
  redirect('/');
}
