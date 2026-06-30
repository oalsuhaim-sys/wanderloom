'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';

import { fetchSessionRegistrations } from '@/app/crm/services/session-registrations';
import { deleteSession, fetchSessions } from '@/app/crm/services/sessions';
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary';
import { getDemoSessions } from '@/lib/crm-demo';
import type { Session, SessionRegistration } from '@/types/session-tables';

import { SessionForm } from './_components/SessionForm';
import { SessionsTable } from './_components/SessionsTable';

import { isSupabaseConfigured } from '@/lib/supabase-config';

const HAS_PUBLIC_SUPABASE_ENV = isSupabaseConfigured();

export default function CRMSessionsClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [registrations, setRegistrations] = useState<SessionRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [demoHint, setDemoHint] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    setDemoHint(null);
    setLoading(true);

    const res = await fetchSessions();
    let list: Session[] = [];
    if (!res.ok) {
      list = getDemoSessions();
      setLoadError(res.error);
      setDemoHint('عُرضت جلسات تجريبية لأن الجلب من Supabase فشل.');
    } else {
      list = res.data;
      if (res.demo) {
        setDemoHint('وضع تجريبي: لا يوجد اتصال بـ Supabase أو المفتاح غير مضبوط.');
      }
    }

    setSessions(list);

    const ids = list.map((s) => String(s.id)).filter(Boolean);
    const rres = await fetchSessionRegistrations(ids);
    if (rres.ok) {
      setRegistrations(rres.data);
    } else {
      setRegistrations([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <ClientErrorBoundary
      fallbackTitle="تعذر عرض جلسات CRM"
      fallbackMessage="حدث خطأ غير متوقع أثناء تحميل واجهة الجلسات للموظفين."
    >
      <div dir="rtl" className="mx-auto w-full max-w-[min(100%,88rem)] space-y-8 px-4 pb-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-[#1C4532]">إدارة الجلسات</h1>
            <p className="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-stone-500">
              أنشئ الجلسات وحدّثها، واطّلع على المسجّلين لكل جلسة من القائمة في الأسفل.
            </p>
          </div>
          <Link
            href="/portal/sessions"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-[#1C4532] shadow-sm hover:bg-stone-50"
          >
            معاينة واجهة العميل
            <ArrowRight className="h-4 w-4 rotate-180" />
          </Link>
        </div>

        {!HAS_PUBLIC_SUPABASE_ENV && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-900">
            إعدادات الاتصال بقاعدة البيانات غير مكتملة على بيئة النشر. أضف رابط المشروع ومفتاح الوصول
            العام من لوحة Supabase إلى إعدادات المشروع في Vercel ثم أعد النشر.
          </div>
        )}

        {(loadError || demoHint) && (
          <div className="space-y-2">
            {loadError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-900">
                {loadError}
              </div>
            )}
            {demoHint && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-950">
                {demoHint}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-8">
          <SessionForm
            mode={editingSession ? 'edit' : 'create'}
            initialSession={editingSession}
            onSaved={() => {
              setEditingSession(null);
              void reload();
            }}
            onCancelEdit={() => setEditingSession(null)}
          />
          <section className="w-full space-y-3" aria-labelledby="crm-sessions-list-heading">
            <h2 id="crm-sessions-list-heading" className="sr-only">
              قائمة الجلسات الحالية
            </h2>
            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white text-sm font-black text-stone-500 shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                جارٍ التحميل…
              </div>
            ) : (
              <SessionsTable
                sessions={sessions}
                registrations={registrations}
                onEdit={(s) => setEditingSession(s)}
                onDelete={async (s) => {
                  if (!s.id) return;
                  const ok = window.confirm(`هل تريد حذف الجلسة "${s.title}"؟`);
                  if (!ok) return;
                  const res = await deleteSession(String(s.id));
                  if (!res.ok) {
                    setLoadError(res.error);
                    return;
                  }
                  if (res.demo) {
                    setSessions((prev) => prev.filter((row) => row.id !== s.id));
                    setRegistrations((prev) => prev.filter((row) => row.session_id !== s.id));
                    return;
                  }
                  void reload();
                }}
              />
            )}
          </section>
        </div>
      </div>
    </ClientErrorBoundary>
  );
}

