'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, Pencil, Trash2, X } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  fetchGroupTripLeaderOptions,
  groupTripLeaderRoleEmoji,
  parseGroupTripLeaderIdForDb,
  resolveGroupTripLeaderName,
  withAssignedLeaderOption,
  type GroupTripLeaderOption,
} from '@/lib/group-trip-leaders';
import type { GroupTripRow } from '@/types/group-trip';
import GroupTripLeaderBadge from '@/app/crm/groups/_components/GroupTripLeaderBadge';
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary';
import {
  formatGroupTripDateRange,
  parseGroupTripDateInput,
  resolveGroupTripDateDisplay,
} from '@/lib/group-trip-dates';

type GroupTripFormData = {
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  badge_ar: string;
  badge_en: string;
  dates_ar: string;
  dates_en: string;
  price: string;
  includes_ar: string;
  includes_en: string;
  excludes_ar: string;
  excludes_en: string;
  is_active: boolean;
  max_seats: number;
  allow_waitlist: boolean;
  leader_id: string;
};

const EMPTY_SELECTED_DATES = { start: '', end: '' };

const initialFormState: GroupTripFormData = {
  title_ar: '',
  title_en: '',
  description_ar: '',
  description_en: '',
  badge_ar: '',
  badge_en: '',
  dates_ar: '',
  dates_en: '',
  price: '',
  includes_ar: '',
  includes_en: '',
  excludes_ar: '',
  excludes_en: '',
  is_active: true,
  max_seats: 0,
  allow_waitlist: true,
  leader_id: '',
};

function tripToForm(trip: GroupTripRow): GroupTripFormData {
  return {
    title_ar: trip.title_ar ?? '',
    title_en: trip.title_en ?? '',
    description_ar: trip.description_ar ?? '',
    description_en: trip.description_en ?? '',
    badge_ar: trip.badge_ar ?? '',
    badge_en: trip.badge_en ?? '',
    dates_ar: trip.dates_ar ?? '',
    dates_en: trip.dates_en ?? '',
    price: trip.price ?? '',
    includes_ar: trip.includes_ar ?? '',
    includes_en: trip.includes_en ?? '',
    excludes_ar: trip.excludes_ar ?? '',
    excludes_en: trip.excludes_en ?? '',
    is_active: trip.is_active !== false,
    max_seats: typeof trip.max_seats === 'number' ? trip.max_seats : 0,
    allow_waitlist: trip.allow_waitlist !== false,
    leader_id: trip.leader_id != null ? String(trip.leader_id) : '',
  };
}

function formToPayload(
  formData: GroupTripFormData,
  leaders: GroupTripLeaderOption[],
  leaderNameFallback?: string | null,
) {
  const leaderIdRaw = formData.leader_id.trim();
  const leaderId = parseGroupTripLeaderIdForDb(leaderIdRaw);
  const leaderName = resolveGroupTripLeaderName(leaderIdRaw, leaders, leaderNameFallback);

  return {
    title_ar: formData.title_ar.trim(),
    title_en: formData.title_en.trim(),
    description_ar: formData.description_ar.trim(),
    description_en: formData.description_en.trim(),
    badge_ar: formData.badge_ar.trim() || 'مجموعة',
    badge_en: formData.badge_en.trim() || 'Group',
    dates_ar: formData.dates_ar.trim(),
    dates_en: formData.dates_en.trim(),
    price: formData.price.trim(),
    includes_ar: formData.includes_ar.trim(),
    includes_en: formData.includes_en.trim(),
    excludes_ar: formData.excludes_ar.trim(),
    excludes_en: formData.excludes_en.trim(),
    is_active: formData.is_active,
    max_seats: Math.max(0, formData.max_seats),
    allow_waitlist: formData.allow_waitlist,
    leader_id: leaderId,
    leader_name: leaderName,
  };
}

function isTripActive(trip: GroupTripRow): boolean {
  return trip.is_active !== false;
}

