'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Bus,
  Loader2,
  Plane,
  Plus,
  Save,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCE_SELECT_CLASS } from '@/lib/lead-source';
import {
  calculateProfitFromMargin,
  calculateQuotationGrandTotal,
  createEmptyActivityProposal,
  createEmptyFlightProposal,
  createEmptyHotelProposal,
  createEmptyTransportProposal,
  ensureProposalRows,
  fetchQuotationById,
  fetchQuotationHotelPlaces,
  filterQuotationHotelsByCity,
  hotelExistsInQuotationPlaces,
  normalizeQuotationId,
  resolveQuotationClientId,
  serializeActivityProposalsForSave,
  serializeFlightProposalsForSave,
  serializeHotelProposalsForSave,
  serializeTransportProposalsForSave,
  silentInsertQuotationHotelPlace,
  sumProposalPrices,
  type QuotationActivityProposal,
  type QuotationFlightProposal,
  type QuotationHotelPlace,
  type QuotationHotelProposal,
  type QuotationTransportProposal,
} from '@/lib/crm-quotations';

type ClientOption = {
  id: string;
  name: string;
};

type QuoteBuilderFormProps = {
  editQuoteId: string;
  isEditMode: boolean;
};

const fieldClass =
  'w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-bold text-gray-900 outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/30';
const labelClass = 'mb-1.5 block text-xs font-black text-slate-700';
const cardClass = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5';
const cellInputClass =
  'w-full min-w-[4rem] border-0 bg-transparent px-2 py-2 text-xs font-bold text-gray-900 outline-none focus:bg-amber-50/80 focus:ring-1 focus:ring-inset focus:ring-[#C9A84C]/40';
const thClass =
  'bg-[#1C4532] px-2 py-2 text-start text-[10px] font-black uppercase tracking-wide text-[#C9A84C]';

function normalizeClientId(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(Math.trunc(raw));
  const s = String(raw).trim();
  if (s === 'null' || s === 'undefined') return '';
  return s;
}

function mapClientRow(row: Record<string, unknown>): ClientOption | null {
  const raw = row.id ?? row.client_id ?? row.uuid;
  const id = normalizeClientId(raw);
  if (!id) return null;
  return {
    id,
    name: String(row.name ?? '').trim(),
  };
}

function PriceInput({
  value,
  onChange,
  className = cellInputClass,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      placeholder="0"
      className={`${className} text-end`}
      dir="ltr"
    />
  );
}

