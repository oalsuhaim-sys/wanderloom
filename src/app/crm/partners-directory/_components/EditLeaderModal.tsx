'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { CRM_BTN_PRIMARY, CRM_INPUT, CRM_MODAL_PANEL } from '@/lib/crm-luxury-ui';
import {
  DEFAULT_PARTNER_COMMISSION_RATE,
  resolveCommissionRate,
} from '@/lib/partner-commission';

export type LeaderCommissionProfile = {
  id: string;
  name?: string | null;
  referral_code?: string | null;
  referralCode?: string | null;
  commission_rate?: number | null;
  commissionRate?: number | null;
};

type Props = {
  open: boolean;
  profile: LeaderCommissionProfile | null;
  apiBase: string;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

/**
 * Edit Leader — referral code + commission rate (default 15% of profit margin).
 */
export default function EditLeaderModal({
  open,
  profile,
  apiBase,
  onClose,
  onSaved,
}: Props) {
  const [formData, setFormData] = useState({
    referral_code: profile?.referral_code || profile?.referralCode || '',
    commission_rate: resolveCommissionRate(
      profile?.commission_rate ?? profile?.commissionRate,
    ),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !profile) return;
    setFormData({
      referral_code: profile.referral_code || profile.referralCode || '',
      commission_rate: resolveCommissionRate(
        profile.commission_rate ?? profile.commissionRate,
      ),
    });
  }, [open, profile]);

  if (!open || !profile) return null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_code: formData.referral_code.trim() || null,
          commission_rate: resolveCommissionRate(formData.commission_rate),
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر حفظ العمولة');
      }
      toast.success('تم حفظ نسبة عمولة القائد');
      await onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[310] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-leader-commission-title"
    >
      <div
        className={CRM_MODAL_PANEL}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id="edit-leader-commission-title"
            className="text-lg font-bold text-slate-900 dark:text-white"
          >
            عمولة القائد — {profile.name || 'قائد الرحلة'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#22302C]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 space-y-1 text-right">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
            كود الإحالة <span className="font-normal text-slate-400">(اختياري)</span>
          </label>
          <input
            type="text"
            value={formData.referral_code}
            onChange={(e) =>
              setFormData({ ...formData, referral_code: e.target.value })
            }
            className={`${CRM_INPUT} text-left`}
            dir="ltr"
            placeholder="LEADER-CODE"
          />
        </div>

        <div className="mb-4 space-y-1 text-right">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
            نسبة العمولة (من الفائدة/الربح)
          </label>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={formData.commission_rate}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  commission_rate: Number(e.target.value),
                })
              }
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-right text-sm font-bold text-slate-800 outline-none transition focus:border-amber-500 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100"
              dir="rtl"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              % من الفائدة
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            الافتراضي {DEFAULT_PARTNER_COMMISSION_RATE}% من هامش الربح (السعر − التكلفة)
          </p>
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={`${CRM_BTN_PRIMARY} w-full`}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          حفظ العمولة
        </button>
      </div>
    </div>
  );
}
