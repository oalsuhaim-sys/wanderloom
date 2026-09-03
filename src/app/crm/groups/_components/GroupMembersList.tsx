'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, X } from 'lucide-react';

import { deleteGroupMemberById, updateGroupMemberById } from '@/app/actions/groupTripAssignmentActions';
import {
  groupOperationsJoinBadge,
  isPendingGroupJoinStatus,
  RADAR_FULFILLMENT_DONE,
  RADAR_FULFILLMENT_PENDING,
  updateRadarFulfillmentStatus,
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
import { getClientAccessToken } from '@/lib/crm-session-token';
import { supabase } from '@/lib/supabase';
import {
  RADAR_SECTION_INITIAL_LIMIT,
  ShowAllToggle,
} from '@/app/crm/radar/_components/ShowAllToggle';

type Props = {
  members: GroupFulfillmentClient[];
  onMembersChange: (
    updater: (prev: GroupFulfillmentClient[]) => GroupFulfillmentClient[],
  ) => void;
  showAll?: boolean;
  onToggleShowAll?: () => void;
  initialLimit?: number;
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

  async function toggle() {
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
    onUpdated(client.member_id, !done);
    setSaving(false);
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={saving}
        title={done ? 'تم التنفيذ — اضغط للتراجع' : 'وضع علامة تم التنفيذ'}
        className={`rounded-lg border p-1.5 transition-all active:scale-95 disabled:opacity-60 ${
          done
            ? 'border-emerald-500/40 bg-emerald-500 text-white shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
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
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('الاسم مطلوب.');
      return;
    }

    setSaving(true);
    setError('');

    const nextStatus = status;
    onMembersChange((prev) =>
      prev.map((row) =>
        row.member_id === client.member_id
          ? {
              ...row,
              name: trimmedName,
              phone_wa: phone.trim(),
              status: nextStatus,
              payment_status: paymentStatus === '' ? null : paymentStatus,
            }
          : row,
      ),
    );

    try {
      const token = await getClientAccessToken();
      const result = await updateGroupMemberById(
        client.member_id,
        {
          customer_name: trimmedName,
          customer_phone: phone.trim(),
          status,
          payment_status: paymentStatus === '' ? null : paymentStatus,
        },
        token,
      );

      if (!result.ok) {
        setError(result.error ?? 'تعذر الحفظ');
        onMembersChange((prev) =>
          prev.map((row) => (row.member_id === client.member_id ? client : row)),
        );
        return;
      }

      const leftBoard = status === 'rejected';

      if (leftBoard) {
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
      onClose();
    } catch (err) {
      console.error('Failed to update member:', err);
      setError('تعذر تحديث حالة العضو.');
    } finally {
      setSaving(false);
    }
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

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
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

  const handleDeleteMember = async (groupMemberId: string) => {
    if (deleting) return;

    const ok = window.confirm(
      `حذف «${client.name}» من رحلة «${client.target_trip}»؟\nسيتم تحرير المقعد من المخزون.`,
    );
    if (!ok) return;

    setDeleting(true);
    setActionError('');

    try {
      const token = await getClientAccessToken();
      const result = await deleteGroupMemberById(groupMemberId, token);

      if (!result.ok) {
        console.error('Error deleting member:', result.error);
        setActionError(result.error ?? 'تعذر حذف العضو، يرجى المحاولة لاحقاً.');
        return;
      }

      onDeleted(groupMemberId);
    } catch (err) {
      console.error('Delete exception:', err);
      setActionError('تعذر حذف العضو، يرجى المحاولة لاحقاً.');
    } finally {
      setDeleting(false);
    }
  };

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
            onClick={() => void handleDeleteMember(client.member_id)}
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

export default function GroupMembersList({
  members,
  onMembersChange,
  showAll = false,
  onToggleShowAll,
  initialLimit = RADAR_SECTION_INITIAL_LIMIT,
}: Props) {
  const handleFulfillmentUpdated = useCallback(
    (memberId: string, done: boolean) => {
      onMembersChange((prev) =>
        prev.map((row) =>
          row.member_id === memberId
            ? {
                ...row,
                radar_fulfillment_status: done
                  ? RADAR_FULFILLMENT_DONE
                  : RADAR_FULFILLMENT_PENDING,
              }
            : row,
        ),
      );
    },
    [onMembersChange],
  );

  const handleDeleted = useCallback(
    (memberId: string) => {
      onMembersChange((prev) => prev.filter((row) => row.member_id !== memberId));
    },
    [onMembersChange],
  );

  const handleMemberUpdated = useCallback(
    (memberId: string, next: GroupFulfillmentClient | null) => {
      onMembersChange((prev) => {
        if (next == null) return prev.filter((row) => row.member_id !== memberId);
        return prev.map((row) => (row.member_id === memberId ? next : row));
      });
    },
    [onMembersChange],
  );

  const visibleRows = showAll ? members : members.slice(0, initialLimit);

  return (
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
      {onToggleShowAll && members.length > initialLimit ? (
        <ShowAllToggle showAll={showAll} total={members.length} onToggle={onToggleShowAll} />
      ) : null}
    </div>
  );
}
