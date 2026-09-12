import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const redirectTo = request.nextUrl.clone();
  redirectTo.searchParams.delete('code');

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Most common cause: the sign-in request and this callback happened in
      // two different browsers/profiles, so the PKCE code_verifier cookie
      // set at request time isn't present here to match against.
      redirectTo.pathname = '/login';
      redirectTo.searchParams.set('error', error.message);
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = '/';
  return NextResponse.redirect(redirectTo);
}
