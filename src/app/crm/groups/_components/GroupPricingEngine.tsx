'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calculator,
  Users,
  Moon,
  DollarSign,
  TrendingUp,
  FileText,
  Save,
  Link as LinkIcon,
  Download,
  AlertCircle,
  Loader2,
  X,
  Hotel,
  Plus,
  Trash2,
} from 'lucide-react';

import { toast } from '@/lib/crm-toast';
import {
  calculateHotelsGroupTotal,
  createEmptyHotelItem,
  parseDirectCosts,
  parseFixedCosts,
  resolveHotelsFromRow,
  sanitizeGroupPricingPayload,
  type GroupPricingDirectCosts,
  type GroupPricingFixedCosts,
  type GroupPricingHotelItem,
  type GroupPricingPayload,
  type GroupPricingRow,
} from '@/lib/group-pricings';
import { supabase } from '@/lib/supabase';

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-base font-extrabold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#D4AF37]';

/**
 * Labels sit on light cards above light inputs.
 * print: forces pitch-black on white paper so labels never fade out.
 */
const labelClass =
  'outside-label gp-label mb-1.5 block text-sm font-extrabold tracking-wide text-slate-800 print:text-slate-950 print:font-extrabold';

/** Helper / subtext under fields — screen muted; print pitch-black + extrabold */
const hintClass =
  'subtext-grey gp-hint subtext mt-1 block text-xs font-semibold text-slate-500 print:text-slate-900 print:font-extrabold print:opacity-100';

