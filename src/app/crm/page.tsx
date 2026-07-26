'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import toast, { Toaster } from 'react-hot-toast';
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Radar,
  Route,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  AlertCircle,
  X,
  XCircle,
} from 'lucide-react';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import {
  fetchMarketingPublishingRadar,
  type MarketingPublishRadarItem,
} from '@/lib/marketing-publishing-radar';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { supabase } from '@/lib/supabase';

const FOREST = '#1A3B2A';
const GOLD = '#C5A059';

/** أقسام أسفل الصفحة — تُحمّل عند الحاجة فقط لتخفيف حجم الشحنة الأولى */
const DashboardPendingActions = dynamic(
  () => import('@/app/crm/_components/DashboardPendingActions'),
  { ssr: false },
);
const MarketingPublishingRadar = dynamic(
  () => import('@/app/crm/_components/MarketingPublishingRadar'),
  { ssr: false },
);

type SystemTestStep = {
  step: number;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  detail?: string;
  id?: string | number | null;
};

type SystemTestResult = {
  ok?: boolean;
  overall?: 'PASS' | 'FAIL';
  summary?: string;
  error?: string;
  steps?: SystemTestStep[];
};

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
    draft: { label: 'مسودة', className: 'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold' },
    sent: { label: 'مُرسل', className: 'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold' },
    active: { label: 'نشطة', className: 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold' },
    archived: { label: 'مؤرشفة', className: 'bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold' },
    confirmed: { label: 'مؤكّدة', className: 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold' },
    template: { label: 'قالب', className: 'bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold' },
  };
  return (
    map[s] ?? {
      label: status?.trim() || '—',
      className: 'bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold',
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
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<SystemTestResult | null>(null);

  const runSystemHealthCheck = useCallback(async () => {
    if (healthChecking) return;
    setHealthChecking(true);
    setHealthResult(null);
    const loadingToast = toast.loading('جاري محاكاة دورة حياة رحلة كاملة...', {
      style: { background: FOREST, color: '#fff', fontWeight: 700 },
    });
    try {
      const accessToken = await getClientAccessToken();
      const response = await fetch('/api/admin/system-test', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      const payload = (await response.json()) as SystemTestResult;
      setHealthResult(payload);

      if (payload.overall === 'PASS' && payload.ok !== false) {
        toast.success(payload.summary || 'فحص النظام نجح بالكامل ✓', {
          id: loadingToast,
          duration: 4500,
          style: { background: '#1e3f20', color: '#fff', fontWeight: 700 },
        });
      } else {
        const failed =
          payload.steps?.find((s) => s.status === 'FAIL') ??
          null;
        const failMsg = failed
          ? `فشل الخطوة ${failed.step}: ${failed.name}`
          : payload.error || payload.summary || 'فشل فحص النظام';
        toast.error(failMsg, {
          id: loadingToast,
          duration: 6000,
          style: { fontWeight: 700 },
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'تعذر الاتصال بفحص النظام';
      setHealthResult({ ok: false, overall: 'FAIL', error: message, steps: [] });
      toast.error(message, { id: loadingToast, duration: 5000 });
    } finally {
      setHealthChecking(false);
    }
  }, [healthChecking]);

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
        iconBg: 'bg-[#1A3B2A]/8 text-[#1A3B2A]',
      },
      {
        label: 'الرحلات الفردية',
        value: individualItineraries,
        sub: 'Individual أو غير مُعرّف + غير قالب',
        icon: Route,
        iconBg: 'bg-sky-500/10 text-sky-800',
      },
      {
        label: 'إجمالي القروبات',
        value: groupsTotal,
        sub: 'الرحلات الجماعية المجدولة',
        icon: Users,
        iconBg: 'bg-emerald-600/10 text-emerald-800',
      },
      {
        label: 'إجمالي الحجوزات',
        value: totalBookings,
        sub: 'الرحلات الخاصة والمقاعد الجماعية',
        icon: BarChart3,
        iconBg: 'bg-[#1A3B2A] text-[#C5A059]',
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
      <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex animate-pulse items-start justify-between gap-3">
          <div className="flex-1 space-y-3 text-right">
            <div className="ms-auto h-3 w-32 rounded-full bg-gray-100" />
            <div className="ms-auto h-8 w-24 rounded-xl bg-gray-100" />
            <div className="ms-auto h-3 w-full max-w-[9rem] rounded-full bg-gray-50" />
          </div>
          <span className="h-12 w-12 shrink-0 rounded-xl bg-gray-100" />
        </div>
      </article>
    );
  }

  return (
    <div className="min-h-full bg-[#F9F9F6] pb-14 font-[family-name:var(--font-tajawal),system-ui,sans-serif]" dir="rtl">
      {/* رأس */}
      <header
        className="relative overflow-hidden rounded-2xl border px-4 py-6 shadow-xl sm:px-10 sm:py-10"
        style={{
          borderColor: `${GOLD}55`,
          background: `linear-gradient(135deg, ${FOREST} 0%, #244F38 52%, ${FOREST} 100%)`,
          boxShadow: `0 20px 50px rgba(26,59,42,0.28)`,
        }}
      >
        <div aria-hidden className="pointer-events-none absolute -start-28 top-0 h-72 w-72 rounded-full blur-3xl" style={{ background: `${GOLD}22` }} />
        <div aria-hidden className="pointer-events-none absolute bottom-0 end-0 h-48 w-48 rounded-full blur-3xl opacity-70" style={{ background: `${GOLD}18` }} />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="text-right">
            <p className="text-[11px] font-black uppercase tracking-[0.38em]" style={{ color: `${GOLD}dd` }}>
              Wanderloom CRM
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-white sm:text-4xl">
              مركز القيادة والإحصائيات&nbsp;📊
            </h1>
            <p className="mt-4 max-w-xl text-base font-semibold leading-relaxed text-white/82">
              {displayName ? (
                <>
                  يسعدنا أن نراك، <span style={{ color: GOLD }}>{displayName}</span>. لمحة حقيقية من قاعدة البيانات — محدَّثة
                  عند فتح هذه الصفحة.
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
                onClick={() => void runSystemHealthCheck()}
                disabled={healthChecking}
                className="group flex items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-black transition disabled:cursor-wait disabled:opacity-80"
                style={{
                  borderColor: `${GOLD}aa`,
                  background: `linear-gradient(135deg, ${GOLD} 0%, #e8c86a 45%, ${GOLD} 100%)`,
                  color: FOREST,
                  boxShadow: `0 10px 28px ${GOLD}44`,
                }}
              >
                {healthChecking ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="h-5 w-5 transition group-hover:scale-110" aria-hidden />
                )}
                {healthChecking ? 'جاري الفحص...' : 'فحص شامل للنظام'}
              </button>
            ) : null}
            <div className="rounded-2xl border border-white/12 bg-white/6 px-5 py-4 text-right backdrop-blur-md">
              <span className="flex items-center justify-end gap-2 text-[11px] font-black uppercase tracking-wider text-white/70">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#C5A059]" aria-hidden />
                اليوم
              </span>
              <p className="mt-1 text-sm font-bold leading-relaxed text-white">{todayLabelArabic()}</p>
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <div
          className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-right text-sm text-rose-900 shadow-sm"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <span className="font-bold">{error}</span>
        </div>
      ) : null}

      {/* بطاقات */}
      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="إحصائيات سريعة">
        {loading
          ? [0, 1, 2, 3].map((k) => <StatSkeleton key={k} />)
          : statCards.map((s) => {
              const Icon = s.icon;
              return (
                <article
                  key={s.label}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.05)]"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
                    style={{ backgroundImage: 'linear-gradient(to bottom left, transparent, rgba(197,160,89,0.08))' }}
                    aria-hidden
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0 text-right">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{s.label}</p>
                      <p className="mt-2 text-3xl font-bold text-[#C5A059]" dir="ltr">
                        {formatStatNumber(s.value ?? 0)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{s.sub}</p>
                    </div>
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner ring-2 ring-black/5 ${s.iconBg}`}
                    >
                      <Icon className="h-6 w-6" aria-hidden strokeWidth={2} />
                    </span>
                  </div>
                </article>
              );
            })}
      </section>

      {/* الوصول السريع — قبل الرادار لجذب الانتباه للإجراءات */}
      <section className="mt-10 text-right" aria-label="الوصول السريع">
        <h2 className="mb-5 flex flex-wrap items-center justify-end gap-2 text-xl font-black" style={{ color: FOREST }}>
          <Sparkles className="h-5 w-5" style={{ color: GOLD }} aria-hidden />
          الوصول السريع
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#C5A059]/40 hover:shadow-[0_10px_20px_rgba(0,0,0,0.05)]"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl shadow-md ring-2 transition ring-[#1A3B2A]/12 group-hover:ring-[#C5A059]/50"
                  style={{ backgroundColor: FOREST, color: GOLD }}
                >
                  <Icon className="h-6 w-6" aria-hidden strokeWidth={2} />
                </span>
                <span className="mt-5 text-lg font-black transition" style={{ color: FOREST }}>
                  {a.title}
                </span>
                <span className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{a.desc}</span>
                <span className="mt-4 text-xs font-black opacity-0 transition group-hover:opacity-100" style={{ color: `${GOLD}cc` }}>
                  انتقال الآن ▸
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* رادار النشر التسويقي — مركز القيادة */}
      <section className="mt-10" aria-label="رادار النشر التسويقي">
        <MarketingPublishingRadar
          items={marketingRadar}
          loading={loading || marketingRadarLoading}
          error={marketingRadarError}
        />
      </section>

      <DashboardPendingActions />

      {/* الرادار */}
      <section className="mt-10 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" aria-label="آخر الرحلات">
        <div
          className="flex flex-col gap-2 border-b border-gray-100 px-6 py-5 text-right sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: `linear-gradient(to left, rgba(26,59,42,0.04), transparent)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-black" style={{ color: FOREST }}>
                الرادار الحي 📡
              </h2>
              <p className="text-xs font-semibold text-slate-600">آخر 5 مسارات مضافة (غير قوالب الجدول)</p>
            </div>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner"
              style={{ backgroundColor: FOREST, color: GOLD }}
            >
              <Radar className="h-5 w-5" aria-hidden strokeWidth={2.2} />
            </span>
          </div>
          <Link
            href="/crm/itineraries"
            className="self-end text-xs font-black underline decoration-[#C5A059]/65 underline-offset-4 transition hover:opacity-90 sm:self-auto"
            style={{ color: FOREST }}
          >
            كل المسارات ←
          </Link>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center gap-3 px-6 py-12 text-[#1A3B2A]" dir="rtl">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} aria-hidden />
              <span className="text-sm font-bold">جاري تحميل الرادار...</span>
            </div>
          ) : radarRows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm font-bold text-slate-600">لا توجد مسارات لعرضها بعد.</div>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-right text-sm">
              <thead>
                <tr>
                  <th className="bg-[#1A3B2A]/5 px-6 py-4 text-right text-sm font-semibold text-[#1A3B2A] border-b border-gray-200">اسم الرحلة</th>
                  <th className="bg-[#1A3B2A]/5 px-6 py-4 text-right text-sm font-semibold text-[#1A3B2A] border-b border-gray-200">اسم العميل</th>
                  <th className="bg-[#1A3B2A]/5 px-6 py-4 text-right text-sm font-semibold text-[#1A3B2A] border-b border-gray-200">الوجهة</th>
                  <th className="bg-[#1A3B2A]/5 px-6 py-4 text-right text-sm font-semibold text-[#1A3B2A] border-b border-gray-200">المسؤول</th>
                  <th className="bg-[#1A3B2A]/5 px-6 py-4 text-right text-sm font-semibold text-[#1A3B2A] border-b border-gray-200">تاريخ الإنشاء</th>
                  <th className="bg-[#1A3B2A]/5 px-6 py-4 text-center text-sm font-semibold text-[#1A3B2A] border-b border-gray-200">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {radarRows.map((row) => {
                  const b = statusBadge(row.status);
                  return (
                    <tr
                      key={row.id}
                      className="cursor-default border-b border-gray-100 transition-colors duration-200 hover:bg-white"
                    >
                      <td className="max-w-[12rem] truncate px-6 py-4 font-bold text-[#1A3B2A]" title={row.title ?? ''}>
                        {row.title?.trim() || '—'}
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#1A3B2A]/80">{resolveRadarClientName(row)}</td>
                      <td className="px-6 py-4 font-semibold text-[#1A3B2A]/80">{row.destination?.trim() || '—'}</td>
                      <td className="px-6 py-4">
                        {row.expert_id != null &&
                        expertNames[String(row.expert_id)] ? (
                          <span className="font-bold text-[#1A3B2A]">
                            {expertNames[String(row.expert_id)]}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                            بانتظار التعيين
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-600">
                        {formatCreatedAtArabic(row.created_at)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex ${b.className}`}>
                          {b.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Toaster position="top-center" toastOptions={{ duration: 3500, style: { fontWeight: 700 } }} />

      {healthResult ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1A3B2A]/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="system-health-title"
          onClick={() => setHealthResult(null)}
        >
          <div
            className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border bg-white p-6 shadow-2xl"
            style={{ borderColor: `${GOLD}66` }}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setHealthResult(null)}
              className="absolute start-4 top-4 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-3 pe-8 text-right">
              {healthResult.overall === 'PASS' ? (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-7 w-7" aria-hidden />
                </span>
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                  <XCircle className="h-7 w-7" aria-hidden />
                </span>
              )}
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                  System Health Check
                </p>
                <h2 id="system-health-title" className="mt-1 text-xl font-black" style={{ color: FOREST }}>
                  {healthResult.overall === 'PASS' ? 'النظام سليم بالكامل' : 'فشل فحص دورة الحياة'}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {healthResult.summary || healthResult.error || 'نتيجة الفحص الآلي لدورة الرحلة الكاملة'}
                </p>
              </div>
            </div>

            {Array.isArray(healthResult.steps) && healthResult.steps.length > 0 ? (
              <ul className="mt-6 space-y-2">
                {healthResult.steps.map((step) => {
                  const ok = step.status === 'PASS';
                  const skip = step.status === 'SKIP';
                  return (
                    <li
                      key={`${step.step}-${step.name}`}
                      className={`rounded-2xl border px-4 py-3 text-right ${
                        ok
                          ? 'border-emerald-200 bg-emerald-50/80'
                          : skip
                            ? 'border-slate-200 bg-slate-50'
                            : 'border-rose-200 bg-rose-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ${
                            ok
                              ? 'bg-emerald-600 text-white'
                              : skip
                                ? 'bg-slate-400 text-white'
                                : 'bg-rose-600 text-white'
                          }`}
                        >
                          {step.status}
                        </span>
                        <p className="min-w-0 text-sm font-black text-slate-900">
                          <span className="ms-1 text-slate-400">{step.step}.</span>
                          {step.name}
                        </p>
                      </div>
                      {step.detail ? (
                        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-600">
                          {step.detail}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : healthResult.error ? (
              <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                {healthResult.error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setHealthResult(null)}
              className="mt-6 w-full rounded-2xl py-3 text-sm font-black text-white transition hover:opacity-95"
              style={{ backgroundColor: FOREST }}
            >
              إغلاق
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
