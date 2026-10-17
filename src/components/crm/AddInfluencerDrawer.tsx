'use client';

import React, { useEffect, useState } from 'react';

import { ReferralCodeInput } from '@/components/crm/ReferralCodeInput';

export type AddInfluencerPayload = {
  name: string;
  referral_code: string;
  phone: string | null;
  email: string | null;
  platforms: string | null;
  content_type: string | null;
};

interface AddInfluencerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddInfluencerPayload) => Promise<void>;
}

const emptyForm = {
  name: '',
  referralCode: '',
  phone: '',
  email: '',
  platforms: '',
  contentType: '',
};

export function generateInfluencerReferralCode() {
  return `WNDR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

/** Direct public entry: https://domain/?ref=CODE */
export function buildInfluencerReferralLink(code: string) {
  const clean = code.trim();
  if (!clean || typeof window === 'undefined') return '';
  return `${window.location.origin}/?ref=${encodeURIComponent(clean)}`;
}

export const AddInfluencerDrawer: React.FC<AddInfluencerDrawerProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [codeValid, setCodeValid] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setFormData(emptyForm);
      setErrorMessage(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerateCode = () => {
    setFormData((prev) => ({ ...prev, referralCode: generateInfluencerReferralCode() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeValid) {
      setErrorMessage('عذراً، كود الإحالة هذا موجود ومسجل لشخص آخر مسبقاً.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    const payload: AddInfluencerPayload = {
      name: formData.name.trim(),
      referral_code:
        formData.referralCode.trim() || generateInfluencerReferralCode(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      platforms: formData.platforms.trim() || null,
      content_type: formData.contentType.trim() || null,
    };

    try {
      await onSubmit(payload);
      setFormData(emptyForm);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بقاعدة البيانات';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col justify-between overflow-y-auto border-r border-slate-200 bg-[#F8F5EE] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/40 p-6 backdrop-blur-md">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#111827]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#BA8E48]" />
              إضافة مؤثر جديد
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              يُحفظ مباشرة بحالة نشط – بدون رادار.
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/60 text-xs font-bold text-slate-700 hover:bg-slate-300 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 p-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#111827]">
              اسم المؤثر <span className="font-bold text-red-500">* (إجباري)</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: عبد الله السليمان"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-semibold text-[#111827] shadow-sm outline-none placeholder:text-slate-400 focus:border-[#BA8E48]"
            />
          </div>

          <ReferralCodeInput
            value={formData.referralCode}
            onGenerate={handleGenerateCode}
            onChange={(val, isValid) => {
              setFormData((prev) => ({ ...prev, referralCode: val }));
              setCodeValid(isValid);
            }}
          />

          <div className="space-y-4 border-t border-slate-200 pt-3">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              بيانات إضافية (جميعها اختيارية)
            </span>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                رقم التواصل <span className="font-normal text-slate-400">(اختياري)</span>
              </label>
              <input
                type="tel"
                placeholder="9665xxxxxxxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-right text-xs text-[#111827] shadow-sm outline-none placeholder:text-slate-400 focus:border-[#BA8E48]"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                البريد الإلكتروني <span className="font-normal text-slate-400">(اختياري)</span>
              </label>
              <input
                type="email"
                placeholder="influencer@domain.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs text-[#111827] shadow-sm outline-none placeholder:text-slate-400 focus:border-[#BA8E48]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                المنصات <span className="font-normal text-slate-400">(اختياري)</span>
              </label>
              <input
                type="text"
                placeholder="سناب شات، إنستغرام، تيك توك..."
                value={formData.platforms}
                onChange={(e) => setFormData({ ...formData, platforms: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs text-[#111827] shadow-sm outline-none placeholder:text-slate-400 focus:border-[#BA8E48]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                نوع المحتوى <span className="font-normal text-slate-400">(اختياري)</span>
              </label>
              <input
                type="text"
                placeholder="سفر فاخر، تجارب سياحية..."
                value={formData.contentType}
                onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs text-[#111827] shadow-sm outline-none placeholder:text-slate-400 focus:border-[#BA8E48]"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="sticky bottom-0 flex items-center gap-3 bg-[#F8F5EE] pb-2 pt-4">
            <button
              type="submit"
              disabled={loading || !codeValid}
              className="flex-1 rounded-xl bg-[#BA8E48] py-3.5 text-center text-xs font-bold text-[#111827] shadow-md transition-all hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : '+ حفظ المؤثر'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
