import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { checkinKindFor } from '@/core/today/checkinKind';

/** One "Check-in" destination that lands on the form the time of day calls for.
 * The nav used to point at /checkin/morning always, so tapping it at night
 * opened the morning form. */
export default async function CheckinPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) redirect('/login');

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  if (!settingsRow) redirect('/onboarding');

  const { minute } = planClock(new Date(), settingsToDomain(settingsRow).timezone);
  redirect(`/checkin/${checkinKindFor(minute)}`);
}
