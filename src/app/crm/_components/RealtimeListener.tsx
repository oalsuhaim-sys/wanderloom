'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

import { dispatchCrmRealtimeRefresh } from '@/lib/crm-realtime-events';
import { isQuotationStatusApproved } from '@/lib/crm-quotations';
import { supabase } from '@/lib/supabase';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** True when DNA submission can be inferred without noisy false positives. */
function clientDnaJustSubmitted(nextRaw: unknown, prevRaw: unknown): boolean {
  const next = asRecord(nextRaw);
  const prev = asRecord(prevRaw);

  if (next.onboarding_completed !== true) return false;

  // Full replica identity: clear false → true transition
  if ('onboarding_completed' in prev) {
    return prev.onboarding_completed !== true;
  }

  // Default replica identity (old = PK only): only fire if DNA payload fields are in `new`
  return (
    'travel_dna' in next ||
    'dna_interests' in next ||
    'dna_activity_level' in next ||
    'dna_special_requests' in next
  );
}

function leadMovedToDnaOrMeeting(nextRaw: unknown, prevRaw: unknown): boolean {
  const nextStatus = String(asRecord(nextRaw).status ?? '')
    .trim()
    .toLowerCase();
  const prevStatus = String(asRecord(prevRaw).status ?? '')
    .trim()
    .toLowerCase();
  if (!nextStatus || nextStatus === prevStatus) return false;
  return (
    nextStatus === 'meeting' ||
    nextStatus === 'dna_completed' ||
    nextStatus.includes('dna_complete')
  );
}

/**
 * Global CRM Realtime listener — toasts staff + asks Radar (and peers) to soft-refresh.
 * Mount once inside CrmShell.
 */
