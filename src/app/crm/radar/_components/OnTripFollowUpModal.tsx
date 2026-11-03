'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageCircleHeart, X } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  buildFallbackFollowup,
  canonicalFollowupClientId,
  formatFollowupDateTime,
  persistLocalFollowup,
  type ClientFollowup,
  type FollowupClientRef,
} from '@/lib/client-followups';
import { getClientAccessToken } from '@/lib/crm-session-token';

type Props = {
  open: boolean;
  /** معرّف العميل الصريح — من بطاقة المسافر */
  clientId?: string | number | null;
  /** كائن العميل إن وُجد — يُؤخذ id أو client_id منه */
  client?: FollowupClientRef | null;
  /** معرّف احتياطي من بطاقة المسافر (traveler.id) */
  travelerId?: string | number | null;
  clientName: string;
  agentName: string;
  agentEmployeeId?: string | null;
  onClose: () => void;
  onSaved?: (followup: ClientFollowup) => void;
  /** يُستدعى بعد الحفظ لتحديث سجل المتابعات فوراً */
  onFollowupAdded?: () => void;
};

export default function OnTripFollowUpModal({
  open,
  clientId,
  client = null,
  clientName,
  agentName,
  agentEmployeeId = null,
  onClose,
  onSaved,
  onFollowupAdded,
}: Props) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [stamp, setStamp] = useState(() => new Date().toISOString());

  const unifiedClientId = canonicalFollowupClientId(
    client?.id ?? clientId ?? client?.client_id,
  );
  const resolvedClientId = unifiedClientId;

  useEffect(() => {
    if (open) {
      setNotes('');
      setStamp(new Date().toISOString());
    }
  }, [open, resolvedClientId]);

  function storeConfirmed(followup: ClientFollowup): ClientFollowup {
    return persistLocalFollowup({
      ...followup,
      clientId: unifiedClientId,
      clientName,
    });
  }

  function finishSaved(stored: ClientFollowup) {
    toast.success('تم حفظ المتابعة بنجاح');
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('followup-updated', { detail: { clientId: stored.clientId } }));
    onSaved?.(stored);
    onFollowupAdded?.();
    onClose();
  }

  async function handleSaveFollowup() {
    const finalClientId = canonicalFollowupClientId(
      client?.id ?? clientId ?? client?.client_id,
    );
    if (!finalClientId) {
      toast.error('حدّد العميل أولاً قبل تسجيل المتابعة.');
      return;
    }
    const trimmed = notes.trim();
    if (!trimmed) {
      toast.error('اكتب ملاحظات المتابعة قبل الحفظ.');
      return;
    }

    const payload = {
      client_id: finalClientId,
      clientId: finalClientId,
      notes: trimmed,
      agent_name: agentName,
      agentName,
      client: { id: finalClientId, client_id: finalClientId, name: clientName },
      agentEmployeeId,
    };

    setSaving(true);
    try {
      const token = await getClientAccessToken().catch(() => '');
      const res = await fetch('/api/admin/followups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        fallback?: boolean;
        error?: string;
        followup?: ClientFollowup;
      };
      const draft =
        json.followup ??
        buildFallbackFollowup({
          clientId: finalClientId,
          clientName,
          agentName,
          agentEmployeeId,
          notes: trimmed,
          createdAt: stamp,
        });
      const stored = storeConfirmed({ ...draft, clientId: finalClientId, clientName });
      const apiSaved = Boolean(res.ok && json.ok && json.followup);
      const fallbackSaved = Boolean(json.fallback);
      if (!apiSaved && !fallbackSaved) {
        toast.error(json.error || 'تعذر حفظ المتابعة في قاعدة البيانات.');
        onSaved?.(stored);
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('followup-updated', { detail: { clientId: stored.clientId } }));
        onClose();
        return;
      }
      finishSaved(stored);
    } catch (err) {
      try {
        const stored = storeConfirmed(
          buildFallbackFollowup({
            clientId: finalClientId,
            clientName,
            agentName,
            agentEmployeeId,
            notes: trimmed,
            createdAt: stamp,
          }),
        );
        finishSaved(stored);
      } catch (storeErr) {
        toast.error(storeErr instanceof Error ? storeErr.message : err instanceof Error ? err.message : 'تعذر حفظ المتابعة.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="followup-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#2D3F3A] dark:bg-[#22302C]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              On-Trip Follow-up
            </p>
            <h2
              id="followup-modal-title"
              className="mt-1 flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"
            >
              <MessageCircleHeart className="h-5 w-5 text-emerald-600" aria-hidden />
              متابعة {clientName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#1A2421]"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-[#2D3F3A] dark:bg-[#1A2421]">
          <div>
            <p className="font-bold text-slate-400">وقت التواصل</p>
            <p className="mt-0.5 font-extrabold text-slate-800 dark:text-slate-200">
              {formatFollowupDateTime(stamp)}
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-400">الموظف</p>
            <p className="mt-0.5 font-extrabold text-slate-800 dark:text-slate-200">
              {agentName || '—'}
            </p>
          </div>
        </div>

        <label className="mb-4 block space-y-1.5">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            ملاحظات وتغذية العميل الراجعة
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="مثال: العميل راضٍ عن الفندق · طلب توصية مطعم لليلة…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving || !notes.trim() || !resolvedClientId}
            onClick={() => void handleSaveFollowup()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            حفظ المتابعة
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
