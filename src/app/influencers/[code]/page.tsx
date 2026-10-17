import Link from 'next/link';
import { redirect } from 'next/navigation';

import { findReferralCodeOwner, normalizeReferralLookupCode } from '@/lib/referral-code-owner';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function InfluencerByReferralCodePage({ params }: PageProps) {
  const { code: raw } = await params;
  const code = normalizeReferralLookupCode(decodeURIComponent(raw));

  if (!code) {
    redirect('/crm/partners-directory?tab=celebrities');
  }

  let owner = null;
  try {
    const admin = createSupabaseAdminClient();
    owner = await findReferralCodeOwner(admin, code);
  } catch (err) {
    console.error('[influencers/code] lookup failed:', err);
  }

  if (owner) {
    redirect(
      `/crm/partners-directory/profile?id=${encodeURIComponent(owner.id)}&type=${owner.type}`,
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F5EE] px-6" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold tracking-wider text-[#BA8E48]">كود الإحالة</p>
        <h1 className="mt-3 font-mono text-lg font-bold text-[#111827]" dir="ltr">
          {code}
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-600">
          لا يوجد مؤثر أو شريك مسجّل بهذا الكود.
        </p>
        <Link
          href="/crm/partners-directory?tab=celebrities"
          className="mt-6 inline-flex rounded-xl bg-[#BA8E48] px-5 py-3 text-xs font-bold text-[#111827]"
        >
          العودة لدليل الشركاء
        </Link>
      </div>
    </main>
  );
}
