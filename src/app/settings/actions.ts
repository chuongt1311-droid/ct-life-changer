'use server';

import { redirect } from 'next/navigation';
import { isValidTimeZone } from '@/core/time';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { SettingsRow } from '@/lib/db/schemas';

/** Returns a result instead of throwing on a bad timezone — an unhandled
 * throw from a Server Action surfaces to CT as a generic "server error
 * occurred" page with no way back; a saved invalid value (e.g. the
 * abbreviation "ICT" instead of an IANA name like "Asia/Ho_Chi_Minh") used
 * to crash the Today page on every later load (ensureTodayPlan → planClock). */
export async function saveSettingsAction(row: SettingsRow): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  if (!isValidTimeZone(row.timezone)) {
    return { ok: false, error: `"${row.timezone}" isn't a recognized time zone. Use an IANA name, e.g. Asia/Ho_Chi_Minh or America/New_York.` };
  }

  const client = supabase as unknown as RepositoryClient;
  await repositories(client).settings.upsert({ ...row, owner_id: user.id });
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
