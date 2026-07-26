'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Inbox,
  Loader2,
  MapPin,
  ShieldAlert,
  UserPlus,
  UsersRound,
} from 'lucide-react';

import { countNewCrmLeads, fetchNewCrmLeadSummaries } from '@/lib/crm-leads';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { supabase } from '@/lib/supabase';

type PartnerRequest = {
  id: string;
  name: string;
  type: 'expert' | 'leader';
  createdAt: string;
};

type ClientRequest = {
  id: string;
  name: string;
  destination: string;
  status: string;
  createdAt: string;
};

type PendingPayload = {
  partnerRequests: PartnerRequest[];
  clientRequests: ClientRequest[];
  counts: {
    partners: number;
    clients: number;
  };
};

const EMPTY_PENDING: PendingPayload = {
  partnerRequests: [],
  clientRequests: [],
  counts: { partners: 0, clients: 0 },
};

export default function DashboardPendingActions() {
  const [data, setData] = useState<PendingPayload>(EMPTY_PENDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);

      // Client requests: exact same `leads` filter as Radar inbox
      let clientRequests: ClientRequest[] = [];
      if (!supabase) {
        throw new Error('Supabase غير مهيأ.');
      }
      const [summaries, clientsCount] = await Promise.all([
        fetchNewCrmLeadSummaries(supabase, 6),
        countNewCrmLeads(supabase),
      ]);
      clientRequests = summaries;
      let clientsTotal = clientsCount;

      let partnerRequests: PartnerRequest[] = [];
      let partnerCount = 0;
      try {
        const accessToken = await getClientAccessToken();
        const response = await fetch('/api/crm/dashboard/pending', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const payload = (await response.json()) as Partial<PendingPayload> & {
          ok?: boolean;
          error?: string;
        };
        if (response.ok && payload.ok) {
          partnerRequests = Array.isArray(payload.partnerRequests)
            ? payload.partnerRequests
            : [];
          partnerCount = Number(payload.counts?.partners) || partnerRequests.length;
          // If API also returned client rows, prefer the longer of the two (defensive)
          const apiClients = Array.isArray(payload.clientRequests)
            ? payload.clientRequests
            : [];
          if (apiClients.length > clientRequests.length) {
            clientRequests = apiClients;
          }
          const apiClientCount = Number(payload.counts?.clients) || 0;
          if (apiClientCount > clientsTotal) {
            clientsTotal = apiClientCount;
          }
        }
      } catch {
        /* Partners are best-effort; leads already mirror the Inbox. */
      }

      setData({
        partnerRequests,
        clientRequests,
        counts: {
          partners: partnerCount,
          clients: clientsTotal,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تحميل الطلبات المعلقة.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <section
      className="mt-10 overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-white shadow-lg"
      aria-label="طلبات بانتظار الإجراء"
      dir="rtl"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-l from-[#001F3F] via-[#06345B] to-[#001F3F] px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#E4C96F]">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-black">طلبات بانتظار الإجراء</h2>
            <p className="mt-1 text-xs font-semibold text-white/55">
              أحدث الطلبات التي تحتاج مراجعة الإدارة
            </p>
          </div>
        </div>
        {!loading ? (
          <span className="rounded-full border border-[#D4AF37]/30 bg-white/5 px-3 py-1.5 text-xs font-black text-[#E4C96F]">
            {data.counts.partners + data.counts.clients} إجراء معلّق
          </span>
        ) : null}
      </header>

      {loading ? (
        <div className="flex min-h-52 items-center justify-center gap-3 text-sm font-bold text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
          جاري تحميل مركز الإجراءات…
        </div>
      ) : error ? (
        <div className="p-5">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </p>
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-x-reverse lg:divide-slate-100">
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
                <UsersRound className="h-4 w-4 text-[#A88849]" />
                طلبات الشركاء الجدد
              </h3>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
                {data.counts.partners}
              </span>
            </div>

            {data.partnerRequests.length ? (
              <ul className="space-y-2">
                {data.partnerRequests.map((request) => (
                  <li
                    key={`${request.type}-${request.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#A88849] shadow-sm">
                      <UserPlus className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">
                        {request.name}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold text-slate-500">
                        {request.type === 'expert'
                          ? 'خبير وجهات'
                          : 'قائد رحلات'}
                      </p>
                    </div>
                    <Link
                      href={`/crm/partners-directory/profile?id=${encodeURIComponent(request.id)}&type=${request.type === 'expert' ? 'experts' : 'leaders'}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/30 bg-white px-3 py-2 text-[11px] font-black text-[#725A2D] transition hover:bg-amber-50"
                    >
                      مراجعة
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">
                لا توجد طلبات شركاء معلّقة.
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 p-5 lg:border-t-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
                <Inbox className="h-4 w-4 text-emerald-700" />
                طلبات العملاء الجديدة
              </h3>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
                {data.counts.clients}
              </span>
            </div>

            {data.clientRequests.length ? (
              <ul className="space-y-2">
                {data.clientRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">
                        {request.name}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">
                        {request.destination}
                      </p>
                    </div>
                    <Link
                      href="/crm/radar"
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[11px] font-black text-emerald-800 transition hover:bg-emerald-50"
                    >
                      عرض الطلب
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">
                لا توجد طلبات عملاء جديدة.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
