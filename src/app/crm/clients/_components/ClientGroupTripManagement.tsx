'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  assignClientToGroupTrip,
  getClientGroupMember,
  listActiveGroupTripsForAssign,
  removeClientFromConfirmedSeat,
  unlinkClientFromGroupTrip,
  updateGroupMemberPaymentDeadline,
  type ActiveGroupTripOption,
} from '@/app/actions/groupTripAssignmentActions';
import {
  groupMemberStatusLabel,
  paymentDeadlineBadgeLabel,
  type GroupMember,
} from '@/lib/group-members';
import { getClientAccessToken } from '@/lib/crm-session-token';

type Props = {
  clientId: number | string;
  className?: string;
  /** Fired after membership load — use to default DNA WhatsApp trip type to Group. */
  onMembershipLoaded?: (member: GroupMember | null) => void;
};

export default function ClientGroupTripManagement({
  clientId,
  className,
  onMembershipLoaded,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<
    'assign' | 'unlink' | 'removeSeat' | 'extendDeadline' | null
  >(null);
  const [application, setApplication] = useState<GroupMember | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [trips, setTrips] = useState<ActiveGroupTripOption[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const token = await getClientAccessToken();
    const result = await getClientGroupMember(clientId, token);
    if (!result.ok) {
      setLoadError(result.error);
      setApplication(null);
      onMembershipLoaded?.(null);
    } else {
      setApplication(result.data ?? null);
      onMembershipLoaded?.(result.data ?? null);
      if (result.data?.status === 'approved') {
        setShowAssign(true);
      }
    }
    setLoading(false);
  }, [clientId, onMembershipLoaded]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadTrips = async () => {
    const token = await getClientAccessToken();
    const result = await listActiveGroupTripsForAssign(token);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTrips(result.data ?? []);
  };

  const onAssign = async () => {
    if (!selectedTripId) {
      toast.error('اختر رحلة جماعية أولاً.');
      return;
    }
    setBusy('assign');
    try {
      const token = await getClientAccessToken();
      const result = await assignClientToGroupTrip(clientId, selectedTripId, token);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setShowAssign(false);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const onUnlink = async () => {
    if (!window.confirm('هل تريد إلغاء ارتباط العميل بهذه الرحلة؟')) return;
    setBusy('unlink');
    try {
      const token = await getClientAccessToken();
      const result = await unlinkClientFromGroupTrip(clientId, token);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setShowAssign(false);
      setSelectedTripId('');
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const onRemoveSeat = async () => {
    if (!window.confirm('إزالة العميل من المقعد المؤكد وتحرير السعة؟')) return;
    setBusy('removeSeat');
    try {
      const token = await getClientAccessToken();
      const result = await removeClientFromConfirmedSeat(clientId, token);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const onExtendDeadline = async () => {
    setBusy('extendDeadline');
    try {
      const token = await getClientAccessToken();
      const result = await updateGroupMemberPaymentDeadline(
        clientId,
        { extendDays: 3 },
        token,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const status = application?.status;
  const linkedToTrip = status === 'confirmed_seat' || status === 'waitlisted';
  const deadlineBadge =
    status === 'confirmed_seat'
      ? paymentDeadlineBadgeLabel(application?.payment_deadline)
      : null;
  const canShowAssignUi =
    !linkedToTrip &&
    (showAssign || status === 'approved' || status === 'pending_interview' || !application);

  return (
    <section className={className}>
      <div className="mb-4">
        <h2 className="inline-flex items-center gap-2 text-base font-black text-slate-900">
          <UsersRound size={16} aria-hidden />
          الرحلات الجماعية المرتبطة
        </h2>
        <p className="mt-1 text-xs font-bold text-slate-500">
          رحلات المجموعات المرتبطة بهذا العميل عبر group_members — تعيين المقعد ومهلة السداد.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          جاري التحميل…
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          {loadError}
        </div>
      ) : (
        <>
          {application && (application.group_trip_id || application.status) ? (
            <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-l from-emerald-50 via-white to-amber-50/40 px-4 py-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-xl" aria-hidden>
                  🎯
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800/80">
                    رحلة جماعية مرتبطة
                  </p>
                  <p className="text-base font-black text-slate-900">
                    {application.trip_title_ar?.trim() || 'رحلة جماعية (بدون عنوان)'}
                  </p>
                  {application.trip_dates_ar ? (
                    <p className="text-xs font-semibold text-slate-600">{application.trip_dates_ar}</p>
                  ) : null}
                  <p className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-xs font-black text-emerald-950 ring-1 ring-emerald-200/70">
                    {groupMemberStatusLabel(application.status)}
                  </p>
                  {deadlineBadge ? (
                    <p
                      className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                        deadlineBadge.tone === 'slate'
                          ? 'bg-slate-100 text-slate-800'
                          : deadlineBadge.tone === 'amber'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {deadlineBadge.label}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
              لا توجد رحلات جماعية مرتبطة
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {linkedToTrip && status === 'confirmed_seat' ? (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onRemoveSeat()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-900 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === 'removeSeat' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  إزالة من المقعد
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onExtendDeadline()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm font-black text-sky-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === 'extendDeadline' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  تعديل المهلة (+3 أيام)
                </button>
              </>
            ) : null}
            {linkedToTrip ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onUnlink()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-black text-orange-900 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'unlink' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                إلغاء الارتباط
              </button>
            ) : null}
            {!showAssign && (status === 'pending_interview' || !application) ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setShowAssign(true);
                  void loadTrips();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                تعيين على رحلة جماعية…
              </button>
            ) : null}
          </div>

          {canShowAssignUi && showAssign ? (
            <div className="mt-4 space-y-3 rounded-xl border border-[#D4AF37]/35 bg-[#FEFDF9] p-4">
              <label className="block text-xs font-black text-slate-700">
                اختر الرحلة الجماعية
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  onFocus={() => {
                    if (trips.length === 0) void loadTrips();
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none ring-slate-200 focus:ring-2"
                >
                  <option value="">— اختر رحلة —</option>
                  {trips.map((trip) => {
                    const seats =
                      trip.seats_left == null
                        ? 'بدون حد سعة'
                        : trip.seats_left > 0
                          ? `${trip.seats_left} مقعد متاح`
                          : 'مكتملة';
                    return (
                      <option key={trip.id} value={trip.id}>
                        {trip.title_ar} ({seats}
                        {trip.allow_waitlist ? ' · انتظار' : ''})
                      </option>
                    );
                  })}
                </select>
              </label>
              <button
                type="button"
                disabled={busy !== null || !selectedTripId}
                onClick={() => void onAssign()}
                className="w-full rounded-xl bg-gradient-to-l from-[#D4AF37] to-[#B8941F] py-2.5 text-sm font-black text-[#0D0F0E] disabled:opacity-60"
              >
                {busy === 'assign' ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    جاري التعيين…
                  </span>
                ) : (
                  'تأكيد الانضمام للمجموعة'
                )}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
