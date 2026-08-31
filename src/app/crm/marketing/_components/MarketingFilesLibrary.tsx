'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CloudUpload,
  Download,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Trash2,
} from 'lucide-react';

import {
  deleteMarketingFile,
  listMarketingFiles,
  type MarketingStorageFile,
  uploadMarketingFile,
} from '@/lib/marketing-files';
import { CRM_BTN_PRIMARY } from '@/lib/crm-luxury-ui';

function fileIconForName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return FileSpreadsheet;
  if (ext === 'pdf') return FileText;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return ImageIcon;
  return File;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  onFilesCountChange?: (count: number) => void;
};

export default function MarketingFilesLibrary({ onFilesCountChange }: Props = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<MarketingStorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    const res = await listMarketingFiles();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? 'تعذّر تحميل الملفات');
      return;
    }
    setFiles(res.files);
    onFilesCountChange?.(res.files.length);
  }, [onFilesCountChange]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;

      setUploading(true);
      const res = await uploadMarketingFile(file);
      setUploading(false);

      if (!res.ok || !res.file) {
        toast.error(res.error ?? 'فشل رفع الملف');
        return;
      }

      setFiles((prev) => {
        const next = [res.file!, ...prev.filter((f) => f.path !== res.file!.path)];
        onFilesCountChange?.(next.length);
        return next;
      });
      toast.success('تم رفع الملف بنجاح');
    },
    [onFilesCountChange],
  );

  const handleDelete = useCallback(
    async (file: MarketingStorageFile) => {
      if (!window.confirm(`حذف «${file.name}» من مكتبة التسويق؟`)) return;

      setDeletingPath(file.path);
      const res = await deleteMarketingFile(file.path);
      setDeletingPath(null);

      if (!res.ok) {
        toast.error(res.error ?? 'تعذّر حذف الملف');
        return;
      }

      setFiles((prev) => {
        const next = prev.filter((f) => f.path !== file.path);
        onFilesCountChange?.(next.length);
        return next;
      });
      toast.success('تم حذف الملف');
    },
    [onFilesCountChange],
  );

  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6"
      dir="rtl"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-[#D4AF37]/80">
            <FolderOpen className="h-4 w-4" aria-hidden />
            Marketing Assets
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">مكتبة ملفات التسويق</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Excel · PDF · صور · مستندات</p>
        </div>
        <CloudUpload className="h-8 w-8 shrink-0 text-slate-300 dark:text-[#D4AF37]/70" aria-hidden />
      </div>

      <div
        className={`mb-6 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragOver
            ? 'border-[#D4AF37] bg-[#D4AF37]/10'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-[#2D3F3A] dark:bg-[#1A2421]'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleUpload(e.dataTransfer.files);
        }}
      >
        <CloudUpload className="mx-auto mb-3 h-10 w-10 text-slate-400 dark:text-[#D4AF37]" aria-hidden />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">اسحب الملف هنا أو</p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={`${CRM_BTN_PRIMARY} mt-3`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <CloudUpload className="h-4 w-4" aria-hidden />
          )}
          رفع ملف جديد
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,image/*,application/pdf"
          onChange={(e) => {
            void handleUpload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <p className="mb-3 text-xs font-semibold text-slate-500">الملفات المرفوعة ({files.length})</p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" aria-hidden />
          جاري تحميل الملفات…
        </div>
      ) : files.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs font-medium text-slate-400 dark:border-[#2D3F3A]">
          لا توجد ملفات بعد — ارفع أول ملف تسويقي.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => {
            const Icon = fileIconForName(file.path);
            const busy = deletingPath === file.path;
            return (
              <li
                key={file.path}
                className="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-transform hover:-translate-y-1 dark:border-[#2D3F3A] dark:bg-[#1A2421]"
              >
                <Icon
                  className="mb-3 h-12 w-12 text-slate-400 dark:text-[#D4AF37]/80"
                  aria-hidden
                />
                <p className="line-clamp-2 w-full text-sm font-semibold text-slate-900 dark:text-white" title={file.name}>
                  {file.name}
                </p>
                {file.size ? (
                  <p className="mt-1 text-[10px] font-medium text-slate-400" dir="ltr">
                    {formatFileSize(file.size)}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <a
                    href={file.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-300"
                    title="معاينة"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <a
                    href={file.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={file.name}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-300"
                    title="تحميل"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(file)}
                    className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:bg-transparent"
                    aria-label={`حذف ${file.name}`}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
