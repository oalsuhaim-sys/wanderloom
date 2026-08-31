'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Calendar,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Plus,
  Receipt,
  StickyNote,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import {
  addClientActivityNoteAction,
  fetchClientActivityAction,
} from '@/app/actions/clientActivityActions';
import { getClientFinancialHubAction } from '@/app/actions/clientFinancialActions';
import type { ClientFinancialHubData } from '@/lib/client-financial-hub';
import type { ClientActivityLog, ClientActivityType } from '@/lib/client-activity-types';
import type { UnifiedTripRow } from '@/lib/client-trips-crm';
import { formatWalletAmount } from '@/lib/vip-wallet-ledger';
import {
  normalizeVipSpendingTier,
  vipSpendingTierLabel,
} from '@/lib/vip-spending-tier';
import { toast } from '@/lib/crm-toast';

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

type TimelineTone = 'emerald' | 'navy' | 'gold' | 'slate';

type TimelineVisual = {
  icon: LucideIcon;
  tone: TimelineTone;
  kindLabel: string;
};

const GLASS_BADGE =
  'inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm';

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

function formatActivityDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      try {
        return new Date(s.slice(0, 10)).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        return s.slice(0, 10);
      }
    }
    return s;
  }
  return d.toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timelineVisual(type: ClientActivityType): TimelineVisual {
  switch (type) {
    case 'booking':
    case 'trip':
      return { icon: CheckCircle2, tone: 'emerald', kindLabel: 'تأكيد حجز' };
    case 'quote':
      return { icon: FileText, tone: 'navy', kindLabel: 'عرض سعر' };
    case 'meeting':
      return { icon: Calendar, tone: 'gold', kindLabel: 'اجتماع' };
    case 'contact':
      return { icon: MessageCircle, tone: 'slate', kindLabel: 'تواصل' };
    case 'payment':
      return { icon: Wallet, tone: 'emerald', kindLabel: 'دفعة' };
    case 'invoice':
      return { icon: Receipt, tone: 'navy', kindLabel: 'فاتورة' };
    case 'note':
      return { icon: StickyNote, tone: 'gold', kindLabel: 'ملاحظة' };
    default:
      return { icon: MapPin, tone: 'slate', kindLabel: 'حدث' };
  }
}

