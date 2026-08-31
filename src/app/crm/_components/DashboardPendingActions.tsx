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

  const pendingTotal = data.counts.partners + data.counts.clients;

  return (
    <section
      className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
      aria-label="طلبات بانتظار الإجراء"
      dir="rtl"
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-amber-600">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">طلبات بانتظار الإجراء</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              أحدث الطلبات التي تحتاج مراجعة الإدارة
            </p>
          </div>
        </div>
        {!loading ? (
          <span className="rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-bold text-[#b8952d]">
            {pendingTotal} إجراء معلّق
          </span>
        ) : null}
      </header>

      {loading ? (
        <div className="flex min-h-52 items-center justify-center gap-3 text-sm font-semibold text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#b8952d]" />
          جاري تحميل مركز الإجراءات…
        </div>
      ) : error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 text-base font-bold text-slate-800">
                <UsersRound className="h-4 w-4 text-[#b8952d]" />
                طلبات الشركاء الجدد
              </h3>
              <span className="rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-bold text-[#b8952d]">
                {data.counts.partners}
              </span>
            </div>

            {data.partnerRequests.length ? (
              <ul className="space-y-2">
                {data.partnerRequests.map((request) => (
                  <li
                    key={`${request.type}-${request.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#b8952d]">
                      <UserPlus className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {request.name}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                        {request.type === 'expert'
                          ? 'خبير وجهات'
                          : 'قائد رحلات'}
                      </p>
                    </div>
                    <Link
                      href={`/crm/partners-directory/profile?id=${encodeURIComponent(request.id)}&type=${request.type === 'expert' ? 'experts' : 'leaders'}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#1A2421] px-3 py-2 text-[11px] font-bold text-[#D4AF37] transition hover:opacity-90"
                    >
                      مراجعة
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center text-sm font-semibold text-slate-500">
                لا توجد طلبات شركاء معلّقة.
              </p>
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 text-base font-bold text-slate-800">
                <Inbox className="h-4 w-4 text-[#b8952d]" />
                طلبات العملاء الجديدة
              </h3>
              <span className="rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-bold text-[#b8952d]">
                {data.counts.clients}
              </span>
            </div>

            {data.clientRequests.length ? (
              <ul className="space-y-2">
                {data.clientRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#b8952d]">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {request.name}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                        {request.destination}
                      </p>
                    </div>
                    <Link
                      href="/crm/radar"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      عرض الطلب
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center text-sm font-semibold text-slate-500">
                لا توجد طلبات عملاء جديدة.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
