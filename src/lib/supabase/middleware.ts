import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

/**
 * Minimal CRM auth gate — session/cookie only.
 * NO database queries. NO getUser() network round-trip.
 * Team/admin checks live in page components (e.g. /crm/team).
 */
export async function crmAuthMiddleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isCrm = pathname === '/crm' || pathname.startsWith('/crm/');
  const isLogin = pathname === '/login';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  if (isCrm && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isLogin && user) {
    const next = request.nextUrl.searchParams.get('next');
    const safeNext =
      next && next.startsWith('/crm') && !next.includes('//') ? next : '/crm/itineraries';
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = safeNext;
    redirectUrl.searchParams.delete('next');
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
