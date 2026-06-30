'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Phone,
  User,
} from 'lucide-react';

import {
  groupFulfillmentClients,
  RADAR_FULFILLMENT_DONE,
  RADAR_FULFILLMENT_PENDING,
  updateRadarFulfillmentStatus,
  type GroupFulfillmentBucket,
  type GroupFulfillmentClient,
} from '@/lib/group-operations-radar';
import { supabase } from '@/lib/supabase';

type GroupOperationsFulfillmentProps = {
  clients: GroupFulfillmentClient[];
  warning?: string;
  onRefresh: () => void | Promise<void>;
};

function FulfillmentToggle({
  client,
  onUpdated,
}: {
  client: GroupFulfillmentClient;
  onUpdated: (id: string, done: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const done = client.radar_fulfillment_status === RADAR_FULFILLMENT_DONE;

  async function handleToggle() {
    if (!supabase || saving) return;
    setSaving(true);
    setError('');

    const next = done ? RADAR_FULFILLMENT_PENDING : RADAR_FULFILLMENT_DONE;
    const result = await updateRadarFulfillmentStatus(supabase, client.id, next);

    if (!result.ok) {
      setError(result.error ?? 'تعذر التحديث');
      setSaving(false);
      return;
    }

    onUpdated(client.id, next === RADAR_FULFILLMENT_DONE);
    setSaving(false);
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={saving}
        aria-pressed={done}
        aria-label={done ? 'تم التنفيذ — اضغط للتراجع' : 'تحديد كتم التنفيذ'}
        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
          done
            ? 'border-emerald-400/60 bg-emerald-500 text-white shadow-sm shadow-emerald-200/50'
            : 'border-[#D4AF37]/35 bg-white text-[#1E2720] hover:border-[#D4AF37]/60 hover:bg-[#FEFDF9]'
        } disabled:opacity-60`}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <CheckCircle2 className={`h-4 w-4 ${done ? 'text-white' : 'text-[#D4AF37]'}`} aria-hidden />
        )}
      </button>
      {error ? (
        <span className="max-w-[4.5rem] text-center text-[9px] font-bold leading-tight text-rose-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function GroupTripCard({
  bucket,
  defaultOpen,
}: {
  bucket: GroupFulfillmentBucket;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState(bucket.clients);

  useEffect(() => {
    setRows(bucket.clients);
  }, [bucket.clients]);

  const handleUpdated = useCallback((id: string, done: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              radar_fulfillment_status: done ? RADAR_FULFILLMENT_DONE : RADAR_FULFILLMENT_PENDING,
            }
          : row,
      ),
    );
  }, []);

  const pending = rows.filter((r) => r.radar_fulfillment_status !== RADAR_FULFILLMENT_DONE).length;
  const done = rows.length - pending;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-white shadow-sm ring-1 ring-[#D4AF37]/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-right transition hover:bg-[#FEFDF9]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-[#1E2720]">{bucket.target_trip}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {rows.length.toLocaleString('ar-SA')} عميل مؤكد ·{' '}
            <span className="text-amber-800">{pending} بانتظار التنفيذ</span>
            {done > 0 ? (
              <>
                {' '}
                · <span className="text-emerald-700">{done} تم</span>
              </>
            ) : null}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[#D4AF37] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-[#D4AF37]/15 bg-gradient-to-b from-[#FEFDF9] to-white px-4 py-4 sm:px-5">
          <div className="space-y-3">
            {rows.map((client) => {
              const fulfilled = client.radar_fulfillment_status === RADAR_FULFILLMENT_DONE;
              const requestText = client.dna_special_requests.trim() || '— لا طلبات خاصة';

              return (
                <div
                  key={client.id}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                    fulfilled
                      ? 'border-emerald-200/80 bg-emerald-50/70'
                      : 'border-gray-200/90 bg-white'
                  }`}
                >
                  <FulfillmentToggle client={client} onUpdated={handleUpdated} />

                  <div className="min-w-0 flex-1 text-right">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/crm/clients/${client.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-black text-[#1E2720] transition hover:text-[#D4AF37]"
                      >
                        <User className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                        {client.name}
                      </Link>
                      {fulfilled ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                          تم التنفيذ ✓
                        </span>
                      ) : null}
                    </div>

                    {client.phone_wa ? (
                      <a
                        href={`tel:${client.phone_wa.replace(/\s+/g, '')}`}
                        dir="ltr"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-gray-600 transition hover:text-[#1E2720]"
                      >
                        <Phone className="h-3 w-3 shrink-0 text-[#D4AF37]" aria-hidden />
                        {client.phone_wa}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-gray-400">بدون رقم</p>
                    )}

                    <p
                      className={`mt-2 text-sm font-semibold leading-relaxed ${
                        fulfilled
                          ? 'text-emerald-900/70 line-through decoration-emerald-600/50'
                          : 'text-gray-700'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#D4AF37]">
                        طلبات خاصة:{' '}
                      </span>
                      {requestText}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function GroupOperationsFulfillment({
  clients,
  warning,
  onRefresh,
}: GroupOperationsFulfillmentProps) {
  const buckets = useMemo(() => groupFulfillmentClients(clients), [clients]);

  return (
    <section className="mb-10" aria-label="عمليات القروبات وتجهيز الطلبات" dir="rtl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black text-[#1E2720]">
          🧳 عمليات القروبات وتجهيز الطلبات
        </h2>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="rounded-lg border border-[#D4AF37]/30 bg-white px-3 py-1.5 text-xs font-bold text-[#1E2720] transition hover:bg-[#FEFDF9]"
        >
          تحديث القائمة ↻
        </button>
      </div>

      {warning ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-right text-xs font-bold text-amber-900">
          {warning}
        </div>
      ) : null}

      {buckets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-5 py-8 text-center text-sm font-semibold text-gray-500">
          لا يوجد عملاء مؤكدون مرتبطون برحلة قروب حالياً.
          <p className="mt-2 text-xs font-medium text-gray-400">
            عيّن «عميل مؤكد» + «الرحلة المستهدفة» من بطاقة العميل في CRM.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {buckets.map((bucket, index) => (
            <GroupTripCard key={bucket.target_trip} bucket={bucket} defaultOpen={index === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
