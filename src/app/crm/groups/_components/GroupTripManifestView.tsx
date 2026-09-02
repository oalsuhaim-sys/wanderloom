'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Download,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  getGroupTripManifest,
  promoteWaitlistedClient,
  removeGroupMemberFromConfirmedSeatById,
  updateGroupMemberPaymentDeadline,
  updateGroupMemberPaymentStatus,
  type GroupTripManifest,
  type TripManifestMember,
} from '@/app/actions/groupTripAssignmentActions';
import {
  buildCheckoutUrl,
  buildPaymentWhatsAppMessage,
  buildPaymentWhatsAppUrl,
} from '@/lib/bank-checkout';
import { subscribeCrmRealtimeRefresh } from '@/lib/crm-realtime-events';
import {
  GROUP_PAYMENT_STATUSES,
  groupMemberStatusLabel,
  groupPaymentStatusBadgeClass,
  groupPaymentStatusLabel,
  paymentDeadlineBadgeLabel,
  SCARCITY_THRESHOLD,
  type GroupPaymentStatus,
} from '@/lib/group-members';
import { getClientAccessToken } from '@/lib/crm-session-token';

type BusyKey = string | null;
type PaymentFilter = 'all' | GroupPaymentStatus | 'unset';

type Props = {
  tripId: string;
};

