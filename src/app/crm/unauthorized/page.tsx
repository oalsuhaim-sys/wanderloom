'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import { defaultCrmLandingPath } from '@/lib/crm-permissions';

export default function CrmUnauthorizedPage() {
  const { profileAccess } = useCrmEmployee();
  const home = defaultCrmLandingPath(profileAccess);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center" dir="rtl">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-300/40 bg-rose-950/20">
        <ShieldAlert className="h-8 w-8 text-rose-400" />
      </div>
      <h1 className="text-2xl font-black text-[#1e3f20]">403 — غير مصرح</h1>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
        ليس لديك صلاحية الوصول إلى هذا القسم. تواصل مع المدير لتحديث صلاحياتك.
      </p>
      {home !== '/crm/unauthorized' ? (
        <Link
          href={home}
          className="mt-6 rounded-2xl bg-gradient-to-l from-[#cda04c] to-[#b3893d] px-5 py-2.5 text-sm font-black text-[#1e3f20] shadow-md"
        >
          العودة للوحة المسموح بها
        </Link>
      ) : null}
    </div>
  );
}
