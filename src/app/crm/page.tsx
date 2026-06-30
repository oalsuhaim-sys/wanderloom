'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BarChart3,
  CalendarDays,
  Loader2,
  Radar,
  Route,
  Sparkles,
  UserRound,
  Users,
  AlertCircle,
} from 'lucide-react';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import { supabase } from '@/lib/supabase';

const NAVY = '#001f3f';
const GOLD = '#d4af37';

type ClientJoin = { name?: string | null };

type RadarRow = {
  id: number;
  title: string | null;
  destination: string | null;
  customer_name: string | null;
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
    draft: { label: 'مسودة', className: 'text-slate-800 bg-slate-100 ring-slate-200' },
    sent: { label: 'مُرسل', className: 'text-sky-900 bg-sky-100 ring-sky-200' },
    active: { label: 'نشطة', className: 'text-emerald-900 bg-emerald-100 ring-emerald-200' },
    archived: { label: 'مؤرشفة', className: 'text-amber-950 bg-amber-100 ring-amber-300' },
    confirmed: { label: 'مؤكّدة', className: 'text-emerald-900 bg-emerald-100 ring-emerald-200' },
    template: { label: 'قالب', className: 'text-violet-900 bg-violet-100 ring-violet-200' },
  };
  return map[s] ?? { label: status?.trim() || '—', className: 'text-slate-700 bg-slate-100 ring-slate-200' };
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
  const { employee, loading: empLoading } = useCrmEmployee();
  const displayName = employee?.full_name?.trim() || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientsTotal, setClientsTotal] = useState<number>(0);
  const [individualItineraries, setIndividualItineraries] = useState<number>(0);
  const [groupsTotal, setGroupsTotal] = useState<number>(0);
  const [totalBookings, setTotalBookings] = useState<number>(0);
  const [radarRows, setRadarRows] = useState<RadarRow[]>([]);

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
          .select('id, title, destination, customer_name, status, created_at, clients(name)')
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

      if (errs.length) {
        setError(errs.join(' · ') || null);
      }
    } catch (e) {
      console.error('[crm dashboard]', e);
      setError('تعذر تحميل بيانات اللوحة. تحقّق من الشبكة والصلاحيات.');
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
        iconBg: 'bg-[#001f3f]/8 text-[#001f3f]',
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
        iconBg: 'bg-[#001f3f] text-[#d4af37]',
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
      <article className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-lg">
        <div className="flex animate-pulse items-start justify-between gap-3">
          <div className="flex-1 space-y-3 text-right">
            <div className="ms-auto h-3 w-32 rounded-full bg-slate-200" />
            <div className="ms-auto h-8 w-24 rounded-xl bg-slate-200" />
            <div className="ms-auto h-3 w-full max-w-[9rem] rounded-full bg-slate-100" />
          </div>
          <span className="h-12 w-12 shrink-0 rounded-xl bg-slate-100" />
        </div>
      </article>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 pb-14 font-[family-name:var(--font-tajawal),system-ui,sans-serif]" dir="rtl">
      {/* رأس */}
      <header
        className="relative overflow-hidden rounded-2xl border px-4 py-6 shadow-xl sm:px-10 sm:py-10"
        style={{
          borderColor: `${GOLD}55`,
          background: `linear-gradient(135deg, ${NAVY} 0%, #003366 52%, ${NAVY} 100%)`,
          boxShadow: `0 20px 50px rgba(0,31,63,0.35)`,
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
          <div className="shrink-0 rounded-2xl border border-white/12 bg-white/6 px-5 py-4 text-right backdrop-blur-md md:min-w-[220px]">
            <span className="flex items-center justify-end gap-2 text-[11px] font-black uppercase tracking-wider text-white/70">
              <CalendarDays className="h-4 w-4 shrink-0 text-[#d4af37]" aria-hidden />
              اليوم
            </span>
            <p className="mt-1 text-sm font-bold leading-relaxed text-white">{todayLabelArabic()}</p>
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
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
                    style={{ backgroundImage: 'linear-gradient(to bottom left, transparent, rgba(212,175,55,0.08))' }}
                    aria-hidden
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0 text-right">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900" dir="ltr">
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
        <h2 className="mb-5 flex flex-wrap items-center justify-end gap-2 text-xl font-black" style={{ color: NAVY }}>
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
                className="group flex flex-col rounded-2xl border-2 border-[#001f3f]/12 bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:border-[#d4af37]/60 hover:shadow-xl"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl shadow-md ring-2 transition ring-[#001f3f]/12 group-hover:ring-[#d4af37]/50"
                  style={{ backgroundColor: NAVY, color: GOLD }}
                >
                  <Icon className="h-6 w-6" aria-hidden strokeWidth={2} />
                </span>
                <span className="mt-5 text-lg font-black transition" style={{ color: NAVY }}>
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

      {/* الرادار */}
      <section className="mt-10 rounded-2xl border border-slate-200 bg-white shadow-lg" aria-label="آخر الرحلات">
        <div
          className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 text-right sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: `linear-gradient(to left, rgba(0,31,63,0.04), transparent)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-black" style={{ color: NAVY }}>
                الرادار الحي 📡
              </h2>
              <p className="text-xs font-semibold text-slate-600">آخر 5 مسارات مضافة (غير قوالب الجدول)</p>
            </div>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner"
              style={{ backgroundColor: NAVY, color: GOLD }}
            >
              <Radar className="h-5 w-5" aria-hidden strokeWidth={2.2} />
            </span>
          </div>
          <Link
            href="/crm/itineraries"
            className="self-end text-xs font-black underline decoration-[#d4af37]/65 underline-offset-4 transition hover:opacity-90 sm:self-auto"
            style={{ color: NAVY }}
          >
            كل المسارات ←
          </Link>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center gap-3 px-6 py-12 text-[#001f3f]" dir="rtl">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} aria-hidden />
              <span className="text-sm font-bold">جاري تحميل الرادار...</span>
            </div>
          ) : radarRows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm font-bold text-slate-600">لا توجد مسارات لعرضها بعد.</div>
          ) : (
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3">اسم الرحلة</th>
                  <th className="px-6 py-3">اسم العميل</th>
                  <th className="px-6 py-3">الوجهة</th>
                  <th className="px-6 py-3">تاريخ الإنشاء</th>
                  <th className="px-6 py-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {radarRows.map((row) => {
                  const b = statusBadge(row.status);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 last:border-0 transition hover:bg-[#d4af37]/06"
                    >
                      <td className="max-w-[12rem] truncate px-6 py-4 font-bold text-slate-900" title={row.title ?? ''}>
                        {row.title?.trim() || '—'}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{resolveRadarClientName(row)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{row.destination?.trim() || '—'}</td>
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-600">
                        {formatCreatedAtArabic(row.created_at)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1 ring-inset ${b.className}`}
                        >
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
    </div>
  );
}