export function QuoteBuilderForm({ editQuoteId, isEditMode }: QuoteBuilderFormProps) {
  const router = useRouter();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingStatus, setEditingStatus] = useState<'draft' | 'pending_client' | 'approved'>(
    'pending_client',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [clientId, setClientId] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [title, setTitle] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [destinations, setDestinations] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [marginPercent, setMarginPercent] = useState('20');
  const [serviceFee, setServiceFee] = useState('0');

  const [flights, setFlights] = useState<QuotationFlightProposal[]>([createEmptyFlightProposal()]);
  const [hotels, setHotels] = useState<QuotationHotelProposal[]>([createEmptyHotelProposal()]);
  const [activities, setActivities] = useState<QuotationActivityProposal[]>([
    createEmptyActivityProposal(),
  ]);
  const [transports, setTransports] = useState<QuotationTransportProposal[]>([
    createEmptyTransportProposal(),
  ]);

  const [hotelPlaces, setHotelPlaces] = useState<QuotationHotelPlace[]>([]);
  const pendingClientId = useRef('');

  const baseCost = useMemo(
    () => sumProposalPrices(flights, hotels, activities, transports),
    [flights, hotels, activities, transports],
  );

  const marginProfit = useMemo(
    () => calculateProfitFromMargin(baseCost, Number(marginPercent) || 0),
    [baseCost, marginPercent],
  );

  const grandTotal = useMemo(
    () => calculateQuotationGrandTotal(baseCost, Number(marginPercent) || 0, Number(serviceFee) || 0),
    [baseCost, marginPercent, serviceFee],
  );

  const loadClients = useCallback(async () => {
    if (!supabase) {
      setError('Supabase غير مهيأ.');
      setLoadingClients(false);
      return;
    }
    setLoadingClients(true);
    const primary = await supabase
      .from('clients')
      .select('id, name, phone_wa')
      .order('name', { ascending: true });

    let data: Record<string, unknown>[] | null = null;
    if (!primary.error) {
      data = (primary.data ?? []) as Record<string, unknown>[];
    } else {
      const fallback = await supabase.from('clients').select('*').order('name', { ascending: true });
      if (fallback.error) {
        setError(fallback.error.message || 'تعذر تحميل العملاء.');
        setClients([]);
        setLoadingClients(false);
        return;
      }
      data = (fallback.data ?? []) as Record<string, unknown>[];
    }

    const mapped = (data ?? [])
      .map((row) => mapClientRow(row))
      .filter((c): c is ClientOption => c != null);
    setClients(mapped);
    setLoadingClients(false);
  }, []);

  useEffect(() => {
    void loadClients();
    void (async () => {
      try {
        setHotelPlaces(await fetchQuotationHotelPlaces());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'تعذر تحميل قاعدة الفنادق.');
      }
    })();
  }, [loadClients]);

  useEffect(() => {
    if (!editQuoteId) return;
    let cancelled = false;

    void (async () => {
      setLoadingQuote(true);
      setError('');
      try {
        const row = await fetchQuotationById(editQuoteId);
        if (cancelled) return;
        if (!row) {
          setError('تعذر العثور على عرض السعر للتعديل.');
          return;
        }

        setEditingId(normalizeQuotationId(row.id));
        setEditingStatus(row.status);
        const cid = row.client_id != null ? String(row.client_id) : '';
        pendingClientId.current = cid;
        setClientId(cid);
        setLeadSource(row.lead_source ?? '');
        setTitle(row.title);
        setDestinations(row.destinations);
        setStartDate(row.start_date ?? '');
        setEndDate(row.end_date ?? '');
        setMarginPercent(String(row.profit_margin || 20));
        setServiceFee(String(row.service_fee || 0));
        setFlights(ensureProposalRows(row.flight_proposals, createEmptyFlightProposal));
        setHotels(ensureProposalRows(row.hotel_proposals, createEmptyHotelProposal));
        setActivities(ensureProposalRows(row.activities_proposals, createEmptyActivityProposal));
        setTransports(ensureProposalRows(row.transport_proposals, createEmptyTransportProposal));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'تعذر تحميل عرض السعر.');
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editQuoteId]);

  useEffect(() => {
    const pending = pendingClientId.current;
    if (!pending || !clients.length) return;
    const match = clients.find((c) => c.id === pending);
    if (match) setClientId(match.id);
  }, [clients]);

  const addDestination = () => {
    const t = destinationInput.trim();
    if (!t || destinations.some((d) => d.toLowerCase() === t.toLowerCase())) {
      setDestinationInput('');
      return;
    }
    setDestinations((prev) => [...prev, t]);
    setDestinationInput('');
  };

  const removeDestination = (index: number) => {
    setDestinations((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFlight = (id: string, patch: Partial<QuotationFlightProposal>) => {
    setFlights((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updateHotel = (id: string, patch: Partial<QuotationHotelProposal>) => {
    setHotels((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updateActivity = (id: string, patch: Partial<QuotationActivityProposal>) => {
    setActivities((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updateTransport = (id: string, patch: Partial<QuotationTransportProposal>) => {
    setTransports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = <T extends { id: string }>(
    rows: T[],
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    id: string,
    createEmpty: () => T,
  ) => {
    const next = rows.filter((r) => r.id !== id);
    setter(next.length > 0 ? next : [createEmpty()]);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const rawClientId = normalizeClientId(clientId);
    const matchedClient = clients.find((c) => c.id === rawClientId);
    if (!rawClientId || !matchedClient) {
      setError('اختر عميلاً صالحاً.');
      return;
    }

    let resolvedClientId: string | number;
    try {
      resolvedClientId = resolveQuotationClientId(matchedClient.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'اختر عميلاً صالحاً.');
      return;
    }

    if (!title.trim()) {
      setError('أدخل عنوان الرحلة.');
      return;
    }
    if (!destinations.length) {
      setError('أضف وجهة واحدة على الأقل.');
      return;
    }
    if (!startDate.trim() || !endDate.trim()) {
      setError('أدخل تاريخ البداية والنهاية.');
      return;
    }
    if (endDate < startDate) {
      setError('تاريخ النهاية يجب أن يكون بعد البداية.');
      return;
    }

    setSaving(true);
    try {
      for (const hotel of hotels) {
        if (
          hotel.hotel_name.trim() &&
          hotel.city.trim() &&
          !hotelExistsInQuotationPlaces(hotelPlaces, hotel.hotel_name, hotel.city)
        ) {
          const created = await silentInsertQuotationHotelPlace({
            hotelName: hotel.hotel_name,
            city: hotel.city,
            roomType: hotel.room_type,
          });
          if (created) {
            setHotelPlaces((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
          }
        }
      }

      const margin = Number(marginPercent) || 0;
      const fee = Number(serviceFee) || 0;
      const profitAmount = calculateProfitFromMargin(baseCost, margin);
      const total = calculateQuotationGrandTotal(baseCost, margin, fee);

      const payload = {
        client_id: resolvedClientId,
        title: title.trim(),
        destinations,
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        flight_proposals: serializeFlightProposalsForSave(flights),
        hotel_proposals: serializeHotelProposalsForSave(hotels),
        activities_proposals: serializeActivityProposalsForSave(activities),
        transport_proposals: serializeTransportProposalsForSave(transports),
        total_estimated_cost: baseCost,
        expected_profit: profitAmount,
        profit_margin: margin,
        service_fee: fee,
        grand_total: total,
        status: editingId ? editingStatus : ('pending_client' as const),
        lead_source: leadSource.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (!supabase) {
        setError('Supabase غير مهيأ.');
        return;
      }

      if (editingId) {
        let { data, error: updateError } = await supabase
          .from('quotations')
          .update(payload)
          .eq('id', editingId)
          .select('*');

        if (updateError?.message?.includes('column')) {
          const legacyPayload = {
            client_id: resolvedClientId,
            title: title.trim(),
            destinations,
            start_date: startDate.trim(),
            end_date: endDate.trim(),
            flight_proposals: payload.flight_proposals,
            hotel_proposals: payload.hotel_proposals,
            total_estimated_cost: baseCost,
            expected_profit: profitAmount + fee,
            status: editingId ? editingStatus : ('pending_client' as const),
            lead_source: leadSource.trim() || null,
            updated_at: new Date().toISOString(),
          };
          const retry = await supabase
            .from('quotations')
            .update(legacyPayload)
            .eq('id', editingId)
            .select('*');
          data = retry.data;
          updateError = retry.error;
        }

        if (updateError) {
          console.error('Supabase Update Error:', updateError);
          setError(`فشل التحديث: ${updateError.message}`);
          return;
        }

        if (data?.[0]?.id != null) {
          setSuccess('تم تحديث عرض السعر بنجاح! ✨');
          router.push('/crm/quotations');
        }
        return;
      }

      let { data: insertedData, error: insertError } = await supabase
        .from('quotations')
        .insert([payload])
        .select('*');

      if (insertError?.message?.includes('column')) {
        const legacyPayload = {
          client_id: resolvedClientId,
          title: title.trim(),
          destinations,
          start_date: startDate.trim(),
          end_date: endDate.trim(),
          flight_proposals: payload.flight_proposals,
          hotel_proposals: payload.hotel_proposals,
          total_estimated_cost: baseCost,
          expected_profit: profitAmount + fee,
          status: 'pending_client' as const,
          lead_source: leadSource.trim() || null,
          updated_at: new Date().toISOString(),
        };
        const retry = await supabase.from('quotations').insert([legacyPayload]).select('*');
        insertedData = retry.data;
        insertError = retry.error;
      }

      if (insertError) {
        console.error('Supabase Insert Error:', insertError);
        setError(`فشل الحفظ: ${insertError.message}`);
        return;
      }

      const newQuoteId = insertedData?.[0]?.id != null ? String(insertedData[0].id).trim() : '';
      if (newQuoteId) {
        setSuccess('تم حفظ عرض السعر بنجاح! ✨');
        router.push(`/quote/${newQuoteId}`);
      } else {
        setError('تم الحفظ، ولكن فشل استخراج معرّف العرض للتوجيه.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ عرض السعر.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 sm:pb-10">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-[#1C4532] sm:text-2xl">
            {isEditMode ? 'تعديل عرض السعر' : 'إنشاء عرض سعر جديد'}
          </h1>
          <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">
            محرك تسعير ديناميكي — التكلفة تُحسب تلقائياً من أسعار الصفوف
          </p>
        </div>
        <Link
          href="/crm/quotations"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <X size={14} aria-hidden />
          رجوع للقائمة
        </Link>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          {success}
        </div>
      ) : null}

      {loadingQuote ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          جاري تحميل عرض السعر للتعديل…
        </div>
      ) : null}

      <section className={`${cardClass} mb-5 space-y-4`}>
        <h2 className="text-base font-black text-[#1C4532]">بيانات الرحلة</h2>

        <label className="block">
          <span className={labelClass}>العميل *</span>
          {loadingClients ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              جاري تحميل العملاء...
            </div>
          ) : (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={fieldClass}
              required
            >
              <option value="">— اختر العميل —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'بدون اسم'}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block">
          <span className={labelClass}>مصدر العميل</span>
          <select
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
            className={LEAD_SOURCE_SELECT_CLASS}
          >
            <option value="" disabled>
              اختر مصدر العميل...
            </option>
            {LEAD_SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>عنوان الرحلة *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
        </label>

        <div>
          <span className={labelClass}>الوجهات *</span>
          <div className="flex gap-2">
            <input
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDestination();
                }
              }}
              placeholder="Paris — Enter للإضافة"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={addDestination}
              className="shrink-0 rounded-xl border border-[#C9A84C]/50 bg-[#FEFDF9] px-4 text-xs font-black text-[#1C4532] hover:bg-amber-50"
            >
              <Plus size={14} className="inline" aria-hidden /> إضافة
            </button>
          </div>
          {destinations.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {destinations.map((d, i) => (
                <li
                  key={`${d}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1C4532] px-3 py-1 text-xs font-bold text-[#C9A84C]"
                >
                  {d}
                  <button type="button" onClick={() => removeDestination(i)} aria-label={`حذف ${d}`}>
                    <X size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>تاريخ البداية *</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`${fieldClass} [color-scheme:light]`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>تاريخ النهاية *</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`${fieldClass} [color-scheme:light]`}
            />
          </label>
        </div>
      </section>

      <section className={`${cardClass} mb-5 space-y-4`}>
        <h2 className="flex items-center gap-2 text-base font-black text-[#1C4532]">
          💰 المقترح المالي
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <label className="block">
            <span className={labelClass}>التكلفة التقديرية (محسوبة)</span>
            <input
              type="text"
              readOnly
              value={baseCost.toLocaleString('ar-SA')}
              className={`${fieldClass} cursor-not-allowed bg-slate-50 text-slate-700`}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className={labelClass}>نسبة الربح %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={marginPercent}
              onChange={(e) => setMarginPercent(e.target.value)}
              className={fieldClass}
            />
            {marginProfit > 0 ? (
              <p className="mt-1 text-[10px] font-bold text-emerald-700">
                هامش: {marginProfit.toLocaleString('ar-SA')} ر.س
              </p>
            ) : null}
          </label>
          <label className="block">
            <span className={labelClass}>رسوم خدمة Wanderloom</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={serviceFee}
              onChange={(e) => setServiceFee(e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="rounded-xl border border-[#C9A84C]/30 bg-[#1C4532] px-4 py-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C]/80">
            الإجمالي للعميل
          </p>
          <p className="mt-1 text-2xl font-black text-[#C9A84C]" dir="ltr">
            {grandTotal.toLocaleString('ar-SA')} ر.س
          </p>
        </div>
      </section>

      <ProposalSection
        title="مقترحات الطيران"
        icon={<Plane size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() => setFlights((prev) => [...prev, createEmptyFlightProposal()])}
      >
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>من</th>
              <th className={thClass}>إلى</th>
              <th className={thClass}>الخطوط</th>
              <th className={thClass}>الدرجة</th>
              <th className={thClass}>السعر (ر.س)</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {flights.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                {(['departureCity', 'arrivalCity', 'airline', 'flight_class'] as const).map((key) => (
                  <td key={key} className="border-l border-slate-100 p-0">
                    <input
                      value={row[key]}
                      onChange={(e) => updateFlight(row.id, { [key]: e.target.value })}
                      className={cellInputClass}
                      dir="ltr"
                    />
                  </td>
                ))}
                <td className="border-l border-slate-100 p-0">
                  <PriceInput value={row.price} onChange={(v) => updateFlight(row.id, { price: v })} />
                </td>
                <td className="border-l border-slate-100 p-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(flights, setFlights, row.id, createEmptyFlightProposal)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ProposalSection>

      <ProposalSection
        title="مقترحات الفنادق"
        icon={<Building2 size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() => setHotels((prev) => [...prev, createEmptyHotelProposal()])}
      >
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>المدينة</th>
              <th className={thClass}>الفندق</th>
              <th className={thClass}>نوع الغرفة</th>
              <th className={thClass}>السعر (ر.س)</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {hotels.map((row) => {
              const cityHotels = filterQuotationHotelsByCity(hotelPlaces, row.city);
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="border-l border-slate-100 p-0">
                    <select
                      value={row.city}
                      onChange={(e) => updateHotel(row.id, { city: e.target.value, hotel_name: '' })}
                      className={cellInputClass}
                      disabled={destinations.length === 0}
                    >
                      <option value="">— المدينة —</option>
                      {destinations.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-l border-slate-100 p-0">
                    {cityHotels.length > 0 ? (
                      <select
                        value={row.hotel_name}
                        onChange={(e) => updateHotel(row.id, { hotel_name: e.target.value })}
                        className={cellInputClass}
                        disabled={!row.city}
                      >
                        <option value="">— الفندق —</option>
                        {cityHotels.map((h) => (
                          <option key={h.id} value={h.name}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={row.hotel_name}
                        onChange={(e) => updateHotel(row.id, { hotel_name: e.target.value })}
                        placeholder="اسم الفندق"
                        className={cellInputClass}
                        disabled={!row.city}
                      />
                    )}
                  </td>
                  <td className="border-l border-slate-100 p-0">
                    <input
                      value={row.room_type}
                      onChange={(e) => updateHotel(row.id, { room_type: e.target.value })}
                      className={cellInputClass}
                    />
                  </td>
                  <td className="border-l border-slate-100 p-0">
                    <PriceInput value={row.price} onChange={(v) => updateHotel(row.id, { price: v })} />
                  </td>
                  <td className="border-l border-slate-100 p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(hotels, setHotels, row.id, createEmptyHotelProposal)}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      aria-label="حذف"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ProposalSection>

      <ProposalSection
        title="الفعاليات"
        icon={<Ticket size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() => setActivities((prev) => [...prev, createEmptyActivityProposal()])}
      >
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>الفعالية</th>
              <th className={thClass}>الوصف</th>
              <th className={thClass}>السعر (ر.س)</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {activities.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={row.name}
                    onChange={(e) => updateActivity(row.id, { name: e.target.value })}
                    className={cellInputClass}
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={row.description}
                    onChange={(e) => updateActivity(row.id, { description: e.target.value })}
                    className={cellInputClass}
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <PriceInput
                    value={row.price}
                    onChange={(v) => updateActivity(row.id, { price: v })}
                  />
                </td>
                <td className="border-l border-slate-100 p-1 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      removeRow(activities, setActivities, row.id, createEmptyActivityProposal)
                    }
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ProposalSection>

      <ProposalSection
        title="المواصلات"
        icon={<Bus size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() => setTransports((prev) => [...prev, createEmptyTransportProposal()])}
      >
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>الوصف</th>
              <th className={thClass}>الوسيلة</th>
              <th className={thClass}>السعر (ر.س)</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {transports.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={row.description}
                    onChange={(e) => updateTransport(row.id, { description: e.target.value })}
                    className={cellInputClass}
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <input
                    value={row.mode}
                    onChange={(e) => updateTransport(row.id, { mode: e.target.value })}
                    placeholder="سيارة / قطار..."
                    className={cellInputClass}
                  />
                </td>
                <td className="border-l border-slate-100 p-0">
                  <PriceInput
                    value={row.price}
                    onChange={(v) => updateTransport(row.id, { price: v })}
                  />
                </td>
                <td className="border-l border-slate-100 p-1 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      removeRow(transports, setTransports, row.id, createEmptyTransportProposal)
                    }
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ProposalSection>

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#8A6B2A] to-[#C9A84C] px-6 py-3 text-sm font-black text-[#1C4532] shadow-md disabled:opacity-60 sm:w-auto sm:py-4"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            جاري الحفظ...
          </>
        ) : (
          <>
            <Save size={18} aria-hidden />
            {isEditMode ? 'تحديث عرض السعر' : 'حفظ عرض السعر'}
          </>
        )}
      </button>
    </div>
  );
}

function ProposalSection({
  title,
  icon,
  onAdd,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`${cardClass} mb-5`}>
      <div className="mb-3 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black text-[#1C4532] sm:text-base">
          {icon}
          {title}
        </h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-[#C9A84C]/40 bg-[#FEFDF9] px-3 py-1.5 text-[10px] font-black text-[#1C4532] hover:bg-amber-50"
        >
          <Plus size={12} aria-hidden />
          صف جديد
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">{children}</div>
    </section>
  );
}
