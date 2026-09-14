import { createClient } from '@supabase/supabase-js';

/** Service-role client. Bypasses RLS entirely — used server-side for the
 * onboarding seed script and the cron tick route, both of which act
 * autonomously with no signed-in user session to bind to. Never used for a
 * request made narrowly on CT's behalf while they're signed in — those use
 * createServerSupabase() instead. */
export function createAdminSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
