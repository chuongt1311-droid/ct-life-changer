import { createClient } from '@supabase/supabase-js';

/** Service-role client. Bypasses RLS entirely — only ever used server-side for
 * the onboarding seed script (Task 8), never for a request made on CT's behalf. */
export function createAdminSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
