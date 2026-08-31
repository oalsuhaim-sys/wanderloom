'use client';

import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';

import {
  isItineraryWalletFileAllowed,
  type ItineraryDocument,
} from '@/lib/itinerary-documents';
import { toast } from '@/lib/crm-toast';
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
      toast.error(msg);
      e.target.value = '';
      return;
    }

    if (!supabase) {
      const msg = 'تعذّر الاتصال بـ Supabase';
      onNotice?.(msg);
      toast.error(msg);
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
      toast.error('فشل رفع الملف، يرجى المحاولة مرة أخرى.');
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
    <section className="mb-6 w-full max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#D4AF37]">
        <FileText className="h-5 w-5 text-[#D4AF37]" aria-hidden />
        محفظة المستندات (PDF)
      </h3>
      <p className="mb-4 text-sm text-slate-500">{description}</p>

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
        className={`relative mb-4 flex min-h-[8.5rem] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-[#D4AF37]/40 bg-slate-50 px-6 py-8 transition hover:border-[#D4AF37]/70 hover:bg-slate-50 ${
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
          <span className="text-sm font-bold text-slate-100">
            {isUploading ? 'جاري الرفع…' : 'اضغط لرفع PDF أو صورة'}
          </span>
          <span className="text-xs text-slate-500">تذكرة · قسيمة فندق · تأكيد حجز</span>
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
          لا توجد مستندات بعد.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc, docIndex) => (
            <li
              key={doc.id ?? `doc-${docIndex}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-slate-900">{doc.name || 'مستند'}</p>
                {doc.uploadedAt ? (
                  <p className="text-xs text-slate-500">
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
                    className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-200"
                  >
                    عرض الملف
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeDocument(doc.id)}
                  className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/50"
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
