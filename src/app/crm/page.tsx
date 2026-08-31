'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Award,
  BarChart3,
  CalendarDays,
  Loader2,
  Radar,
  Route,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  AlertCircle,
} from 'lucide-react';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import { SystemCheckModal } from '@/app/crm/_components/SystemCheckModal';
import {
  fetchMarketingPublishingRadar,
  type MarketingPublishRadarItem,
} from '@/lib/marketing-publishing-radar';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { supabase } from '@/lib/supabase';

const CARD =
  'bg-white dark:bg-[#22302C] rounded-xl shadow-sm border border-slate-200 dark:border-[#2D3F3A] hover:shadow-md transition-shadow';
const ICON_WELL =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-[#1A2421] dark:text-[#D4AF37]';
const TH =
  'bg-slate-50 px-5 py-3 text-right text-sm font-semibold text-slate-600 border-b border-slate-200 dark:bg-[#1A2421] dark:text-[#D4AF37] dark:border-[#2D3F3A]';

/** أقسام أسفل الصفحة — تُحمّل عند الحاجة فقط لتخفيف حجم الشحنة الأولى */
const DashboardPendingActions = dynamic(
  () => import('@/app/crm/_components/DashboardPendingActions'),
  { ssr: false },
);
const MarketingPublishingRadar = dynamic(
  () => import('@/app/crm/_components/MarketingPublishingRadar'),
  { ssr: false },
);

type ClientJoin = { name?: string | null };

type RadarRow = {
  id: number;
  title: string | null;
  destination: string | null;
  customer_name: string | null;
  expert_id: string | number | null;
  status: string | null;
  created_at: string | null;
  clients?: ClientJoin | ClientJoin[] | null;
};

function resolveRadarClientName(row: RadarRow): string {
  const raw = row.clients;
  const client = Array.isArray(raw) ? raw[0] : raw;
  const joined = String(client?.name ?? '').trim();
  return joined || row.customer_name?.trim() || '—';
}

function todayLabelArabic(): string {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString('ar-SA');
  }
}

function formatCreatedAtArabic(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return '—';
  }
}

function statusBadge(status: string | null | undefined): { label: string; className: string } {
  const s = String(status ?? '').trim().toLowerCase();
  const map: Record<string, { label: string; className: string }> = {
    draft: {
      label: 'مسودة',
      className:
        'bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs font-medium dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]',
    },
    sent: {
      label: 'مُرسل',
      className:
        'bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs font-medium dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]',
    },
    active: {
      label: 'نشطة',
      className:
        'bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-medium dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    archived: {
      label: 'مؤرشفة',
      className:
        'bg-rose-50 text-rose-800 px-3 py-1 rounded-full text-xs font-medium dark:bg-rose-950/40 dark:text-rose-300',
    },
    confirmed: {
      label: 'مؤكّدة',
      className:
        'bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-medium dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    template: {
      label: 'قالب',
      className:
        'bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium dark:bg-[#1A2421] dark:text-slate-300',
    },
  };
  return (
    map[s] ?? {
      label: status?.trim() || '—',
      className:
        'bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium dark:bg-[#1A2421] dark:text-slate-300',
    }
  );
}

function formatStatNumber(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return safe.toLocaleString('en-US');
}

/** عدد المسارات الفردية (غير قالب). */
async function fetchPrivateItinerariesCount(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('itineraries')
    .select('*', { count: 'exact', head: true })
    .not('is_template', 'eq', true)
    .or('trip_type.eq.Individual,trip_type.is.null');
  if (error) {
    console.warn('[crm dashboard] private itineraries count:', error.message);
    return 0;
  }
  return count ?? 0;
}

/** مقاعد محجوزة في رحلات المجموعات — من customers (لا يوجد جدول group_registrations). */
async function fetchGroupTripSeatsBooked(): Promise<number> {
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from('customers')
    .select('group_size, travelers_count')
    .filter('trip_form->>lead_type', 'eq', 'group_trip_seat');

  if (!error) {
    return sumGroupTripSeatsBooked(data ?? []);
  }

  if (error) {
    console.warn('[crm dashboard] group seats (trip_form filter):', error.message);
  }

  const { count, error: countError } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .ilike('destination_dream', 'حجز مقعد%');

  if (countError) {
    console.warn('[crm dashboard] group seats (destination fallback):', countError.message);
    return 0;
  }

  return count ?? 0;
}

