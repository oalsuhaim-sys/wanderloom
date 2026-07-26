'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import {
  canAccessCrmPath,
  defaultCrmLandingPath,
  isPartnersCrmPath,
} from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { supabase } from '@/lib/supabase';

export function CrmRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { loading, profileAccess, authEmail, employeeDbRow } = useCrmEmployee();

  const ownerBypass = isEmergencyCrmOwnerBypass(authEmail);
  const partnersPath = isPartnersCrmPath(pathname);
  const isExpert = Boolean(profileAccess?.is_expert) && !profileAccess?.is_admin;

  useEffect(() => {
    if (loading) return;
    if (ownerBypass) return;

    if (profileAccess?.is_suspended) {
      void (async () => {
        if (supabase) await supabase.auth.signOut();
        router.replace('/login');
      })();
      return;
    }

    if (pathname === '/crm/unauthorized') return;

    // Partners force-open is for staff only — experts use strict allowlist
    if (partnersPath && !isExpert) {
      return;
    }

    const allowed = canAccessCrmPath(pathname, profileAccess, authEmail);
    console.log('Auth Debug - Email:', authEmail);
    console.log('Auth Debug - DB Result:', employeeDbRow);
    console.log('Auth Debug - profileAccess:', profileAccess);
    console.log('Auth Debug - pathname:', pathname, 'allowed:', allowed);

    if (!allowed) {
      const fallback = defaultCrmLandingPath(profileAccess);
      router.replace(fallback === pathname ? '/crm/unauthorized' : fallback);
    }
  }, [
    loading,
    pathname,
    profileAccess,
    authEmail,
    employeeDbRow,
    ownerBypass,
    partnersPath,
    isExpert,
    router,
  ]);

  if (loading) return null;
  if (ownerBypass) return <>{children}</>;
  if (profileAccess?.is_suspended) return null;

  if (partnersPath && !isExpert) return <>{children}</>;

  if (
    pathname !== '/crm/unauthorized' &&
    !canAccessCrmPath(pathname, profileAccess, authEmail)
  ) {
    return null;
  }

  return <>{children}</>;
}
