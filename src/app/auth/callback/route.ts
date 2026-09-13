import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (code) {
    // The redirect response is created up front and every cookie the auth
    // exchange sets is written directly onto *this* response object — not via
    // next/headers' cookies(), whose merge-into-the-returned-response
    // behavior in a Route Handler proved unreliable here (the exchange
    // reported success, but the session cookie never reached the browser on
    // the next request, silently bouncing back to /login with no session).
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Most common cause: the sign-in request and this callback happened in
      // two different browsers/profiles, so the PKCE code_verifier cookie
      // set at request time isn't present here to match against.
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.search = '';
      loginUrl.searchParams.set('error', error.message);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  const homeUrl = request.nextUrl.clone();
  homeUrl.pathname = '/';
  homeUrl.search = '';
  return NextResponse.redirect(homeUrl);
}
