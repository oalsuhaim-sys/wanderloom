'use client';

import { useState } from 'react';
import { FolderOpen, Image as ImageIcon, Search, Video } from 'lucide-react';

import { CRM_BTN_PRIMARY, CRM_INPUT } from '@/lib/crm-luxury-ui';

const FIELD_LABEL =
  'block text-xs font-semibold text-slate-600 dark:text-slate-300';

type AssetItem = {
  id: string;
  name: string;
  kind: 'image' | 'video' | 'folder';
  path: string;
  size: string;
};

const DEMO_ASSETS: AssetItem[] = [
  {
    id: 'a1',
    name: 'seoul-morning-reel.mp4',
    kind: 'video',
    path: 'archive/2026/q3/reels',
    size: '42 MB',
  },
  {
    id: 'a2',
    name: 'namdaemun-cover.jpg',
    kind: 'image',
    path: 'archive/2026/q3/covers',
    size: '3.1 MB',
  },
  {
    id: 'a3',
    name: 'brand-kit-autumn',
    kind: 'folder',
    path: 'archive/brand',
    size: '12 ملف',
  },
  {
    id: 'a4',
    name: 'group-trip-teaser.mp4',
    kind: 'video',
    path: 'archive/2026/q3/campaigns',
    size: '68 MB',
  },
];

function AssetIcon({ kind }: { kind: AssetItem['kind'] }) {
  if (kind === 'video') return <Video className="h-4 w-4" aria-hidden />;
  if (kind === 'image') return <ImageIcon className="h-4 w-4" aria-hidden />;
  return <FolderOpen className="h-4 w-4" aria-hidden />;
}

export default function AssetsTab() {
  const [archivePath, setArchivePath] = useState('archive/wanderloom/marketing');
  const [query, setQuery] = useState('');

  const filtered = DEMO_ASSETS.filter((asset) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      asset.name.toLowerCase().includes(q) ||
      asset.path.toLowerCase().includes(q) ||
      archivePath.toLowerCase().includes(q)
    );
  });

  return (
    <section dir="rtl" className="space-y-4" aria-labelledby="assets-tab-heading">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6">
        <p className="text-xs font-semibold tracking-wide text-slate-400 dark:text-[#D4AF37]/80">
          Asset Library
        </p>
        <h2
          id="assets-tab-heading"
          className="mt-1 text-lg font-bold text-slate-900 dark:text-white sm:text-xl"
        >
          مكتبة الأصول
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          اربط مسار الأرشيف ثم تصفّح الأصول المفهرسة.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <label className="block space-y-1.5">
            <span className={FIELD_LABEL}>مسار مجلد الأرشيف</span>
            <div className="relative">
              <FolderOpen
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                className={`${CRM_INPUT} !pr-10 font-mono text-xs sm:text-sm`}
                dir="ltr"
                value={archivePath}
                onChange={(e) => setArchivePath(e.target.value)}
                placeholder="archive/brand/…"
              />
            </div>
          </label>
          <div className="flex items-end">
            <button type="button" className={`${CRM_BTN_PRIMARY} w-full lg:w-auto`}>
              فهرسة المسار
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">الأصول المفهرسة</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {filtered.length} عنصر ضمن{' '}
              <span dir="ltr" className="font-mono">
                {archivePath || '—'}
              </span>
            </p>
          </div>
          <label className="relative block min-w-[14rem] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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

        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((asset) => (
            <li
              key={asset.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 transition hover:border-slate-300 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:hover:border-[#D4AF37]/35"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-[#D4AF37]">
                <AssetIcon kind={asset.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {asset.name}
                </p>
                <p dir="ltr" className="mt-0.5 truncate text-left font-mono text-[11px] text-slate-400">
                  {asset.path}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{asset.size}</p>
              </div>
            </li>
          ))}
        </ul>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400 dark:border-[#2D3F3A]">
            لا توجد أصول مطابقة للبحث.
          </p>
        ) : null}
      </div>
    </section>
  );
}
