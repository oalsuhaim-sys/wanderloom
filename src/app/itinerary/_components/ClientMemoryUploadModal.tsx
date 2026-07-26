'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

import { CrmModalBackdrop, CrmModalPanel } from '@/app/crm/_components/CrmShell';
import { uploadClientMemory } from '@/lib/client-memories';
import { supabaseClient } from '@/lib/supabaseClient';

type ClientMemoryUploadModalProps = {
  open: boolean;
  clientId: string | number;
  itineraryId: string | number;
  locationName: string;
  dayLabel?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function ClientMemoryUploadModal({
  open,
  clientId,
  itineraryId,
  locationName,
  dayLabel = null,
  onClose,
  onSuccess,
}: ClientMemoryUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setCaption('');
      setError('');
      setUploading(false);
      setSaved(false);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open]);

  if (!open) return null;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError('');
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabaseClient) {
      setError('تعذر الاتصال بخدمة التخزين.');
      return;
    }
    if (!selectedFile) {
      setError('اختر صورة أو التقط واحدة أولاً.');
      return;
    }

    setUploading(true);
    setError('');

    const trimmedCaption = caption.trim();
    const resolvedCaption =
      trimmedCaption ||
      [dayLabel?.trim(), locationName?.trim()].filter(Boolean).join(' · ') ||
      null;

    const result = await uploadClientMemory(supabaseClient, {
      itineraryId,
      locationName,
      file: selectedFile,
      caption: resolvedCaption,
    });

    setUploading(false);

    if (!result.ok) {
      setError(result.error || 'تعذر حفظ الذكرى.');
      return;
    }

    setSaved(true);
    onSuccess?.();
    window.setTimeout(() => {
      onClose();
    }, 900);
  }

  return (
    <>
      <CrmModalBackdrop onClose={uploading ? undefined : onClose} />
      <CrmModalPanel className="max-w-md">
        <div className="flex items-start justify-between gap-3 border-b border-[#1E2720]/10 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#D4AF37]">
              Polarsteps Journal
            </p>
            <h2 className="mt-1 text-lg font-black text-[#1E2720]">📸 أضف ذكرى</h2>
            <p className="mt-1 text-xs font-semibold text-gray-600">📍 {locationName}</p>
            {dayLabel ? (
              <p className="mt-0.5 text-[11px] font-bold text-gray-500">{dayLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 transition ${
              selectedFile
                ? 'border-[#D4AF37]/60 bg-[#FFFBF0]'
                : 'border-gray-200 bg-gray-50 hover:border-[#D4AF37]/40'
            }`}
          >
            {previewUrl ? (
              <div className="w-full space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="معاينة"
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <p className="text-center text-xs font-bold text-gray-600">{selectedFile?.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Camera className="h-8 w-8 text-[#D4AF37]" aria-hidden />
                <p className="text-sm font-black text-[#1E2720]">التقط أو اختر صورة</p>
                <p className="text-xs font-semibold text-gray-500">JPG · PNG · WebP</p>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">تعليق اختياري</label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="اكتب لحظة لا تُنسى…"
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
              {error}
            </p>
          ) : null}

          {saved ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-black text-emerald-800">
              ✓ تم حفظ الذكرى في رحلتك
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!selectedFile || uploading || saved}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1E2720] px-5 py-3 text-sm font-black text-[#D4AF37] transition hover:bg-[#243029] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                جاري الرفع…
              </>
            ) : saved ? (
              'تم الحفظ'
            ) : (
              'حفظ الذكرى'
            )}
          </button>
        </form>
      </CrmModalPanel>
    </>
  );
}
