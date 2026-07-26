import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

/** مسارات عامة — لا جلسة Supabase ولا إعادة توجيه CRM */
function isPublicClientPath(pathname: string): boolean {
  if (pathname === '/welcome' || pathname.startsWith('/welcome/')) return true;
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) return true;
  if (pathname === '/dna-success') return true;
  if (pathname === '/expert-dna' || pathname.startsWith('/expert-dna/')) return true;
  if (pathname === '/partner-dna' || pathname.startsWith('/partner-dna/')) return true;
  if (pathname === '/join-leader' || pathname.startsWith('/join-leader/')) return true;
  if (pathname === '/join-partner' || pathname.startsWith('/join-partner/')) return true;
  if (pathname.startsWith('/quote/')) return true;
  if (pathname.startsWith('/itinerary/')) return true;
  if (pathname.startsWith('/invoice/')) return true;
  if (pathname.startsWith('/portal/')) return true;
  if (pathname === '/forgot-password' || pathname.startsWith('/forgot-password/')) return true;
  if (pathname === '/update-password' || pathname.startsWith('/update-password/')) return true;
  return false;
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
