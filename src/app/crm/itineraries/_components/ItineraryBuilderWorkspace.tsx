'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowRight, Award, CalendarDays, CloudSun, Crown, Globe, Key, Loader2, MapPin, MessageCircle, Plus, Save, Sparkles, UserRound, Users } from 'lucide-react';
import Link from 'next/link';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import { resolveVipDestinationStoredValue } from '@/lib/vip-destination-countries';
import { FeaturesAchievementsModal } from '@/app/crm/itineraries/_components/FeaturesAchievementsModal';
import { supabase } from '@/lib/supabase';
import {
  buildVipPortalWhatsAppUrl,
  normalizeWhatsAppPhoneDigits,
  resolveItineraryPortalPin,
} from '@/lib/vip-portal-share';
import {
  CRM_CLIENTS_LIST_SELECT,
  ITINERARY_CLIENT_JOIN_SELECT,
  mergeClientIntoList,
  parseJoinedCrmClient,
  resolveClientPhone,
  resolveItineraryClientId,
  type CrmClientMini,
} from '@/lib/itinerary-client-crm';
import ItineraryBuilderDaysPanel from '@/app/crm/itineraries/_components/ItineraryBuilderDaysPanel';
import {
  buildItinerarySupabasePayload,
  buildVipClientSummaryPatch,
  stripItineraryPayloadForSchemaError,
  createEmptyDay,
  createInitialItineraryDraft,
  draftFromItineraryRow,
  draftFromTemplate,
  newLocalId,
  type ItineraryDraft,
} from '@/lib/itinerary-builder-model';
import { parseDaysDataFromRow } from '@/lib/public-itinerary';

type ItineraryBuilderWorkspaceProps = {
  itineraryId?: string;
};
type ClientMini = CrmClientMini;
type TemplateRow = Record<string, unknown> & { id: number | string; title?: string | null };

const vipCardClass =
  'rounded-[1.25rem] border border-amber-500/20 bg-gradient-to-b from-[#0f1c35] via-[#0a1428] to-[#060b14] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-amber-400/10';
const cardClass = vipCardClass;

/** تسميات قراءة فوق خلفية الكرت الداكن (لوحة التحكم) */
const labelOnDarkClass = 'mb-1 block text-xs font-bold text-gray-100';
/** تسميات ذهبية — مركز القيادة والميزانية */
const goldLabelClass = 'mb-1 block text-xs font-bold text-[#D4AF37]';
const commandPanelClass = 'rounded-2xl border border-amber-500/20 bg-[#060b14]/70 p-5 ring-1 ring-amber-400/10';
/** حقول إدخال واضحة التباين (WCAG-friendly) */
const contrastInputClass =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300/60';

function parseEmployeeIdForPayload(employeeId: string | undefined): number | null {
  if (employeeId == null || !/^\d+$/.test(employeeId)) return null;
  return Number(employeeId);
}

