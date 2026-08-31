'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Cake,
  Luggage,
  Plane,
  RefreshCw,
  UsersRound,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  filterUpcomingBirthdays,
  formatBirthdayDisplayDate,
  type BirthdayRadarClient,
} from '@/lib/birthday-radar';
import { subscribeCrmRealtimeRefresh } from '@/lib/crm-realtime-events';
import { countGroupOnboardingLeads, countNewCrmLeads } from '@/lib/crm-leads';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { formatInvoiceAmount } from '@/lib/crm-invoices';
import { supabase } from '@/lib/supabase';

type PaymentReviewItem = {
  invoiceId: string;
  quoteId: string;
  clientName: string;
  tripTitle: string;
  amount: number;
  href: string;
};

type NotificationCounts = {
  pendingPartners: number;
  pendingTrips: number;
  pendingGroupTrips: number;
  pendingPayments: number;
  pendingPaymentItems: PaymentReviewItem[];
  upcomingBirthdays: BirthdayRadarClient[];
  upcomingBirthdayCount: number;
  totalPending: number;
};

const EMPTY_COUNTS: NotificationCounts = {
  pendingPartners: 0,
  pendingTrips: 0,
  pendingGroupTrips: 0,
  pendingPayments: 0,
  pendingPaymentItems: [],
  upcomingBirthdays: [],
  upcomingBirthdayCount: 0,
  totalPending: 0,
};

const REALTIME_TABLES = [
  'leaders',
  'experts',
  'partner_applications',
  'leads',
  'clients',
  'group_members',
  'invoices',
] as const;