export function RealtimeListener() {
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('crm-system-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          const row = asRecord(payload.new);
          const name = String(row.full_name ?? row.name ?? '').trim();
          toast.success(
            name
              ? `طلب جديد وصل للرادار: ${name}`
              : 'طلب جديد وصل للرادار للتو!',
            {
              icon: '🚨',
              duration: 5000,
              id: `lead-insert-${String(row.id ?? Date.now())}`,
            },
          );
          dispatchCrmRealtimeRefresh({ source: 'leads', reason: 'insert' });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          dispatchCrmRealtimeRefresh({ source: 'leads', reason: 'update' });
          if (!leadMovedToDnaOrMeeting(payload.new, payload.old)) return;
          const row = asRecord(payload.new);
          const name = String(row.full_name ?? row.name ?? '').trim();
          toast.success(
            name
              ? `عميل أكمل DNA / انتقل لاجتماع: ${name}`
              : 'تم تعبئة ملف DNA — تحديث في الرادار',
            {
              icon: '🧬',
              duration: 5000,
              id: `lead-dna-${String(row.id ?? Date.now())}`,
            },
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clients' },
        (payload) => {
          if (!clientDnaJustSubmitted(payload.new, payload.old)) return;
          const row = asRecord(payload.new);
          const name = String(row.name ?? '').trim();
          toast.success(
            name
              ? `تم إكمال DNA للعميل ${name} وتم إنشاء عرض السعر آلياً!`
              : 'تم إكمال DNA وتم إنشاء عرض السعر آلياً!',
            {
              icon: '🧬',
              duration: 6500,
              id: `dna-client-${String(row.id ?? Date.now())}`,
            },
          );
          dispatchCrmRealtimeRefresh({ source: 'clients', reason: 'dna' });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quotations' },
        (payload) => {
          const row = asRecord(payload.new);
          const title = String(row.title ?? '').trim();
          const clientName = title.replace(/^عرض سعر\s*-?\s*/u, '').trim();
          toast.success(
            clientName
              ? `تم إكمال DNA للعميل ${clientName} وتم إنشاء عرض السعر آلياً!`
              : 'تم إنشاء عرض سعر آلياً بعد إكمال DNA!',
            {
              icon: '📄',
              duration: 6500,
              id: `quote-insert-${String(row.id ?? Date.now())}`,
            },
          );
          dispatchCrmRealtimeRefresh({ source: 'quotations', reason: 'insert' });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quotations' },
        (payload) => {
          const next = asRecord(payload.new);
          const prev = asRecord(payload.old);
          const nextStatus = String(next.status ?? '');
          const prevStatus = String(prev.status ?? '');
          if (!isQuotationStatusApproved(nextStatus)) return;
          if (prevStatus && isQuotationStatusApproved(prevStatus)) return;

          const title = String(next.title ?? '').trim();
          toast.success(
            title
              ? `تم اعتماد العرض وإضافته للمسارات الفردية: ${title}`
              : 'تم اعتماد عرض السعر وإضافته للمسارات الفردية!',
            {
              icon: '✅',
              duration: 5000,
              id: `quote-${String(next.id ?? Date.now())}`,
            },
          );
          dispatchCrmRealtimeRefresh({ source: 'quotations', reason: 'approved' });
          dispatchCrmRealtimeRefresh({ source: 'itineraries', reason: 'from_quote_approval' });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'itineraries' },
        (payload) => {
          const row = asRecord(payload.new);
          const title = String(row.title ?? row.customer_name ?? '').trim();
          const status = String(row.status ?? '').trim().toLowerCase();
          if (status && status !== 'active' && status !== 'draft' && status !== 'confirmed') {
            dispatchCrmRealtimeRefresh({ source: 'itineraries', reason: 'insert' });
            return;
          }
          toast.success(
            title
              ? `مسار فردي جديد في الدليل: ${title}`
              : 'تم إضافة رحلة مؤكدة إلى المسارات الفردية!',
            {
              icon: '🧭',
              duration: 5500,
              id: `itinerary-insert-${String(row.id ?? Date.now())}`,
            },
          );
          dispatchCrmRealtimeRefresh({ source: 'itineraries', reason: 'insert' });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invoices' },
        (payload) => {
          const next = asRecord(payload.new);
          const prev = asRecord(payload.old);
          const nextStatus = String(next.status ?? '')
            .trim()
            .toLowerCase();
          const prevStatus = String(prev.status ?? '')
            .trim()
            .toLowerCase();
          const nextReceipt = String(next.receipt_url ?? '').trim();
          const prevReceipt = String(prev.receipt_url ?? '').trim();

          const becamePaid = nextStatus === 'paid' && prevStatus !== 'paid';
          if (becamePaid) {
            const trip = String(next.trip_title ?? '').trim();
            toast.success(
              trip ? `تم اعتماد الدفع: ${trip}` : 'تم اعتماد دفعة — تحديث المالية والرحلات',
              {
                icon: '✅',
                duration: 5000,
                id: `invoice-paid-${String(next.id ?? Date.now())}`,
              },
            );
            dispatchCrmRealtimeRefresh({ source: 'invoices', reason: 'paid' });
            return;
          }

          const enteredReview =
            (nextStatus === 'payment_review' ||
              nextStatus === 'awaiting_confirmation') &&
            prevStatus !== 'payment_review' &&
            prevStatus !== 'awaiting_confirmation';
          const receiptJustUploaded =
            Boolean(nextReceipt) && nextReceipt !== prevReceipt && nextStatus !== 'paid';

          if (!enteredReview && !receiptJustUploaded) return;

          const trip = String(next.trip_title ?? '').trim();
          toast.success(
            trip
              ? `حوالة جديدة بانتظار الاعتماد: ${trip}`
              : 'عميل رفع صورة حوالة — بانتظار الاعتماد!',
            {
              icon: '💳',
              duration: 7000,
              id: `invoice-review-${String(next.id ?? Date.now())}`,
            },
          );
          dispatchCrmRealtimeRefresh({
            source: 'invoices',
            reason: 'payment_review',
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        (payload) => {
          const next = asRecord(payload.new);
          const status = String(next.status ?? '').trim();
          if (status === 'confirmed_seat' || payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            dispatchCrmRealtimeRefresh({
              source: 'group_members',
              reason: status || payload.eventType?.toLowerCase() || 'change',
            });
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(
            '[RealtimeListener] channel error — enable Realtime on leads/clients/quotations/invoices/group_members/itineraries in Supabase',
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Toasts render via <CrmLuxuryToaster /> in CrmShell — avoid duplicate hosts.
  return null;
}
