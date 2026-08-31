'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Calendar, Loader2, Pencil, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import {
  approveGroupLead,
  archiveGroupLead,
  deleteGroupLead,
  setLeadMeetingDateManual,
} from '@/app/actions/groupOnboardingActions';
import { whatsAppHref } from '@/lib/crm-lead-actions';
import {
  datetimeLocalToMeetingIso,
  formatMeetingDateLabel,
  formatRelativeTimeArabic,
  isExplicitGroupTripLead,
  isLeadAppointmentExpired,
  joinDestinations,
  meetingDateToDatetimeLocal,
  resolveLeadMeetingSlot,
  resolveLeadPreferredTripId,
  resolveLeadBookedTripId,
  parseBookedTripLabelFromLead,
  resolveLeadBookingChannelLabel,
  type CrmLeadRow,
} from '@/lib/crm-leads';
import { extractReferralCodeFromLead } from '@/lib/referral-rewards';
import {
  INTERVIEW_SCHEDULED_STATUS,
  LEAD_STATUS_LABEL_AR,
  normalizeLeadStatus,
} from '@/lib/lead-status';
import { supabase } from '@/lib/supabase';
import { BRAND_GOLD } from '@/lib/brand-gold';
import {
  InboxLuxuryTripBadge,
  InboxMediaConsentInline,
  inboxCompactDangerBtnClass,
  inboxCompactPrimaryBtnClass,
  inboxCompactSecondaryBtnClass,
  inboxCompactWhatsAppClass,
  inboxLuxuryCardClass,
  inboxLuxuryDetailsClass,
  inboxLuxuryMetaGridClass,
  inboxLuxuryPrimaryButtonStyle,
} from './inbox-luxury-ui';

type TripOption = {
  id: string;
  title_ar: string;
  max_seats: number;
  booked_seats: number;
};