function csvEscape(value: string): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadManifestCsv(
  rows: TripManifestMember[],
  tripId: string,
  tripTitle: string,
) {
  const headers = [
    'الاسم',
    'رقم الجوال',
    'حالة المقعد',
    'حالة السداد',
    'حالة الجواز',
    'حالة التأشيرة',
  ];

  const lines = [
    headers.join(','),
    ...rows.map((m) =>
      [
        csvEscape(m.clientName),
        csvEscape(m.phone ?? ''),
        csvEscape(groupMemberStatusLabel(m.status)),
        csvEscape(groupPaymentStatusLabel(m.paymentStatus)),
        csvEscape(m.passportExpiry ?? '—'),
        csvEscape(m.visaStatus ?? '—'),
      ].join(','),
    ),
  ];

  // UTF-8 BOM so Arabic opens correctly in Excel
  const csv = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTitle = tripTitle.replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 40);
  a.href = url;
  a.download = `manifest_trip_${tripId}${safeTitle ? `_${safeTitle}` : ''}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function memberMatchesFilters(
  member: TripManifestMember,
  searchQuery: string,
  paymentFilter: PaymentFilter,
): boolean {
  const q = searchQuery.trim().toLowerCase();
  const phoneDigits = (member.phone ?? '').replace(/\D/g, '');
  const queryDigits = q.replace(/\D/g, '');

  const matchesSearch =
    !q ||
    member.clientName.toLowerCase().includes(q) ||
    (member.phone ?? '').toLowerCase().includes(q) ||
    (queryDigits.length > 0 && phoneDigits.includes(queryDigits)) ||
    (member.email ?? '').toLowerCase().includes(q) ||
    String(member.clientId).toLowerCase().includes(q);

  const matchesPayment =
    paymentFilter === 'all' ||
    (paymentFilter === 'unset'
      ? member.paymentStatus == null
      : member.paymentStatus === paymentFilter);

  return matchesSearch && matchesPayment;
}

export default function GroupTripManifestView({ tripId }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manifest, setManifest] = useState<GroupTripManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const token = await getClientAccessToken();
      const result = await getGroupTripManifest(tripId, token);

      if (!result.ok) {
        console.error('Supabase Query Error details:', result.error);
        setError(result.error);
        setManifest(null);
      } else {
        console.log('Pending Requests Fetched:', result.data?.pending ?? []);
        if (result.message?.startsWith('ok_with_warning:')) {
          console.warn(
            'Supabase Query Error details:',
            result.message.replace('ok_with_warning:', ''),
          );
        }
        setManifest(result.data ?? null);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [tripId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeCrmRealtimeRefresh((detail) => {
      if (
        detail.source === 'invoices' ||
        detail.source === 'group_members' ||
        detail.source === 'leads' ||
        detail.reason === 'paid'
      ) {
        void load(true);
      }
    });
  }, [load]);

  const runAction = async (
    key: string,
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) => {
    setBusy(key);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? 'تعذر تنفيذ العملية.');
        return;
      }
      toast.success(result.message ?? 'تم التحديث.');
      await load(true);
    } finally {
      setBusy(null);
    }
  };

  const patchMemberPayment = useCallback(
    (memberId: string, paymentStatus: GroupPaymentStatus) => {
      setManifest((prev) => {
        if (!prev) return prev;
        const patch = (list: TripManifestMember[]) =>
          list.map((m) => (m.id === memberId ? { ...m, paymentStatus } : m));
        return {
          ...prev,
          confirmed: patch(prev.confirmed),
          waitlisted: patch(prev.waitlisted),
          pending: patch(prev.pending ?? []),
        };
      });
    },
    [],
  );

  const filteredConfirmed = useMemo(
    () =>
      (manifest?.confirmed ?? []).filter((m) =>
        memberMatchesFilters(m, searchQuery, paymentFilter),
      ),
    [manifest?.confirmed, searchQuery, paymentFilter],
  );
  const filteredPending = useMemo(
    () =>
      (manifest?.pending ?? []).filter((m) =>
        memberMatchesFilters(m, searchQuery, paymentFilter),
      ),
    [manifest?.pending, searchQuery, paymentFilter],
  );
  const filteredWaitlisted = useMemo(
    () =>
      (manifest?.waitlisted ?? []).filter((m) =>
        memberMatchesFilters(m, searchQuery, paymentFilter),
      ),
    [manifest?.waitlisted, searchQuery, paymentFilter],
  );

  const filtersActive = searchQuery.trim() !== '' || paymentFilter !== 'all';
  const totalFiltered =
    filteredConfirmed.length + filteredPending.length + filteredWaitlisted.length;
  const totalMembers =
    (manifest?.confirmed.length ?? 0) +
    (manifest?.pending?.length ?? 0) +
    (manifest?.waitlisted.length ?? 0);

  const filteredMembers = useMemo(
    () => [...filteredConfirmed, ...filteredPending, ...filteredWaitlisted],
    [filteredConfirmed, filteredPending, filteredWaitlisted],
  );

  const handleExportCSV = useCallback(() => {
    if (!manifest) return;
    if (filteredMembers.length === 0) {
      toast.error('لا يوجد ركاب مطابقون للتصدير.');
      return;
    }
    downloadManifestCsv(filteredMembers, tripId, manifest.trip.titleAr);
    toast.success(`تم تصدير ${filteredMembers.length} راكب إلى Excel/CSV`);
  }, [filteredMembers, manifest, tripId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm font-bold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        جاري تحميل كشف الركاب…
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
        <p className="text-sm font-bold text-red-800">{error ?? 'تعذر تحميل البيانات.'}</p>
        <p className="mt-2 text-[11px] font-medium text-red-700/80">
          إن كانت الرحلة بلا ركاب يظهر كشف فارغ — هذا الخطأ يعني فشل استعلام قاعدة البيانات.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl bg-red-800 px-4 py-2 text-xs font-black text-white"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const { trip, confirmed, waitlisted, pending } = manifest;
  const seatsLeft =
    trip.maxSeats > 0 ? Math.max(0, trip.maxSeats - trip.bookedSeats) : null;
  const fillPct =
    trip.maxSeats > 0
      ? Math.min(100, Math.round((trip.bookedSeats / trip.maxSeats) * 100))
      : 0;
  const canPromote = seatsLeft == null || seatsLeft > 0;
  const pendingList = pending ?? [];

  return (
    <div dir="rtl" className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/crm/groups"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#1A3B2A]/70 hover:text-[#1A3B2A]"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            العودة لرحلات القروبات
          </Link>
          <p className="text-xs font-bold tracking-wide text-[#C5A059]">كشف الرحلة الشامل</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#1A3B2A] sm:text-3xl">
            {trip.titleAr}
          </h1>
          {trip.titleEn ? (
            <p className="mt-1 text-sm font-semibold text-slate-500" dir="ltr">
              {trip.titleEn}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
            {trip.datesAr ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                <CalendarDays className="h-3.5 w-3.5 text-[#C5A059]" aria-hidden />
                {trip.datesAr}
              </span>
            ) : null}
            {trip.price ? (
              <span className="rounded-full bg-[#1A3B2A]/8 px-3 py-1 text-[#1A3B2A]" dir="ltr">
                {trip.price}
              </span>
            ) : null}
            <span
              className={`rounded-full px-3 py-1 ${
                trip.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {trip.isActive ? 'نشطة' : 'مخفية'}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void load(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          تحديث
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="المقاعد المحجوزة" value={`${trip.bookedSeats} / ${trip.maxSeats || '∞'}`} />
        <StatCard
          label="الركاب المؤكدون"
          value={String(confirmed.length)}
          valueTone="emerald"
        />
        <StatCard
          label="قائمة الانتظار"
          value={String(waitlisted.length)}
          valueTone="amber"
        />
        <StatCard
          label="بانتظار التأكيد"
          value={String(pendingList.length)}
          valueTone={pendingList.length > 0 ? 'rose' : 'slate'}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="مهلة السداد"
          value={
            trip.bookedSeats >= SCARCITY_THRESHOLD
              ? 'مفعّلة (3 أيام)'
              : `غير مفعّلة (< ${SCARCITY_THRESHOLD})`
          }
          valueTone={trip.bookedSeats >= SCARCITY_THRESHOLD ? 'rose' : 'slate'}
        />
        <StatCard
          label="مقاعد شاغرة"
          value={seatsLeft == null ? 'بدون حد' : String(seatsLeft)}
          valueTone={seatsLeft === 0 ? 'rose' : 'emerald'}
        />
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex justify-between text-xs font-bold text-slate-600">
          <span>إشغال الرحلة</span>
          <span>{fillPct}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100">
          <div
            className={`h-2.5 rounded-full transition-all ${
              fillPct >= 100 ? 'bg-red-500' : 'bg-[#C5A059]'
            }`}
            style={{ width: `${trip.maxSeats > 0 ? fillPct : 0}%` }}
          />
        </div>
      </div>

      {/* Smart search & payment filters */}
      <section
        className="rounded-2xl border border-[#C5A059]/25 bg-white p-4 shadow-sm ring-1 ring-[#C5A059]/10"
        aria-label="محرك بحث وفلاتر ذكية"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black text-[#1A3B2A]">محرك بحث وفلاتر ذكية</h2>
          <div className="flex flex-wrap items-center gap-2">
            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPaymentFilter('all');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 transition hover:text-[#1A3B2A]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                مسح الفلاتر
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredMembers.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              تصدير الكشف 📥
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">بحث بالاسم أو الجوال</span>
            <Search
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، الجوال، أو رقم العميل…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pr-10 pl-3 text-sm font-semibold text-[#1A3B2A] outline-none transition focus:border-[#C5A059]/50 focus:bg-white focus:ring-2 focus:ring-[#C5A059]/20"
            />
          </label>
          <label className="shrink-0 sm:w-52">
            <span className="sr-only">فلتر حالة السداد</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-[#1A3B2A] outline-none focus:border-[#C5A059]/50 focus:ring-2 focus:ring-[#C5A059]/20"
            >
              <option value="all">كل حالات السداد</option>
              {GROUP_PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {groupPaymentStatusLabel(s)}
                </option>
              ))}
              <option value="unset">بدون حالة سداد</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-[11px] font-semibold text-slate-500">
          {filtersActive
            ? `عرض ${totalFiltered.toLocaleString('ar-SA')} من أصل ${totalMembers.toLocaleString('ar-SA')} راكب`
            : `${totalMembers.toLocaleString('ar-SA')} راكب في الكشف`}
        </p>
      </section>

      <ManifestSection
        title="الركاب المؤكدون"
        subtitle="مقاعد محجوزة — إدارة مهلة السداد والإزالة"
        count={filteredConfirmed.length}
        emptyMessage={
          confirmed.length === 0
            ? 'لا يوجد ركاب مؤكدون بعد.'
            : 'لا نتائج مطابقة للبحث أو الفلتر في المؤكدين.'
        }
      >
        {filteredConfirmed.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-right text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">العميل</th>
                  <th className="px-3 py-3">التواصل</th>
                  <th className="px-3 py-3">حالة السداد</th>
                  <th className="px-3 py-3">المهلة</th>
                  <th className="px-3 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredConfirmed.map((member) => (
                  <ConfirmedRow
                    key={member.id}
                    member={member}
                    tripTitle={trip.titleAr}
                    busy={busy}
                    onPaymentUpdated={patchMemberPayment}
                    onExtend={() =>
                      void runAction(`extend-${member.id}`, async () => {
                        const token = await getClientAccessToken();
                        return updateGroupMemberPaymentDeadline(
                          member.clientId,
                          { extendDays: 3 },
                          token,
                        );
                      })
                    }
                    onRemove={() => {
                      if (
                        !window.confirm(
                          `إزالة ${member.clientName} من المقعد وتحرير السعة؟`,
                        )
                      ) {
                        return;
                      }
                      void runAction(`remove-${member.id}`, async () => {
                        const token = await getClientAccessToken();
                        return removeGroupMemberFromConfirmedSeatById(member.id, token);
                      });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </ManifestSection>

      <ManifestSection
        title="بانتظار التأكيد"
        subtitle="طلبات جماعية (travel_style = Group) المطابقة لهذه الوجهة — قبل تثبيت المقعد"
        count={filteredPending.length}
        emptyMessage={
          pendingList.length === 0
            ? 'لا يوجد ركاب بانتظار التأكيد.'
            : 'لا نتائج مطابقة للبحث أو الفلتر هنا.'
        }
      >
        {filteredPending.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {filteredPending.map((member) => (
              <PendingRow key={member.id} member={member} />
            ))}
          </ul>
        ) : null}
      </ManifestSection>

      <ManifestSection
        title="قائمة الانتظار"
        subtitle={
          canPromote
            ? 'ترقية الأعضاء عند توفر مقعد'
            : 'الرحلة مكتملة — لا يمكن الترقية حتى يتحرر مقعد'
        }
        count={filteredWaitlisted.length}
        emptyMessage={
          waitlisted.length === 0
            ? 'قائمة الانتظار فارغة.'
            : 'لا نتائج مطابقة للبحث أو الفلتر في الانتظار.'
        }
      >
        {filteredWaitlisted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-right text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">العميل</th>
                  <th className="px-3 py-3">التواصل</th>
                  <th className="px-3 py-3">تاريخ الانتظار</th>
                  <th className="px-3 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredWaitlisted.map((member) => (
                  <WaitlistRow
                    key={member.id}
                    member={member}
                    busy={busy}
                    canPromote={canPromote}
                    onPromote={() => {
                      if (
                        !window.confirm(
                          `ترقية ${member.clientName} إلى مقعد مؤكد؟`,
                        )
                      ) {
                        return;
                      }
                      void runAction(`promote-${member.id}`, async () => {
                        const token = await getClientAccessToken();
                        return promoteWaitlistedClient(member.id, tripId, token);
                      });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </ManifestSection>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueTone = 'slate',
}: {
  label: string;
  value: string;
  valueTone?: 'slate' | 'emerald' | 'amber' | 'rose';
}) {
  const valueClass = {
    slate: 'text-slate-900 dark:text-white',
    emerald: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }[valueTone];

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all hover:shadow-md dark:border-[#2D3F3A] dark:bg-[#22302C]">
      <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function ManifestSection({
  title,
  subtitle,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-[#2D3F3A]">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-[#1A2421] dark:text-slate-300 dark:ring-[#2D3F3A]">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {count}
        </span>
      </div>
      <div className="p-4 sm:p-5">
        {count === 0 ? (
          <p className="py-8 text-center text-sm font-medium text-slate-400">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`;
}

function PendingRow({ member }: { member: TripManifestMember }) {
  const pipeline = String(member.leadPipelineStatus ?? '').trim();
  let statusLabel = 'بانتظار المقابلة';
  let badgeClass =
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';

  if (member.status === 'approved') {
    statusLabel = 'تمت الموافقة — بانتظار المقعد';
    badgeClass =
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  } else if (pipeline === 'awaiting_dna') {
    statusLabel = 'بانتظار DNA';
  } else if (
    pipeline === 'meeting' ||
    pipeline === 'interview_scheduled' ||
    member.source === 'lead' ||
    member.status === 'pending_interview'
  ) {
    statusLabel = 'بانتظار المقابلة';
  }

  const joined = member.createdAt
    ? new Date(member.createdAt).toLocaleDateString('ar-SA')
    : '—';

  const clientHref =
    member.source === 'lead' && String(member.clientId).startsWith('lead:')
      ? `/crm/radar#group-onboarding`
      : `/crm/clients/${member.clientId}`;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F3A] dark:bg-[#1A2421]">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-[#D4AF37] dark:text-slate-900"
          aria-hidden
        >
          {memberInitials(member.clientName)}
        </div>
        <div className="min-w-0">
          <Link
            href={clientHref}
            className="block truncate text-sm font-bold text-slate-900 hover:underline dark:text-white"
          >
            {member.clientName}
          </Link>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {member.source === 'lead' ? 'من مسار المقابلة' : `#${member.clientId}`}
            {member.phone ? (
              <span className="ms-2" dir="ltr">
                · {member.phone}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${badgeClass}`}>
          {statusLabel}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{joined}</span>
      </div>
    </li>
  );
}

function PaymentStatusBadge({
  status,
}: {
  status: GroupPaymentStatus | null | undefined;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${groupPaymentStatusBadgeClass(status)}`}
    >
      {status === 'paid' ? '✓ ' : status === 'expired' ? '! ' : ''}
      {groupPaymentStatusLabel(status)}
    </span>
  );
}

function PaymentUpdateModal({
  member,
  tripTitle,
  onClose,
  onSaved,
}: {
  member: TripManifestMember;
  tripTitle: string;
  onClose: () => void;
  onSaved: (status: GroupPaymentStatus) => void;
}) {
  const [status, setStatus] = useState<GroupPaymentStatus>(
    member.paymentStatus ?? 'pending',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const canShareCheckout =
    member.clientId != null &&
    String(member.clientId).trim() !== '' &&
    !String(member.clientId).startsWith('lead:');

  const paymentLink = canShareCheckout ? buildCheckoutUrl(member.clientId) : '';

  const whatsappUrl =
    canShareCheckout && member.phone
      ? buildPaymentWhatsAppUrl({
          phone: member.phone,
          clientName: member.clientName,
          targetTrip: tripTitle,
          clientId: member.clientId,
        })
      : null;

  async function handleCopyPaymentLink() {
    if (!paymentLink) {
      toast.error('لا يوجد رابط دفع لهذا الراكب بعد.');
      return;
    }
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      toast.success('تم نسخ رابط الدفع');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('تعذر نسخ الرابط — انسخه يدوياً من الحقل.');
    }
  }

  function handleWhatsAppShare() {
    if (whatsappUrl) {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!member.phone?.trim()) {
      toast.error('لا يوجد رقم واتساب مسجّل لهذا الراكب.');
      return;
    }
    if (!paymentLink) {
      toast.error('لا يوجد رابط دفع لهذا الراكب بعد.');
      return;
    }
    const message = buildPaymentWhatsAppMessage({
      clientName: member.clientName,
      targetTrip: tripTitle,
      checkoutUrl: paymentLink,
    });
    const digits = member.phone.replace(/[\s+\-()]/g, '');
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const token = await getClientAccessToken();
      const result = await updateGroupMemberPaymentStatus(member.id, status, token);
      if (!result.ok) {
        setError(result.error ?? 'تعذر تحديث السداد');
        setSaving(false);
        return;
      }
      toast.success(result.message ?? 'تم التحديث.');
      onSaved(status);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث السداد');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-update-title"
      onClick={onClose}
    >
      <div
        className="w-[95%] max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border border-[#C5A059]/30 bg-white p-5 shadow-xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 id="payment-update-title" className="text-base font-black text-[#1A3B2A]">
              تسديد / تحديث مالي
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{member.clientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
          <p className="text-[10px] font-bold text-slate-500">الحالة الحالية</p>
          <div className="mt-1">
            <PaymentStatusBadge status={member.paymentStatus} />
          </div>
        </div>

        <label className="block text-right">
          <span className="mb-1 block text-xs font-bold text-gray-600">حالة السداد الجديدة</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GroupPaymentStatus)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#1A3B2A] outline-none focus:border-[#C5A059]/50"
          >
            {GROUP_PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {groupPaymentStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {GROUP_PAYMENT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 transition ${
                status === s ? 'ring-2 ring-[#1A3B2A]' : 'opacity-80 hover:opacity-100'
              } ${groupPaymentStatusBadgeClass(s)}`}
            >
              {groupPaymentStatusLabel(s)}
            </button>
          ))}
        </div>

        <hr className="my-4 border-slate-200" />

        <section aria-label="رابط الدفع المباشر للعميل">
          <h4 className="text-sm font-black text-[#1A3B2A]">رابط الدفع المباشر للعميل</h4>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
            صفحة السداد البنكي وإرفاق الإيصال — بدون نظام عروض الأسعار.
          </p>

          {paymentLink ? (
            <p
              className="mt-2 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600"
              dir="ltr"
              title={paymentLink}
            >
              {paymentLink}
            </p>
          ) : (
            <p className="mt-2 text-[11px] font-bold text-amber-800">
              لا يمكن إنشاء رابط دفع قبل ربط الراكب بملف عميل.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopyPaymentLink()}
              disabled={!paymentLink}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#1A3B2A]/20 bg-white px-3 py-2.5 text-xs font-black text-[#1A3B2A] transition hover:bg-[#1A3B2A]/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {copied ? 'تم النسخ ✓' : 'نسخ رابط الدفع'}
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              disabled={!paymentLink || !member.phone?.trim()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              إرسال عبر واتساب
            </button>
          </div>
        </section>

        {error ? <p className="mt-3 text-xs font-bold text-rose-600">{error}</p> : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            حفظ الحالة
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmedRow({
  member,
  tripTitle,
  busy,
  onExtend,
  onRemove,
  onPaymentUpdated,
}: {
  member: TripManifestMember;
  tripTitle: string;
  busy: BusyKey;
  onExtend: () => void;
  onRemove: () => void;
  onPaymentUpdated: (memberId: string, status: GroupPaymentStatus) => void;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const deadlineBadge = paymentDeadlineBadgeLabel(member.paymentDeadline);
  const isUrgent = deadlineBadge.tone === 'rose';
  const isPaid = member.paymentStatus === 'paid';

  return (
    <tr className={isUrgent && !isPaid ? 'bg-rose-50/40' : isPaid ? 'bg-emerald-50/30' : undefined}>
      <td className="px-3 py-3">
        <Link
          href={`/crm/clients/${member.clientId}`}
          className="font-black text-[#1A3B2A] hover:underline"
        >
          {member.clientName}
        </Link>
        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">#{member.clientId}</p>
      </td>
      <td className="px-3 py-3 text-xs font-semibold text-slate-600">
        {member.phone ? (
          <p dir="ltr" className="text-left">
            {member.phone}
          </p>
        ) : (
          <span className="text-slate-400">—</span>
        )}
        {member.email ? (
          <p className="mt-0.5 truncate text-[10px] text-slate-400" dir="ltr">
            {member.email}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <PaymentStatusBadge status={member.paymentStatus} />
      </td>
      <td className="px-3 py-3">
        <DeadlineBadge badge={deadlineBadge} />
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="تسديد 💵"
            icon={<Wallet className="h-3.5 w-3.5" aria-hidden />}
            tone="emerald"
            disabled={busy !== null}
            onClick={() => setPayOpen(true)}
          />
          <ActionButton
            label="تعديل المهلة"
            icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
            tone="sky"
            loading={busy === `extend-${member.id}`}
            disabled={busy !== null}
            onClick={onExtend}
          />
          <ActionButton
            label="إزالة"
            tone="rose"
            loading={busy === `remove-${member.id}`}
            disabled={busy !== null}
            onClick={onRemove}
          />
        </div>
        {payOpen ? (
          <PaymentUpdateModal
            member={member}
            tripTitle={tripTitle}
            onClose={() => setPayOpen(false)}
            onSaved={(status) => onPaymentUpdated(member.id, status)}
          />
        ) : null}
      </td>
    </tr>
  );
}

function WaitlistRow({
  member,
  busy,
  canPromote,
  onPromote,
}: {
  member: TripManifestMember;
  busy: BusyKey;
  canPromote: boolean;
  onPromote: () => void;
}) {
  const joined = member.createdAt
    ? new Date(member.createdAt).toLocaleDateString('ar-SA')
    : '—';

  return (
    <tr>
      <td className="px-3 py-3">
        <Link
          href={`/crm/clients/${member.clientId}`}
          className="font-black text-[#1A3B2A] hover:underline"
        >
          {member.clientName}
        </Link>
        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">#{member.clientId}</p>
      </td>
      <td className="px-3 py-3 text-xs font-semibold text-slate-600">
        {member.phone ?? '—'}
      </td>
      <td className="px-3 py-3 text-xs font-bold text-slate-500">{joined}</td>
      <td className="px-3 py-3">
        <ActionButton
          label="ترقية لمقعد مؤكد"
          icon={<UserCheck className="h-3.5 w-3.5" aria-hidden />}
          tone="emerald"
          loading={busy === `promote-${member.id}`}
          disabled={!canPromote || busy !== null}
          onClick={onPromote}
        />
      </td>
    </tr>
  );
}

function DeadlineBadge({
  badge,
}: {
  badge: ReturnType<typeof paymentDeadlineBadgeLabel>;
}) {
  const className =
    badge.tone === 'slate'
      ? 'bg-slate-100 text-slate-700 ring-slate-200'
      : badge.tone === 'amber'
        ? 'bg-amber-100 text-amber-900 ring-amber-200'
        : 'bg-rose-100 text-rose-900 ring-rose-300';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${className}`}
    >
      {badge.tone !== 'slate' ? <Clock className="h-3 w-3" aria-hidden /> : null}
      {badge.label}
    </span>
  );
}

function ActionButton({
  label,
  icon,
  tone,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  tone: 'sky' | 'rose' | 'emerald';
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const tones = {
    sky: 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : icon}
      {label}
    </button>
  );
}
