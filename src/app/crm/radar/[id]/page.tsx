'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { handleAcceptRequest } from '@/app/actions/leadRequestActions';
import { whatsAppHref } from '@/lib/crm-lead-actions';
import {
  formatTravelDateArabic,
  joinDestinations,
  resolveLeadBookingChannelLabel,
} from '@/lib/crm-leads';
import { buildItineraryBuilderPath } from '@/lib/itinerary-builder-prefill';
import { LEAD_STATUS_LABEL_AR, normalizeLeadStatus } from '@/lib/lead-status';
import { supabase } from '@/lib/supabase';

type LeadRow = Record<string, unknown>;

function readId(raw: string | string[] | undefined) {
  if (Array.isArray(raw)) return raw[0]?.trim() ?? '';
  return String(raw ?? '').trim();
}

function readText(row: LeadRow, keys: string[]) {
  for (const key of keys) {
    const value = String(row[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function destinationLabel(row: LeadRow) {
  const raw = row.destinations;
  if (Array.isArray(raw)) {
    const joined = joinDestinations(raw.map((item) => String(item ?? '')));
    if (joined && joined !== '—') return joined;
  }
  return readText(row, ['destination', 'trip_title', 'title']);
}

function travelersLabel(row: LeadRow) {
  const count = Number(row.travelers_count ?? row.passengers_count ?? row.passengers ?? 0);
  const days = Number(row.travel_days ?? 0);
  if (!Number.isFinite(count) || count <= 0) return 'غير محدد';
  return days > 0 ? `${count} مسافر (${days} يوم)` : `${count} مسافر`;
}

function statusLabel(row: LeadRow) {
  const booking = resolveLeadBookingChannelLabel(row);
  if (booking.label) return booking.detail ? `${booking.label} · ${booking.detail}` : booking.label;
  const normalized = normalizeLeadStatus(row.status);
  return LEAD_STATUS_LABEL_AR[normalized] || readText(row, ['status', 'booking_status']) || 'بانتظار الجدولة';
}

export default function LeadDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const leadId = readId(params?.id);

  const [lead, setLead] = useState<LeadRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setLoading(false);
      setError(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError(false);
        if (!supabase) throw new Error('supabase_unavailable');

        const { data, error: dbError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle();

        if (dbError) throw dbError;
        if (!data) throw new Error('not_found');
        if (!cancelled) setLead(data as LeadRow);
      } catch (err) {
        console.error('Error fetching lead details:', err);
        if (!cancelled) {
          setLead(null);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5EE] p-6" dir="rtl">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#BA8E48] border-t-transparent" />
          <p className="text-xs font-bold text-slate-700">جاري تحميل تفاصيل الطلب...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5EE] p-6" dir="rtl">
        <div className="max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-base font-bold text-slate-900">لم يتم العثور على تفاصيل الطلب</h2>
          <p className="text-xs text-slate-500">قد يكون الطلب محذوفاً أو تم تغيير معرّف الطلب.</p>
          <button
            type="button"
            onClick={() => router.push('/crm/radar')}
            className="rounded-full bg-[#1B242F] px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-slate-800"
          >
            العودة للرادار
          </button>
        </div>
      </div>
    );
  }

  const name = readText(lead, ['full_name', 'name', 'client_name']) || 'عميل جديد';
  const phone = readText(lead, ['phone_wa', 'phone', 'whatsapp']);
  const destination = destinationLabel(lead) || 'غير محددة';
  const createdLabel = lead.created_at
    ? new Date(String(lead.created_at)).toLocaleDateString('ar-SA-u-ca-gregory')
    : '—';
  const travelRaw = readText(lead, ['travel_date']);
  const travelLabel = travelRaw ? formatTravelDateArabic(travelRaw) : 'غير محدد';
  const waHref = phone ? whatsAppHref(phone) : '';

  const acceptLead = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      const result = await handleAcceptRequest(leadId, {
        origin: window.location.origin,
      });
      if (!result.ok) throw new Error(result.error);
      toast.success(result.message || 'تم قبول الطلب');
      router.push(
        buildItineraryBuilderPath({
          from: 'lead',
          clientId: result.clientId,
          clientName: name,
          destination,
          startDate: travelRaw || null,
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر قبول الطلب');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-4xl space-y-6 bg-[#F8F5EE] p-6" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push('/crm/radar')}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100"
        >
          <span>→ العودة للرادار</span>
        </button>

        <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          طلب جديد · DNA جاهز
        </span>
      </div>

      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
            <p className="mt-1 text-xs text-slate-500">تاريخ الطلب: {createdLabel}</p>
          </div>

          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100"
            >
              <span>💬 تواصل عبر الواتساب</span>
              <span className="font-mono text-[11px]" dir="ltr">
                ({phone})
              </span>
            </a>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-bold text-slate-500">
              بدون رقم واتساب
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1 rounded-2xl border border-slate-200/80 bg-[#F8F5EE] p-4">
            <span className="text-[11px] font-bold text-slate-400">الوجهة المستهدفة</span>
            <p className="text-sm font-bold text-[#BA8E48]">{destination}</p>
          </div>

          <div className="space-y-1 rounded-2xl border border-slate-200/80 bg-[#F8F5EE] p-4">
            <span className="text-[11px] font-bold text-slate-400">عدد المسافرين ومدة الرحلة</span>
            <p className="text-sm font-bold text-slate-800">{travelersLabel(lead)}</p>
          </div>

          <div className="space-y-1 rounded-2xl border border-slate-200/80 bg-[#F8F5EE] p-4">
            <span className="text-[11px] font-bold text-slate-400">تاريخ السفر المفضل</span>
            <p className="text-sm font-bold text-slate-800">{travelLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs font-medium text-slate-500">
            حالة الحجز: <strong className="text-slate-800">{statusLabel(lead)}</strong>
          </span>

          <button
            type="button"
            onClick={() => void acceptLead()}
            disabled={accepting}
            className="rounded-xl bg-[#BA8E48] px-6 py-3 text-xs font-bold text-[#111827] shadow-md transition-all hover:bg-amber-600 disabled:opacity-60"
          >
            {accepting ? 'جارٍ القبول...' : 'قبول الطلب وبدء تفصيل المسار ✨'}
          </button>
        </div>
      </div>
    </div>
  );
}