export default function ItineraryBuilderWorkspace({ itineraryId }: ItineraryBuilderWorkspaceProps) {
  const { employee } = useCrmEmployee();
  const isEditMode = Boolean(itineraryId?.trim());
  const editId = itineraryId?.trim() ?? '';

  const [draft, setDraft] = useState<ItineraryDraft>(createInitialItineraryDraft);
  const patchDraft = (patch: Partial<ItineraryDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const [clients, setClients] = useState<ClientMini[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadingItinerary, setLoadingItinerary] = useState(isEditMode);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [magicLink, setMagicLink] = useState('');
  const [savedTripPin, setSavedTripPin] = useState('');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const pinnedClientRef = useRef<CrmClientMini | null>(null);

  useEffect(() => {
    async function loadLibrary() {
      if (!supabase) {
        setLoadingLibrary(false);
        setNotice('قاعدة البيانات غير مهيأة. أضف مفاتيح Supabase في البيئة.');
        return;
      }
      setLoadingLibrary(true);
      setNotice(null);
      try {
        const [{ data: templatesData, error: templatesError }, { data: clientsData, error: clientsError }] =
          await Promise.all([
          supabase
            .from('itineraries')
            .select(
              'id, title, customer_name, days_data, include_wardrobe, unlock_secret_guide, budget_options, flight_details, weather_temp, highlights, hotel_details, experiences_details, destination, destination_story, taxi_phrase, secret_gem, local_lingo, weather_summary, packing_summary, budget_summary, flight_summary',
            )
            .eq('is_template', true)
            .order('created_at', { ascending: false }),
          supabase.from('clients').select(CRM_CLIENTS_LIST_SELECT).order('name', { ascending: true }),
        });

        if (clientsError) {
          console.warn('[builder] clients:', clientsError);
        }
        if (templatesError) {
          console.error(templatesError);
          setNotice('تعذر تحميل القوالب الجاهزة. تأكد من وجود العمود is_template في itineraries.');
        }
        const loadedClients = (clientsData ?? []) as ClientMini[];
        setClients(
          pinnedClientRef.current
            ? mergeClientIntoList(loadedClients, pinnedClientRef.current)
            : loadedClients,
        );
        setTemplates((templatesData ?? []) as TemplateRow[]);
      } catch (error) {
        console.error(error);
        setNotice('تعذر تحميل مكتبة البيانات. راجع إعدادات Supabase أو صلاحيات الجداول.');
      } finally {
        setLoadingLibrary(false);
      }
    }
    loadLibrary();
  }, []);

  useEffect(() => {
    if (!isEditMode || !editId) {
      setLoadingItinerary(false);
      return;
    }
    if (!supabase) {
      setFetchError('قاعدة البيانات غير مهيأة.');
      setLoadingItinerary(false);
      return;
    }

    let cancelled = false;
    const queryId = /^\d+$/.test(editId) ? Number(editId) : editId;

    async function fetchItinerary() {
      setLoadingItinerary(true);
      setFetchError(null);
      try {
        const { data, error } = await supabase!
          .from('itineraries')
          .select(ITINERARY_CLIENT_JOIN_SELECT)
          .eq('id', queryId)
          .maybeSingle();
        if (cancelled) return;

        let row = data as Record<string, unknown> | null;
        if (error || !row) {
          const fallback = await supabase!
            .from('itineraries')
            .select('*')
            .eq('id', queryId)
            .maybeSingle();
          if (cancelled) return;
          if (fallback.error) throw fallback.error;
          if (!fallback.data) {
            setFetchError('لم يُعثر على المسار.');
            return;
          }
          row = fallback.data as Record<string, unknown>;
        }

        const joinedClient = parseJoinedCrmClient(row.client);
        if (joinedClient) {
          pinnedClientRef.current = joinedClient;
          setClients((prev) => mergeClientIntoList(prev, joinedClient));
        }

        const linkedClientId = resolveItineraryClientId(row);
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
        setDraft({
          ...draftFromItineraryRow(row, legacyDays),
          linkedClientId,
        });
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'تعذر تحميل المسار.');
      } finally {
        if (!cancelled) setLoadingItinerary(false);
      }
    }

    void fetchItinerary();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, editId]);

  function addDay() {
    patchDraft({ days: [...draft.days, createEmptyDay(draft.days.length)] });
  }

  async function saveExistingItinerary() {
    if (!supabase || !editId) return;
    if (!draft.customerName.trim() || !draft.title.trim()) {
      setNotice('يرجى إدخال اسم العميل وعنوان الرحلة.');
      return;
    }
    setSaving(true);
    setNotice(null);
    const queryId = /^\d+$/.test(editId) ? Number(editId) : editId;
    const payload = buildItinerarySupabasePayload(draft, {
      employeeId: parseEmployeeIdForPayload(employee?.id),
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
      await supabase.from('itineraries').update(buildVipClientSummaryPatch(draft)).eq('id', queryId);
      setNotice('تم حفظ التعديلات.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'فشل الحفظ.');
    } finally {
      setSaving(false);
    }
  }

  function toggleGroupMember(clientId: number) {
    patchDraft({
      groupMemberIds: draft.groupMemberIds.includes(clientId)
        ? draft.groupMemberIds.filter((x) => x !== clientId)
        : [...draft.groupMemberIds, clientId],
    });
  }

  async function saveAndGenerateLink() {
    if (!supabase) {
      setNotice('قاعدة البيانات غير مهيأة.');
      return;
    }
    if (!draft.customerName.trim() || !draft.title.trim()) {
      setNotice('يرجى إدخال اسم العميل وعنوان الرحلة قبل الحفظ.');
      return;
    }
    if (draft.tripMode === 'Group') {
      if (!draft.groupName.trim()) {
        setNotice('يرجى إدخال اسم القروب عند اختيار نوع الرحلة «قروب».');
        return;
      }
      if (draft.groupMemberIds.length === 0) {
        setNotice('اختر عميلاً واحداً على الأقل من قائمة CRM لربطهم بالقروب.');
        return;
      }
    }

    setSaving(true);
    setNotice(null);
    setShowSaveSuccess(false);
    setSavedTripPin('');

    const payload = buildItinerarySupabasePayload(draft, {
      employeeId: parseEmployeeIdForPayload(employee?.id),
      autoPasscode: !draft.passcode.trim(),
    });
    try {
      let insertRes = await supabase
        .from('itineraries')
        .insert(payload)
        .select('id, magic_link_id, passcode')
        .single();
      if (insertRes.error && /column|schema cache|does not exist/i.test(insertRes.error.message ?? '')) {
        const errMsg = insertRes.error.message ?? '';
        const retryPayload = stripItineraryPayloadForSchemaError(errMsg, payload);
        insertRes = await supabase
          .from('itineraries')
          .insert(retryPayload)
          .select('id, magic_link_id, passcode')
          .single();
      }
      const { data, error } = insertRes;

      if (error) {
        console.error('Itinerary insert failed:', error);
        throw error;
      }

      const itineraryId = data?.id;

      if (itineraryId != null) {
        const summaryPatch = buildVipClientSummaryPatch(draft);
        const { error: summaryErr } = await supabase
          .from('itineraries')
          .update(summaryPatch)
          .eq('id', itineraryId);
        if (summaryErr) {
          console.warn('[builder] VIP summary columns update:', summaryErr.message);
        }
      }
      const memberIds =
        draft.tripMode === 'Group'
          ? [...new Set(draft.groupMemberIds)]
          : draft.linkedClientId && Number.isFinite(Number(draft.linkedClientId))
            ? [Number(draft.linkedClientId)]
            : [];
      if (itineraryId != null && memberIds.length > 0) {
        const rows = memberIds.map((client_id) => ({ itinerary_id: itineraryId, client_id }));
        const { error: memErr } = await supabase.from('itinerary_client_members').insert(rows);
        if (memErr) {
          console.warn('[builder] itinerary_client_members insert:', memErr);
        }
      }

      const slug =
        data?.magic_link_id != null && String(data.magic_link_id).trim() !== ''
          ? String(data.magic_link_id)
          : String(data?.id ?? '');
      setMagicLink(`${window.location.origin}/portal`);
      const pinRow =
        data && typeof data === 'object'
          ? resolveItineraryPortalPin(data as { passcode?: string | null })
          : '';
      setSavedTripPin(pinRow);
      setShowSaveSuccess(true);
      setNotice('تم حفظ الرحلة بنجاح!');
    } catch (error) {
      console.error('Supabase Error:', error);
      const dynamicMessage =
        typeof error === 'object' && error !== null
          ? (error as { message?: string; details?: string; hint?: string; code?: string }).message ||
            (error as { message?: string; details?: string }).details ||
            (error as { hint?: string }).hint ||
            (error as { code?: string }).code
          : null;
      setNotice(dynamicMessage ? `فشل حفظ الرحلة: ${dynamicMessage}` : 'فشل حفظ الرحلة: حدث خطأ غير معروف.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAsTemplate() {
    if (!supabase) {
      setNotice('قاعدة البيانات غير مهيأة.');
      return;
    }
    if (!draft.title.trim()) {
      setNotice('يرجى إدخال عنوان الرحلة قبل حفظها كقالب.');
      return;
    }

    setSaving(true);
    setNotice(null);
    setShowSaveSuccess(false);
    try {
      const payload = buildItinerarySupabasePayload(draft, {
        isTemplate: true,
        employeeId: parseEmployeeIdForPayload(employee?.id),
        autoPasscode: false,
      });
      let insertRes = await supabase
        .from('itineraries')
        .insert(payload)
        .select(
          'id, title, customer_name, days_data, include_wardrobe, unlock_secret_guide, budget_options, flight_details, weather_temp, highlights, hotel_details, experiences_details, destination, destination_story, taxi_phrase, secret_gem, local_lingo, passcode, dates, weather_summary, packing_summary, budget_summary, flight_summary',
        )
        .single();
      if (insertRes.error && /column|schema cache|does not exist/i.test(insertRes.error.message ?? '')) {
        const errMsg = insertRes.error.message ?? '';
        insertRes = await supabase
          .from('itineraries')
          .insert(stripItineraryPayloadForSchemaError(errMsg, payload))
          .select(
            'id, title, customer_name, days_data, include_wardrobe, unlock_secret_guide, budget_options, flight_details, weather_temp, highlights, hotel_details, experiences_details, destination, destination_story, taxi_phrase, secret_gem, local_lingo, passcode, dates, weather_summary, packing_summary, budget_summary, flight_summary',
          )
          .single();
      }
      const { data, error } = insertRes;

      if (error) {
        console.error(error);
        throw error;
      }

      const templateId = data?.id;
      if (templateId != null) {
        const summaryPatch = buildVipClientSummaryPatch(draft);
        const { error: summaryErr } = await supabase
          .from('itineraries')
          .update(summaryPatch)
          .eq('id', templateId);
        if (summaryErr) {
          console.warn('[builder] template VIP summary columns update:', summaryErr.message);
        }
      }

      setTemplates((prev) => [data as TemplateRow, ...prev]);
      setNotice('تم حفظ الرحلة كقالب جاهز بنجاح.');
    } catch (error) {
      console.error(error);
      setNotice('تعذر حفظ القالب. تأكد من وجود عمود is_template في جدول itineraries.');
    } finally {
      setSaving(false);
    }
  }

  function importTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => String(t.id) === templateId);
    if (!template) return;

    const partial = draftFromTemplate(template as Record<string, unknown>);
    const fd = partial.flight;
    if (fd) {
      partial.flight = {
        ...fd,
        destination_flag: resolveVipDestinationStoredValue(fd.destination_flag),
      };
    }
    setDraft((d) => ({ ...d, ...partial }));
    setShowSaveSuccess(false);
    setNotice(`تم استيراد القالب: ${template.title || 'بدون عنوان'}`);
  }

  function handleWhatsAppShare() {
    const pinDisplay = savedTripPin.trim();
    if (!pinDisplay) {
      setNotice('احفظ الرحلة أولاً لتوليد مفتاح الرحلة ومشاركته.');
      return;
    }

    let currentClient: ClientMini | undefined;
    if (draft.tripMode === 'Group' && draft.groupMemberIds.length > 0) {
      const orgId = draft.groupMemberIds[0];
      currentClient = clients.find((c) => String(c.id) === String(orgId));
    } else if (draft.tripMode === 'Individual' && draft.linkedClientId) {
      currentClient = clients.find((c) => String(c.id) === String(draft.linkedClientId));
    }

    const phoneDigits = normalizeWhatsAppPhoneDigits(resolveClientPhone(currentClient));
    if (!phoneDigits) {
      setNotice('⚠️ لا يوجد رقم جوال مسجل لهذا العميل في قاعدة البيانات.');
      return;
    }

    const url = buildVipPortalWhatsAppUrl(pinDisplay, phoneDigits);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="min-h-screen bg-[#050a14] p-4 font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-amber-50 sm:p-6" dir="rtl">
      <FeaturesAchievementsModal open={showAchievementsModal} onClose={() => setShowAchievementsModal(false)} />
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-amber-500/25 bg-gradient-to-r from-[#0f1c35] to-[#060b14] px-5 py-4 ring-1 ring-amber-400/15">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400/80">Wanderloom CRM</p>
            <h1 className="mt-1 text-xl font-black text-white sm:text-2xl">منشئ المسار الموحّد ✈️</h1>
            <p className="mt-1 text-xs font-medium text-slate-400">
              مركز قيادة مدمج — الطقس، الوجهة، الميزانية الداخلية، والأيام (stops)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAchievementsModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-black text-amber-100 transition hover:bg-amber-500/20"
          >
            <Award className="h-4 w-4 text-amber-400" />
            دليل ميزات النظام 🏆
          </button>
        </header>
        <div className="mb-4">
          <Link href="/crm/itineraries" className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-white/5 hover:text-amber-100">
            <ArrowRight className="h-4 w-4" />
            الرجوع إلى المسارات
          </Link>
        </div>

        <section className={`${cardClass} mb-6`}>
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[auto_1fr]">
            <label className="block">
              <span className={`${labelOnDarkClass} inline-flex items-center gap-1`}>
                <Sparkles className="h-3.5 w-3.5" />
                استيراد من قالب جاهز
              </span>
              <select
                value={selectedTemplateId}
                onChange={(e) => importTemplate(e.target.value)}
                className={contrastInputClass}
              >
                <option value="">اختر قالباً جاهزاً...</option>
                {templates.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.title || 'بدون عنوان'}{t.customer_name ? ` · ${t.customer_name}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-gradient-to-l from-slate-50 to-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0 text-right">
                <p className="text-sm font-black text-slate-800">إرفاق بوتيك الأزياء المخصص لهذه الرحلة</p>
                <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">
                  عند التفعيل، يظهر للعميل في الرابط السحري قسم الأزياء واللوك اليومي. عند الإيقاف، يعرض المسار فقط دون أزياء.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.includeWardrobe}
                onClick={() => patchDraft({ includeWardrobe: !draft.includeWardrobe })}
                className={`relative h-9 w-[3.25rem] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 ${draft.includeWardrobe ? 'bg-slate-900' : 'bg-slate-300'}`}
              >
                <span
                  className={`pointer-events-none absolute top-1 h-7 w-7 rounded-full bg-white shadow-md transition-[inset-inline-start] ${draft.includeWardrobe ? 'start-[calc(100%-1.875rem)]' : 'start-1'}`}
                />
              </button>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border-2 border-slate-900/90 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/30 px-4 py-4 shadow-inner shadow-black/20 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0 text-right">
                <p className="inline-flex items-center gap-2 text-sm font-black text-amber-100">
                  <Crown className="h-4 w-4 shrink-0 text-amber-400" strokeWidth={2} />
                  فتح الدليل السري للوجهة (VIP)
                </p>
                <p className="mt-1 text-[11px] font-bold leading-relaxed text-amber-100/65">
                  يمنح العميل المميز وصولاً للدليل السري عند التفعيل — للاستخدام بقرار الموظف فقط.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.unlockSecretGuide}
                onClick={() => patchDraft({ unlockSecretGuide: !draft.unlockSecretGuide })}
                className={`relative h-9 w-[3.25rem] shrink-0 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                  draft.unlockSecretGuide
                    ? 'bg-gradient-to-l from-amber-500 via-yellow-400 to-amber-600 shadow-[0_0_22px_rgba(234,179,8,0.45)] ring-1 ring-amber-200/50'
                    : 'border-2 border-amber-600/40 bg-neutral-950'
                }`}
              >
                <span
                  className={`pointer-events-none absolute top-1 h-7 w-7 rounded-full bg-white shadow-md transition-[inset-inline-start] ${draft.unlockSecretGuide ? 'start-[calc(100%-1.875rem)]' : 'start-1'}`}
                />
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-black text-slate-900">نوع الرحلة</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-900 shadow-sm">
                <input
                  type="radio"
                  name="tripMode"
                  checked={draft.tripMode === 'Individual'}
                  onChange={() => {
                    patchDraft({ tripMode: 'Individual', groupName: '', groupMemberIds: [] });
                  }}
                  className="accent-slate-900"
                />
                فردية
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-900 shadow-sm">
                <input
                  type="radio"
                  name="tripMode"
                  checked={draft.tripMode === 'Group'}
                  onChange={() => {
                    patchDraft({ tripMode: 'Group', linkedClientId: '' });
                  }}
                  className="accent-slate-900"
                />
                قروب
              </label>
            </div>
            {draft.tripMode === 'Group' ? (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-700">اسم القروب</span>
                  <input
                    value={draft.groupName}
                    onChange={(e) => patchDraft({ groupName: e.target.value })}
                    placeholder="مثال: قروب عائلة السعيد — اليابان 2026"
                    className="w-full rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
                <div>
                  <span className="mb-2 block text-xs font-black text-slate-600">أعضاء القروب من CRM (اختيار متعدد)</span>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                    {clients.length === 0 ? (
                      <p className="p-2 text-xs font-semibold text-slate-500">لا يوجد عملاء في الجدول أو تعذر التحميل.</p>
                    ) : (
                      <ul className="space-y-1">
                        {clients.map((c) => (
                          <li key={c.id}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                              <input
                                type="checkbox"
                                checked={draft.groupMemberIds.includes(c.id)}
                                onChange={() => toggleGroupMember(c.id)}
                                className="accent-slate-900"
                              />
                              <span className="text-gray-900 font-medium">
                                {c.name || `عميل #${c.id}`}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-black text-slate-600">ربط بعميل CRM (اختياري — للظهور في صفحة العميل والقروبات)</span>
                  <select
                    value={draft.linkedClientId || ''}
                    onChange={(e) => patchDraft({ linkedClientId: e.target.value })}
                    className={contrastInputClass}
                  >
                    <option value="">— بدون ربط —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name || `عميل #${c.id}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-5 border-t border-amber-500/20 pt-6">
            <div>
              <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-black text-white">
                <Globe className="h-4 w-4 text-[#D4AF37]" />
                مركز القيادة
              </h3>
              <div className={commandPanelClass}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={`${goldLabelClass} inline-flex items-center gap-1`}>
                      <CloudSun className="h-3.5 w-3.5" />
                      الطقس — weather_temp
                    </span>
            <input
              type="text"
                      value={draft.weatherTemp}
                      onChange={(e) => patchDraft({ weatherTemp: e.target.value })}
              inputMode="decimal"
                      placeholder="مثال: 22°"
              className={contrastInputClass}
            />
          </label>
                <label className="block">
                    <span className={`${goldLabelClass} inline-flex items-center gap-1`}>
                      <MapPin className="h-3.5 w-3.5" />
                      الوجهة التفاعلية — destination
                    </span>
                  <input
                      value={draft.destination}
                      onChange={(e) => patchDraft({ destination: e.target.value })}
                      placeholder="مثال: Paris, France"
                      className={contrastInputClass}
                  />
                </label>
                </div>
              </div>
            </div>

            <div className={commandPanelClass}>
              <h3 className="mb-1 text-sm font-black text-[#D4AF37]">تبويب الرئيسية — للعميل VIP</h3>
              <p className="mb-4 text-[11px] font-semibold text-white/50">
                الطقس نصي؛ الميزانية والبوردينق والحقيبة تُبنى تلقائياً من الحقول المنظّمة.
              </p>
              <div className="grid grid-cols-1 gap-4">
                <label className="block">
                  <span className={goldLabelClass}>ملخص الطقس — weather_summary</span>
                  <textarea
                    value={draft.weatherSummary}
                    onChange={(e) => patchDraft({ weatherSummary: e.target.value })}
                    rows={3}
                    className={`${contrastInputClass} min-h-[80px] resize-y`}
                    placeholder="مثال: الجو بارد — خذ معاطف"
                  />
                </label>
              </div>
            </div>

            <div className={commandPanelClass}>
              <h3 className="mb-1 text-sm font-black text-[#D4AF37]">بطاقة الصعود — flight_details</h3>
              <p className="mb-4 text-[11px] font-semibold text-white/50">
                تظهر كتذكرة صعود للعميل عند إدخال رقم الرحلة.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={goldLabelClass}>من — flight_from</span>
                  <input
                    value={draft.flight.flight_from}
                    onChange={(e) =>
                      patchDraft({ flight: { ...draft.flight, flight_from: e.target.value } })
                    }
                    className={contrastInputClass}
                  />
                </label>
                <label className="block">
                  <span className={goldLabelClass}>إلى — flight_to</span>
                  <input
                    value={draft.flight.flight_to}
                    onChange={(e) =>
                      patchDraft({ flight: { ...draft.flight, flight_to: e.target.value } })
                    }
                    className={contrastInputClass}
                  />
                </label>
                <label className="block">
                  <span className={goldLabelClass}>رقم الرحلة</span>
                  <input
                    value={draft.flight.flight_number}
                    onChange={(e) =>
                      patchDraft({ flight: { ...draft.flight, flight_number: e.target.value } })
                    }
                    className={contrastInputClass}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className={goldLabelClass}>المقعد</span>
                  <input
                    value={draft.flight.flight_seat}
                    onChange={(e) =>
                      patchDraft({ flight: { ...draft.flight, flight_seat: e.target.value } })
                    }
                    className={contrastInputClass}
                    dir="ltr"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={goldLabelClass}>وقت الإقلاع</span>
                  <input
                    value={draft.flight.flight_time}
                    onChange={(e) =>
                      patchDraft({ flight: { ...draft.flight, flight_time: e.target.value } })
                    }
                    className={contrastInputClass}
                    dir="ltr"
                  />
                </label>
              </div>
            </div>

            <div className={commandPanelClass}>
              <h3 className="mb-1 text-sm font-black text-white">الميزانية للعميل + CRM</h3>
              <p className="mb-4 text-[11px] font-semibold text-white/50">
                الإجمالي والمدفوع والعملة يظهران للعميل في تبويب حقيبة السفر والمالية.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={goldLabelClass}>الميزانية الإجمالية (total_budget)</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={draft.budgetTracking.totalBudget}
                    onChange={(e) =>
                      patchDraft({
                        budgetTracking: { ...draft.budgetTracking, totalBudget: e.target.value },
                      })
                    }
                    placeholder="150000"
                    className={contrastInputClass}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className={goldLabelClass}>المبلغ المدفوع (spent_amount)</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={draft.budgetTracking.spentAmount}
                    onChange={(e) =>
                      patchDraft({
                        budgetTracking: { ...draft.budgetTracking, spentAmount: e.target.value },
                      })
                    }
                    placeholder="75000"
                    className={contrastInputClass}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className={goldLabelClass}>العملة</span>
                  <input
                    value={draft.budgetOptions.currency}
                    onChange={(e) =>
                      patchDraft({
                        budgetOptions: { ...draft.budgetOptions, currency: e.target.value },
                      })
                    }
                    placeholder="SAR"
                    className={contrastInputClass}
                    dir="ltr"
                  />
                </label>
              </div>
            </div>

            <p className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-[11px] font-semibold text-white/55">
              فنادق وتجارب العرض (hotel_details / experiences_details) تُشتق تلقائياً من أيام المسار عند الحفظ.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className={`${labelOnDarkClass} inline-flex items-center gap-1`}>
                <UserRound className="h-3.5 w-3.5" />
                اسم العميل
              </span>
              <input
                value={draft.customerName}
                onChange={(e) => patchDraft({ customerName: e.target.value })}
                placeholder="مثال: أحمد خالد"
                className={contrastInputClass}
              />
            </label>

            <label className="block">
              <span className={`${labelOnDarkClass} inline-flex items-center gap-1`}>
                <Sparkles className="h-3.5 w-3.5" />
                عنوان الرحلة
              </span>
              <input
                value={draft.title}
                onChange={(e) => patchDraft({ title: e.target.value })}
                placeholder="مثال: شهر عسل في سويسرا"
                className={contrastInputClass}
              />
            </label>

            <label className="block">
              <span className={`${labelOnDarkClass} inline-flex items-center gap-1`}>
                <Key className="h-3.5 w-3.5" />
                passcode
              </span>
              <input
                value={draft.passcode}
                onChange={(e) => patchDraft({ passcode: e.target.value.toUpperCase() })}
                placeholder="WL-XXXX-XX (يُولَّد تلقائياً إن تُرك فارغاً)"
                className={contrastInputClass}
              />
            </label>

            <label className="block">
              <span className={labelOnDarkClass}>تاريخ البداية</span>
              <input
                type="date"
                value={draft.datesFrom}
                onChange={(e) => patchDraft({ datesFrom: e.target.value })}
                className={contrastInputClass}
              />
            </label>

            <label className="block">
              <span className={labelOnDarkClass}>تاريخ النهاية</span>
              <input
                type="date"
                value={draft.datesTo}
                onChange={(e) => patchDraft({ datesTo: e.target.value })}
                className={contrastInputClass}
              />
            </label>

            <div className="flex items-end lg:col-span-2">
              <button
                type="button"
                onClick={saveAsTemplate}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 hover:bg-slate-100 disabled:opacity-60 lg:w-auto"
              >
                <Save className="h-4 w-4" />
                حفظ كقالب جاهز
              </button>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void (isEditMode ? saveExistingItinerary() : saveAndGenerateLink())}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60 lg:w-auto"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEditMode ? 'حفظ التعديلات' : 'حفظ وتوليد الرابط'}
              </button>
            </div>
          </div>
          {showSaveSuccess && magicLink ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-800">تم حفظ الرحلة بنجاح!</p>
              <div className="mt-2">
                <p className="text-[11px] font-bold text-emerald-900/80">
                  بوابة العميل الآمنة — لا تُرسل رابط /itinerary مباشرة للعميل
                </p>
                <code className="mt-1 block w-full overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                  {magicLink}
                </code>
              </div>
              <div className="mt-3 rounded-lg border border-emerald-100 bg-white px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">الرمز السري للعميل (PIN)</p>
                <p className="mt-1 font-mono text-lg font-black text-slate-900">{savedTripPin.trim() !== '' ? savedTripPin : '—'}</p>
              </div>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-5 py-3.5 text-base font-black text-white shadow-[0_8px_24px_rgba(34,197,94,0.35)] transition hover:bg-green-600 active:scale-[0.99] sm:py-4"
              >
                <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                إرسال الرابط للعميل عبر واتساب 💬
              </button>
            </div>
          ) : null}
          {notice ? <p className="mt-3 text-xs font-bold text-gray-200">{notice}</p> : null}
        </section>

        <section className={`${cardClass} mb-6 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="inline-flex items-center gap-2 text-lg font-black text-gray-100">
                <CalendarDays className="h-5 w-5 text-[#D4AF37]" />
                بناء الأيام — Wanderlog
              </h2>
              <p className="mt-1 text-xs font-medium text-white/50">
                مصدر الأنشطة: جدول places فقط (بنك الأماكن)
              </p>
            </div>
            <button
              type="button"
              onClick={addDay}
              className="inline-flex items-center gap-1 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-2 text-xs font-black text-[#D4AF37] hover:bg-[#D4AF37]/25"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة يوم
            </button>
          </div>

          {loadingItinerary ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
            </div>
          ) : fetchError ? (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{fetchError}</p>
          ) : (
            <ItineraryBuilderDaysPanel
              days={draft.days}
              onDaysChange={(days) => patchDraft({ days })}
              destination={draft.destination}
            />
          )}
        </section>
      </div>
    </div>
  );
}

