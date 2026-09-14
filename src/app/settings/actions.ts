'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { SettingsRow } from '@/lib/db/schemas';

export async function saveSettingsAction(row: SettingsRow): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const client = supabase as unknown as RepositoryClient;
  await repositories(client).settings.upsert({ ...row, owner_id: user.id });
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