function tripText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function hasTripText(value: unknown): boolean {
  return tripText(value).length > 0;
}

function normalizeGroupTripRow(raw: GroupTripRow): GroupTripRow {
  const dates = resolveGroupTripDateDisplay(raw?.dates_ar, raw?.dates_en);
  return {
    ...raw,
    id: raw?.id != null ? String(raw.id) : '',
    title_ar: tripText(raw?.title_ar),
    title_en: tripText(raw?.title_en),
    description_ar: tripText(raw?.description_ar),
    description_en: tripText(raw?.description_en),
    badge_ar: tripText(raw?.badge_ar) || 'مجموعة',
    badge_en: tripText(raw?.badge_en) || 'Group',
    dates_ar: dates.dates_ar || null,
    dates_en: dates.dates_en || null,
    price: tripText(raw?.price) || null,
    leader_name: tripText(raw?.leader_name) || null,
    max_seats: typeof raw?.max_seats === 'number' ? raw.max_seats : Number(raw?.max_seats) || 0,
  };
}

function TripStatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${
        active ? 'bg-emerald-500' : 'bg-gray-400'
      }`}
      title={active ? 'نشطة — تظهر للعملاء' : 'مخفية — لا تظهر للعملاء'}
      aria-hidden
    />
  );
}

function tripDateLabels(trip: GroupTripRow): { dates_ar: string; dates_en: string } {
  return resolveGroupTripDateDisplay(trip.dates_ar, trip.dates_en);
}


const inputClass =
  'w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-right text-sm font-semibold text-[#f5f0e6] outline-none transition placeholder:text-gray-500 focus:border-[#D4AF37]/60 focus:ring-2 focus:ring-[#D4AF37]/25 [color-scheme:dark]';

const labelClass = 'mb-1.5 block text-right text-xs font-black text-[#d4af37]/85';

const selectClass = `${inputClass} relative z-50 appearance-none bg-no-repeat pe-4 ps-10`;

const dateInputClass = `${inputClass} [color-scheme:dark]`;

const amenitiesList = [
  { id: 'intl_flights', ar: 'الطيران الدولي', en: 'International Flights' },
  { id: 'dom_flights', ar: 'الطيران الداخلي', en: 'Domestic Flights' },
  { id: 'hotels_5star', ar: 'فنادق فاخرة', en: 'Premium Hotels' },
  { id: 'breakfast', ar: 'الإفطار اليومي', en: 'Daily Breakfast' },
  { id: 'transport', ar: 'مواصلات خاصة', en: 'Private Transportation' },
  { id: 'guide', ar: 'مرشد سياحي', en: 'Tour Guide' },
  { id: 'tickets', ar: 'تذاكر الدخول', en: 'Entrance Tickets' },
  { id: 'visa', ar: 'تأشيرة الدخول (الفيزا)', en: 'Visa' },
  { id: 'insurance', ar: 'تأمين سفر', en: 'Travel Insurance' },
  { id: 'personal', ar: 'المصاريف الشخصية', en: 'Personal Expenses' },
] as const;

type Amenity = (typeof amenitiesList)[number];
type AmenityListType = 'includes' | 'excludes';

function parseArAmenities(value: string): string[] {
  return value ? value.split('، ').map((s) => s.trim()).filter(Boolean) : [];
}

function parseEnAmenities(value: string): string[] {
  return value ? value.split(', ').map((s) => s.trim()).filter(Boolean) : [];
}

function isAmenityChecked(arValue: string, item: Amenity): boolean {
  return parseArAmenities(arValue).includes(item.ar);
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-gray-700/60 pb-2 text-right text-xs font-black uppercase tracking-wide text-[#d4af37]">
      {children}
    </h3>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="h-5 w-24 rounded-full bg-gray-100" />
          <div className="mt-4 h-6 w-3/4 rounded-lg bg-gray-100" />
          <div className="mt-3 h-4 w-full rounded bg-gray-100" />
          <div className="mt-6 h-9 w-32 rounded-lg bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export default function AdminGroupsPage() {
  const [trips, setTrips] = useState<GroupTripRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GroupTripFormData>(initialFormState);
  const [selectedDates, setSelectedDates] = useState(EMPTY_SELECTED_DATES);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<GroupTripLeaderOption[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(true);
  const [leadersError, setLeadersError] = useState<string | null>(null);
  const [leaderNameFallback, setLeaderNameFallback] = useState<string | null>(null);

  const leaderOptions = withAssignedLeaderOption(
    leaders ?? [],
    formData.leader_id || editingId ? formData.leader_id : null,
    leaderNameFallback,
  );

  const fetchLeaders = useCallback(async () => {
    setLeadersLoading(true);
    setLeadersError(null);

    if (!supabase) {
      setLeaders([]);
      setLeadersLoading(false);
      return;
    }

    const { options, error: fetchErr } = await fetchGroupTripLeaderOptions(supabase);
    if (fetchErr) {
      console.error('[CRM groups] leaders fetch failed', fetchErr);
      setLeadersError(fetchErr);
      setLeaders([]);
    } else {
      setLeaders(Array.isArray(options) ? options : []);
    }
    setLeadersLoading(false);
  }, []);

  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!supabase) {
      setTrips([]);
      setError('قاعدة البيانات غير مهيأة — تحقق من متغيرات Supabase.');
      setIsLoading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from('group_trips')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (dbError) {
      setTrips([]);
      setError(dbError.message);
      setIsLoading(false);
      return;
    }

    setTrips(
      ((data ?? []) as GroupTripRow[])
        .filter((row): row is GroupTripRow => row != null && row.id != null)
        .map(normalizeGroupTripRow),
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchTrips();
    void fetchLeaders();
  }, [fetchTrips, fetchLeaders]);

  function openAddModal() {
    setFormData(initialFormState);
    setSelectedDates(EMPTY_SELECTED_DATES);
    setEditingId(null);
    setLeaderNameFallback(null);
    setBanner(null);
    setIsModalOpen(true);
    void fetchLeaders();
  }

  function openEditModal(trip: GroupTripRow) {
    setFormData(tripToForm(trip));
    setSelectedDates(EMPTY_SELECTED_DATES);
    setEditingId(trip.id);
    setLeaderNameFallback(hasTripText(trip.leader_name) ? tripText(trip.leader_name) : null);
    setBanner(null);
    setIsModalOpen(true);
    void fetchLeaders();
  }

  function closeModal() {
    if (saving) return;
    setIsModalOpen(false);
    setEditingId(null);
    setLeaderNameFallback(null);
    setFormData(initialFormState);
    setSelectedDates(EMPTY_SELECTED_DATES);
  }

  function handleDateChange(type: 'start' | 'end', value: string) {
    setSelectedDates((prev) => {
      const newDates = { ...prev, [type]: value };

      if (newDates.start && newDates.end) {
        const start = parseGroupTripDateInput(newDates.start);
        const end = parseGroupTripDateInput(newDates.end);
        if (start && end) {
          const formatted = formatGroupTripDateRange(start, end);
          setFormData((formPrev) => ({
            ...formPrev,
            dates_ar: formatted.dates_ar,
            dates_en: formatted.dates_en,
          }));
        }
      }

      return newDates;
    });
  }

  async function handleSave() {
    if (!supabase) return;

    const payload = formToPayload(formData, leaderOptions, leaderNameFallback);

    if (!payload.title_ar || !payload.title_en || !payload.description_ar || !payload.description_en) {
      setBanner({ type: 'err', text: 'يرجى تعبئة العناوين والأوصاف بالعربية والإنجليزية.' });
      return;
    }

    setSaving(true);
    setBanner(null);

    let resultBanner: { type: 'ok' | 'err'; text: string } | null = null;

    try {
      if (editingId) {
        let { error: updateError } = await supabase
          .from('group_trips')
          .update(payload)
          .eq('id', editingId);

        if (
          updateError &&
          (updateError.message ?? '').toLowerCase().includes('leader')
        ) {
          const { leader_id: _lid, leader_name: _lname, ...withoutLeader } = payload;
          ({ error: updateError } = await supabase
            .from('group_trips')
            .update(withoutLeader)
            .eq('id', editingId));
          if (!updateError) {
            resultBanner = {
              type: 'err',
              text: 'تم الحفظ بدون الليدر — نفّذ supabase/sql/group_trips_leader.sql في Supabase.',
            };
          }
        }

        if (updateError) throw updateError;
        resultBanner = resultBanner ?? { type: 'ok', text: 'تم تحديث الرحلة بنجاح.' };
      } else {
        let { error: insertError } = await supabase.from('group_trips').insert([payload]);

        if (
          insertError &&
          (insertError.message ?? '').toLowerCase().includes('leader')
        ) {
          const { leader_id: _lid, leader_name: _lname, ...withoutLeader } = payload;
          ({ error: insertError } = await supabase.from('group_trips').insert([withoutLeader]));
          if (!insertError) {
            resultBanner = {
              type: 'err',
              text: 'تمت الإضافة بدون الليدر — نفّذ supabase/sql/group_trips_leader.sql في Supabase.',
            };
          }
        }

        if (insertError) throw insertError;
        resultBanner = resultBanner ?? { type: 'ok', text: 'تمت إضافة الرحلة بنجاح.' };
      }

      setBanner(resultBanner);

      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialFormState);
      setSelectedDates(EMPTY_SELECTED_DATES);
      await fetchTrips();
    } catch (e) {
      setBanner({
        type: 'err',
        text: e instanceof Error ? e.message : 'تعذر الحفظ. تحقق من صلاحيات Supabase (RLS).',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleSmartCheckbox(type: AmenityListType, item: Amenity, isChecked: boolean) {
    setFormData((prev) => {
      let incAr = parseArAmenities(prev.includes_ar);
      let incEn = parseEnAmenities(prev.includes_en);
      let excAr = parseArAmenities(prev.excludes_ar);
      let excEn = parseEnAmenities(prev.excludes_en);

      if (type === 'includes') {
        if (isChecked) {
          if (!incAr.includes(item.ar)) incAr.push(item.ar);
          if (!incEn.includes(item.en)) incEn.push(item.en);
          excAr = excAr.filter((v) => v !== item.ar);
          excEn = excEn.filter((v) => v !== item.en);
        } else {
          incAr = incAr.filter((v) => v !== item.ar);
          incEn = incEn.filter((v) => v !== item.en);
        }
      } else {
        if (isChecked) {
          if (!excAr.includes(item.ar)) excAr.push(item.ar);
          if (!excEn.includes(item.en)) excEn.push(item.en);
          incAr = incAr.filter((v) => v !== item.ar);
          incEn = incEn.filter((v) => v !== item.en);
        } else {
          excAr = excAr.filter((v) => v !== item.ar);
          excEn = excEn.filter((v) => v !== item.en);
        }
      }

      return {
        ...prev,
        includes_ar: incAr.join('، '),
        includes_en: incEn.join(', '),
        excludes_ar: excAr.join('، '),
        excludes_en: excEn.join(', '),
      };
    });
  }

  async function handleDelete(id: string) {
    if (!supabase) return;
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;

    setDeletingId(id);
    setBanner(null);

    try {
      const { error: deleteError } = await supabase.from('group_trips').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setBanner({ type: 'ok', text: 'تم حذف الرحلة.' });
      await fetchTrips();
    } catch (e) {
      setBanner({
        type: 'err',
        text: e instanceof Error ? e.message : 'تعذر الحذف. تحقق من صلاحيات Supabase (RLS).',
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ClientErrorBoundary
      fallbackTitle="تعذّر تحميل صفحة القروبات"
      fallbackMessage="حدث خطأ أثناء عرض الرحلات. حدّث الصفحة أو تحقق من اتصال Supabase."
    >
    <div className="min-h-screen bg-[#F6F4F0] p-6 font-sans sm:p-8" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 className="text-2xl font-extrabold text-[#1E2720] sm:text-3xl">
              إدارة رحلات القروبات 🌍
            </h1>
            <p className="mt-2 text-sm font-semibold text-gray-500">
              عرض وتعديل بطاقات رحلات المجموعات المعروضة في الصفحة الرئيسية (جدول group_trips).
            </p>
        </div>
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-xl bg-[#1E2720] px-6 py-3 text-sm font-bold text-[#D4AF37] shadow-md transition hover:bg-[#2A362C]"
          >
          + إضافة قروب جديد
        </button>
      </div>

        {banner ? (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm font-bold ${
              banner.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {banner.text}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
            <button
              type="button"
              onClick={() => void fetchTrips()}
              className="mr-3 underline decoration-red-300 underline-offset-2"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <CardsSkeleton />
        ) : trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-8 py-16 text-center">
            <p className="text-base font-bold text-gray-600">لا توجد رحلات قروبات في قاعدة البيانات.</p>
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 rounded-xl bg-[#1E2720] px-5 py-2.5 text-sm font-bold text-[#D4AF37]"
            >
              إضافة أول رحلة
            </button>
              </div>
        ) : (
          <>
            <div dir="rtl" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {(trips ?? []).map((trip) => {
                const dateLabels = tripDateLabels(trip);
                return (
                <article
                  key={String(trip.id)}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#d4af37]/20 bg-white shadow-[0_8px_30px_rgba(30,39,32,0.06)] transition hover:shadow-lg"
                >
                  <div className="border-b border-[#d4af37]/10 bg-gradient-to-l from-[#001f3f]/[0.05] via-transparent to-[#d4af37]/[0.04] px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1c4532]/10 px-2.5 py-0.5 text-[10px] font-black text-[#1c4532]">
                            <TripStatusDot active={isTripActive(trip)} />
                            {trip.badge_ar}
                          </span>
                          {!isTripActive(trip) ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-500">
                              مخفية
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-2 text-lg font-black leading-snug text-[#1E2720]">{trip.title_ar}</h3>
                        <p className="mt-0.5 text-xs font-semibold text-gray-500" dir="ltr">
                          {trip.title_en}
                        </p>
                      </div>
                      {hasTripText(trip.price) ? (
                        <span className="shrink-0 rounded-xl bg-[#1E2720] px-3 py-1.5 text-[11px] font-black text-[#D4AF37]">
                          {tripText(trip.price)}
                </span>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      {hasTripText(trip.leader_name) ? (
                        <GroupTripLeaderBadge name={tripText(trip.leader_name)} compact />
                      ) : (
                        <span className="text-[11px] font-semibold text-gray-400">بدون مشرف</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col px-5 py-4">
                    <p className="line-clamp-3 flex-1 text-sm font-semibold leading-relaxed text-gray-600">
                      {tripText(trip.description_ar) || '—'}
                    </p>
                    <div className="mt-4 space-y-1.5 rounded-xl border border-gray-100 bg-[#F6F4F0]/60 px-3 py-2.5">
                      {hasTripText(dateLabels.dates_ar) ? (
                        <p className="text-xs font-bold text-[#1c4532]">{dateLabels.dates_ar}</p>
                      ) : (
                        <p className="text-xs font-semibold text-gray-400">— بدون تواريخ —</p>
                      )}
                      {hasTripText(dateLabels.dates_en) ? (
                        <p className="text-[10px] font-semibold text-gray-500" dir="ltr">
                          {dateLabels.dates_en}
                        </p>
                      ) : null}
                      <p className="text-[10px] font-bold text-gray-500">
                        المقاعد: {typeof trip.max_seats === 'number' ? trip.max_seats : 0}
                        {trip.allow_waitlist !== false ? ' · قائمة انتظار ✓' : ' · بدون انتظار'}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                      <button
                        type="button"
                        onClick={() => openEditModal(trip)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37]/30 bg-[#1E2720] px-4 py-2 text-xs font-bold text-[#D4AF37] transition hover:bg-[#2A362C] sm:flex-none"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        تعديل
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === trip.id}
                        onClick={() => void handleDelete(trip.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 sm:flex-none"
                      >
                        {deletingId === trip.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                        حذف
                      </button>
              </div>
              </div>
                </article>
                );
              })}
            </div>
            
            <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3 text-xs font-bold text-gray-500 shadow-sm">
              <span>{trips.length} رحلة</span>
              <button
                type="button"
                onClick={() => void fetchTrips()}
                className="inline-flex items-center gap-1.5 text-[#1c4532] hover:underline"
              >
                <Loader2 className="h-3.5 w-3.5" aria-hidden />
                تحديث
              </button>
            </div>
          </>
        )}
      </div>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-trip-modal-title"
          onClick={closeModal}
        >
          <div
            dir="rtl"
            className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-[#D4AF37]/25 bg-[#121816] shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:max-h-[88vh] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between border-b border-gray-800 bg-[#1E2720] px-6 py-5">
              <div className="text-right">
                <h2 id="group-trip-modal-title" className="text-lg font-extrabold text-[#D4AF37]">
                  {editingId ? 'تعديل رحلة قروب' : 'إضافة قروب جديد'}
                </h2>
                <p className="mt-1 text-xs font-semibold text-white/60">
                  المحتوى يظهر في قسم رحلات المجموعات بالصفحة الرئيسية (عربي / إنجليزي).
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
              <div className="flex flex-col gap-5">
                <section className="rounded-xl border border-[#D4AF37]/20 bg-[#1E2720]/40 px-4 py-4">
                  <p className="mb-3 text-right text-xs font-black uppercase tracking-wide text-[#d4af37]">
                    حالة الرحلة / Trip Status
                  </p>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.is_active ?? true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-5 w-5 shrink-0 rounded border-gray-400 text-[#1c4532] focus:ring-[#D4AF37]"
                    />
                    <span className="text-sm font-bold text-[#f5f0e6]">
                      {formData.is_active
                        ? '✅ نشطة (تظهر للعملاء) / Active'
                        : '❌ مخفية / Hidden'}
                    </span>
                  </label>
                </section>

                <section className="flex flex-col gap-5">
                  <SectionTitle>العناوين والشارات</SectionTitle>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>عنوان الرحلة (AR)</span>
                      <input
                        type="text"
                        autoComplete="off"
                        className={inputClass}
                        value={formData.title_ar || ''}
                        onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                        placeholder="مثال: رحلة عائلية لليابان"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Title (EN)</span>
                      <input
                        type="text"
                        autoComplete="off"
                        className={inputClass}
                        dir="ltr"
                        value={formData.title_en || ''}
                        onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                        placeholder="Family Trip to Japan"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>الشارة (AR)</span>
                      <input
                        type="text"
                        autoComplete="off"
                        className={inputClass}
                        value={formData.badge_ar || ''}
                        onChange={(e) => setFormData({ ...formData, badge_ar: e.target.value })}
                        placeholder="مجموعة"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Badge (EN)</span>
                      <input
                        type="text"
                        autoComplete="off"
                        className={inputClass}
                        dir="ltr"
                        value={formData.badge_en || ''}
                        onChange={(e) => setFormData({ ...formData, badge_en: e.target.value })}
                        placeholder="Group"
                      />
                    </label>
                  </div>
                </section>

                <section className="relative z-50 flex flex-col gap-5">
                  <SectionTitle>الليدر المشرف</SectionTitle>
                  <p className="text-right text-xs font-semibold text-gray-400">
                    اختر المشرف — يظهر على البطاقة: «بإشراف: الاسم».
                  </p>
                  <label className="relative z-50 block">
                    <span className={labelClass}>الليدر المشرف</span>
                    <select
                      value={formData.leader_id}
                      onChange={(e) => setFormData({ ...formData, leader_id: e.target.value })}
                      disabled={leadersLoading}
                      className={selectClass}
                      style={{
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23d4af37' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'left 0.75rem center',
                        backgroundSize: '1rem',
                      }}
                    >
                      <option value="">— اختر مشرفاً —</option>
                      {leaderOptions?.map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {groupTripLeaderRoleEmoji(leader.role)} {leader.name}
                        </option>
                      ))}
                    </select>
                    {leadersLoading ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d4af37]" aria-hidden />
                        جاري تحميل الليدرز…
                      </p>
                    ) : (leaderOptions?.length ?? 0) === 0 ? (
                      <p className="mt-2 text-right text-[11px] font-bold text-amber-400/90">
                        {leadersError
                          ? `تعذر تحميل الليدرز: ${leadersError}`
                          : 'لا يوجد ليدرز — فعّل is_leader على العميل من CRM أولاً.'}
                      </p>
                    ) : (
                      <p className="mt-2 text-right text-[10px] font-semibold text-gray-500">
                        {leaderOptions?.length ?? 0} ليدر متاح
                      </p>
                    )}
                    {formData.leader_id ? (
                      <div className="mt-3">
                        <GroupTripLeaderBadge
                          name={
                            resolveGroupTripLeaderName(
                              formData.leader_id,
                              leaderOptions,
                              leaderNameFallback,
                            ) ?? '—'
                          }
                        />
                      </div>
                    ) : null}
                  </label>
                </section>

                <section className="flex flex-col gap-5">
                  <SectionTitle>التواريخ والسعر</SectionTitle>
                  <p className="text-right text-xs font-semibold text-gray-400">
                    اختر تاريخ البداية والنهاية — يُنسّق النص العربي والإنجليزي تلقائياً للحفظ في قاعدة البيانات.
                  </p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>
                        تاريخ البداية / Start Date
                      </span>
                      <input
                        type="date"
                        value={selectedDates.start}
                        onChange={(e) => handleDateChange('start', e.target.value)}
                        className={dateInputClass}
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>
                        تاريخ النهاية / End Date
                      </span>
                      <input
                        type="date"
                        value={selectedDates.end}
                        min={selectedDates.start || undefined}
                        onChange={(e) => handleDateChange('end', e.target.value)}
                        className={dateInputClass}
                      />
                    </label>
                    {formData.dates_ar || formData.dates_en ? (
                      <div className="rounded-xl border border-[#D4AF37]/25 bg-[#1E2720]/60 px-4 py-3 sm:col-span-2">
                        <p className="text-xs font-black text-[#d4af37]">معاينة التواريخ المحفوظة</p>
                        <p className="mt-1 text-sm font-bold text-[#f5f0e6]">
                          {resolveGroupTripDateDisplay(formData.dates_ar, formData.dates_en).dates_ar}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-400" dir="ltr">
                          {resolveGroupTripDateDisplay(formData.dates_ar, formData.dates_en).dates_en}
                        </p>
                      </div>
                    ) : null}
                    <label className="block sm:col-span-2">
                      <span className={labelClass}>السعر / Price</span>
                      <input
                        type="text"
                        autoComplete="off"
                        className={inputClass}
                        dir="ltr"
                        value={formData.price || ''}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="9900 SAR"
                      />
                    </label>
                  </div>
                </section>

                <section className="flex flex-col gap-5">
                  <SectionTitle>الوصف</SectionTitle>
                  <div className="grid gap-5">
                    <label className="block">
                      <span className={labelClass}>الوصف (AR)</span>
                      <textarea
                        autoComplete="off"
                        className={`${inputClass} min-h-[88px] resize-y`}
                        value={formData.description_ar || ''}
                        onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                        placeholder="وصف تشويقي للرحلة بالعربية..."
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Description (EN)</span>
                      <textarea
                        autoComplete="off"
                        className={`${inputClass} min-h-[88px] resize-y`}
                        dir="ltr"
                        value={formData.description_en || ''}
                        onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                        placeholder="Compelling trip description in English..."
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-4">
                  <SectionTitle>تشمل / INCLUDES</SectionTitle>
                  <p className="text-xs font-semibold text-gray-500">
                    اختر ما يشمله السعر — يُحفظ تلقائياً بالعربية والإنجليزية.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {amenitiesList.map((item) => {
                      const isChecked = isAmenityChecked(formData.includes_ar || '', item);
                      return (
                        <label
                          key={`inc_${item.id}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                            isChecked
                              ? 'border-[#D4AF37]/50 bg-[#1c4532]/5 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-[#D4AF37]/30'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleSmartCheckbox('includes', item, e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[#1c4532] focus:ring-[#D4AF37]"
                          />
                          <span className="text-sm font-semibold leading-snug text-[#1E2720]">
                            {item.ar}
                            <span className="mt-0.5 block text-xs font-bold text-gray-500" dir="ltr">
                              {item.en}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {formData.includes_ar ? (
                    <p className="rounded-lg bg-[#F6F4F0] px-3 py-2 text-xs font-bold text-[#1c4532]">
                      {formData.includes_ar}
                    </p>
                  ) : null}
                </section>

                <section className="space-y-4">
                  <SectionTitle>لا تشمل / EXCLUDES</SectionTitle>
                  <p className="text-xs font-semibold text-gray-500">
                    اختر ما لا يشمله السعر — على العميل ترتيبه بنفسه.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {amenitiesList.map((item) => {
                      const isChecked = isAmenityChecked(formData.excludes_ar || '', item);
                      return (
                        <label
                          key={`exc_${item.id}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                            isChecked
                              ? 'border-red-200 bg-red-50/80 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-red-200/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleSmartCheckbox('excludes', item, e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-300"
                          />
                          <span className="text-sm font-semibold leading-snug text-[#1E2720]">
                            {item.ar}
                            <span className="mt-0.5 block text-xs font-bold text-gray-500" dir="ltr">
                              {item.en}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {formData.excludes_ar ? (
                    <p className="rounded-lg bg-red-950/40 px-3 py-2 text-xs font-bold text-red-200">
                      {formData.excludes_ar}
                    </p>
                  ) : null}
                </section>

                <section className="flex flex-col gap-5 border-t border-gray-800 pt-5">
                  <SectionTitle>السعة والانتظار</SectionTitle>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>عدد المقاعد / Max Seats</span>
                      <input
                        type="number"
                        min={0}
                        value={formData.max_seats || 0}
                        onChange={(e) =>
                          setFormData({ ...formData, max_seats: parseInt(e.target.value, 10) || 0 })
                        }
                        className={inputClass}
                      />
                    </label>
                    <div className="flex items-center justify-start md:mt-7">
                      <label className="group flex cursor-pointer items-center">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={formData.allow_waitlist ?? true}
                            onChange={(e) =>
                              setFormData({ ...formData, allow_waitlist: e.target.checked })
                            }
                            className="peer sr-only"
                          />
                          <div className="h-6 w-11 rounded-full bg-gray-600 after:absolute after:right-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#D4AF37] peer-checked:after:-translate-x-[100%]" />
                        </div>
                        <span className="mr-3 text-sm font-medium text-gray-300 transition-colors group-hover:text-[#D4AF37]">
                          تفعيل قائمة الانتظار / Waitlist
                        </span>
                      </label>
                </div>
              </div>
                </section>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-gray-800 bg-[#1E2720] px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-[#1E2720] shadow-md transition hover:brightness-105 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                حفظ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </ClientErrorBoundary>
  );
}
