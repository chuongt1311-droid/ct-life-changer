import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isOwner } from '@/lib/auth/isOwner';

/** Refreshes the Supabase session on every request and signs out (redirecting
 * to /login) anyone who isn't OWNER_EMAIL — spec §4.2's server-side gate.
 * API routes (/api/*) get a 401 JSON body instead of a redirect — a fetch
 * client following a 307 to an HTML login page is not a usable error. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  const isLoginRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth/callback');
  // pg_net calls this with no Supabase session — it authenticates with
  // CRON_SECRET inside the route itself, same reasoning as isLoginRoute.
  const isCronRoute = request.nextUrl.pathname.startsWith('/api/cron/');

  if (user && !isOwner(user.email)) {
    await supabase.auth.signOut();
    if (isApiRoute) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isLoginRoute && !isCronRoute) {
    if (isApiRoute) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
