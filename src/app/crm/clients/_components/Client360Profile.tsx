'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plane,
  Receipt,
  Wallet,
} from 'lucide-react';

import { getClientFinancialHubAction } from '@/app/actions/clientFinancialActions';
import type { ClientFinancialHubData } from '@/lib/client-financial-hub';
import type { UnifiedTripRow } from '@/lib/client-trips-crm';
import {
  formatInvoiceAmount,
  INVOICE_STATUS_LABEL,
  type InvoiceRow,
} from '@/lib/crm-invoices';
import { formatShortArabicDate } from '@/lib/public-itinerary';
import { formatWalletAmount } from '@/lib/vip-wallet-ledger';
import VipSpendingTierBadge from '@/components/VipSpendingTierBadge';

type Client360ProfileProps = {
  clientId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  jobType?: string | null;
  travelType?: string | null;
  vipTier?: string | null;
  totalProfit?: number;
  trips: UnifiedTripRow[];
  badges?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
};

type TimelineItem = {
  id: string;
  kind: 'trip' | 'payment' | 'invoice';
  title: string;
  subtitle: string;
  date: string | null;
  href: string | null;
  amountLabel?: string;
};

function clientInitials(name: string): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`;
  }
  const single = parts[0] ?? 'WL';
  return single.slice(0, 2);
}

function tripDateLabel(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return formatShortArabicDate(s.slice(0, 10));
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('ar-SA');
}

function invoiceDate(inv: InvoiceRow): string | null {
  const raw =
    (inv as { paid_at?: string | null }).paid_at ||
    (inv as { created_at?: string | null }).created_at ||
    null;
  return raw ? String(raw).slice(0, 10) : null;
}

function buildTimeline(
  trips: UnifiedTripRow[],
  invoices: InvoiceRow[],
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const trip of trips) {
    items.push({
      id: `trip-${trip.backend}-${trip.id}`,
      kind: 'trip',
      title: trip.destination || 'رحلة',
      subtitle: trip.notes?.trim() || trip.status || 'رحلة مسجّلة',
      date: trip.trip_date || trip.end_date || null,
      href: trip.viewUrl ?? null,
      amountLabel:
        trip.cost > 0 ? formatWalletAmount(trip.cost) : undefined,
    });
  }

  for (const inv of invoices) {
    const status = String(inv.status ?? '').toLowerCase();
    const statusLabel =
      (INVOICE_STATUS_LABEL as Record<string, string>)[status] ||
      inv.status ||
      'فاتورة';
    items.push({
      id: `inv-${inv.id}`,
      kind: status === 'paid' ? 'payment' : 'invoice',
      title: status === 'paid' ? 'دفعة مستلمة' : 'فاتورة',
      subtitle: statusLabel,
      date: invoiceDate(inv),
      href: `/invoice/${inv.id}`,
      amountLabel: formatInvoiceAmount(Number(inv.amount ?? 0)),
    });
  }

  return items.sort((a, b) => {
    const da = a.date ?? '';
    const db = b.date ?? '';
    if (da !== db) return db.localeCompare(da);
    return b.id.localeCompare(a.id);
  });
}

export default function Client360Profile({
  clientId,
  name,
  phone,
  email,
  jobType,
  travelType,
  vipTier,
  totalProfit,
  trips,
  badges,
  actions,
  footer,
}: Client360ProfileProps) {
  const [finance, setFinance] = useState<ClientFinancialHubData | null>(null);
  const [loadingFinance, setLoadingFinance] = useState(true);

  const loadFinance = useCallback(async () => {
    if (!clientId) return;
    setLoadingFinance(true);
    const result = await getClientFinancialHubAction(clientId);
    setLoadingFinance(false);
    if (result.ok) setFinance(result.data);
    else setFinance(null);
  }, [clientId]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  const initials = clientInitials(name || 'عميل');
  const displayPhone = String(phone ?? '').trim();
  const displayEmail = String(email ?? '').trim();

  const totalSpent = finance?.totals.paid ?? 0;
  const remaining = finance?.totals.remaining ?? 0;
  const activeBookings =
    finance?.itineraries.length ??
    trips.filter((t) => {
      const s = String(t.status ?? '').toLowerCase();
      return !s || !['completed', 'done', 'cancelled', 'canceled', 'مكتمل', 'ملغي'].includes(s);
    }).length;

  const timeline = useMemo(
    () => buildTimeline(trips, finance?.invoices ?? []),
    [trips, finance?.invoices],
  );

  return (
    <div className="space-y-6" aria-label="ملف العميل 360">
      {/* ── Profile Header ── */}
      <section className="relative overflow-hidden rounded-3xl bg-[#1A3B2A] p-8 text-white shadow-xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 100% 0%, rgba(197,160,89,0.35), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(197,160,89,0.15), transparent 50%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, #C5A059 0 1px, transparent 1px 14px)',
          }}
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-5">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C5A059]/40 to-[#C5A059]/10 text-2xl font-black text-[#C5A059] ring-2 ring-[#C5A059]/50 shadow-[0_0_24px_rgba(197,160,89,0.35)]"
              aria-hidden
            >
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                  {name || 'عميل بدون اسم'}
                </h1>
                <span className="rounded-full border border-[#C5A059] bg-[#C5A059]/20 px-3 py-1 text-sm font-bold text-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.45)]">
                  VIP
                </span>
                <VipSpendingTierBadge
                  tier={vipTier}
                  totalProfit={totalProfit}
                  className="!text-[11px]"
                />
              </div>

              {badges ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
                {displayPhone ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold" dir="ltr">
                    <Phone className="h-3.5 w-3.5 text-[#C5A059]" aria-hidden />
                    {displayPhone}
                  </span>
                ) : null}
                {displayEmail ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Mail className="h-3.5 w-3.5 text-[#C5A059]" aria-hidden />
                    {displayEmail}
                  </span>
                ) : null}
                {jobType ? (
                  <span className="font-semibold text-white/60">{jobType}</span>
                ) : null}
                {travelType ? (
                  <span className="font-semibold text-white/60">{travelType}</span>
                ) : null}
              </div>
            </div>
          </div>

          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>

        {footer ? <div className="relative mt-6">{footer}</div> : null}
      </section>

      {/* ── Wallet & Financials ── */}
      <section aria-label="ملخص المحفظة">
        {loadingFinance ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#C5A059]/25 bg-white py-10 text-sm font-bold text-[#1A3B2A]/60">
            <Loader2 className="h-5 w-5 animate-spin text-[#C5A059]" aria-hidden />
            جارٍ تحميل الملخص المالي…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FinanceStatCard
              label="إجمالي المدفوعات"
              value={formatWalletAmount(totalSpent)}
              icon={<Wallet className="h-4 w-4" aria-hidden />}
            />
            <FinanceStatCard
              label="الرصيد المتبقي"
              value={formatWalletAmount(remaining)}
              icon={<Receipt className="h-4 w-4" aria-hidden />}
            />
            <FinanceStatCard
              label="حجوزات نشطة"
              value={String(activeBookings)}
              icon={<Plane className="h-4 w-4" aria-hidden />}
              dir="rtl"
            />
          </div>
        )}
      </section>

      {/* ── Activity Timeline ── */}
      <section
        className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
        aria-labelledby="client-360-timeline-title"
      >
        <h2
          id="client-360-timeline-title"
          className="mb-6 text-base font-black text-[#1A3B2A]"
        >
          سجل الرحلات والتفاعلات
        </h2>

        {timeline.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
            لا توجد تفاعلات مسجّلة بعد.
          </p>
        ) : (
          <ol className="relative space-y-0 pr-1">
            {timeline.map((item, index) => {
              const isLast = index === timeline.length - 1;
              const Inner = (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[#1A3B2A]">{item.title}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {item.subtitle}
                      </p>
                    </div>
                    {item.amountLabel ? (
                      <span
                        className="shrink-0 text-xs font-black text-[#C5A059]"
                        dir="ltr"
                      >
                        {item.amountLabel}
                      </span>
                    ) : null}
                  </div>
                  {item.date ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                      <Calendar className="h-3 w-3" aria-hidden />
                      {tripDateLabel(item.date)}
                    </p>
                  ) : null}
                </>
              );

              return (
                <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="relative flex w-4 shrink-0 flex-col items-center">
                    <span className="z-10 mt-1.5 h-3 w-3 rounded-full bg-[#C5A059] shadow-[0_0_8px_rgba(197,160,89,0.7)] ring-2 ring-[#C5A059]/30" />
                    {!isLast ? (
                      <span className="absolute top-5 bottom-0 w-px bg-slate-200" aria-hidden />
                    ) : null}
                  </div>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-[#C5A059]/40 hover:bg-[#FEFDF9] hover:shadow-sm"
                    >
                      <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#C5A059]/80">
                        {item.kind === 'trip' ? (
                          <>
                            <MapPin className="h-3 w-3" aria-hidden /> رحلة
                          </>
                        ) : item.kind === 'payment' ? (
                          <>
                            <Wallet className="h-3 w-3" aria-hidden /> دفعة
                          </>
                        ) : (
                          <>
                            <Receipt className="h-3 w-3" aria-hidden /> فاتورة
                          </>
                        )}
                      </span>
                      {Inner}
                    </Link>
                  ) : (
                    <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                      <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#C5A059]/80">
                        {item.kind === 'trip' ? 'رحلة' : item.kind === 'payment' ? 'دفعة' : 'فاتورة'}
                      </span>
                      {Inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function FinanceStatCard({
  label,
  value,
  icon,
  dir = 'ltr',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-[#C5A059]/50 hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <span className="text-[#C5A059] opacity-70 transition group-hover:opacity-100">
          {icon}
        </span>
      </div>
      <p
        className="text-xl font-black text-[#1A3B2A] tabular-nums md:text-2xl"
        dir={dir}
      >
        {value}
      </p>
    </div>
  );
}
