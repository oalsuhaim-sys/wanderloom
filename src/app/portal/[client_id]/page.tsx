import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';

import { ClientTeaserPortalView } from '@/app/portal/[client_id]/_components/ClientTeaserPortalView';
import { fetchClientTeaserPortalAdmin } from '@/lib/client-teaser-portal-server';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

type PageProps = {
  params: Promise<{ client_id: string }>;
};

function AccessDenied({ reason }: { reason: string }) {
  return (
    <div
      dir="rtl"
      lang="ar"
      className="flex min-h-dvh items-center justify-center bg-[#070908] px-4 text-white"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.1), transparent)',
      }}
    >
      <div className="w-full max-w-md rounded-[1.75rem] border border-[#d4af37]/20 bg-gradient-to-b from-[#121816] to-[#0a0d0b] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/10">
          <Lock className="h-6 w-6 text-[#d4af37]" aria-hidden />
        </span>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.35em] text-[#d4af37]/70">
          Wanderloom Portal
        </p>
        <h1 className="mt-2 text-xl font-black text-white">البوابة غير متاحة بعد</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-white/55">{reason}</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-[#d4af37]/60">
          <Sparkles className="h-4 w-4" aria-hidden />
          <span className="text-xs font-bold">ننتظرك في اللحظة المناسبة</span>
        </div>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-xl border border-white/10 px-5 py-2.5 text-xs font-black text-white/60 transition hover:bg-white/5"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}

export default async function ClientTeaserPortalPage({ params }: PageProps) {
  const { client_id: clientId } = await params;

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return <AccessDenied reason={serviceKeyError} />;
  }

  let result: Awaited<ReturnType<typeof fetchClientTeaserPortalAdmin>>;
  try {
    result = await fetchClientTeaserPortalAdmin(clientId);
  } catch (err) {
    console.error('[teaser-portal] page:', err);
    return (
      <AccessDenied
        reason={err instanceof Error ? err.message : 'تعذر فتح البوابة حالياً.'}
      />
    );
  }

  if (!result.ok) {
    return <AccessDenied reason={result.reason} />;
  }

  return <ClientTeaserPortalView data={result.data} />;
}
