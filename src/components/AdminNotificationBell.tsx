'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Plane, RefreshCw, UsersRound } from 'lucide-react';

import { countNewCrmLeads } from '@/lib/crm-leads';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { supabase } from '@/lib/supabase';

type NotificationCounts = {
  pendingPartners: number;
  pendingTrips: number;
  totalPending: number;
};

const EMPTY_COUNTS: NotificationCounts = {
  pendingPartners: 0,
  pendingTrips: 0,
  totalPending: 0,
};

const REALTIME_TABLES = [
  'leaders',
  'experts',
  'partner_applications',
  'leads',
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
      // Leads count: same client query as Radar «صندوق الوارد» (never diverge via API)
      let pendingTrips = 0;
      if (supabase) {
        pendingTrips = await countNewCrmLeads(supabase);
      }

      let pendingPartners = 0;
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
          // Prefer API trips only if client count failed to zero while API has data
          const apiTrips = Number(payload.pendingTrips) || 0;
          if (pendingTrips === 0 && apiTrips > 0) {
            pendingTrips = apiTrips;
          }
        }
      } catch {
        /* Partners count is best-effort; lead count already loaded from Inbox query. */
      }

      setCounts({
        pendingPartners,
        pendingTrips,
        totalPending: pendingPartners + pendingTrips,
      });
    } catch {
      /* Keep the last successful counts during temporary network failures. */
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  refreshRef.current = () => refresh();

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
    if (!supabase) return;

    const channel = supabase.channel('crm-admin-notification-bell');

    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
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
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-[#10251B] text-[#D4AF37] shadow-lg transition hover:border-[#D4AF37]/70 hover:bg-[#183529]"
        aria-label={`الإشعارات: ${counts.totalPending} معلّقة`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {counts.totalPending > 0 ? (
          <span className="absolute -left-2 -top-2 flex min-h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black leading-none text-white ring-2 ring-[#F6F4F0]">
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

          <div className="space-y-2 p-3">
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
