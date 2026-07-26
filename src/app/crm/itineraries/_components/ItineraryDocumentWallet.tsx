'use client';

import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';

import {
  isItineraryWalletFileAllowed,
  type ItineraryDocument,
} from '@/lib/itinerary-documents';
import { supabase } from '@/lib/supabase';

type Props = {
  documents: ItineraryDocument[];
  onChange: Dispatch<SetStateAction<ItineraryDocument[]>>;
  onNotice?: (message: string) => void;
  description?: string;
};

export default function ItineraryDocumentWallet({
  documents,
  onChange,
  onNotice,
  description = 'ارفع تذاكر الطيران والقسائم الفندقية — تُحفظ روابط الملفات مع المسار عند الحفظ النهائي.',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isItineraryWalletFileAllowed(file)) {
      const msg = 'يُقبل فقط PDF أو صور — بحد أقصى 10 ميجابايت';
      onNotice?.(msg);
      alert(msg);
      e.target.value = '';
      return;
    }

    if (!supabase) {
      const msg = 'تعذّر الاتصال بـ Supabase';
      onNotice?.(msg);
      alert(msg);
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `doc_${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage.from('attachments').upload(fileName, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName);

      const newDocument: ItineraryDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        url: urlData.publicUrl,
        uploadedAt: new Date().toISOString(),
        mimeType: file.type || undefined,
      };

      onChange((prev) => [...prev, newDocument]);
      onNotice?.('تم رفع المستند — سيُحفظ مع المسار عند الضغط على «حفظ المسار».');
    } catch (err) {
      console.error('Upload failed:', err);
      const msg =
        err instanceof Error ? err.message : 'فشل رفع الملف، يرجى المحاولة مرة أخرى.';
      onNotice?.(msg);
      alert('فشل رفع الملف، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const openFilePicker = () => {
    if (!isUploading) fileInputRef.current?.click();
  };

  const removeDocument = (docId: string) => {
    onChange((prev) => prev.filter((d) => d.id !== docId));
  };

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#1E2720]">
        <FileText className="h-5 w-5 text-[#D4AF37]" aria-hidden />
        محفظة المستندات (PDF)
      </h3>
      <p className="mb-4 text-sm text-gray-500">{description}</p>

      {/* Invisible file input overlay — receives clicks directly (no dead zone) */}
      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFilePicker();
          }
        }}
        className={`relative mb-4 flex min-h-[8.5rem] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-[#D4AF37]/40 bg-[#FEFDF9] px-6 py-8 transition hover:border-[#D4AF37]/70 hover:bg-[#FFFBF0] ${
          isUploading ? 'opacity-60' : ''
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          disabled={isUploading}
          onChange={(e) => void handleUpload(e)}
          className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label="إرفاق مستند PDF أو صورة"
        />

        <div className="pointer-events-none relative z-10 flex flex-col items-center gap-2">
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" aria-hidden />
          ) : (
            <Upload className="h-8 w-8 text-[#D4AF37]" aria-hidden />
          )}
          <span className="text-sm font-bold text-gray-800">
            {isUploading ? 'جاري الرفع…' : 'اضغط لرفع PDF أو صورة'}
          </span>
          <span className="text-xs text-gray-500">تذكرة · قسيمة فندق · تأكيد حجز</span>
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
          لا توجد مستندات بعد.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc, docIndex) => (
            <li
              key={doc.id ?? `doc-${docIndex}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">{doc.name || 'مستند'}</p>
                {doc.uploadedAt ? (
                  <p className="text-xs text-gray-500">
                    {new Date(doc.uploadedAt).toLocaleString('ar-SA')}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[#D4AF37]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#1E2720] hover:bg-[#FEFDF9]"
                  >
                    عرض الملف
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeDocument(doc.id)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
