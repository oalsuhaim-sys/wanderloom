'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2, X } from 'lucide-react';

import { CrmModalBackdrop, CrmModalPanel } from '@/app/crm/_components/CrmShell';
import {
  normalizeProfilePinInput,
  persistClientProfileUnlock,
} from '@/lib/client-profile-unlock';

type ClientProfilePinModalProps = {
  open: boolean;
  /** Required — from parent fetched trip.clientId, never from URL */
  clientId: string | number;
  /** Optional trip PK for logging / soft cross-check */
  tripId?: string | number | null;
  itineraryId?: string | number | null;
  onClose: () => void;
  onSuccess: () => void;
};

function normalizeId(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  return String(raw)
    .trim()
    .replace(/^(client-|vip-)/i, '');
}

export default function ClientProfilePinModal({
  open,
  clientId,
  tripId,
  itineraryId,
  onClose,
  onSuccess,
}: ClientProfilePinModalProps) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const pin = normalizeProfilePinInput(pinInput);
    if (!pin) {
      setError('أدخل رمز الملف الشخصي الخاص.');
      return;
    }

    const resolvedClientId = normalizeId(clientId);
    const resolvedTripId = normalizeId(tripId ?? itineraryId);

    console.log('Submitting PIN for Client:', resolvedClientId, {
      tripId: resolvedTripId || null,
    });

    if (!resolvedClientId) {
      setError('تعذر تحديد العميل المرتبط بهذه الرحلة. أعد فتح الرابط.');
      console.error('[profile-pin] clientId prop missing at submit');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, string> = {
        pin,
        clientId: resolvedClientId,
        client_id: resolvedClientId,
      };
      if (resolvedTripId) {
        payload.itineraryId = resolvedTripId;
        payload.itinerary_id = resolvedTripId;
        payload.trip_id = resolvedTripId;
      }

      const res = await fetch('/api/itinerary/verify-profile-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        if (data.error === 'profile_not_configured') {
          setError('لم يُفعَّل رمز الملف الشخصي بعد. تواصل مع الكونسيرج.');
        } else if (data.error === 'invalid_pin') {
          setError('الرمز غير صحيح. حاول مرة أخرى.');
        } else if (data.error === 'missing_fields' || data.error === 'client_not_found') {
          setError('تعذر التحقق من هوية العميل. أعد فتح رابط الرحلة.');
        } else {
          setError('تعذر التحقق. أعد المحاولة أو تواصل مع الكونسيرج.');
        }
        return;
      }

      persistClientProfileUnlock(resolvedClientId);
      setPinInput('');
      onSuccess();
    } catch {
      setError('تعذر الاتصال. تحقق من الشبكة وأعد المحاولة.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CrmModalBackdrop onClose={onClose} labelledBy="profile-pin-title">
      <CrmModalPanel
        className="max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]/30">
              <KeyRound className="h-5 w-5 text-[#D4AF37]" aria-hidden />
            </span>
            <div>
              <h2 id="profile-pin-title" className="text-base font-black text-[#1E2720]">
                الملف الشخصي الخاص
              </h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-600">
                أدخل رمز الملف الشخصي الخاص بك للوصول إلى المحفظة والمكافآت. هذا الرمز منفصل عن
                رابط المسار وكود الإحالة.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-gray-700">
              رمز الملف الشخصي / PIN
            </span>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.toUpperCase());
                if (error) setError('');
              }}
              autoComplete="off"
              autoFocus
              dir="ltr"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center font-mono text-lg font-black tracking-[0.2em] text-[#1E2720] outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25"
              placeholder="••••••"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !normalizeId(clientId)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E2720] px-4 py-3 text-sm font-black text-[#D4AF37] transition hover:bg-black disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                جاري التحقق…
              </>
            ) : (
              'فتح الملف الشخصي'
            )}
          </button>
        </form>
      </CrmModalPanel>
    </CrmModalBackdrop>
  );
}