/** Applied while `group-pricing-printing` — beats faded utility classes in PDF */
const HINT_PRINT_INK = {
  color: '#000000',
  fontWeight: 'bold' as const,
  opacity: 1,
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function GroupPricingEngine() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pricingIdParam = searchParams.get('pricingId')?.trim() || '';

  const [passengersCount, setPassengersCount] = useState<number>(12);
  const [nightsCount, setNightsCount] = useState<number>(7);
  const [isPrinting, setIsPrinting] = useState(false);
  const hintInkStyle = isPrinting ? HINT_PRINT_INK : undefined;

  const [hotels, setHotels] = useState<GroupPricingHotelItem[]>(() => [
    createEmptyHotelItem(7),
  ]);

  const [directCosts, setDirectCosts] = useState<
    Omit<GroupPricingDirectCosts, 'hotel' | 'hotels'>
  >({
    flight: 1800,
    activities: 1200,
    meals: 800,
  });

  const [fixedCosts, setFixedCosts] = useState<GroupPricingFixedCosts>({
    leader: 6000,
    expert: 4000,
    marketing: 3000,
    contingency: 2000,
  });

  const [profitMargin, setProfitMargin] = useState<number>(30);
  const [manualSellingPrice, setManualSellingPrice] = useState<number | null>(null);

  const [savedPricingId, setSavedPricingId] = useState<string | null>(null);
  const [itineraryName, setItineraryName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);

  const [loadingPricing, setLoadingPricing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const handleDirectCostChange = (
    field: keyof Omit<GroupPricingDirectCosts, 'hotel' | 'hotels'>,
    value: number,
  ) => {
    setDirectCosts((prev) => ({ ...prev, [field]: Math.max(0, value) }));
  };

  const handleFixedCostChange = (field: keyof GroupPricingFixedCosts, value: number) => {
    setFixedCosts((prev) => ({ ...prev, [field]: Math.max(0, value) }));
  };

  const updateHotel = (id: string, patch: Partial<GroupPricingHotelItem>) => {
    setHotels((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  };

  const hotelEngine = useMemo(
    () => calculateHotelsGroupTotal(hotels, passengersCount),
    [hotels, passengersCount],
  );

  const calculations = useMemo(() => {
    const validPassengers = Math.max(1, passengersCount);

    const hotelAvgPerPassenger = hotelEngine.hotelAvgPerPassenger;
    const nonHotelDirectPerPassenger =
      directCosts.flight + directCosts.activities + directCosts.meals;
    const totalDirectCostPerPassenger = hotelAvgPerPassenger + nonHotelDirectPerPassenger;
    const totalDirectGroupCost =
      hotelEngine.hotelGroupTotal + nonHotelDirectPerPassenger * validPassengers;

    const totalGroupFixedCosts =
      fixedCosts.leader + fixedCosts.expert + fixedCosts.marketing + fixedCosts.contingency;
    const fixedCostSharePerPassenger = totalGroupFixedCosts / validPassengers;

    const totalBaseCostPerPassenger = totalDirectCostPerPassenger + fixedCostSharePerPassenger;

    let finalSellingPricePerPassenger = 0;
    let effectiveMargin = profitMargin;

    if (manualSellingPrice !== null) {
      finalSellingPricePerPassenger = manualSellingPrice;
      if (finalSellingPricePerPassenger > 0) {
        effectiveMargin =
          ((finalSellingPricePerPassenger - totalBaseCostPerPassenger) /
            finalSellingPricePerPassenger) *
          100;
      } else {
        effectiveMargin = 0;
      }
    } else {
      const marginDecimal = profitMargin / 100;
      finalSellingPricePerPassenger =
        marginDecimal < 1
          ? totalBaseCostPerPassenger / (1 - marginDecimal)
          : totalBaseCostPerPassenger;
    }

    const netProfitPerPassenger = finalSellingPricePerPassenger - totalBaseCostPerPassenger;
    const totalGroupRevenue = finalSellingPricePerPassenger * validPassengers;
    const totalGroupNetProfit = netProfitPerPassenger * validPassengers;

    return {
      hotelAvgPerPassenger,
      hotelGroupTotal: hotelEngine.hotelGroupTotal,
      hotelBreakdowns: hotelEngine.breakdowns,
      hotelWarnings: hotelEngine.warnings,
      totalDirectCostPerPassenger,
      totalDirectGroupCost,
      totalGroupFixedCosts,
      fixedCostSharePerPassenger,
      totalBaseCostPerPassenger,
      finalSellingPricePerPassenger,
      effectiveMargin,
      netProfitPerPassenger,
      totalGroupRevenue,
      totalGroupNetProfit,
    };
  }, [passengersCount, directCosts, fixedCosts, profitMargin, manualSellingPrice, hotelEngine]);

  const buildPayload = useCallback((): GroupPricingPayload => {
    const pax = Math.max(1, passengersCount);
    const itinLabel = itineraryName.trim();
    const leaderLabel = leaderName.trim();
    const raw = {
      title: itinLabel
        ? `تسعير قروب — ${itinLabel}`
        : `تسعير قروب (${pax} مسافر)`,
      passengers_count: pax,
      nights_count: Math.max(1, nightsCount),
      direct_costs: {
        hotel: roundMoney(calculations.hotelAvgPerPassenger),
        flight: directCosts.flight,
        activities: directCosts.activities,
        meals: directCosts.meals,
      },
      fixed_costs: fixedCosts,
      hotels_breakdown: hotels,
      profit_margin: roundMoney(profitMargin),
      effective_margin: roundMoney(calculations.effectiveMargin || profitMargin),
      manual_selling_price: manualSellingPrice,
      final_selling_price_per_pax: roundMoney(
        calculations.finalSellingPricePerPassenger || 0,
      ),
      total_group_revenue: roundMoney(calculations.totalGroupRevenue || 0),
      total_group_net_profit: roundMoney(calculations.totalGroupNetProfit || 0),
      updated_at: new Date().toISOString(),
      ...(itinLabel ? { itinerary_name: itinLabel } : {}),
      ...(leaderLabel ? { leader_name: leaderLabel } : {}),
    };

    return sanitizeGroupPricingPayload(raw);
  }, [
    passengersCount,
    nightsCount,
    directCosts,
    hotels,
    fixedCosts,
    profitMargin,
    manualSellingPrice,
    calculations,
    itineraryName,
    leaderName,
  ]);

  const hydrateFromRow = useCallback((row: GroupPricingRow) => {
    setSavedPricingId(row.id);
    const nights = Math.max(1, Number(row.nights_count) || 7);
    setPassengersCount(Math.max(1, Number(row.passengers_count) || 1));
    setNightsCount(nights);

    const parsedDirect = parseDirectCosts(row.direct_costs, nights);
    setHotels(resolveHotelsFromRow(row));
    setDirectCosts({
      flight: parsedDirect.flight,
      activities: parsedDirect.activities,
      meals: parsedDirect.meals,
    });
    setFixedCosts(parseFixedCosts(row.fixed_costs));

    const margin = Number(row.profit_margin);
    setProfitMargin(Number.isFinite(margin) ? margin : 30);

    const manual = row.manual_selling_price;
    if (manual != null && Number.isFinite(Number(manual))) {
      setManualSellingPrice(Number(manual));
    } else {
      setManualSellingPrice(null);
    }

    setItineraryName(String(row.itinerary_name ?? '').trim());
    setLeaderName(String(row.leader_name ?? '').trim());
  }, []);

  // Load saved pricing when ?pricingId= is present
  useEffect(() => {
    if (!pricingIdParam) return;

    let cancelled = false;
    setLoadingPricing(true);

    void (async () => {
      const { data, error } = await supabase
        .from('group_pricings')
        .select('*')
        .eq('id', pricingIdParam)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        toast.error(`تعذر تحميل التسعير: ${error.message}`);
        setLoadingPricing(false);
        return;
      }

      if (!data) {
        toast.error('لم يتم العثور على سجل التسعير المطلوب.');
        setLoadingPricing(false);
        return;
      }

      hydrateFromRow(data as GroupPricingRow);
      toast.success('تم تحميل التسعير المحفوظ.');
      setLoadingPricing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pricingIdParam, hydrateFromRow]);

  const handleMarginChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = parseFloat(e.target.value) || 0;
    setProfitMargin(val);
    setManualSellingPrice(null);
  };

  const handleSellingPriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? null : parseFloat(e.target.value);
    setManualSellingPrice(Number.isFinite(val as number) ? val : null);
  };

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      const payload = sanitizeGroupPricingPayload(
        buildPayload() as unknown as Record<string, unknown>,
      );

      console.log('group_pricings sanitized payload:', payload);

      const result = savedPricingId
        ? await supabase
            .from('group_pricings')
            .update(payload)
            .eq('id', savedPricingId)
            .select()
        : await supabase.from('group_pricings').insert([payload]).select();

      console.log('Supabase Direct Response:', result);

      const { data, error } = result;

      if (error) {
        console.error('Supabase Save Error:', error);
        toast.error(`خطأ Supabase: ${error.message}`);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const id = String((row as { id?: string } | null)?.id ?? savedPricingId ?? '');
      if (id) {
        setSavedPricingId(id);
        router.replace(`/crm/groups/pricing?pricingId=${encodeURIComponent(id)}`);
      }

      toast.success('تم حفظ التسعير الرسمي بنجاح في قاعدة البيانات! 🚀');
    } catch (err: unknown) {
      console.error('Save Exception:', err);
      toast.error('حدث خطأ أثناء حفظ البيانات.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = () => {
    toast.dismiss();
    setIsPrinting(true);
    document.body.classList.add('group-pricing-printing');
    const cleanup = () => {
      document.body.classList.remove('group-pricing-printing');
      setIsPrinting(false);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Keep class during print dialog; clean up afterwards (and as a safety fallback)
    window.setTimeout(() => {
      // afterprint usually fires first; this is a backup only
      if (document.body.classList.contains('group-pricing-printing')) {
        cleanup();
      }
    }, 60_000);
    // Allow React to paint HINT_PRINT_INK before the print dialog opens
    window.setTimeout(() => window.print(), 50);
  };

  const handleLinkToItinerary = async () => {
    const itinLabel = itineraryName.trim();
    const leaderLabel = leaderName.trim();
    if (!itinLabel && !leaderLabel) {
      toast.error('أدخل اسم المسار أو اسم القائد / العميل للربط.');
      return;
    }

    setLinking(true);
    try {
      const payload = buildPayload();

      if (savedPricingId) {
        const patch: Record<string, unknown> = {
          title: payload.title,
          itinerary_name: itinLabel || null,
          leader_name: leaderLabel || null,
          updated_at: new Date().toISOString(),
        };

        let { error } = await supabase
          .from('group_pricings')
          .update(patch)
          .eq('id', savedPricingId);

        // Older DBs may lack the text columns — fall back to title-only
        if (error && /itinerary_name|leader_name/i.test(error.message)) {
          ({ error } = await supabase
            .from('group_pricings')
            .update({
              title: payload.title,
              updated_at: patch.updated_at,
            })
            .eq('id', savedPricingId));
        }

        if (error) throw error;
      } else {
        let { data, error } = await supabase
          .from('group_pricings')
          .insert(payload)
          .select('id')
          .single();

        if (error && /itinerary_name|leader_name/i.test(error.message)) {
          const {
            itinerary_name: _i,
            leader_name: _l,
            ...withoutNames
          } = payload;
          ({ data, error } = await supabase
            .from('group_pricings')
            .insert(withoutNames)
            .select('id')
            .single());
        }

        if (error) throw error;
        const id = String(data.id);
        setSavedPricingId(id);
        router.replace(`/crm/groups/pricing?pricingId=${encodeURIComponent(id)}`);
      }

      toast.success('تم حفظ بيانات الربط بنجاح.');
      setLinkPanelOpen(false);
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
            ? err.message
            : 'خطأ غير معروف';
      toast.error(`تعذر الربط: ${message}`);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="print-container group-pricing-print-root w-full min-h-screen space-y-8 bg-[#f8fafc] p-6 font-sans text-slate-800 sm:p-8">
      <div className="print-report-header flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="no-print rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-3 text-[#b8952d]">
            <Calculator className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              تقرير تسعير القروب المالي
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500 print:text-slate-800 print:font-semibold">
              Wanderloom Executive Pricing Report — ملخص التكاليف والهامش والإيرادات
            </p>
            <p className="mt-1 hidden text-xs text-slate-500 print:block print:text-slate-800 print:font-semibold">
              تاريخ التصدير: {new Date().toLocaleString('ar-SA')}
              {savedPricingId ? ` · معرف التسعير: ${savedPricingId}` : ''}
            </p>
            {savedPricingId ? (
              <p className="mt-1 font-mono text-[11px] text-slate-500 print:hidden">
                معرف التسعير: {savedPricingId}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 no-print print:hidden">
          {loadingPricing ? (
            <span className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
              جاري تحميل التسعير…
            </span>
          ) : null}
            <button
            type="button"
            onClick={() => {
              setSavedPricingId(null);
              setManualSellingPrice(null);
              setItineraryName('');
              setLeaderName('');
              setHotels([createEmptyHotelItem(nightsCount)]);
              setDirectCosts({ flight: 1800, activities: 1200, meals: 800 });
              router.replace('/crm/groups/pricing');
              toast.success('مسودة تسعير جديدة — جاهزة للتعبئة.');
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200"
          >
            <FileText className="h-4 w-4 text-[#b8952d]" />
            مسودة تسعير
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="print-card mb-6 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-extrabold text-slate-900">
            <Users className="h-5 w-5 text-[#b8952d]" />
            <h2>1. بيانات الرحلة والركاب</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>
                عدد المسافرين بالقروب (Pax)
              </label>
              <input
                type="number"
                min={1}
                value={passengersCount}
                onChange={(e) =>
                  setPassengersCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-lg font-extrabold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label className={labelClass}>عدد الليالي</label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={nightsCount}
                  onChange={(e) =>
                    setNightsCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-lg font-extrabold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#D4AF37]"
                />
                <Moon className="absolute left-4 top-3.5 h-5 w-5 text-[#b8952d]" />
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-700 print:text-slate-900">
              <p className="flex justify-between font-semibold print:text-slate-950 print:font-extrabold">
                <span className="print:text-slate-950 print:font-extrabold">
                  تأثير حجم القروب:
                </span>
                <span className="text-emerald-600 print:text-emerald-800 print:font-bold">
                  توزيع الثوابت التلقائي
                </span>
              </p>
              <p className={hintClass} style={hintInkStyle}>
                زيادة عدد الركاب تقلل من حصة الفرد في التكاليف الثابتة وتزيد الربحية.
              </p>
            </div>
          </div>
        </div>

        <div className="print-card mb-6 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <Hotel className="h-5 w-5 text-[#b8952d]" />
              <h2>2. محرك التسعير الفندقي VIP (سعر موحّد + خدمات مخصصة)</h2>
            </div>
            <button
              type="button"
              onClick={() => setHotels((prev) => [...prev, createEmptyHotelItem(nightsCount)])}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-[#b8952d] transition hover:bg-slate-200 print:hidden"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة فندق
            </button>
          </div>

          <p
            className="subtext text-xs font-semibold text-slate-600 print:text-slate-900 print:font-extrabold print:opacity-100"
            style={hintInkStyle}
          >
            كل مسافر يُحاسب بسعر الغرفة الكامل لليلة — دون تقسيم على الشاغلين. الغرف المشتركة تُستخدم
            فقط لحساب عدد الغرف الفعلية، مع إضافة خدمات VIP مخصصة عند التفعيل.
          </p>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {hotels.map((hotel, index) => {
              const breakdown = calculations.hotelBreakdowns[index];
              return (
                <div
                  key={hotel.id}
                  className="hotel-card space-y-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <label className={labelClass}>
                        اسم الفندق
                      </label>
                      <input
                        type="text"
                        value={hotel.name}
                        onChange={(e) => updateHotel(hotel.id, { name: e.target.value })}
                        className={fieldClass}
                      />
                    </div>
                    {hotels.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setHotels((prev) => prev.filter((h) => h.id !== hotel.id))
                        }
                        className="mt-6 rounded-lg border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50"
                        aria-label="حذف الفندق"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>
                        عدد الليالي
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={hotel.nightsCount}
                        onChange={(e) =>
                          updateHotel(hotel.id, {
                            nightsCount: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        السعر الموحّد للغرفة / مسافر / ليلة
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={hotel.unifiedBaseRoomRate}
                        onChange={(e) =>
                          updateHotel(hotel.id, {
                            unifiedBaseRoomRate: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className={fieldClass}
                      />
                        <span className={hintClass} style={hintInkStyle}>
                          يُحسب كاملاً لكل مسافر — لا يُقسَّم عند المشاركة
                        </span>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={hotel.hasSharedAllocations}
                      onChange={(e) =>
                        updateHotel(hotel.id, { hasSharedAllocations: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#D4AF37]"
                    />
                    <span className="text-xs font-bold text-slate-800 print:text-slate-900 print:font-bold">
                      تفعيل تخصيص الغرف المشتركة (لحساب الإشغال فقط — Double/Twin)
                    </span>
                  </label>

                  {hotel.hasSharedAllocations ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>
                          عدد الغرف المشتركة (Double / Twin)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={hotel.doubleRoomsCount}
                          onChange={(e) =>
                            updateHotel(hotel.id, {
                              doubleRoomsCount: Math.max(
                                0,
                                Math.floor(parseFloat(e.target.value) || 0),
                              ),
                            })
                          }
                          className={fieldClass}
                        />
                        <span className={hintClass} style={hintInkStyle}>
                          كل غرفة تتسع لمسافرَين — للإشغال الفعلي فقط، دون تقسيم السعر
                        </span>
                      </div>
                      <div>
                        <label className={labelClass}>
                          إجمالي خدمات VIP المخصصة للمشاركين
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={hotel.customVipServicesTotalCost}
                          onChange={(e) =>
                            updateHotel(hotel.id, {
                              customVipServicesTotalCost: Math.max(
                                0,
                                parseFloat(e.target.value) || 0,
                              ),
                            })
                          }
                          className={fieldClass}
                        />
                        <span className={hintClass} style={hintInkStyle}>
                          عشاء خاص، فعاليات، إعداد VIP… (إجمالي وليس لكل غرفة)
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {breakdown ? (
                    <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-600 print:text-slate-900 print:font-semibold">
                      <div className="flex justify-between print:text-slate-900 print:font-bold">
                        <span>
                          تسعير موحّد ({passengersCount} مسافر × {hotel.nightsCount} ليلة):
                        </span>
                        <span className="font-semibold text-slate-900 print:text-slate-950 print:font-bold">
                          {breakdown.unifiedRoomCost.toLocaleString()} ر.س
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 print:text-slate-900 print:font-bold">
                        <span>الغرف الفعلية المطلوبة:</span>
                        <span className="font-semibold text-slate-800 print:text-slate-900 print:font-bold">
                          {breakdown.physicalRoomsTotal} غرفة ({breakdown.singleRooms} فردية
                          {breakdown.doubleRooms > 0
                            ? ` + ${breakdown.doubleRooms} مشتركة`
                            : ''}
                          )
                        </span>
                      </div>
                      {hotel.hasSharedAllocations ? (
                        <>
                          <div className="flex justify-between print:text-slate-900 print:font-bold">
                            <span>
                              مسافرو الغرف المشتركة ({breakdown.doubleRooms} غرفة ·{' '}
                              {breakdown.sharedPax} مسافر):
                            </span>
                            <span className="font-semibold text-slate-600 print:text-slate-800 print:font-semibold">
                              إشغال فقط
                            </span>
                          </div>
                          <div className="flex justify-between print:text-slate-900 print:font-bold">
                            <span>خدمات VIP المخصصة:</span>
                            <span className="font-semibold text-[#D4AF37]">
                              {breakdown.vipServicesCost.toLocaleString()} ر.س
                            </span>
                          </div>
                        </>
                      ) : null}
                      <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-[#b8952d]">
                        <span>إجمالي هذا الفندق:</span>
                        <span>{breakdown.hotelTotal.toLocaleString()} ر.س</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {calculations.hotelWarnings.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {calculations.hotelWarnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-3 text-xs">
            <div className="flex justify-between gap-6 text-slate-600 print:text-slate-900 print:font-bold">
              <span>إجمالي الفنادق للقروب:</span>
              <span className="font-bold text-slate-900 print:text-slate-950">
                {calculations.hotelGroupTotal.toLocaleString()} ر.س
              </span>
            </div>
            <div className="flex justify-between gap-6 text-[#b8952d] print:font-bold">
              <span>متوسط الفندق للفرد (بعد التوزيع الحقيقي):</span>
              <span className="font-bold">
                {calculations.hotelAvgPerPassenger.toFixed(2)} ر.س
              </span>
            </div>
          </div>
        </div>

        {/* ================= CARD 2b: Other Direct Costs ================= */}
        <div className="print-card mb-6 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <DollarSign className="h-5 w-5 text-[#b8952d]" />
              <h2>2ب. باقي التكاليف المباشرة لكل فرد</h2>
            </div>
          </div>

          <div className="space-y-3.5">
            {(
              [
                ['flight', 'الطيران والتنقلات (لكل فرد)'],
                ['activities', 'الفعاليات والتجارب (لكل فرد)'],
                ['meals', 'الوجبات والخدمات الجانبية (لكل فرد)'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className={labelClass}>{label}</label>
                <input
                  type="number"
                  value={directCosts[field]}
                  onChange={(e) =>
                    handleDirectCostChange(field, parseFloat(e.target.value) || 0)
                  }
                  className={fieldClass}
                />
              </div>
            ))}

            <div className="space-y-1 border-t border-slate-200 pt-3">
              <div className="flex justify-between text-xs text-slate-600 print:text-slate-900 print:font-bold">
                <span>إجمالي المباشر للفرد (شامل الفندق المحسوب):</span>
                <span className="font-bold text-slate-900 print:text-slate-950">
                  {calculations.totalDirectCostPerPassenger.toLocaleString()} ر.س
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 print:text-slate-900 print:font-bold">
                <span>إجمالي المباشر للقروب كامل:</span>
                <span className="font-semibold text-slate-800 print:text-slate-900 print:font-bold">
                  {calculations.totalDirectGroupCost.toLocaleString()} ر.س
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="print-card mb-6 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-extrabold text-slate-900">
            <TrendingUp className="h-5 w-5 text-[#b8952d]" />
            <h2>3. التكاليف الثابتة للقروب</h2>
          </div>

          <div className="space-y-3.5">
            {(
              [
                ['leader', 'أتعاب وتكلفة الليدر (الإقامة/اليومية)'],
                ['expert', 'أتعاب الخبير السياحي'],
                ['marketing', 'ميزانية التسويق والمشهور'],
                ['contingency', 'احتياطي الطوارئ واللوجستيات'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className={labelClass}>{label}</label>
                <input
                  type="number"
                  value={fixedCosts[field]}
                  onChange={(e) =>
                    handleFixedCostChange(field, parseFloat(e.target.value) || 0)
                  }
                  className={fieldClass}
                />
              </div>
            ))}

            <div className="space-y-1 border-t border-slate-200 pt-3">
              <div className="flex justify-between text-xs text-slate-600 print:text-slate-900 print:font-bold">
                <span>إجمالي الثوابت للقروب:</span>
                <span className="font-bold text-slate-900 print:text-slate-950">
                  {calculations.totalGroupFixedCosts.toLocaleString()} ر.س
                </span>
              </div>
              <div className="flex justify-between text-xs text-[#b8952d] print:font-bold">
                <span>حصة الفرد الواحدة من الثوابت:</span>
                <span className="font-bold">
                  {calculations.fixedCostSharePerPassenger.toFixed(2)} ر.س
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="print-card mb-6 space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <Calculator className="h-5 w-5 text-[#b8952d]" />
              <h2>4. هندسة المكسب وسعر البيع (Two-Way Engine)</h2>
            </div>
            <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700 print:text-slate-900">
              تفاعلي ثنائي
            </span>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex justify-between text-xs font-bold text-slate-700 print:text-slate-950 print:font-extrabold">
              <span>التكلفة الإجمالية الأساسية للفرد (المباشرة + حصة الثوابت):</span>
            </div>
            <p className="text-xl font-bold text-slate-900 print:text-slate-950">
              {calculations.totalBaseCostPerPassenger.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-500 print:text-slate-800 print:font-semibold">
                ر.س / فرد
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                نسبة ربح واندرلوم المستهدفة (%)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={profitMargin}
                  onChange={handleMarginChange}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-base font-extrabold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#D4AF37]"
                />
                <select
                  value={profitMargin}
                  onChange={handleMarginChange}
                  className="cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  <option value={15}>15%</option>
                  <option value={20}>20%</option>
                  <option value={25}>25%</option>
                  <option value={30}>30%</option>
                  <option value={35}>35%</option>
                  <option value={40}>40%</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                سعر البيع النهائي للفرد (يدوي)
              </label>
              <input
                type="number"
                placeholder={calculations.finalSellingPricePerPassenger.toFixed(0)}
                value={manualSellingPrice ?? ''}
                onChange={handleSellingPriceChange}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-base font-extrabold text-slate-900 outline-none transition-all focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#D4AF37]"
              />
              <span className={hintClass} style={hintInkStyle}>
                تعديل هذا الرقم يحسب نسبة الربح تلقائياً.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <span className="block text-xs font-bold text-slate-600 print:text-slate-950 print:font-extrabold">
                نسبة الربح المحققة الفعلية:
              </span>
              <span className="text-lg font-bold text-emerald-600 print:text-emerald-800">
                {calculations.effectiveMargin.toFixed(1)}%
              </span>
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold text-slate-600 print:text-slate-950 print:font-extrabold">
                صافي مكسب الفرد الواحدة:
              </span>
              <span className="text-lg font-bold text-[#D4AF37]">
                +{calculations.netProfitPerPassenger.toFixed(2)} ر.س
              </span>
            </div>
          </div>
        </div>

        <div className="summary-card flex flex-col justify-between print-card mb-6 space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-extrabold text-slate-900">
              <TrendingUp className="h-5 w-5 text-[#b8952d]" />
              <h2>5. الملخص التنفيذي للقروب (Executive Summary)</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="summary-box rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="mb-1 block text-xs font-bold tracking-wide text-slate-500 print:text-slate-950 print:font-extrabold">
                إجمالي إيراد القروب الكلي:
              </span>
                <p className="text-xl font-extrabold text-slate-900 print:text-slate-950">
                  {calculations.totalGroupRevenue.toLocaleString('ar-SA', {
                    maximumFractionDigits: 0,
                  })}{' '}
                  <span className="text-xs font-normal text-slate-500 print:text-slate-800 print:font-semibold">
                    ر.س
                  </span>
                </p>
              </div>

              <div className="summary-box rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-4">
              <span className="mb-1 block text-xs font-bold tracking-wide text-slate-500 print:text-slate-950 print:font-extrabold">
                إجمالي صافي ربح واندرلوم:
              </span>
                <p className="text-2xl font-black text-[#D4AF37]">
                  +
                  {calculations.totalGroupNetProfit.toLocaleString('ar-SA', {
                    maximumFractionDigits: 0,
                  })}{' '}
                  <span className="text-xs font-normal text-slate-600 print:text-slate-800 print:font-semibold">
                    ر.س
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-2">
              <div className="flex justify-between text-xs text-slate-600 print:text-slate-900 print:font-bold">
                <span>سعر البيع النهائي لكل مسافر:</span>
                <span className="font-bold text-[#D4AF37]">
                  {calculations.finalSellingPricePerPassenger.toFixed(2)} ر.س
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 print:text-slate-900 print:font-bold">
                <span>نقطة التعادل للقروب (Break-Even Cost):</span>
                <span>
                  {(calculations.totalBaseCostPerPassenger * passengersCount).toLocaleString()} ر.س
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 print:text-slate-800 print:font-semibold">
                <span>مدة الرحلة:</span>
                <span>{nightsCount} ليلة</span>
              </div>
              {(itineraryName.trim() || leaderName.trim()) && (
                <div className="flex justify-between gap-2 text-xs text-emerald-700 print:text-emerald-800 print:font-bold">
                  <span>الربط الحالي:</span>
                  <span className="text-left font-semibold">
                    {[
                      itineraryName.trim() || null,
                      leaderName.trim() || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 print:border-amber-700 print:bg-amber-50 print:text-amber-950">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>الحسابات لحظية — احفظ التسعير لتثبيته في قاعدة البيانات.</span>
          </div>
        </div>
      </div>

      {linkPanelOpen ? (
        <div className="mb-6 space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm print:hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <LinkIcon className="h-5 w-5 text-[#b8952d]" />
              <h2>ربط التسعير بمسار أو ليدر / عميل</h2>
            </div>
            <button
              type="button"
              onClick={() => setLinkPanelOpen(false)}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="my-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">
                اسم / وصف مسار الرحلة
              </label>
              <input
                type="text"
                placeholder="مثال: مسار اليابان الساحرة (طوكيو وكيوتو)"
                value={itineraryName}
                onChange={(e) => setItineraryName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-extrabold text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">
                اسم قائد القروب / العميل
              </label>
              <input
                type="text"
                placeholder="مثال: عبدالرحمن الشهري (قائد الرحلة)"
                value={leaderName}
                onChange={(e) => setLeaderName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-extrabold text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setLinkPanelOpen(false)}
              className="rounded-xl border border-slate-200/80 bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => void handleLinkToItinerary()}
              disabled={linking}
              className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-[#B8952B] disabled:opacity-60"
            >
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
              تأكيد الربط والحفظ
            </button>
          </div>
        </div>
      ) : null}

      <div className="no-print flex flex-col items-center justify-end gap-4 border-t border-slate-200 pt-6 print:hidden sm:flex-row">
        <button
          type="button"
          onClick={() => setLinkPanelOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-slate-100 px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-200 sm:w-auto"
        >
          <LinkIcon className="h-4 w-4 text-[#b8952d]" />
          ربط بمسار الرحلة (Itinerary)
        </button>

        <button
          type="button"
          onClick={handleExportPDF}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-[#b8952d] shadow-sm transition-all hover:bg-slate-50 sm:w-auto"
        >
          <Download className="h-4 w-4" />
          تصدير التقرير المالي PDF
        </button>

        <button
          type="button"
          onClick={() => void handleSavePricing()}
          disabled={saving || loadingPricing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-8 py-3 font-extrabold text-slate-950 shadow-lg transition-all hover:bg-[#B8952B] active:scale-95 disabled:opacity-60 sm:w-auto"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'جاري الحفظ…' : 'حفظ التسعير الرسمي'}
        </button>
      </div>
    </div>
  );
}