type Props = {
  leads: CrmLeadRow[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void | Promise<void>;
  onLeadDecided?: (leadId: string) => void;
};

function mapTripRows(rows: Record<string, unknown>[] | null | undefined): TripOption[] {
  return (rows ?? [])
    .map((row) => {
      const id = String(row.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        title_ar: String(row.title_ar ?? row.title ?? 'رحلة جماعية'),
        max_seats: Math.max(0, Number(row.max_seats) || 0),
        booked_seats: Math.max(0, Number(row.booked_seats) || 0),
      };
    })
    .filter((trip): trip is TripOption => trip != null);
}

export function GroupOnboardingInbox({ leads, loading, error, onRefresh, onLeadDecided }: Props) {
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [selectedTripByLead, setSelectedTripByLead] = useState<Record<string, string>>({});
  const selectRefs = useRef<Record<string, HTMLSelectElement | null>>({});

  const hasInterviewDecisions = leads.some(
    (lead) => normalizeLeadStatus(lead.status) === INTERVIEW_SCHEDULED_STATUS,
  );

  useEffect(() => {
    if (!leads.length) {
      setTripsLoading(false);
      return;
    }

    let alive = true;

    async function fetchTrips() {
      setTripsLoading(true);
      try {
        if (!supabase) {
          console.error('Error fetching trips: supabase not configured');
          return;
        }

        let { data, error: fetchError } = await supabase
          .from('group_trips')
          .select('id, title_ar, max_seats, booked_seats')
          .eq('is_active', true);

        // If is_active filter fails or returns empty, load all rows
        if (fetchError || !data?.length) {
          const fallback = await supabase
            .from('group_trips')
            .select('id, title_ar, max_seats, booked_seats');
          if (fallback.error) {
            console.error('Error fetching trips:', fallback.error);
            if (alive) setTrips([]);
            return;
          }
          data = fallback.data;
          fetchError = null;
        }

        if (fetchError) {
          console.error('Error fetching trips:', fetchError);
          if (alive) setTrips([]);
          return;
        }

        const options = mapTripRows(data as Record<string, unknown>[]);
        if (!alive) return;

        setTrips(options);

        // Auto-select each lead's booked journey — never default to trips[0]
        if (options.length > 0) {
          setSelectedTripByLead((prev) => {
            const next: Record<string, string> = { ...prev };
            for (const lead of leads) {
              if (normalizeLeadStatus(lead.status) !== INTERVIEW_SCHEDULED_STATUS) continue;

              const prevId = String(prev[lead.id] ?? '').trim();
              if (prevId && options.some((t) => t.id === prevId)) continue;

              const bookedId = resolveLeadBookedTripId(lead, options);
              const isGroup =
                isExplicitGroupTripLead(lead) ||
                Boolean(resolveLeadPreferredTripId(lead)) ||
                Boolean(bookedId);
              if (!isGroup) continue;

              if (bookedId) next[lead.id] = bookedId;
            }
            return next;
          });
        }
      } catch (err) {
        console.error('Error fetching trips:', err);
        if (alive) setTrips([]);
      } finally {
        if (alive) setTripsLoading(false);
      }
    }

    void fetchTrips();
    return () => {
      alive = false;
    };
  }, [hasInterviewDecisions, leads]);

  useEffect(() => {
    if (!trips.length) return;
    setSelectedTripByLead((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const lead of leads) {
        if (normalizeLeadStatus(lead.status) !== INTERVIEW_SCHEDULED_STATUS) continue;

        const current = String(prev[lead.id] ?? '').trim();
        if (current && trips.some((t) => t.id === current)) continue;

        const bookedId = resolveLeadBookedTripId(lead, trips);
        const isGroup =
          isExplicitGroupTripLead(lead) ||
          Boolean(resolveLeadPreferredTripId(lead)) ||
          Boolean(bookedId);
        if (!isGroup) continue;

        if (bookedId && bookedId !== current) {
          next[lead.id] = bookedId;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [leads, trips]);

  function resolveTripFromUi(leadId: string): { id: string; title_ar: string } | null {
    const fromState = String(selectedTripByLead[leadId] ?? '').trim();
    const selectEl = selectRefs.current[leadId];
    const fromSelect = String(selectEl?.value ?? '').trim();
    const tripId = fromSelect || fromState;
    const trip = trips.find((t) => String(t.id) === tripId) ?? null;
    return trip ? { id: String(trip.id), title_ar: trip.title_ar } : null;
  }

  async function handleDeleteAppointment(leadId: string) {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا الموعد المنتهي؟')) return;
    setBusyLeadId(leadId);
    try {
      const result = await deleteGroupLead(leadId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('تم حذف الموعد بنجاح');
      onLeadDecided?.(leadId);
      await onRefresh?.();
    } finally {
      setBusyLeadId(null);
    }
  }

  function runDecision(leadId: string, action: 'approve' | 'archive' | 'delete') {
    setActionError(null);
    setBusyLeadId(leadId);
    startTransition(async () => {
      try {
        if (action === 'approve') {
          const trip = resolveTripFromUi(leadId);
          const tripId = String(trip?.id ?? '').trim();
          if (!tripId) {
            setActionError('الرجاء اختيار رحلة صالحة من القائمة.');
            return;
          }

          const result = await approveGroupLead({ leadId, tripId });
          if (!result.ok) {
            setActionError(result.error);
            return;
          }
          toast.success(result.message);
          onLeadDecided?.(leadId);
          await onRefresh?.();
          return;
        }

        const result =
          action === 'archive' ? await archiveGroupLead(leadId) : await deleteGroupLead(leadId);

        if (!result.ok) {
          setActionError(result.error);
          return;
        }

        toast.success(result.message);
        onLeadDecided?.(leadId);
        await onRefresh?.();
      } finally {
        setBusyLeadId(null);
      }
    });
  }

  return (
    <section
      id="group-onboarding"
      className="mb-12 w-full scroll-mt-24 space-y-4"
      aria-label="مواعيد المقابلات القادمة (أفراد ومجموعات)"
      dir="rtl"
    >
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium' }} />
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        مواعيد المقابلات القادمة (أفراد ومجموعات)
      </h2>
      {actionError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-2.5 text-xs font-medium text-rose-700 shadow-sm">
          {actionError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
          <p className="text-sm text-slate-500">جاري التحميل…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-100 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-700">تعذر تحميل طلبات المقابلات</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {error.includes('group_members') || error.includes('.sql')
              ? 'حدث خطأ في جلب البيانات، تأكد من الاتصال بقاعدة البيانات.'
              : error}
          </p>
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-slate-500">لا توجد طلبات في مرحلة المقابلة حالياً</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.map((lead) => {
            const status = normalizeLeadStatus(lead.status);
            const rawStatus = String(lead.status ?? '').trim().toLowerCase();
            const wa = String(lead.phone_wa ?? '').trim();
            const isInterviewScheduled =
              status === INTERVIEW_SCHEDULED_STATUS || status === 'meeting';
            const meetingFromColumn = formatMeetingDateLabel(lead.meeting_date);
            const meetingSlot = resolveLeadMeetingSlot(
              lead as CrmLeadRow & Record<string, unknown>,
            );
            const interviewDisplay = meetingFromColumn || meetingSlot.display;
            const isExpired = isLeadAppointmentExpired(
              lead as CrmLeadRow & Record<string, unknown>,
            );
            const preferredTripId = resolveLeadPreferredTripId(lead);
            const bookedTripId = resolveLeadBookedTripId(lead, trips);
            const preferredTrip = bookedTripId
              ? trips.find((t) => t.id === bookedTripId)
              : preferredTripId
                ? trips.find((t) => t.id === preferredTripId)
                : null;
            const bookedLabel = parseBookedTripLabelFromLead(lead);
            const isGroupLead =
              isExplicitGroupTripLead(lead) ||
              Boolean(preferredTripId) ||
              Boolean(bookedTripId);
            const isBusy = pending && busyLeadId === lead.id;
            const journeyTitle =
              preferredTrip?.title_ar ||
              bookedLabel ||
              joinDestinations(lead.destinations);
            const appointmentDateText = interviewDisplay || 'لم يُحدد الموعد بعد';
            const scheduleBadgeLabel =
              isExpired
                ? 'موعد منتهي ⚠️'
                : status === INTERVIEW_SCHEDULED_STATUS
                  ? 'مقابلة مجدولة'
                  : rawStatus === 'approved'
                    ? 'موافق — بانتظار الجدولة'
                    : LEAD_STATUS_LABEL_AR[status] ?? 'بانتظار المقابلة';

            const storedId = String(selectedTripByLead[lead.id] ?? '').trim();
            const selectedTripValue =
              storedId && trips.some((t) => t.id === storedId)
                ? storedId
                : bookedTripId && trips.some((t) => t.id === bookedTripId)
                  ? bookedTripId
                  : '';
            const canApprove =
              Boolean(selectedTripValue) && trips.some((t) => t.id === selectedTripValue);
            const timeAgo = formatRelativeTimeArabic(lead.created_at) || 'الآن';
            const referralCode = extractReferralCodeFromLead(
              lead as CrmLeadRow & Record<string, unknown>,
            );

            const booking = resolveLeadBookingChannelLabel(
              lead as CrmLeadRow & Record<string, unknown>,
            );
            const travelersLabel = `${lead.travelers_count || 1} مسافر${
              lead.travel_days ? ` (${lead.travel_days} يوم)` : ''
            }`;

            return (
              <article
                key={lead.id}
                className={`${inboxLuxuryCardClass} ${
                  isExpired
                    ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400/60'
                    : 'hover:border-[rgba(205,160,76,0.45)]'
                }`}
              >
                {/* Header: name, badges, time & WhatsApp */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3
                      className={`text-sm font-extrabold sm:text-base ${
                        isExpired ? 'text-rose-950' : 'text-slate-900'
                      }`}
                    >
                      {lead.full_name}
                    </h3>
                    <InboxLuxuryTripBadge isGroup={isGroupLead} />
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        isExpired
                          ? 'bg-rose-50 text-rose-800'
                          : status === INTERVIEW_SCHEDULED_STATUS
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {scheduleBadgeLabel}
                    </span>
                    {isExpired ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDeleteAppointment(lead.id)}
                        className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        🗑️ حذف
                      </button>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">{timeAgo}</span>
                    {wa ? (
                      <a
                        href={whatsAppHref(wa)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={inboxCompactWhatsAppClass}
                        dir="ltr"
                      >
                        💬 {wa}
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* Compact details box */}
                <div className={inboxLuxuryDetailsClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 font-extrabold text-slate-900">
                      <span className="shrink-0" style={{ color: BRAND_GOLD.TEXT }}>
                        📍 الرحلة:
                      </span>
                      <span className="truncate">{journeyTitle || '—'}</span>
                    </div>
                    <InboxMediaConsentInline mediaConsent={lead.media_consent} />
                  </div>

                  <div className={inboxLuxuryMetaGridClass}>
                    <div>
                      👥 العدد:{' '}
                      <span className="font-bold text-slate-800">{travelersLabel}</span>
                    </div>
                    <div>
                      📞 الحجز:{' '}
                      <span className="font-bold text-slate-800">{booking.label}</span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <span>📅 الموعد:</span>
                      <span
                        className={`font-bold ${isExpired ? 'text-rose-800' : 'text-slate-800'}`}
                        dir="ltr"
                      >
                        {appointmentDateText}
                      </span>
                      <MeetingDateField
                        lead={lead}
                        displayLabel={null}
                        compact
                        onSaved={() => void onRefresh?.()}
                      />
                    </div>
                    {referralCode ? (
                      <div className="flex items-center gap-1 font-bold text-slate-700">
                        <span>🎁 إحالة:</span>
                        <span
                          className="rounded px-2 py-0.5 text-[10px] font-extrabold"
                          style={{
                            backgroundColor: '#F7F0E1',
                            color: '#8C6D23',
                          }}
                        >
                          {referralCode}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Trip selector + compact actions */}
                {isGroupLead && isInterviewScheduled ? (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <select
                      ref={(el) => {
                        selectRefs.current[lead.id] = el;
                      }}
                      value={selectedTripValue}
                      onChange={(e) => {
                        const next = String(e.target.value).trim();
                        setSelectedTripByLead((prev) => ({
                          ...prev,
                          [lead.id]: next,
                        }));
                      }}
                      className="min-w-[10rem] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30"
                    >
                      <option value="" disabled>
                        {tripsLoading ? 'جاري تحميل الرحلات…' : 'قرار الرحلة: اختر الرحلة…'}
                      </option>
                      {trips.length === 0 && !tripsLoading ? (
                        <option value="">— لا توجد رحلات —</option>
                      ) : null}
                      {trips.map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.title_ar} ({trip.booked_seats}/{trip.max_seats || '∞'})
                          {bookedTripId === trip.id ? ' ★' : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isBusy || !canApprove}
                      onClick={() => runDecision(lead.id, 'approve')}
                      style={inboxLuxuryPrimaryButtonStyle(isBusy || !canApprove)}
                      className={`${inboxCompactPrimaryBtnClass} flex flex-row-reverse items-center gap-1.5`}
                    >
                      <span>موافقة وترحيل</span>
                      <span aria-hidden>➔</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => runDecision(lead.id, 'archive')}
                      className={inboxCompactSecondaryBtnClass}
                    >
                      أرشفة
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => runDecision(lead.id, 'delete')}
                      className={inboxCompactDangerBtnClass}
                    >
                      حذف
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Bind leads.meeting_date + manual CRM override (no mock dates). */
function MeetingDateField({
  lead,
  displayLabel,
  onSaved,
  compact = false,
}: {
  lead: CrmLeadRow;
  displayLabel: string | null;
  onSaved?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => meetingDateToDatetimeLocal(lead.meeting_date));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setValue(meetingDateToDatetimeLocal(lead.meeting_date));
    }
  }, [lead.meeting_date, editing]);

  async function save(nextLocal: string | null) {
    setSaving(true);
    try {
      const iso = nextLocal ? datetimeLocalToMeetingIso(nextLocal) : null;
      if (nextLocal && !iso) {
        toast.error('صيغة الموعد غير صالحة.');
        setSaving(false);
        return;
      }
      const result = await setLeadMeetingDateManual(lead.id, iso);
      if (!result.ok) {
        toast.error(result.error);
        setSaving(false);
        return;
      }
      toast.success(iso ? 'تم حفظ موعد المقابلة' : 'تم مسح موعد المقابلة');
      setEditing(false);
      await onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div
        className={
          compact
            ? 'w-full min-w-[12rem] rounded-lg border border-slate-200 bg-white p-2'
            : 'rounded-xl border border-slate-100 bg-slate-50/80 p-3'
        }
      >
        {!compact ? (
          <p className="mb-1.5 text-xs font-medium text-slate-500">تعديل موعد المقابلة يدوياً</p>
        ) : null}
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-900"
          dir="ltr"
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          <button
            type="button"
            disabled={saving || !value}
            onClick={() => void save(value)}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            حفظ
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(null)}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-60"
          >
            مسح
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setValue(meetingDateToDatetimeLocal(lead.meeting_date));
            }}
            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
          >
            <X className="h-3 w-3 text-slate-400" aria-hidden />
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50"
        title="تعديل الموعد يدوياً"
      >
        <Pencil className="h-3 w-3 text-slate-400" aria-hidden />
        تعديل
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {displayLabel ? (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700">
          <Calendar className="h-3.5 w-3.5 text-sky-500" aria-hidden />
          {displayLabel}
        </p>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-sm text-slate-500">
          <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          لم يتم تحديد موعد بعد
        </p>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"
        title="تعديل الموعد يدوياً"
      >
        <Pencil className="h-3 w-3 text-slate-400" aria-hidden />
        تعديل
      </button>
    </div>
  );
}
