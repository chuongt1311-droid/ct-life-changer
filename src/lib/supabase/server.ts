import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** One client per request, bound to that request's session cookie. Call this
 * fresh in every Server Component / Route Handler / Server Action — never
 * cache the instance across requests. */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component that can't set cookies; middleware
          // refreshes the session on the next request instead.
        }
      },
    },
  });
}