function nodeToneClass(tone: TimelineTone): string {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-300 text-emerald-600 dark:border-emerald-700/40 dark:text-emerald-400';
    case 'navy':
      return 'border-slate-300 text-slate-700 dark:border-[#D4AF37]/40 dark:text-[#D4AF37]';
    case 'gold':
      return 'border-[#D4AF37]/50 text-[#B8941F] dark:border-[#D4AF37]/40 dark:text-[#D4AF37]';
    default:
      return 'border-slate-200 text-slate-500 dark:border-[#2D3F3A] dark:text-[#D4AF37]';
  }
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
  const [activities, setActivities] = useState<ClientActivityLog[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadFinance = useCallback(async () => {
    if (!clientId) return;
    setLoadingFinance(true);
    const result = await getClientFinancialHubAction(clientId);
    setLoadingFinance(false);
    if (result.ok) setFinance(result.data);
    else setFinance(null);
  }, [clientId]);

  const loadActivities = useCallback(async () => {
    if (!clientId) return;
    setLoadingActivities(true);
    setActivityError(null);
    const result = await fetchClientActivityAction(clientId);
    setLoadingActivities(false);
    if (!result.ok) {
      setActivities([]);
      setActivityError(result.error);
      return;
    }
    setActivities(result.rows);
  }, [clientId]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text || savingNote) return;
    setSavingNote(true);
    const result = await addClientActivityNoteAction(clientId, text);
    setSavingNote(false);
    if (!result.ok) {
      toast.error(result.error || 'تعذر حفظ الملاحظة.');
      return;
    }
    setNoteText('');
    toast.success('تم إضافة الملاحظة.');
    await loadActivities();
  };

  const initials = clientInitials(name || 'عميل');
  const displayPhone = String(phone ?? '').trim();
  const displayEmail = String(email ?? '').trim();
  const tierLabel = vipSpendingTierLabel(
    normalizeVipSpendingTier(vipTier, totalProfit),
  ).replace(/\s*[🟡⚫✨]\s*$/u, '');

  const totalSpent = finance?.totals.paid ?? 0;
  const remaining = finance?.totals.remaining ?? 0;
  const activeBookings =
    finance?.itineraries.length ??
    trips.filter((t) => {
      const s = String(t.status ?? '').toLowerCase();
      return !s || !['completed', 'done', 'cancelled', 'canceled', 'مكتمل', 'ملغي'].includes(s);
    }).length;

  return (
    <div
      className="space-y-4 font-sans"
      aria-label="ملف العميل 360"
      data-wl-client-profile="navy-olive-v4"
    >
      <section
        data-wl-banner="theme-aware"
        className="flex w-full flex-col flex-wrap items-start justify-between gap-4 rounded-2xl bg-slate-900 p-6 text-white md:flex-row md:items-center dark:!bg-[#22302C] dark:text-[#D4AF37]"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-semibold tracking-wide text-white backdrop-blur-sm dark:border-[#D4AF37]/35 dark:!bg-[#1A2421] dark:text-[#D4AF37]"
            aria-hidden
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl dark:text-gray-100">
                {name || 'عميل بدون اسم'}
              </h1>
              <span className={GLASS_BADGE}>VIP</span>
              <span className={GLASS_BADGE} title={tierLabel}>
                {tierLabel}
              </span>
            </div>

            {badges ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70 dark:text-gray-300">
              {displayPhone ? (
                <span className="inline-flex items-center gap-1.5 font-medium" dir="ltr">
                  <Phone className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  {displayPhone}
                </span>
              ) : null}
              {displayEmail ? (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Mail className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  {displayEmail}
                </span>
              ) : null}
              {jobType ? <span className="font-medium text-white/55">{jobType}</span> : null}
              {travelType ? (
                <span className="font-medium text-white/55">{travelType}</span>
              ) : null}
            </div>
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}

        {footer ? <div className="w-full md:basis-full">{footer}</div> : null}
      </section>

      <section aria-label="ملخص المحفظة">
        {loadingFinance ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-8 text-sm font-medium text-slate-500 dark:border-[#2D3F3A] dark:!bg-[#22302C] dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin dark:text-[#D4AF37]" aria-hidden />
            جارٍ تحميل الملخص المالي…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      <section
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:!bg-[#22302C]"
        aria-labelledby="client-360-timeline-title"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2
            id="client-360-timeline-title"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            سجل الرحلات والتفاعلات
          </h2>
        </div>

        <form
          className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-stretch"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAddNote();
          }}
        >
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="أضف ملاحظة أو تفاعلاً يدوياً…"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]/50 dark:focus:ring-[#D4AF37]/20"
            disabled={savingNote}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={savingNote || !noteText.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/30"
          >
            {savingNote ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            إضافة
          </button>
        </form>

        {loadingActivities ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin dark:text-[#D4AF37]" aria-hidden />
            جارٍ تحميل السجل…
          </div>
        ) : activityError ? (
          <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
            {activityError}
          </p>
        ) : activities.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-400">
            لا توجد تفاعلات بعد — أضف ملاحظة أو ستظهر هنا الدفعات والحجوزات تلقائياً.
          </p>
        ) : (
          <ol className="relative space-y-4 border-s-2 border-slate-200 ps-6 dark:border-[#2D3F3A]">
            {activities.map((item) => {
              const visual = timelineVisual(item.type);
              const Icon = visual.icon;
              return (
                <li key={item.id} className="relative">
                  <span
                    className={`absolute -start-[1.9rem] top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white shadow-sm dark:!bg-[#1A2421] ${nodeToneClass(visual.tone)}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 transition hover:bg-white dark:border-[#2D3F3A] dark:!bg-[#1A2421]/80">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-[#D4AF37]/70">
                        {visual.kindLabel}
                      </span>
                      <time
                        className="text-[11px] font-medium text-slate-400 dark:text-slate-500"
                        dateTime={item.created_at}
                      >
                        {formatActivityDate(item.created_at)}
                      </time>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                      {item.title}
                    </p>
                    {item.description ? (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-[#2D3F3A] dark:!bg-[#22302C]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className="text-slate-400 dark:text-[#D4AF37]">{icon}</span>
      </div>
      <p
        className="text-xl font-semibold tabular-nums text-slate-900 dark:text-gray-100"
        dir={dir}
      >
        {value}
      </p>
    </div>
  );
}
