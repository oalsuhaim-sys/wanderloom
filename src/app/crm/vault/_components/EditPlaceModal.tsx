'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { CRM_BTN_PRIMARY, CRM_INPUT, CRM_MODAL_PANEL } from '@/lib/crm-luxury-ui';
import { supabase } from '@/lib/supabase';

export type EditablePlace = {
  id: string;
  name?: string | null;
  country?: string | null;
  city?: string | null;
  branch_name?: string | null;
  map_url?: string | null;
  maps_url?: string | null;
  google_maps_url?: string | null;
  sub_tag?: string | null;
  category?: string | null;
};

type CategoryOption = { id: string; label: string };

type EditPlaceModalProps = {
  place: EditablePlace;
  categoryOptions: CategoryOption[];
  onClose: () => void;
  onSaved: () => void;
};

type PlaceFormData = {
  name: string;
  country: string;
  city: string;
  branch_name: string;
  map_url: string;
  sub_tag: string;
  category: string;
};

function resolveMapUrl(place: EditablePlace): string {
  return String(place.map_url || place.maps_url || place.google_maps_url || '').trim();
}

export default function EditPlaceModal({
  place,
  categoryOptions,
  onClose,
  onSaved,
}: EditPlaceModalProps) {
  const [formData, setFormData] = useState<PlaceFormData>({
    name: place?.name || '',
    country: place?.country || '',
    city: place?.city || '',
    branch_name: place?.branch_name || '',
    map_url: resolveMapUrl(place),
    sub_tag: place?.sub_tag || '',
    category: place?.category || 'o',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      name: place?.name || '',
      country: place?.country || '',
      city: place?.city || '',
      branch_name: place?.branch_name || '',
      map_url: resolveMapUrl(place),
      sub_tag: place?.sub_tag || '',
      category: place?.category || 'o',
    });
    setError(null);
  }, [place]);

  const save = async () => {
    if (!supabase || !place?.id) return;
    setSaving(true);
    setError(null);

    const branchName = formData.branch_name.trim() || null;
    const mapUrl = formData.map_url.trim() || null;

    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      country: formData.country.trim(),
      city: formData.city.trim(),
      branch_name: branchName,
      map_url: mapUrl,
      maps_url: mapUrl,
      google_maps_url: mapUrl,
      sub_tag: formData.sub_tag.trim() || null,
      category: formData.category,
    };

    let { error: updateError } = await supabase
      .from('places')
      .update(payload)
      .eq('id', place.id);

    // Fall back if optional map alias columns are missing from schema
    if (
      updateError &&
      /column|schema cache|does not exist|could not find/i.test(updateError.message)
    ) {
      const corePayload = {
        name: payload.name,
        country: payload.country,
        city: payload.city,
        branch_name: branchName,
        map_url: mapUrl,
        sub_tag: payload.sub_tag,
        category: payload.category,
      };
      const retry = await supabase.from('places').update(corePayload).eq('id', place.id);
      updateError = retry.error;

      if (
        updateError &&
        /column|schema cache|does not exist|could not find/i.test(updateError.message)
      ) {
        const minimal = {
          name: payload.name,
          country: payload.country,
          city: payload.city,
          sub_tag: payload.sub_tag,
          category: payload.category,
        };
        const last = await supabase.from('places').update(minimal).eq('id', place.id);
        updateError = last.error;
        if (!updateError) {
          setError(
            'تم حفظ الاسم/المدينة، لكن أعمدة الفرع ورابط الخريطة غير موجودة في قاعدة البيانات. نفّذ places_branch_and_map_url.sql',
          );
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);

    if (updateError) {
      setError(updateError.message || 'تعذر حفظ التعديلات.');
      toast.error('تعذر حفظ التعديلات.');
      return;
    }

    toast.success('تم حفظ التعديلات.');
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className={CRM_MODAL_PANEL} onClick={(e) => e.stopPropagation()} dir="rtl">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">تعديل المكان</h2>

        <label className="mb-3 block text-xs font-semibold text-slate-500">
          الاسم
          <input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`${CRM_INPUT} mt-1`}
          />
        </label>

        <label className="mb-3 block text-xs font-semibold text-slate-500">
          الدولة
          <input
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            className={`${CRM_INPUT} mt-1`}
          />
        </label>

        <label className="mb-3 block text-xs font-semibold text-slate-500">
          المدينة
          <input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className={`${CRM_INPUT} mt-1`}
          />
        </label>

        <div className="mb-3 space-y-1 text-right">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
            اسم الفرع / المنطقة{' '}
            <span className="font-normal text-slate-400">(اختياري)</span>
          </label>
          <input
            type="text"
            placeholder="مثال: فرع سيونغسو / Seongsu"
            value={formData.branch_name}
            onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-right text-sm font-medium outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100"
            dir="rtl"
          />
        </div>

        <div className="mb-3 space-y-1 text-right">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
            رابط خريطة المكان (Google / Naver Map){' '}
            <span className="font-normal text-slate-400">(اختياري)</span>
          </label>
          <input
            type="url"
            placeholder="https://maps.app.goo.gl/..."
            value={formData.map_url}
            onChange={(e) => setFormData({ ...formData, map_url: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100"
            dir="ltr"
          />
        </div>

        <label className="mb-3 block text-xs font-semibold text-slate-500">
          الوصف
          <input
            value={formData.sub_tag}
            onChange={(e) => setFormData({ ...formData, sub_tag: e.target.value })}
            className={`${CRM_INPUT} mt-1`}
          />
        </label>

        <label className="mb-4 block text-xs font-semibold text-slate-500">
          التصنيف
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className={`${CRM_INPUT} mt-1`}
          >
            {categoryOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !formData.name.trim()}
          className={`${CRM_BTN_PRIMARY} w-full`}
        >
          {saving ? 'جاري الحفظ…' : 'حفظ التعديلات'}
        </button>
      </div>
    </div>
  );
}
