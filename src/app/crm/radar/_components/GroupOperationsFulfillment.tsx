'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  X,
} from 'lucide-react';

import {
  groupFulfillmentClients,
  deleteGroupFulfillmentMember,
  updateGroupFulfillmentMember,
  groupOperationsJoinBadge,
  isPendingGroupJoinStatus,
  RADAR_FULFILLMENT_DONE,
  RADAR_FULFILLMENT_PENDING,
  updateRadarFulfillmentStatus,
  type GroupFulfillmentBucket,
  type GroupFulfillmentClient,
} from '@/lib/group-operations-radar';
import {
  GROUP_MEMBER_STATUSES,
  GROUP_PAYMENT_STATUSES,
  groupMemberStatusLabel,
  groupPaymentStatusLabel,
  type GroupMemberStatus,
  type GroupPaymentStatus,
} from '@/lib/group-members';
import { supabase } from '@/lib/supabase';
import { RADAR_SECTION_INITIAL_LIMIT, ShowAllToggle } from './ShowAllToggle';

type GroupOperationsFulfillmentProps = {
  clients: GroupFulfillmentClient[];
  error?: string;
  onRefresh: () => void | Promise<void>;
};

function FulfillmentToggle({
  client,
  onUpdated,
}: {
  client: GroupFulfillmentClient;
  onUpdated: (memberId: string, done: boolean) => void;
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

    onUpdated(client.member_id, next === RADAR_FULFILLMENT_DONE);
    setSaving(false);
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={saving}
        aria-pressed={done}
        aria-label={done ? 'تم التنفيذ — اضغط للتراجع' : 'تحديد كتم التنفيذ'}
        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200 ${
          done
            ? 'border-emerald-500/40 bg-emerald-500 text-white shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        } disabled:opacity-60`}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <CheckCircle2 className={`h-3.5 w-3.5 ${done ? 'text-white' : 'text-slate-400'}`} aria-hidden />
        )}
      </button>
      {error ? (
        <span className="max-w-[4.5rem] text-center text-[9px] font-medium leading-tight text-rose-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function EditMemberModal({
  client,
  onClose,
  onSaved,
}: {
  client: GroupFulfillmentClient;
  onClose: () => void;
  onSaved: (next: GroupFulfillmentClient | null) => void;
}) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone_wa);
  const [status, setStatus] = useState<GroupMemberStatus>(client.status);
  const [paymentStatus, setPaymentStatus] = useState<GroupPaymentStatus | ''>(
    client.payment_status ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!supabase || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('الاسم مطلوب.');
      return;
    }

    setSaving(true);
    setError('');

    const result = await updateGroupFulfillmentMember(
      supabase,
      client.member_id,
      { group_id: client.group_id, status: client.status },
      {
        customer_name: trimmedName,
        customer_phone: phone.trim(),
        status,
        payment_status: paymentStatus === '' ? null : paymentStatus,
      },
    );

    if (!result.ok) {
      setError(result.error ?? 'تعذر الحفظ');
      setSaving(false);
      return;
    }

    if (result.error) {
      // Soft warning (e.g. seat counter) — still apply local update
      setError(result.error);
    }

    if (result.leftBoard) {
      onSaved(null);
    } else {
      onSaved({
        ...client,
        name: trimmedName,
        phone_wa: phone.trim(),
        status,
        payment_status: paymentStatus === '' ? null : paymentStatus,
      });
    }
    setSaving(false);
    if (!result.error) onClose();
    else if (result.leftBoard) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-member-title"
      onClick={onClose}
    >
      <div
        className="w-[95%] max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="edit-member-title" className="text-base font-semibold text-slate-900">
            تعديل العضو
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-right">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">الاسم</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-slate-300"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">الجوال</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-slate-300"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">حالة المقعد</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as GroupMemberStatus)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-slate-300"
            >
              {GROUP_MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {groupMemberStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">حالة السداد</span>
            <select
              value={paymentStatus}
              onChange={(e) =>
                setPaymentStatus(e.target.value as GroupPaymentStatus | '')
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-slate-300"
            >
              <option value="">—</option>
              {GROUP_PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {groupPaymentStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:opacity-90 active:scale-95 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberActions({
  client,
  onDeleted,
  onUpdated,
}: {
  client: GroupFulfillmentClient;
  onDeleted: (memberId: string) => void;
  onUpdated: (next: GroupFulfillmentClient | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  async function handleDelete() {
    if (!supabase || deleting) return;
    const ok = window.confirm(
      `حذف «${client.name}» من رحلة «${client.target_trip}»؟\nسيتم تحرير المقعد من المخزون.`,
    );
    if (!ok) return;

    setDeleting(true);
    setActionError('');

    const result = await deleteGroupFulfillmentMember(
      supabase,
      client.member_id,
      client.group_id,
      { wasConfirmedSeat: client.status === 'confirmed_seat' },
    );

    if (!result.ok) {
      setActionError(result.error ?? 'تعذر الحذف');
      setDeleting(false);
      return;
    }

    onDeleted(client.member_id);
    setDeleting(false);
  }

  return (
    <>
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition-all hover:bg-slate-200"
          >
            تعديل
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 transition-all hover:bg-rose-100 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            حذف
          </button>
        </div>
        {actionError ? (
          <p className="max-w-[10rem] text-left text-[10px] font-medium text-rose-600">
            {actionError}
          </p>
        ) : null}
      </div>
      {editing ? (
        <EditMemberModal
          client={client}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            onUpdated(next);
            setEditing(false);
          }}
        />
      ) : null}
    </>
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
  const [showAllPassengers, setShowAllPassengers] = useState(false);

  useEffect(() => {
    setRows(bucket.clients);
  }, [bucket.clients]);

  const visibleRows = showAllPassengers
    ? rows
    : rows.slice(0, RADAR_SECTION_INITIAL_LIMIT);

  const handleFulfillmentUpdated = useCallback((memberId: string, done: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.member_id === memberId
          ? {
              ...row,
              radar_fulfillment_status: done ? RADAR_FULFILLMENT_DONE : RADAR_FULFILLMENT_PENDING,
            }
          : row,
      ),
    );
  }, []);

  const handleDeleted = useCallback((memberId: string) => {
    setRows((prev) => prev.filter((row) => row.member_id !== memberId));
  }, []);

  const handleMemberUpdated = useCallback((memberId: string, next: GroupFulfillmentClient | null) => {
    setRows((prev) => {
      if (next == null) return prev.filter((row) => row.member_id !== memberId);
      return prev.map((row) => (row.member_id === memberId ? next : row));
    });
  }, []);

  const pendingCount = rows.filter((r) => isPendingGroupJoinStatus(r.status)).length;
  const confirmedCount = rows.filter((r) => r.status === 'confirmed_seat').length;
  const done = rows.filter((r) => r.radar_fulfillment_status === RADAR_FULFILLMENT_DONE).length;

  if (rows.length === 0) return null;

  return (
    <article className="mb-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Compact Group Header Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white hover:text-slate-600"
            aria-expanded={open}
            aria-label={open ? 'طي المجموعة' : 'توسيع المجموعة'}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="min-w-0 flex-1 text-right"
          >
            <span className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-extrabold text-slate-900">
                {bucket.target_trip}
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                ({rows.length.toLocaleString('ar-SA')} أعضاء • {confirmedCount} مؤكد
                {pendingCount > 0 ? ` • ${pendingCount} بانتظار` : ''}
                {done > 0 ? ` • ${done} تم` : ''})
              </span>
            </span>
          </button>
        </div>

        {bucket.group_id ? (
          <Link
            href={`/crm/groups/${encodeURIComponent(bucket.group_id)}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-slate-800"
          >
            <span>📋</span>
            <span>عرض الكشف</span>
          </Link>
        ) : null}
      </div>

      {/* Compact Members List */}
      {open ? (
        <div className="space-y-2 bg-slate-50/30 p-3">
          {visibleRows.map((client) => {
            const fulfilled = client.radar_fulfillment_status === RADAR_FULFILLMENT_DONE;
            const specialRequests = client.dna_special_requests.trim();
            const joinBadge = groupOperationsJoinBadge(client.status);
            const isPendingJoin = isPendingGroupJoinStatus(client.status);

            return (
              <div
                key={client.member_id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all hover:border-amber-200 ${
                  isPendingJoin
                    ? 'border-amber-100 bg-amber-50/40'
                    : fulfilled
                      ? 'border-emerald-100 bg-emerald-50/40'
                      : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <FulfillmentToggle client={client} onUpdated={handleFulfillmentUpdated} />
                  <Link
                    href={`/crm/clients/${client.id}`}
                    className="text-xs font-extrabold text-slate-900 transition hover:text-amber-700"
                  >
                    {client.name}
                  </Link>
                  {client.phone_wa ? (
                    <a
                      href={`tel:${client.phone_wa.replace(/\s+/g, '')}`}
                      dir="ltr"
                      className="font-mono text-[11px] text-slate-400 transition hover:text-slate-600"
                    >
                      📞 {client.phone_wa}
                    </a>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${joinBadge.className}`}
                    >
                      {joinBadge.label}
                    </span>
                    {client.payment_status ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {groupPaymentStatusLabel(client.payment_status)}
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        بانتظار السداد
                      </span>
                    )}
                    {fulfilled ? (
                      <span className="rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        تم التنفيذ
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-3">
                    {specialRequests ? (
                      <span
                        className={`max-w-[150px] truncate text-[11px] font-medium text-slate-400 ${
                          fulfilled ? 'line-through decoration-emerald-600/40' : ''
                        }`}
                        title={specialRequests}
                      >
                        💬 {specialRequests}
                      </span>
                    ) : null}

                    <MemberActions
                      client={client}
                      onDeleted={handleDeleted}
                      onUpdated={(next) => handleMemberUpdated(client.member_id, next)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <ShowAllToggle
            showAll={showAllPassengers}
            total={rows.length}
            onToggle={() => setShowAllPassengers((v) => !v)}
          />
        </div>
      ) : null}
    </article>
  );
}

export default function GroupOperationsFulfillment({
  clients,
  error,
  onRefresh,
}: GroupOperationsFulfillmentProps) {
  const [showAllOperations, setShowAllOperations] = useState(false);
  const buckets = useMemo(() => groupFulfillmentClients(clients), [clients]);
  const allBuckets = buckets.filter((b) => b.clients.length > 0);
  const visibleBuckets = showAllOperations
    ? allBuckets
    : allBuckets.slice(0, RADAR_SECTION_INITIAL_LIMIT);

  return (
    <section
      id="group-operations"
      className="mb-10 scroll-mt-24"
      aria-label="عمليات القروبات وتجهيز الطلبات"
      dir="rtl"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          عمليات القروبات وتجهيز الطلبات
        </h2>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          تحديث القائمة
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-right text-xs font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {allBuckets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm font-medium text-slate-500 shadow-sm">
          لا توجد طلبات انضمام أو مقاعد في عمليات القروبات حالياً.
          <p className="mt-2 text-xs text-slate-400">
            تظهر هنا الطلبات الجديدة (بانتظار التأكيد) والمقاعد المؤكدة بعد مسار الانضمام أو التعيين من
            ملف العميل.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visibleBuckets.map((bucket, index) => (
              <GroupTripCard key={bucket.target_trip} bucket={bucket} defaultOpen={index === 0} />
            ))}
          </div>
          <ShowAllToggle
            showAll={showAllOperations}
            total={allBuckets.length}
            onToggle={() => setShowAllOperations((v) => !v)}
          />
        </>
      )}
    </section>
  );
}
