import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { crmAuthMiddleware } from '@/lib/supabase/middleware';

function legacyWelcomeRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/welcome\/([^/]+)$/);
  if (!match) return null;

  const segment = decodeURIComponent(match[1]);
  if (segment === 'vip' || segment === 'client') return null;

  const url = request.nextUrl.clone();
  if (/^\d+$/.test(segment)) {
    url.pathname = `/welcome/client/${segment}`;
  } else {
    url.pathname = `/welcome/vip/${encodeURIComponent(segment)}`;
  }
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const legacy = legacyWelcomeRedirect(request);
  if (legacy) return legacy;
  return crmAuthMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Run on all non-static routes. Public paths (/welcome, /portal, …) skip CRM auth
     * inside crmAuthMiddleware — legacy /welcome/{segment} redirects still run here.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf)$).*)',
  ],
};