function sumGroupTripSeatsBooked(
  rows: { group_size?: number | null; travelers_count?: number | null }[] | null,
): number {
  if (!rows?.length) return 0;
  return rows.reduce((acc, r) => {
    const groupSize = Number(r.group_size);
    const travelers = Number(r.travelers_count);
    const seats =
      Number.isFinite(groupSize) && groupSize > 0
        ? groupSize
        : Number.isFinite(travelers) && travelers > 0
          ? travelers
          : 1;
    return acc + seats;
  }, 0);
}

export default function CRMHomeDashboardPage() {
  const { employee, profileAccess, loading: empLoading } = useCrmEmployee();
  const displayName = employee?.full_name?.trim() || null;
  const canRunSystemTest = Boolean(profileAccess?.is_admin);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientsTotal, setClientsTotal] = useState<number>(0);
  const [individualItineraries, setIndividualItineraries] = useState<number>(0);
  const [groupsTotal, setGroupsTotal] = useState<number>(0);
  const [totalBookings, setTotalBookings] = useState<number>(0);
  const [radarRows, setRadarRows] = useState<RadarRow[]>([]);
  const [expertNames, setExpertNames] = useState<Record<string, string>>({});
  const [marketingRadar, setMarketingRadar] = useState<MarketingPublishRadarItem[]>([]);
  const [marketingRadarLoading, setMarketingRadarLoading] = useState(true);
  const [marketingRadarError, setMarketingRadarError] = useState<string | undefined>();
  /** Opens the E2E modal only — test runs after explicit "بدء اختبار E2E". */
  const [systemCheckOpen, setSystemCheckOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!supabase) {
      setError('قاعدة البيانات غير مهيأة.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [
        clientsRes,
        indItinRes,
        groupsRes,
        privateItinerariesCount,
        groupSeatsBooked,
        radarRes,
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase
          .from('itineraries')
          .select('*', { count: 'exact', head: true })
          .not('is_template', 'eq', true)
          .or('trip_type.eq.Individual,trip_type.is.null'),
        supabase.from('group_trips').select('*', { count: 'exact', head: true }),
        fetchPrivateItinerariesCount(),
        fetchGroupTripSeatsBooked(),
        supabase
          .from('itineraries')
          .select('id, title, destination, customer_name, expert_id, status, created_at, clients(name)')
          .not('is_template', 'eq', true)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const errs = [
        clientsRes.error?.message,
        indItinRes.error?.message,
        groupsRes.error?.message,
        radarRes.error?.message,
      ].filter(Boolean);

      setClientsTotal(clientsRes.count ?? 0);
      setIndividualItineraries(indItinRes.count ?? 0);
      setGroupsTotal(groupsRes.count ?? 0);
      setTotalBookings(privateItinerariesCount + groupSeatsBooked);
      setRadarRows((radarRes.data as RadarRow[]) ?? []);

      try {
        const accessToken = await getClientAccessToken();
        const expertsResponse = await fetch('/api/crm/experts', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const expertsPayload = (await expertsResponse.json()) as {
          ok?: boolean;
          rows?: Array<{ id: string; name: string }>;
        };
        if (expertsResponse.ok && expertsPayload.ok) {
          setExpertNames(
            Object.fromEntries(
              (expertsPayload.rows ?? [])
                .filter((expert) => expert.id && expert.name)
                .map((expert) => [String(expert.id), expert.name]),
            ),
          );
        }
      } catch (expertError) {
        console.warn('[crm dashboard] expert names:', expertError);
      }

      setMarketingRadarLoading(true);
      const marketingResult = await fetchMarketingPublishingRadar(supabase);
      setMarketingRadar(marketingResult.items);
      setMarketingRadarError(marketingResult.error);
      setMarketingRadarLoading(false);

      if (errs.length) {
        setError(errs.join(' · ') || null);
      }
    } catch (e) {
      console.error('[crm dashboard]', e);
      setError('تعذر تحميل بيانات اللوحة. تحقّق من الشبكة والصلاحيات.');
      setMarketingRadarLoading(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const statCards = useMemo(
    () => [
      {
        label: 'إجمالي العملاء (VIP)',
        value: clientsTotal,
        sub: 'من جدول العملاء',
        icon: UserRound,
      },
      {
        label: 'الرحلات الفردية',
        value: individualItineraries,
        sub: 'Individual أو غير مُعرّف + غير قالب',
        icon: Route,
      },
      {
        label: 'إجمالي القروبات',
        value: groupsTotal,
        sub: 'الرحلات الجماعية المجدولة',
        icon: Users,
      },
      {
        label: 'إجمالي الحجوزات',
        value: totalBookings,
        sub: 'الرحلات الخاصة والمقاعد الجماعية',
        icon: BarChart3,
      },
    ],
    [clientsTotal, individualItineraries, groupsTotal, totalBookings],
  );

  const QUICK_ACTIONS = [
    {
      href: '/crm/itineraries',
      title: 'إضافة / إدارة رحلات فردية',
      desc: 'قائمة المسارات وفتح مسار أو بناء مسار VIP',
      icon: Route,
    },
    {
      href: '/crm/groups',
      title: 'إدارة القروبات',
      desc: 'رحلات المجموعات والمقاعد',
      icon: Users,
    },
    {
      href: '/crm/clients',
      title: 'سجل العملاء',
      desc: 'بيانات الـ CRM والتواصل',
      icon: UserRound,
    },
    {
      href: '/crm/features',
      title: 'دليل الميزات',
      desc: 'شرح الوحدات للفريق',
      icon: Award,
    },
  ] as const;

  function StatSkeleton() {
    return (
      <article className={`${CARD} p-5`}>
        <div className="flex animate-pulse items-start justify-between gap-3">
          <div className="flex-1 space-y-3 text-right">
            <div className="ms-auto h-3 w-32 rounded-full bg-slate-100 dark:bg-[#1A2421]" />
            <div className="ms-auto h-8 w-24 rounded-xl bg-slate-100 dark:bg-[#1A2421]" />
            <div className="ms-auto h-3 w-full max-w-[9rem] rounded-full bg-slate-50 dark:bg-[#1A2421]/70" />
          </div>
          <span className="h-11 w-11 shrink-0 rounded-xl bg-slate-100 dark:bg-[#1A2421]" />
        </div>
      </article>
    );
  }

  return (
    <div
      className="min-h-full bg-[#F9FAFB] pb-14 font-sans dark:bg-[#1A2421]"
      dir="rtl"
      data-wl-dashboard="navy-olive-v1"
    >
      <header className="relative overflow-hidden rounded-2xl border border-transparent bg-slate-900 p-6 text-white shadow-sm sm:p-8 dark:border dark:border-[#D4AF37]/30 dark:!bg-[#22302C] dark:text-[#D4AF37]">
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/50 dark:text-[#D4AF37]/80">
              Wanderloom CRM
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl dark:text-gray-100">
              مركز القيادة والإحصائيات
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-white/75 dark:text-gray-300">
              {displayName ? (
                <>
                  يسعدنا أن نراك،{' '}
                  <span className="text-white dark:text-[#D4AF37]">{displayName}</span>. لمحة حقيقية من
                  قاعدة البيانات — محدَّثة عند فتح هذه الصفحة.
                </>
              ) : empLoading ? (
                <span className="inline-block h-5 w-64 animate-pulse rounded bg-white/10" />
              ) : (
                <>مركز الإحصائيات جاهز: الأرقام أدناه تُجلب مباشرة من Supabase.</>
              )}
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 md:w-auto md:min-w-[240px]">
            {canRunSystemTest ? (
              <button
                type="button"
                onClick={() => setSystemCheckOpen(true)}
                className="group flex items-center justify-center gap-2 rounded-xl !bg-white px-5 py-3 text-sm font-semibold !text-slate-900 transition hover:!bg-slate-50 dark:!border dark:!border-[#D4AF37]/50 dark:!bg-[#D4AF37]/20 dark:!text-[#D4AF37] dark:hover:!bg-[#D4AF37]/30"
              >
                <ShieldCheck className="h-5 w-5 transition group-hover:scale-105" aria-hidden />
                فحص شامل للنظام
              </button>
            ) : null}
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-right backdrop-blur-sm dark:border-[#D4AF37]/20 dark:bg-[#1A2421]/50">
              <span className="flex items-center justify-end gap-2 text-[11px] font-medium uppercase tracking-wider text-white/65 dark:text-[#D4AF37]/80">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
                اليوم
              </span>
              <p className="mt-1 text-sm font-medium leading-relaxed text-white dark:text-gray-100">
                {todayLabelArabic()}
              </p>
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <div
          className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-right text-sm text-rose-900 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <span className="font-medium">{error}</span>
        </div>
      ) : null}

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="إحصائيات سريعة">
        {loading
          ? [0, 1, 2, 3].map((k) => <StatSkeleton key={k} />)
          : statCards.map((s) => {
              const Icon = s.icon;
              return (
                <article key={s.label} className={`${CARD} p-5`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-right">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
                      <p
                        className="mt-2 text-2xl font-bold text-slate-900 dark:text-gray-100"
                        dir="ltr"
                      >
                        {formatStatNumber(s.value ?? 0)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.sub}</p>
                    </div>
                    <span className={ICON_WELL}>
                      <Icon className="h-5 w-5" aria-hidden strokeWidth={2} />
                    </span>
                  </div>
                </article>
              );
            })}
      </section>

      <section className="mt-8 text-right" aria-label="الوصول السريع" dir="rtl">
        <h2 className="mb-4 flex flex-wrap items-center justify-start gap-2 text-lg font-semibold text-slate-900 dark:text-gray-100">
          <Sparkles className="h-5 w-5 text-[#D4AF37]" aria-hidden />
          الوصول السريع
        </h2>
        <div
          className="grid grid-cols-1 gap-4 text-right sm:grid-cols-2 md:grid-cols-4 [direction:rtl]"
          dir="rtl"
        >
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className={`${CARD} group flex flex-col p-5 text-right`}
                dir="rtl"
              >
                <span className={ICON_WELL}>
                  <Icon className="h-5 w-5" aria-hidden strokeWidth={2} />
                </span>
                <span className="mt-4 text-base font-bold text-slate-900 dark:text-gray-100">
                  {a.title}
                </span>
                <span className="mt-1.5 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  {a.desc}
                </span>
                <span className="mt-3 text-xs font-medium text-slate-400 opacity-0 transition group-hover:opacity-100 dark:text-[#D4AF37]">
                  انتقال الآن ◂
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8" aria-label="رادار النشر التسويقي">
        <MarketingPublishingRadar
          items={marketingRadar}
          loading={loading || marketingRadarLoading}
          error={marketingRadarError}
        />
      </section>

      <DashboardPendingActions />

      <section
        className={`${CARD} mt-8 overflow-hidden`}
        aria-label="آخر الرحلات"
      >
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 text-right sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F3A]">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">الرادار الحي</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                آخر 5 مسارات مضافة (غير قوالب الجدول)
              </p>
            </div>
            <span className={ICON_WELL}>
              <Radar className="h-5 w-5" aria-hidden strokeWidth={2.2} />
            </span>
          </div>
          <Link
            href="/crm/itineraries"
            className="self-end text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900 dark:text-[#D4AF37] dark:decoration-[#D4AF37]/40 sm:self-auto"
          >
            كل المسارات ←
          </Link>
        </div>

        <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2D3F3A]">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center gap-3 px-6 py-12 text-slate-600 dark:text-gray-300" dir="rtl">
              <Loader2 className="h-7 w-7 animate-spin text-[#D4AF37]" aria-hidden />
              <span className="text-sm font-medium">جاري تحميل الرادار...</span>
            </div>
          ) : radarRows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
              لا توجد مسارات لعرضها بعد.
            </div>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-right text-sm">
              <thead>
                <tr>
                  <th className={TH}>اسم الرحلة</th>
                  <th className={TH}>اسم العميل</th>
                  <th className={TH}>الوجهة</th>
                  <th className={TH}>المسؤول</th>
                  <th className={TH}>تاريخ الإنشاء</th>
                  <th className={`${TH} text-center`}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {radarRows.map((row) => {
                  const b = statusBadge(row.status);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-[#2D3F3A] dark:hover:bg-[#2A3834]/50"
                    >
                      <td
                        className="max-w-[12rem] truncate px-5 py-3.5 font-semibold text-slate-900 dark:text-gray-100"
                        title={row.title ?? ''}
                      >
                        {row.title?.trim() || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-gray-300">
                        {resolveRadarClientName(row)}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-gray-300">
                        {row.destination?.trim() || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {row.expert_id != null && expertNames[String(row.expert_id)] ? (
                          <span className="font-semibold text-slate-900 dark:text-gray-100">
                            {expertNames[String(row.expert_id)]}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]">
                            بانتظار التعيين
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-500 dark:text-slate-400">
                        {formatCreatedAtArabic(row.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex ${b.className}`}>{b.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <SystemCheckModal open={systemCheckOpen} onClose={() => setSystemCheckOpen(false)} />
    </div>
  );
}
