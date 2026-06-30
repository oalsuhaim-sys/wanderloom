'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CloudUpload,
  Download,
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

const LUXURY_CARD =
  'flex h-full flex-col gap-5 rounded-[1.75rem] border border-[#1e3f20]/10 bg-white p-6 shadow-[0_12px_40px_rgba(30,63,32,0.06)]';

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

export default function MarketingFilesLibrary() {
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
  }, []);

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

      setFiles((prev) => [res.file!, ...prev.filter((f) => f.path !== res.file!.path)]);
      toast.success('تم رفع الملف بنجاح', { style: { background: '#1e3f20', color: '#fff' } });
    },
    [],
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

      setFiles((prev) => prev.filter((f) => f.path !== file.path));
      toast.success('تم حذف الملف');
    },
    [],
  );

  return (
    <article className={LUXURY_CARD} dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black text-[#cda04c]">
            <FolderOpen className="h-4 w-4" aria-hidden />
            Marketing Assets
          </p>
          <h2 className="mt-1 text-xl font-black text-[#1e3f20]">مكتبة ملفات التسويق</h2>
          <p className="mt-1 text-xs font-bold text-gray-500">Excel · PDF · صور · مستندات</p>
        </div>
        <CloudUpload className="h-8 w-8 shrink-0 text-[#cda04c]/70" aria-hidden />
      </div>

      <div
        className={`rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragOver
            ? 'border-[#cda04c] bg-[#cda04c]/10'
            : 'border-[#1e3f20]/15 bg-[#FDFBF7] hover:border-[#cda04c]/45 hover:bg-[#f4f0e6]/60'
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
        <CloudUpload className="mx-auto mb-3 h-10 w-10 text-[#cda04c]" aria-hidden />
        <p className="text-sm font-black text-[#1e3f20]">اسحب الملف هنا أو</p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#1e3f20] px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-[#163318] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <CloudUpload className="h-4 w-4 text-[#cda04c]" aria-hidden />
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

      <div className="min-h-[120px] flex-1">
        <p className="mb-3 text-xs font-black text-[#1e3f20]">الملفات المرفوعة ({files.length})</p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#cda04c]" aria-hidden />
            جاري تحميل الملفات…
          </div>
        ) : files.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#1e3f20]/12 bg-[#FDFBF7] px-4 py-6 text-center text-xs font-bold text-gray-400">
            لا توجد ملفات بعد — ارفع أول ملف تسويقي.
          </p>
        ) : (
          <ul className="max-h-[320px] space-y-2 overflow-y-auto">
            {files.map((file) => {
              const Icon = fileIconForName(file.path);
              const busy = deletingPath === file.path;
              return (
                <li
                  key={file.path}
                  className="flex items-center gap-3 rounded-xl border border-[#1e3f20]/8 bg-[#FDFBF7] px-3 py-2.5"
                >
                  <Icon className="h-5 w-5 shrink-0 text-[#cda04c]" aria-hidden />
                  <div className="min-w-0 flex-1 text-right">
                    <p className="truncate text-sm font-black text-[#1e3f20]" title={file.name}>
                      {file.name}
                    </p>
                    {file.size ? (
                      <p className="text-[10px] font-bold text-gray-400" dir="ltr">
                        {formatFileSize(file.size)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={file.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      download={file.name}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#1e3f20]/15 bg-white px-2.5 py-1.5 text-[11px] font-black text-[#1e3f20] transition hover:bg-[#f4f0e6]"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      تحميل
                    </a>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete(file)}
                      className="rounded-lg border border-red-200 bg-white p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      aria-label={`حذف ${file.name}`}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}
