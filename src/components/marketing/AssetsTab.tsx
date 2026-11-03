'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Download,
  FolderOpen,
  Home,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Search,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { CRM_BTN_PRIMARY, CRM_INPUT } from '@/lib/crm-luxury-ui';
import {
  deleteMarketingFile,
  deleteMarketingFolder,
  detectMarketingAssetKind,
  downloadMarketingFile,
  listMarketingFilesAt,
  normalizeStoragePrefix,
  type MarketingAssetKind,
  type MarketingStorageFile,
} from '@/lib/marketing-files';

const FIELD_LABEL = 'block text-xs font-semibold text-slate-600 dark:text-slate-300';
const DEFAULT_ROOT = 'archive/wanderloom/marketing';

type PreviewState = {
  name: string;
  url: string;
  kind: 'image' | 'video';
} | null;

function formatFileSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetIcon({ kind }: { kind: MarketingAssetKind }) {
  if (kind === 'video') return <Video className="h-5 w-5" aria-hidden />;
  if (kind === 'image') return <ImageIcon className="h-5 w-5" aria-hidden />;
  if (kind === 'folder') return <FolderOpen className="h-5 w-5" aria-hidden />;
  return <FolderOpen className="h-5 w-5" aria-hidden />;
}

function AssetCard({
  asset,
  kind,
  busy,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onOpen,
  onDownload,
  onDelete,
}: {
  asset: MarketingStorageFile;
  kind: MarketingAssetKind;
  busy: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const isMedia = kind === 'image' || kind === 'video';

  return (
    <li className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 transition hover:border-slate-300 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:hover:border-brand-gold/35">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col items-stretch text-right"
      >
        <div className="relative flex h-36 items-center justify-center overflow-hidden bg-slate-100 dark:bg-[#0f1614]">
          {kind === 'image' && asset.publicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.publicUrl}
              alt={asset.name}
              className="h-full w-full object-cover"
            />
          ) : kind === 'video' && asset.publicUrl ? (
            <video
              src={asset.publicUrl}
              className="h-full w-full object-cover"
              muted
              preload="metadata"
            />
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-brand-gold">
              <AssetIcon kind={kind} />
            </span>
          )}
          <span className="absolute bottom-2 left-2 rounded-lg bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
            {kind === 'folder' ? 'مجلد' : kind === 'video' ? 'فيديو' : kind === 'image' ? 'صورة' : 'ملف'}
          </span>
        </div>
        <div className="space-y-1 p-3.5">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={asset.name}>
            {asset.name}
          </p>
          <p dir="ltr" className="truncate text-left font-mono text-[11px] text-slate-400">
            {asset.path}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {kind === 'folder' ? 'افتح المجلد' : formatFileSize(asset.size)}
          </p>
        </div>
      </button>

      <div className="absolute top-2 left-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
        {kind !== 'folder' ? (
          <button
            type="button"
            title="تحميل"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="rounded-lg border border-slate-200 bg-white/95 p-1.5 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          title="حذف"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-lg border border-rose-200 bg-white/95 p-1.5 text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:bg-[#22302C]"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <div className="relative">
          <button
            type="button"
            title="المزيد"
            onClick={(e) => {
              e.stopPropagation();
              if (menuOpen) onCloseMenu();
              else onOpenMenu();
            }}
            className="rounded-lg border border-slate-200 bg-white/95 p-1.5 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-200"
          >
            <MoreVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
          {menuOpen ? (
            <div
              className="absolute left-0 top-full z-20 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-[#2D3F3A] dark:bg-[#22302C]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#1A2421]"
                onClick={() => {
                  onOpen();
                  onCloseMenu();
                }}
              >
                {kind === 'folder' ? 'فتح المجلد' : isMedia ? 'معاينة' : 'فتح'}
              </button>
              {kind !== 'folder' ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#1A2421]"
                  onClick={() => {
                    onDownload();
                    onCloseMenu();
                  }}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  تحميل
                </button>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() => {
                  onDelete();
                  onCloseMenu();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                حذف
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function AssetsTab() {
  const [archivePath, setArchivePath] = useState(DEFAULT_ROOT);
  const [currentPath, setCurrentPath] = useState(DEFAULT_ROOT);
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState<MarketingStorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);

  const breadcrumbs = useMemo(() => {
    const clean = normalizeStoragePrefix(currentPath);
    if (!clean) return [] as { label: string; path: string }[];
    const parts = clean.split('/');
    return parts.map((label, i) => ({
      label,
      path: parts.slice(0, i + 1).join('/'),
    }));
  }, [currentPath]);

  const loadFolder = useCallback(async (path: string, opts?: { showToast?: boolean }) => {
    const clean = normalizeStoragePrefix(path);
    setLoading(true);
    const res = await listMarketingFilesAt(clean);
    setLoading(false);
    if (!res.ok) {
      setAssets([]);
      if (opts?.showToast !== false) {
        toast.error(res.error ?? 'تعذر فهرسة المجلد');
      }
      return;
    }
    setAssets(res.files);
    setCurrentPath(clean);
    setArchivePath(clean);
    setMenuPath(null);
  }, []);

  useEffect(() => {
    void loadFolder(DEFAULT_ROOT, { showToast: false });
  }, [loadFolder]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(q) || asset.path.toLowerCase().includes(q),
    );
  }, [assets, query]);

  const openAsset = (asset: MarketingStorageFile) => {
    const kind = detectMarketingAssetKind(asset.name, asset.kind === 'folder');
    if (kind === 'folder') {
      void loadFolder(asset.path);
      return;
    }
    if ((kind === 'image' || kind === 'video') && asset.publicUrl) {
      setPreview({ name: asset.name, url: asset.publicUrl, kind });
      return;
    }
    if (asset.publicUrl) {
      window.open(asset.publicUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = async (asset: MarketingStorageFile) => {
    if (asset.kind === 'folder') return;
    const res = await downloadMarketingFile(asset.path, asset.name);
    if (!res.ok) {
      // fallback: open public URL
      if (asset.publicUrl) {
        const a = document.createElement('a');
        a.href = asset.publicUrl;
        a.download = asset.name;
        a.target = '_blank';
        a.rel = 'noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      toast.error(res.error ?? 'تعذر التحميل');
      return;
    }
    toast.success('بدأ التحميل');
  };

  const handleDelete = async (asset: MarketingStorageFile) => {
    const isFolder = asset.kind === 'folder';
    const ok = window.confirm(
      isFolder
        ? `حذف المجلد «${asset.name}» وكل محتوياته من التخزين؟ لا يمكن التراجع.`
        : `حذف «${asset.name}» من مكتبة الأصول؟`,
    );
    if (!ok) return;

    setDeletingPath(asset.path);
    const res = isFolder
      ? await deleteMarketingFolder(asset.path)
      : await deleteMarketingFile(asset.path);
    setDeletingPath(null);

    if (!res.ok) {
      toast.error(res.error ?? 'تعذر الحذف');
      return;
    }

    setAssets((prev) => prev.filter((a) => a.path !== asset.path));
    if (preview?.name === asset.name) setPreview(null);
    toast.success(isFolder ? 'تم حذف المجلد' : 'تم حذف الملف');
  };

  const goUp = () => {
    const parts = normalizeStoragePrefix(currentPath).split('/').filter(Boolean);
    if (parts.length <= 1) {
      void loadFolder('');
      return;
    }
    void loadFolder(parts.slice(0, -1).join('/'));
  };

  return (
    <section dir="rtl" className="space-y-4" aria-labelledby="assets-tab-heading">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6">
        <p className="text-xs font-semibold tracking-wide text-slate-400 dark:text-brand-gold/80">
          Asset Library
        </p>
        <h2
          id="assets-tab-heading"
          className="mt-1 text-lg font-bold text-slate-900 dark:text-white sm:text-xl"
        >
          مكتبة الأصول
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          تصفّح المجلدات، عاين الصور والفيديو، حمّل أو احذف مباشرة من التخزين.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <label className="block space-y-1.5">
            <span className={FIELD_LABEL}>مسار مجلد الأرشيف</span>
            <div className="relative">
              <FolderOpen
                className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                className={`${CRM_INPUT} !pr-10 font-mono text-xs sm:text-sm`}
                dir="ltr"
                value={archivePath}
                onChange={(e) => setArchivePath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void loadFolder(archivePath);
                  }
                }}
                placeholder="archive/brand/…"
              />
            </div>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={indexing || loading}
              className={`${CRM_BTN_PRIMARY} w-full lg:w-auto`}
              onClick={async () => {
                setIndexing(true);
                await loadFolder(archivePath);
                setIndexing(false);
                toast.success('تمت فهرسة المسار');
              }}
            >
              {indexing || loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              فهرسة المسار
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6">
        {/* Breadcrumbs */}
        <nav
          className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-[#2D3F3A] dark:bg-[#1A2421]"
          aria-label="مسار الأرشيف"
          dir="ltr"
        >
          <button
            type="button"
            onClick={() => void loadFolder('')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-slate-600 hover:bg-white dark:text-brand-gold dark:hover:bg-[#22302C]"
            title="الجذر"
          >
            <Home className="h-3.5 w-3.5" aria-hidden />
            root
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="inline-flex items-center gap-1">
              <span className="text-slate-300">/</span>
              <button
                type="button"
                onClick={() => void loadFolder(crumb.path)}
                className={`rounded-lg px-2 py-1 font-mono font-bold ${
                  i === breadcrumbs.length - 1
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-[#22302C] dark:text-white'
                    : 'text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-[#22302C]'
                }`}
              >
                {crumb.label}
              </button>
            </span>
          ))}
          {normalizeStoragePrefix(currentPath) ? (
            <button
              type="button"
              onClick={goUp}
              className="mr-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-slate-500 hover:bg-white dark:hover:bg-[#22302C]"
              title="المجلد الأعلى"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              أعلى
            </button>
          ) : null}
        </nav>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">الأصول المفهرسة</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {filtered.length} عنصر ضمن{' '}
              <span dir="ltr" className="font-mono">
                {currentPath || '/'}
              </span>
            </p>
          </div>
          <label className="relative block min-w-[14rem] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              className={`${CRM_INPUT} !pr-10`}
              placeholder="بحث في الأصول…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-medium text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-brand-gold" aria-hidden />
            جاري تحميل الأصول…
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((asset) => {
              const kind = detectMarketingAssetKind(asset.name, asset.kind === 'folder');
              return (
                <AssetCard
                  key={asset.path}
                  asset={asset}
                  kind={kind}
                  busy={deletingPath === asset.path}
                  menuOpen={menuPath === asset.path}
                  onOpenMenu={() => setMenuPath(asset.path)}
                  onCloseMenu={() => setMenuPath(null)}
                  onOpen={() => openAsset(asset)}
                  onDownload={() => void handleDownload(asset)}
                  onDelete={() => void handleDelete(asset)}
                />
              );
            })}
          </ul>
        )}

        {!loading && filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400 dark:border-[#2D3F3A]">
            لا توجد أصول في هذا المسار — جرّب فهرسة مسار آخر أو ارفع ملفات إلى التخزين.
          </p>
        ) : null}
      </div>

      {/* Lightbox */}
      {preview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`معاينة ${preview.name}`}
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            className="absolute top-4 left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setPreview(null)}
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="truncate text-sm font-bold text-white">{preview.name}</p>
              <a
                href={preview.url}
                download={preview.name}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                تحميل
              </a>
            </div>
            <div className="flex max-h-[80vh] items-center justify-center bg-black p-2">
              {preview.kind === 'video' ? (
                <video
                  src={preview.url}
                  controls
                  autoPlay
                  className="max-h-[78vh] w-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="max-h-[78vh] w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
