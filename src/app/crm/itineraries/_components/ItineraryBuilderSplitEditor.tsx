'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Loader2, Plus, Save } from 'lucide-react';
import Link from 'next/link';

import ItineraryBoardingDetailsForm from '@/app/crm/itineraries/_components/ItineraryBoardingDetailsForm';
import ItineraryBuilderDaysPanel from '@/app/crm/itineraries/_components/ItineraryBuilderDaysPanel';
import ItineraryClientRevealControl, {
  bypassLockFromRow,
} from '@/app/crm/itineraries/_components/ItineraryClientRevealControl';
import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import { parseDaysDataFromRow } from '@/lib/public-itinerary';
import { supabase } from '@/lib/supabase';
import {
  buildItinerarySupabasePayload,
  buildVipClientSummaryPatch,
  createEmptyDay,
  createInitialItineraryDraft,
  draftFromItineraryRow,
  stripItineraryPayloadForSchemaError,
  type ItineraryDraft,
} from '@/lib/itinerary-builder-model';

type Props = {
  itineraryId: string;
};

export default function ItineraryBuilderSplitEditor({ itineraryId }: Props) {
  const { employee } = useCrmEmployee();
  const editId = itineraryId.trim();

  const [draft, setDraft] = useState<ItineraryDraft>(createInitialItineraryDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [bypass24hLock, setBypass24hLock] = useState(false);

  const patchDraft = (patch: Partial<ItineraryDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (!editId) {
      setLoading(false);
      setFetchError('معرّف المسار غير صالح.');
      return;
    }
    if (!supabase) {
      setLoading(false);
      setFetchError('قاعدة البيانات غير مهيأة.');
      return;
    }

    let cancelled = false;
    const queryId = /^\d+$/.test(editId) ? Number(editId) : editId;

    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        const { data, error } = await supabase!
          .from('itineraries')
          .select('*')
          .eq('id', queryId)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;
        if (!data) {
          setFetchError('لم يُعثر على المسار في قاعدة البيانات.');
          return;
        }

        const row = data as Record<string, unknown>;
        let legacyDays: Array<Record<string, unknown>> | null = null;
        const { days: parsed } = parseDaysDataFromRow(row.days_data ?? row.days);
        if (parsed.length === 0) {
          const { data: legacyRow } = await supabase!
            .from('itineraries')
            .select(
              `id, itinerary_days (
                id, day_num, title, city, notes, sort_order,
                itinerary_stops (
                  id, place_name, category, time_slot, note, transport_type, taxi,
                  transit_mode, transit_duration, sort_order
                )
              )`,
            )
            .eq('id', queryId)
            .maybeSingle();
          if (legacyRow && typeof legacyRow === 'object') {
            const nested = (legacyRow as Record<string, unknown>).itinerary_days;
            if (Array.isArray(nested)) legacyDays = nested as Array<Record<string, unknown>>;
          }
        }

        const hydrated = draftFromItineraryRow(row, legacyDays);
        setDraft(hydrated);
        setBypass24hLock(bypassLockFromRow(row));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'تعذر تحميل المسار.';
        setFetchError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  function addDay() {
    setDraft((d) => ({
      ...d,
      days: [...d.days, createEmptyDay(d.days.length)],
    }));
  }

  async function saveItinerary() {
    if (!supabase || !editId) return;
    if (!draft.customerName.trim() || !draft.title.trim()) {
      setNotice('يرجى إدخال اسم العميل وعنوان الرحلة.');
      return;
    }

    setSaving(true);
    setNotice(null);
    const queryId = /^\d+$/.test(editId) ? Number(editId) : editId;
    const payload = buildItinerarySupabasePayload(draft, {
      employeeId: employee?.id ?? null,
      autoPasscode: false,
    });

    try {
      let res = await supabase.from('itineraries').update(payload).eq('id', queryId);
      if (res.error && /column|schema cache|does not exist/i.test(res.error.message ?? '')) {
        res = await supabase
          .from('itineraries')
          .update(stripItineraryPayloadForSchemaError(res.error.message ?? '', payload))
          .eq('id', queryId);
      }
      if (res.error) throw res.error;

      const summaryPatch = buildVipClientSummaryPatch(draft);
      await supabase.from('itineraries').update(summaryPatch).eq('id', queryId);
      setNotice('تم حفظ المسار بنجاح.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'فشل الحفظ.';
      setNotice(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F9F9F6]">
        <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" aria-hidden />
        <span className="sr-only">جاري التحميل…</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-bold text-red-700">{fetchError}</p>
        <Link
          href="/crm/itineraries"
          className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#1E2720]"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للمسارات
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F6] text-[#1E2720]">
      <header className="sticky top-0 z-20 border-b border-[#1E2720]/10 bg-[#F9F9F6]/95 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/crm/itineraries"
              className="inline-flex items-center gap-1 rounded-xl border border-[#1E2720]/15 px-3 py-2 text-xs font-bold text-[#1E2720] hover:bg-white"
            >
              <ArrowRight className="h-4 w-4" />
              المسارات
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
                منشئ المسار · بنك الأماكن
              </p>
              <h1 className="text-lg font-black text-[#1E2720]">
                {draft.title.trim() || 'مسار بدون عنوان'}
              </h1>
              {draft.customerName.trim() ? (
                <p className="text-xs font-medium text-[#1E2720]/55">{draft.customerName}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addDay}
              className="inline-flex items-center gap-1 rounded-xl border border-[#D4AF37]/50 bg-white px-3 py-2 text-xs font-black text-[#1E2720]"
            >
              <Plus className="h-3.5 w-3.5" />
              يوم جديد
            </button>
            <button
              type="button"
              onClick={() => void saveItinerary()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E2720] px-4 py-2.5 text-sm font-black text-[#F9F9F6] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ المسار
            </button>
          </div>
        </div>
        {notice ? (
          <p className="mx-auto mt-2 max-w-[1600px] text-xs font-bold text-[#1E2720]/70">{notice}</p>
        ) : null}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="mb-5">
          <ItineraryClientRevealControl
            itineraryId={editId}
            initialBypass={bypass24hLock}
            onBypassChange={setBypass24hLock}
          />
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(300px,360px)_1fr]">
          <ItineraryBoardingDetailsForm
            flight={draft.flight}
            onChange={(flight) => {
              const flight_to = flight.flight_to.trim();
              patchDraft({
                flight,
                ...(flight_to ? { destination: flight_to } : {}),
              });
            }}
          />
          <div>
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#D4AF37]" />
              <h2 className="text-base font-black text-[#1E2720]">خريطة + جدول يومي</h2>
            </div>
            <div className="rounded-[1.25rem] border border-[#D4AF37]/30 bg-white p-4 shadow-[0_12px_40px_rgba(30,39,32,0.08)] ring-1 ring-[#1E2720]/5 sm:p-5">
              <ItineraryBuilderDaysPanel
                theme="light"
                days={draft.days}
                onDaysChange={(days) => patchDraft({ days })}
                destination={draft.destination || draft.flight.flight_to}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
