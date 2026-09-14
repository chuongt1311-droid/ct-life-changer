import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

/** E2E-only. 404s unless E2E_AUTH_SECRET is set — CT sets it only in
 * .env.test.local against a throwaway test Supabase project, never in the
 * production Vercel env. Redeems a server-generated one-time token through
 * the same @supabase/ssr code path /auth/callback uses for a real magic
 * link, so the resulting session cookies are exactly what production sets. */
export async function GET(request: NextRequest) {
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret || request.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const email = process.env.OWNER_EMAIL;
  if (!email) return NextResponse.json({ error: 'OWNER_EMAIL not set' }, { status: 500 });

  const admin = createAdminSupabase();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? 'no token generated' }, { status: 500 });
  }

  const homeUrl = request.nextUrl.clone();
  homeUrl.pathname = '/';
  homeUrl.search = '';
  const response = NextResponse.redirect(homeUrl);

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: data.properties.hashed_token });
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 });

  return response;
}
