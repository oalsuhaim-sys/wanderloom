'use client';

import { useCallback, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { PLACE_CATEGORY_OPTIONS as BANK_CATEGORY_OPTIONS } from '@/lib/places-bank';

export const PLACE_CATEGORY_OPTIONS = BANK_CATEGORY_OPTIONS.map((opt) => ({
  value: opt.id,
  label: opt.label,
}));

export type QuickAddPlaceDraft = {
  name: string;
  city: string;
  country: string;
  category: string;
  sub_tag: string;
};

type UseQuickAddPlaceOptions = {
  defaultCity?: string;
  defaultCountry?: string;
  onPlaceCreated: (place: Record<string, unknown>) => void;
  onClearSearch?: () => void;
};

export function useQuickAddPlace({
  defaultCity = '',
  defaultCountry = '',
  onPlaceCreated,
  onClearSearch,
}: UseQuickAddPlaceOptions) {
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [newPlaceData, setNewPlaceData] = useState<QuickAddPlaceDraft>({
    name: '',
    city: '',
    country: '',
    category: 'l',
    sub_tag: '',
  });
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  const openQuickAddModal = useCallback(
    (searchQuery: string) => {
      setNewPlaceData({
        name: searchQuery.trim(),
        city: defaultCity.trim(),
        country: defaultCountry.trim(),
        category: 'l',
        sub_tag: '',
      });
      setQuickAddError(null);
      setIsQuickAddModalOpen(true);
    },
    [defaultCity, defaultCountry],
  );

  const handleQuickAddPlace = useCallback(async () => {
    if (!supabase) {
      setQuickAddError('قاعدة البيانات غير مهيأة.');
      return;
    }
    if (!newPlaceData.name.trim()) {
      setQuickAddError('اسم المعلم مطلوب.');
      return;
    }

    setQuickAddSaving(true);
    setQuickAddError(null);

    const payload = {
      name: newPlaceData.name.trim(),
      city: newPlaceData.city.trim() || defaultCity.trim() || 'غير محدد',
      country: newPlaceData.country.trim() || defaultCountry.trim() || 'غير محدد',
      category: newPlaceData.category || 'o',
      sub_tag: newPlaceData.sub_tag.trim() || null,
    };

    try {
      const { data, error } = await supabase.from('places').insert(payload).select().single();

      if (error) {
        console.error('Quick add place error:', error);
        setQuickAddError(error.message || 'حدث خطأ أثناء إضافة المعلم الجديد.');
        return;
      }

      if (data) {
        onPlaceCreated(data as Record<string, unknown>);
        setIsQuickAddModalOpen(false);
        onClearSearch?.();
      }
    } catch (err) {
      console.error('Unexpected quick add error:', err);
      setQuickAddError('حدث خطأ غير متوقع أثناء الإضافة.');
    } finally {
      setQuickAddSaving(false);
    }
  }, [newPlaceData, defaultCity, defaultCountry, onPlaceCreated, onClearSearch]);

  return {
    isQuickAddModalOpen,
    setIsQuickAddModalOpen,
    newPlaceData,
    setNewPlaceData,
    quickAddSaving,
    quickAddError,
    openQuickAddModal,
    handleQuickAddPlace,
  };
}

type ModalProps = {
  open: boolean;
  draft: QuickAddPlaceDraft;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onChange: (patch: Partial<QuickAddPlaceDraft>) => void;
  onSave: () => void;
};

export function QuickAddPlaceModal({
  open,
  draft,
  saving,
  error,
  onClose,
  onChange,
  onSave,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-place-title"
    >
      <div className="w-[95%] max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border border-[#D4AF37]/30 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="quick-add-place-title" className="text-lg font-bold text-[#1E2720]">
            إضافة معلم جديد
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">اسم المعلم / Name</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="مثال: برج إيفل"
              className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#D4AF37] focus:bg-white"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">المدينة / City</span>
            <input
              type="text"
              value={draft.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="مثال: باريس"
              className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#D4AF37] focus:bg-white"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">الدولة / Country</span>
            <input
              type="text"
              value={draft.country}
              onChange={(e) => onChange({ country: e.target.value })}
              placeholder="مثال: فرنسا"
              className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#D4AF37] focus:bg-white"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">النوع / Type</span>
            <select
              value={draft.category}
              onChange={(e) => onChange({ category: e.target.value })}
              className="rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
            >
              {PLACE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">وصف مختصر / Description</span>
            <textarea
              value={draft.sub_tag}
              onChange={(e) => onChange({ sub_tag: e.target.value })}
              placeholder="ملاحظة اختيارية للفريق..."
              rows={2}
              className="resize-none rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-gray-300 bg-gray-50 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !draft.name.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#D4AF37] py-2.5 text-sm font-bold text-[#1E2720] transition hover:bg-[#b5952f] disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                جاري الحفظ...
              </>
            ) : (
              'حفظ وإضافة للمسار'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
