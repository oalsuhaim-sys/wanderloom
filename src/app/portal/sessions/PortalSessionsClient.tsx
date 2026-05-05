'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { fetchAvailableSessions } from '@/app/portal/services/sessions';
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary';
import type { Session } from '@/types/session-tables';

import { AvailableSessionsCards } from './_components/AvailableSessionsCards';

const HAS_PUBLIC_SUPABASE_ENV =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function PortalSessionsClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchAvailableSessions();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSessions(res.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء تحميل الجلسات.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ClientErrorBoundary
      fallbackTitle="تعذر عرض الجلسات"
      fallbackMessage="حدث خطأ في واجهة العميل أثناء عرض الجلسات."
    >
      <div dir="rtl" className="min-h-screen bg-[#07100D] font-sans text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#1C4532]/35 blur-[90px]" />
          <div className="absolute -left-32 bottom-0 h-[320px] w-[320px] rounded-full bg-[#C9A84C]/10 blur-[80px]" />
        </div>

        <header className="relative z-10 border-b border-white/10 px-4 py-5">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black tracking-[0.2em] text-[#C9A84C]">Wanderloom</div>
              <p className="mt-1 text-xs font-bold text-white/40">بوابة العملاء · الجلسات القادمة</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/portal"
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/80 hover:bg-white/10"
              >
                مساري (مفتاح الرحلة)
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-3 py-2 text-xs font-black text-[#E8C96A]"
              >
                الموقع
              </Link>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-2xl font-black text-white">الجلسات المتاحة</h1>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-white/55">
            اختر جلسة واضغط «تسجيل الآن» لإرسال اسمك ورقم الواتساب.
          </p>

          {!HAS_PUBLIC_SUPABASE_ENV && (
            <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-950/40 px-4 py-3 text-xs font-black text-amber-100">
              متغيرات البيئة غير مكتملة على بيئة النشر. تأكد من ضبط:
              {' '}
              <code>NEXT_PUBLIC_SUPABASE_URL</code>
              {' '}
              و
              {' '}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              .
            </div>
          )}

          <div className="mt-8">
            <AvailableSessionsCards
              sessions={sessions}
              loading={loading}
              loadError={error}
              onRegistered={load}
            />
          </div>
        </main>

        <footer className="relative z-10 mt-16 border-t border-white/10 py-8 text-center text-[10px] font-bold tracking-[0.35em] text-white/25">
          WANDERLOOM · CLIENT PORTAL
        </footer>
      </div>
    </ClientErrorBoundary>
  );
}

