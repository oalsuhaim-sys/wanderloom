import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

/**
 * Public client routes — skip Supabase session refresh and CRM auth gate.
 * Keep `/join` exact (not prefix) so `/join-leader` stays distinct.
 */
export const PUBLIC_CLIENT_ROUTES = [
  '/welcome',
  '/onboarding',
  '/dna',
  '/dna-survey',
  '/dna-success',
  '/expert-dna',
  '/partner-dna',
  '/join-leader',
  '/join-partner',
  '/join',
  '/leader-calendar',
  '/quote',
  '/proposal',
  '/itinerary',
  '/trip-itinerary',
  '/invoice',
  '/checkout',
  '/portal',
  '/profile',
  '/group-onboarding',
  '/group-registration',
  '/referral',
  '/groups',
  '/sessions',
  '/discover',
  '/forgot-password',
  '/update-password',
  '/login',
] as const;

function routeMatchesPublicPrefix(pathname: string, route: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  const base = route.replace(/\/$/, '') || '/';

  if (base === '/join') {
    return path === '/join' || path.startsWith('/join/');
  }

  return path === base || path.startsWith(`${base}/`);
}

/** مسارات عامة — لا جلسة Supabase ولا إعادة توجيه CRM */
export function isPublicClientPath(pathname: string): boolean {
  return PUBLIC_CLIENT_ROUTES.some((route) => routeMatchesPublicPrefix(pathname, route));
}

/**
 * Minimal CRM auth gate — session/cookie only.
 * NO database queries. NO getUser() network round-trip.
 * Team/admin checks live in page components (e.g. /crm/team).
 */
export async function crmAuthMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // توافق مسارات /admin القديمة → /crm
  if (pathname === '/admin/partners-directory' || pathname.startsWith('/admin/partners-directory/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/admin/, '/crm');
    return NextResponse.redirect(url);
  }
  if (pathname === '/admin/partners-radar' || pathname.startsWith('/admin/partners-radar/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/admin/, '/crm');
    return NextResponse.redirect(url);
  }

  if (isPublicClientPath(pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

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