export function AdminNotificationBell({
  className = '',
}: {
  className?: string;
}) {
  const [counts, setCounts] = useState<NotificationCounts>(EMPTY_COUNTS);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      let pendingTrips = 0;
      let pendingGroupTrips = 0;
      let pendingPartners = 0;
      let pendingPayments = 0;
      let pendingPaymentItems: PaymentReviewItem[] = [];
      let upcomingBirthdays: BirthdayRadarClient[] = [];
      let upcomingBirthdayCount = 0;

      try {
        const accessToken = await getClientAccessToken();
        const response = await fetch('/api/crm/notifications/counts', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const payload = (await response.json()) as Partial<NotificationCounts> & {
          ok?: boolean;
        };
        if (response.ok && payload.ok) {
          pendingPartners = Number(payload.pendingPartners) || 0;
          pendingTrips = Number(payload.pendingTrips) || 0;
          pendingGroupTrips = Number(payload.pendingGroupTrips) || 0;
          pendingPayments = Number(payload.pendingPayments) || 0;
          pendingPaymentItems = Array.isArray(payload.pendingPaymentItems)
            ? payload.pendingPaymentItems
            : [];
          upcomingBirthdays = Array.isArray(payload.upcomingBirthdays)
            ? payload.upcomingBirthdays
            : [];
          upcomingBirthdayCount =
            Number(payload.upcomingBirthdayCount) || upcomingBirthdays.length;
        }
      } catch {
        /* Fall back to client-side counts when API is unavailable. */
      }

      // Client-side birthday fallback
      if (supabase && upcomingBirthdayCount === 0) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name, birth_date, phone_wa')
          .not('birth_date', 'is', null)
          .limit(500);
        if (clients?.length) {
          upcomingBirthdays = filterUpcomingBirthdays(
            clients as Record<string, unknown>[],
            7,
          );
          upcomingBirthdayCount = upcomingBirthdays.length;
        }
      }

      // Client counts as fallback when API returns zero (RLS / offline)
      if (supabase && pendingTrips === 0 && pendingGroupTrips === 0) {
        const [tripsCount, groupCount] = await Promise.all([
          countNewCrmLeads(supabase),
          countGroupOnboardingLeads(supabase),
        ]);
        pendingTrips = Math.max(pendingTrips, tripsCount);
        pendingGroupTrips = Math.max(pendingGroupTrips, groupCount);
      }

      setCounts({
        pendingPartners,
        pendingTrips,
        pendingGroupTrips,
        pendingPayments,
        pendingPaymentItems,
        upcomingBirthdays,
        upcomingBirthdayCount,
        totalPending:
          pendingPartners + pendingTrips + pendingPayments + upcomingBirthdayCount,
      });
    } catch {
      /* Keep the last successful counts during temporary network failures. */
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshRef.current = () => refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();

    // Fallback poll — realtime is primary, this covers missed events / RLS gaps
    const interval = window.setInterval(() => void refresh(), 60_000);
    const handleFocus = () => void refresh();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh]);

  useEffect(() => {
    return subscribeCrmRealtimeRefresh((detail) => {
      void refreshRef.current();
      if (detail.source === 'leads' && detail.reason === 'insert') {
        toast('🔔 طلب جديد وصل للرادار', { icon: '🚨', duration: 4500 });
      }
      if (detail.source === 'group_members') {
        toast('🔔 طلب انضمام مجموعة جديد', { icon: '🧳', duration: 4500 });
      }
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel('crm-admin-notification-bell');

    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          if (table === 'leads' && payload.eventType === 'INSERT') {
            const row = payload.new as Record<string, unknown>;
            const name = String(row.full_name ?? row.name ?? '').trim();
            toast(name ? `🔔 طلب جديد من: ${name}` : '🔔 طلب جديد من عميل', {
              duration: 4500,
            });
          }
          void refreshRef.current();
        },
      );
    }

    channel.subscribe((status) => {
      setLive(status === 'SUBSCRIBED');
    });

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const badge =
    counts.totalPending > 99 ? '99+' : String(counts.totalPending);

  return (
    <div ref={rootRef} className={className} dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-slate-900 text-white shadow-lg transition-colors duration-200 hover:opacity-90 dark:border dark:border-[#D4AF37]/30 dark:bg-[#22302C] dark:text-[#D4AF37]"
        aria-label={`الإشعارات: ${counts.totalPending} معلّقة`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {counts.totalPending > 0 ? (
          <span className="absolute -left-2 -top-2 flex min-h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-[#1A2421]">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-[60] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#D4AF37]/20 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-l from-[#10251B] to-[#08140F] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-black">مركز التنبيهات</p>
              <p className="mt-0.5 text-[10px] font-semibold text-white/50">
                {live
                  ? 'متصل مباشرة — يتحدث فور وصول طلب جديد'
                  : 'يتم التحديث تلقائياً كل دقيقة'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh(true)}
              disabled={refreshing}
              className="rounded-lg p-2 text-[#D4AF37] transition hover:bg-white/10 disabled:opacity-50"
              aria-label="تحديث التنبيهات"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          <div className="max-h-[min(70vh,32rem)] space-y-2 overflow-y-auto p-3">
            <div
              className={`rounded-xl border p-3 ${
                counts.pendingPayments > 0
                  ? 'border-rose-200 bg-rose-50/60'
                  : 'border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                  <Wallet className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-black text-slate-900">
                    حوالات بانتظار الاعتماد
                  </strong>
                  <span className="text-xs font-semibold text-slate-500">
                    لديك {counts.pendingPayments} حوالة تحتاج مراجعة
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-black ${
                    counts.pendingPayments > 0
                      ? 'animate-pulse bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {counts.pendingPayments}
                </span>
              </div>

              {counts.pendingPaymentItems.length > 0 ? (
                <ul className="mt-3 space-y-1.5 border-t border-rose-100 pt-3">
                  {counts.pendingPaymentItems.map((item) => (
                    <li key={item.invoiceId}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-white"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-black text-slate-900">
                            {item.clientName}
                          </span>
                          <span className="block truncate text-[10px] font-semibold text-slate-500">
                            {item.tripTitle}
                          </span>
                        </span>
                        <span
                          className="shrink-0 text-[10px] font-black text-rose-700"
                          dir="ltr"
                        >
                          {formatInvoiceAmount(item.amount)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <Link
              href="/crm/partners-radar"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-amber-200 hover:bg-amber-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                <UsersRound className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-black text-slate-900">
                  طلبات انضمام الشركاء
                </strong>
                <span className="text-xs font-semibold text-slate-500">
                  لديك {counts.pendingPartners} طلبات معلّقة
                </span>
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">
                {counts.pendingPartners}
              </span>
            </Link>

            <Link
              href="/crm/radar"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Plane className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-black text-slate-900">
                  طلبات الرحلات الجديدة
                </strong>
                <span className="text-xs font-semibold text-slate-500">
                  لديك {counts.pendingTrips} طلبات جديدة
                </span>
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
                {counts.pendingTrips}
              </span>
            </Link>

            <Link
              href="/crm/radar"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-sky-200 hover:bg-sky-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 text-[#1E2720]">
                <Luggage className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-black text-slate-900">
                  🧳 طلبات انضمام المجموعات
                </strong>
                <span className="text-xs font-semibold text-slate-500">
                  لديك {counts.pendingGroupTrips} طلبات معلّقة
                </span>
              </span>
              <span className="rounded-full bg-[#D4AF37]/25 px-2.5 py-1 text-xs font-black text-[#1E2720]">
                {counts.pendingGroupTrips}
              </span>
            </Link>

            <div
              className={`rounded-xl border p-3 ${
                counts.upcomingBirthdayCount > 0
                  ? 'border-pink-200 bg-pink-50/60'
                  : 'border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-700">
                  <Cake className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-black text-slate-900">
                    🎂 أعياد ميلاد خلال 7 أيام
                  </strong>
                  <span className="text-xs font-semibold text-slate-500">
                    {counts.upcomingBirthdayCount > 0
                      ? `${counts.upcomingBirthdayCount} عميل — جهّز رسالة تهنئة`
                      : 'لا توجد أعياد ميلاد قريبة'}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-black ${
                    counts.upcomingBirthdayCount > 0
                      ? 'animate-pulse bg-pink-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {counts.upcomingBirthdayCount}
                </span>
              </div>

              {counts.upcomingBirthdays.length > 0 ? (
                <ul className="mt-3 space-y-1.5 border-t border-pink-100 pt-3">
                  {counts.upcomingBirthdays.slice(0, 6).map((client) => (
                    <li key={client.id}>
                      <Link
                        href={`/crm/clients/${encodeURIComponent(client.id)}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-white"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-black text-slate-900">
                            {client.name}
                          </span>
                          <span className="block truncate text-[10px] font-semibold text-slate-500">
                            {formatBirthdayDisplayDate(client.birth_date)}
                            {client.daysUntilBirthday === 0
                              ? ' — اليوم! 🎉'
                              : client.daysUntilBirthday === 1
                                ? ' — غداً'
                                : ` — بعد ${client.daysUntilBirthday} أيام`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {counts.totalPending === 0 ? (
              <p className="px-3 py-2 text-center text-xs font-bold text-slate-400">
                لا توجد إجراءات معلّقة حالياً
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
