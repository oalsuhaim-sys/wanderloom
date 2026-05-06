'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

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
  const [demoHint, setDemoHint] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    setDemoHint(false);
    try {
      const res = await fetchAvailableSessions();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSessions(res.data);
      setDemoHint(Boolean(res.demo));
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
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className="absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full opacity-40 blur-[100px]"
            style={{ background: 'radial-gradient(circle, rgba(28,69,50,0.55), transparent 65%)' }}
          />
          <div
            className="absolute -bottom-32 -left-32 h-[380px] w-[380px] rounded-full opacity-30 blur-[90px]"
            style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.35), transparent 70%)' }}
          />
        </div>

        <header className="relative z-10 border-b border-white/10 bg-[#07100D]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
            <Link href="/portal/sessions" className="text-lg font-black tracking-[0.2em] text-[#C9A84C]">
              Wanderloom
            </Link>
            <nav className="flex flex-wrap items-center gap-3 text-xs font-black">
              <Link
                href="/portal"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/80 hover:bg-white/10"
              >
                مساري (مفتاح الرحلة)
              </Link>
              <Link
                href="/portal/sessions"
                className="rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-4 py-2 text-[#E8C96A]"
              >
                الجلسات
              </Link>
              <Link href="/" className="rounded-full px-4 py-2 text-white/50 hover:text-white/85">
                الموقع
              </Link>
            </nav>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-1.5 text-[11px] font-black text-[#E8C96A]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              بوابة العملاء · جلسات حية من قاعدة البيانات
            </p>
            <h1 className="mt-6 text-3xl font-black leading-tight text-white sm:text-4xl md:text-5xl">
              الجلسات القادمة مع
              <span className="block bg-gradient-to-l from-[#E8C96A] to-[#C9A84C] bg-clip-text text-transparent">
                Wanderloom
              </span>
            </h1>
            <p className="mt-5 text-sm font-bold leading-relaxed text-white/55 sm:text-base">
              اختر الجلسة المناسبة واضغط «تسجيل الآن» لإرسال اسمك ورقم الواتساب. تُعرض الجلسات القادمة فقط.
            </p>
          </div>

          {demoHint ? (
            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-amber-400/30 bg-amber-950/40 px-4 py-3 text-center text-xs font-black text-amber-100">
              يُعرض وضع تجريبي: بيانات الجلسات من العرض التوضيحي حتى يُضبط الاتصال بقاعدة البيانات على بيئة النشر.
            </div>
          ) : null}

          {!HAS_PUBLIC_SUPABASE_ENV ? (
            <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-amber-400/30 bg-amber-950/35 px-4 py-3 text-center text-xs font-black text-amber-50">
              إعدادات الاتصال بقاعدة البيانات غير مكتملة على بيئة النشر. أضف رابط المشروع ومفتاح الوصول العام من لوحة
              Supabase إلى إعدادات المشروع ثم أعد النشر.
            </div>
          ) : null}

          <div className="mt-12">
            <div className="mb-6 flex flex-col gap-2 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-white sm:text-xl">قائمة الجلسات</h2>
                {!loading && !error ? (
                  <p className="mt-1 text-xs font-bold text-white/45">{sessions.length} جلسة متاحة</p>
                ) : null}
              </div>
            </div>

            <AvailableSessionsCards sessions={sessions} loading={loading} loadError={error} onRegistered={load} />
          </div>
        </main>

        <footer className="relative z-10 border-t border-white/10 bg-[#050c09]/90 py-10 text-center">
          <p className="text-xs font-black tracking-[0.35em] text-[#C9A84C]/60">WANDERLOOM</p>
          <p className="mt-2 text-[11px] font-bold text-white/35">بوابة العملاء · الجلسات</p>
        </footer>
      </div>
    </ClientErrorBoundary>
  );
}
