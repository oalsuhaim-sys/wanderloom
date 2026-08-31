'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import toast from 'react-hot-toast';
import { Clapperboard, Copy, Image as ImageIcon, Loader2, Pencil, Sparkles, Upload, Video, X } from 'lucide-react';

import { uploadMarketingVideo } from '@/lib/marketing-files';
import MarketingContentFilterBar, {
  EDIT_CATEGORY_OPTIONS,
  EDIT_MEDIA_TYPE_OPTIONS,
  filterMarketingContentCards,
} from '@/app/crm/marketing/_components/MarketingContentFilterBar';
import {
  fetchAllMarketingContent,
  normalizeContentCategory,
  normalizeMediaType,
  resolveMarketingCardCaption,
  resolveMarketingCardPrompt,
  updateMarketingContent,
  type MarketingContentCategory,
  type MarketingContentItem,
  type MarketingMediaType,
  type MarketingProductionType,
} from '@/lib/marketing-content';

const OUTER_CARD =
  'bg-white dark:bg-[#22302C] border border-slate-200 dark:border-[#2D3F3A] rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col min-h-0';

const TAG_BASE =
  'bg-slate-100 text-slate-700 dark:bg-[#1A2421] dark:text-slate-300 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-[#2D3F3A]';

const TAG_READY =
  'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50 px-2.5 py-1 rounded-md text-xs font-medium';

const DARK_STUDIO =
  'shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]';

const FIELD =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-900 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-white dark:focus:ring-[#D4AF37]/50';

const TEXTAREA =
  'w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 outline-none transition focus:ring-2 focus:ring-slate-900 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-300 dark:focus:ring-[#D4AF37]/50';

const STATUS_OPTIONS = [
  'جاهز للتوليد',
  'تم النسخ',
  'تم التوليد',
  'بانتظار التصوير',
  'تم الرفع',
] as const;

function isReadyStatus(status: string): boolean {
  const s = String(status ?? '').trim();
  return s === 'جاهز للتوليد' || s.includes('جاهز') || s.toLowerCase().includes('ready');
}

function ProductionVideoPlayer({ url }: { url: string }) {
  return (
    <div className={`${DARK_STUDIO} overflow-hidden p-0`}>
      <video
        src={url}
        controls
        playsInline
        className="aspect-video w-full bg-black object-contain"
        preload="metadata"
      />
    </div>
  );
}

function VideoPlaceholder({ label }: { label: string }) {
  return (
    <div className={`${DARK_STUDIO} flex aspect-video flex-col items-center justify-center gap-2 text-center`}>
      <Upload className="h-8 w-8 text-slate-300 dark:text-slate-600" aria-hidden />
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  );
}

type ProductionCardConfig = {
  productionType: MarketingProductionType;
  header: string;
  headerIcon: typeof Sparkles;
  accentClass: string;
  fieldLabel: string;
  fieldPlaceholder: string;
  actionLabel: string;
  actionIcon: typeof Copy;
  getFieldValue: (item: MarketingContentItem) => string;
  patchField: (value: string) => Record<string, string>;
  emptyVideoLabel: string;
  onAction: (ctx: {
    item: MarketingContentItem;
    fieldValue: string;
    setItem: (item: MarketingContentItem) => void;
    setBusy: (v: boolean) => void;
    fileInputRef: RefObject<HTMLInputElement | null>;
  }) => void | Promise<void>;
};

function updateCard(
  item: MarketingContentItem,
  patch: Parameters<typeof updateMarketingContent>[1],
) {
  return updateMarketingContent(item.id, patch, { dataSource: item.dataSource });
}

const AI_CONFIG: ProductionCardConfig = {
  productionType: 'ai',
  header: 'الذكاء الاصطناعي',
  headerIcon: Sparkles,
  accentClass: 'text-[#D4AF37]',
  fieldLabel: 'البرومبت',
  fieldPlaceholder: 'اكتب البرومبت البصري لـ Midjourney / Sora…',
  actionLabel: 'نسخ البرومبت',
  actionIcon: Copy,
  getFieldValue: (item) => item.prompt_text || item.prompt || '',
  patchField: (value) => ({ prompt: value }),
  emptyVideoLabel: 'سيظهر الفيديو المُولَّد هنا بعد الرفع',
  onAction: async ({ item, setItem, setBusy }) => {
    const promptText = item.prompt_text || item.prompt;
    if (!promptText.trim()) {
      toast.error('البرومبت فارغ — اكتب نصاً للنسخ أولاً');
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      toast.success('تم نسخ البرومبت بنجاح');
    } catch {
      toast.error('تعذّر النسخ إلى الحافظة');
      return;
    }

    setBusy(true);
    const res = await updateCard(item, {
      prompt: promptText,
      status: 'تم النسخ',
    });
    setBusy(false);
    if (res.ok && res.item) {
      setItem(res.item);
    }
  },
};

const HUMAN_CONFIG: ProductionCardConfig = {
  productionType: 'human',
  header: 'الإنتاج البشري',
  headerIcon: Clapperboard,
  accentClass: 'text-[#D4AF37]',
  fieldLabel: 'السكريبت',
  fieldPlaceholder: 'اكتب سكريبت التصوير والـ voiceover…',
  actionLabel: 'رفع الفيديو النهائي',
  actionIcon: Upload,
  getFieldValue: (item) => item.script,
  patchField: (value) => ({ script: value }),
  emptyVideoLabel: 'ارفع الفيديو النهائي ليظهر هنا',
  onAction: ({ fileInputRef }) => {
    fileInputRef.current?.click();
  },
};

function configForItem(item: MarketingContentItem): ProductionCardConfig {
  return item.productionType === 'ai' ? AI_CONFIG : HUMAN_CONFIG;
}

function MediaBadge({ mediaType }: { mediaType: string }) {
  const Icon = mediaType === 'صورة' ? ImageIcon : Video;
  return (
    <span className={`inline-flex items-center gap-1 ${TAG_BASE}`}>
      <Icon className="h-3 w-3 text-[#D4AF37]" aria-hidden />
      {mediaType}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return <span className={TAG_BASE}>{category}</span>;
}

function StatusBadge({
  status,
  onClick,
}: {
  status: string;
  onClick?: () => void;
}) {
  const label = String(status ?? '').trim() || '—';
  const ready = isReadyStatus(label);
  const className = ready ? TAG_READY : TAG_BASE;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} cursor-pointer transition hover:brightness-95 active:scale-[0.98]`}
        title="تعديل / توليد المحتوى"
      >
        {label}
      </button>
    );
  }

  return <span className={className}>{label}</span>;
}

/** Premium in-studio editor — no route change */
function EditContentModal({
  item,
  onClose,
  onSaved,
}: {
  item: MarketingContentItem;
  onClose: () => void;
  onSaved: (updated: MarketingContentItem) => void;
}) {
  const [title, setTitle] = useState(
    () => item.title || configForItem(item).header,
  );
  const [category, setCategory] = useState<MarketingContentCategory>(() =>
    normalizeContentCategory(item.contentCategory),
  );
  const [mediaType, setMediaType] = useState<MarketingMediaType>(() =>
    normalizeMediaType(item.mediaType),
  );
  const [status, setStatus] = useState(() => String(item.status ?? '').trim() || 'جاهز للتوليد');
  const [bodyText, setBodyText] = useState(() =>
    item.productionType === 'ai'
      ? item.prompt_text || item.prompt || ''
      : item.script || '',
  );
  const [caption, setCaption] = useState(item.caption || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(item.title || configForItem(item).header);
    setCategory(normalizeContentCategory(item.contentCategory));
    setMediaType(normalizeMediaType(item.mediaType));
    setStatus(String(item.status ?? '').trim() || 'جاهز للتوليد');
    setBodyText(
      item.productionType === 'ai'
        ? item.prompt_text || item.prompt || ''
        : item.script || '',
    );
    setCaption(item.caption || '');
  }, [item]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateCard(item, {
      title: title.trim() || configForItem(item).header,
      media_type: mediaType,
      content_category: category,
      status: status.trim() || item.status,
      caption,
      ...(item.productionType === 'ai'
        ? { prompt: bodyText }
        : { script: bodyText }),
    });
    setSaving(false);
    if (!res.ok || !res.item) {
      toast.error(res.error ?? 'تعذّر حفظ التعديلات');
      return;
    }
    onSaved(res.item);
    toast.success('تم حفظ واعتماد المحتوى');
    onClose();
  };

  const statusChoices = useMemo(() => {
    const base = [...STATUS_OPTIONS];
    if (status && !base.includes(status as (typeof STATUS_OPTIONS)[number])) {
      base.unshift(status as (typeof STATUS_OPTIONS)[number]);
    }
    return base;
  }, [status]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-all dark:bg-black/60"
      dir="rtl"
      lang="ar"
      role="dialog"
      aria-modal="true"
      aria-labelledby="content-editor-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2D3F3A] dark:bg-[#1A2421]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-[#2D3F3A]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              Content Editor
            </p>
            <h2
              id="content-editor-title"
              className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white"
            >
              تعديل المحتوى
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:text-rose-500 active:scale-[0.98]"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-500 dark:text-[#D4AF37]">
                العنوان
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={FIELD}
                placeholder="عنوان المحتوى…"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-500 dark:text-[#D4AF37]">
                الوسوم
              </label>
              <div className="flex flex-wrap gap-2">
                {EDIT_MEDIA_TYPE_OPTIONS.map((type) => {
                  const active = mediaType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMediaType(type)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.98] ${
                        active
                          ? 'bg-slate-900 text-white shadow-sm dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                          : TAG_BASE
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
                {statusChoices.map((opt) => {
                  const active = status === opt;
                  const ready = isReadyStatus(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setStatus(opt)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.98] ${
                        active
                          ? ready
                            ? TAG_READY + ' ring-2 ring-emerald-300/60 dark:ring-emerald-700/50'
                            : 'bg-slate-900 text-white shadow-sm dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                          : ready
                            ? TAG_READY + ' opacity-70'
                            : TAG_BASE
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MarketingContentCategory)}
                  className={FIELD}
                  aria-label="تصنيف المحتوى"
                >
                  {EDIT_CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Caption
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className={`${TEXTAREA} h-40`}
                placeholder="النص التسويقي للمنشور…"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                {item.productionType === 'ai' ? 'البرومبت (AI Prompt)' : 'السكريبت'}
              </label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                dir={item.productionType === 'ai' ? 'ltr' : 'rtl'}
                className={`${TEXTAREA} h-36 ${item.productionType === 'ai' ? 'font-mono text-xs' : ''}`}
                placeholder={
                  item.productionType === 'ai'
                    ? 'Visual prompt for Midjourney / Sora…'
                    : 'اكتب سكريبت التصوير…'
                }
              />
            </div>
          </div>

          <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 p-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]/50">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-5 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-100 active:scale-[0.98] dark:text-slate-400 dark:hover:bg-[#22302C]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-slate-900 px-5 py-2 font-medium text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/30"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              حفظ واعتماد
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function ProductionStudioCard({
  item: initialItem,
  allCards,
  onItemChange,
  onEdit,
}: {
  item: MarketingContentItem;
  allCards: MarketingContentItem[];
  onItemChange: (item: MarketingContentItem) => void;
  onEdit: () => void;
}) {
  const config = configForItem(initialItem);
  const HeaderIcon = config.headerIcon;
  const ActionIcon = config.actionIcon;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayPrompt = useMemo(
    () => resolveMarketingCardPrompt(initialItem, allCards),
    [initialItem, allCards],
  );
  const displayCaption = useMemo(
    () => resolveMarketingCardCaption(initialItem, allCards),
    [initialItem, allCards],
  );

  const [busy, setBusy] = useState(false);
  const [item, setItem] = useState<MarketingContentItem>(() => ({
    ...initialItem,
    prompt: displayPrompt,
    prompt_text: displayPrompt,
    caption: displayCaption,
  }));

  useEffect(() => {
    const prompt = resolveMarketingCardPrompt(initialItem, allCards);
    const caption = resolveMarketingCardCaption(initialItem, allCards);
    setItem({
      ...initialItem,
      prompt,
      prompt_text: prompt,
      caption,
    });
  }, [
    initialItem,
    allCards,
    initialItem.id,
    initialItem.prompt,
    initialItem.prompt_text,
    initialItem.caption,
    initialItem.script,
    initialItem.productionType,
  ]);

  const fieldValue = config.getFieldValue(item);

  const syncItem = useCallback(
    (next: MarketingContentItem) => {
      setItem(next);
      onItemChange(next);
    },
    [onItemChange],
  );

  const persistField = useCallback(async () => {
    const value = config.getFieldValue(item);
    const saved = config.getFieldValue({
      ...initialItem,
      prompt: displayPrompt,
      prompt_text: displayPrompt,
      script: initialItem.script,
    });
    if (value === saved) return;
    const res = await updateCard(item, config.patchField(value));
    if (res.ok && res.item) syncItem(res.item);
  }, [config, displayPrompt, initialItem, item, syncItem]);

  const persistCaption = useCallback(async () => {
    if (item.productionType !== 'ai') return;
    if (item.caption === displayCaption) return;
    const res = await updateCard(item, { caption: item.caption });
    if (res.ok && res.item) syncItem(res.item);
  }, [displayCaption, item, syncItem]);

  const handleFieldChange = useCallback(
    (value: string) => {
      setItem((prev) =>
        prev.productionType === 'ai'
          ? { ...prev, prompt: value, prompt_text: value }
          : { ...prev, script: value },
      );
    },
    [],
  );

  const handleCaptionChange = useCallback((value: string) => {
    setItem((prev) => ({ ...prev, caption: value }));
  }, []);

  const handleVideoUpload = useCallback(
    async (file: File | undefined) => {
      if (!item || !file) return;
      if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|avi)$/i.test(file.name)) {
        toast.error('يرجى اختيار ملف فيديو (MP4 · WebM · MOV)');
        return;
      }

      setBusy(true);
      await persistField();

      const upload = await uploadMarketingVideo(file, `videos/${config.productionType}`);
      if (!upload.ok || !upload.file) {
        setBusy(false);
        toast.error(upload.error ?? 'فشل رفع الفيديو');
        return;
      }

      const save = await updateCard(item, {
        video_url: upload.file.publicUrl,
        status: config.productionType === 'human' ? 'تم الرفع' : 'تم التوليد',
        ...config.patchField(config.getFieldValue(item)),
      });
      setBusy(false);

      if (!save.ok || !save.item) {
        toast.error(save.error ?? 'تعذّر حفظ رابط الفيديو');
        return;
      }

      syncItem(save.item);
      toast.success('تم رفع الفيديو بنجاح');
    },
    [config, item, persistField, syncItem],
  );

  return (
    <article className={OUTER_CARD} dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`flex items-center gap-1.5 text-xs font-medium ${config.accentClass}`}>
            <HeaderIcon className="h-3.5 w-3.5" aria-hidden />
            Production Studio
          </p>
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
            {config.header}
          </h2>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-slate-200 bg-white p-2 transition hover:bg-slate-50 active:scale-[0.98] dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:hover:bg-[#22302C]"
          aria-label="تعديل المحتوى"
        >
          <Pencil className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </button>
      </div>

      <div className="mt-3 mb-5 flex flex-wrap gap-2">
        <MediaBadge mediaType={item.media_type ?? item.mediaType} />
        <CategoryBadge category={item.content_category ?? item.contentCategory} />
        <StatusBadge
          status={item.status}
          onClick={isReadyStatus(item.status) ? onEdit : undefined}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {item.productionType === 'ai' ? (
          <div className="shrink-0">
            <p className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-300">Caption</p>
            <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
              <textarea
                value={item.caption || ''}
                onChange={(e) => handleCaptionChange(e.target.value)}
                onBlur={() => void persistCaption()}
                rows={6}
                className="crm-marketing-textarea w-full resize-y bg-transparent p-4 text-sm leading-relaxed text-slate-600 outline-none dark:text-slate-400"
                placeholder="النص التسويقي للمنشور…"
              />
            </div>
          </div>
        ) : null}

        <div className="shrink-0">
          <p className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            {config.fieldLabel}
          </p>
          <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
            {initialItem.productionType === 'ai' ? (
              <textarea
                value={item.prompt_text || item.prompt || ''}
                onChange={(e) => handleFieldChange(e.target.value)}
                onBlur={() => void persistField()}
                rows={10}
                spellCheck={false}
                dir="ltr"
                className="crm-marketing-textarea w-full resize-y bg-transparent p-4 font-mono text-xs leading-relaxed text-slate-600 outline-none dark:text-slate-300"
              />
            ) : (
              <textarea
                value={item.script}
                onChange={(e) => handleFieldChange(e.target.value)}
                onBlur={() => void persistField()}
                rows={10}
                spellCheck={false}
                dir="rtl"
                className="crm-marketing-textarea w-full resize-y bg-transparent p-4 text-sm leading-relaxed text-slate-600 outline-none dark:text-slate-300"
              />
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void config.onAction({ item, fieldValue, setItem: syncItem, setBusy, fileInputRef })
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/30"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ActionIcon className="h-4 w-4" aria-hidden />
          )}
          {config.actionLabel}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*,.mp4,.mov,.webm"
          className="hidden"
          onChange={(e) => {
            void handleVideoUpload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {config.productionType === 'ai' ? (
          <label className="block cursor-pointer">
            <span className="mb-2 block text-[10px] font-medium text-slate-400">
              أو ارفع الفيديو المُولَّد يدوياً
            </span>
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] font-medium text-slate-600 transition hover:border-[#D4AF37]/40 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-400">
              اضغط لرفع فيديو AI
            </div>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                void handleVideoUpload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        ) : null}

        {item.videoUrl ? (
          <ProductionVideoPlayer url={item.videoUrl} />
        ) : (
          <VideoPlaceholder label={config.emptyVideoLabel} />
        )}
      </div>
    </article>
  );
}

export default function MarketingProductionStudio() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<MarketingContentItem[]>([]);
  const [selectedMediaType, setSelectedMediaType] = useState<string>('الكل');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [editingItem, setEditingItem] = useState<MarketingContentItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchAllMarketingContent();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? 'تعذّر تحميل بطاقات الإنتاج');
      return;
    }
    setCards(res.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCards = useMemo(
    () => filterMarketingContentCards(cards, selectedMediaType, selectedCategory),
    [cards, selectedMediaType, selectedCategory],
  );

  const handleItemChange = useCallback((updated: MarketingContentItem) => {
    setCards((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }, []);

  const handleEditSaved = useCallback(
    (updated: MarketingContentItem) => {
      handleItemChange(updated);
      setEditingItem(null);
      void load();
    },
    [handleItemChange, load],
  );

  return (
    <>
      <MarketingContentFilterBar
        selectedMediaType={selectedMediaType}
        selectedCategory={selectedCategory}
        onSelectMediaType={setSelectedMediaType}
        onSelectCategory={setSelectedCategory}
      />

      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
          <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" aria-hidden />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            جاري تحميل بطاقات الإنتاج…
          </p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-[#2D3F3A] dark:bg-[#22302C]">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            لا توجد بطاقات تطابق هذا التصفية
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            جرّب نوع وسائط أو تصنيفاً آخر، أو عدّل البطاقات من نافذة التعديل
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredCards.map((item) => (
            <ProductionStudioCard
              key={item.id}
              item={item}
              allCards={cards}
              onItemChange={handleItemChange}
              onEdit={() =>
                setEditingItem({
                  ...item,
                  prompt: resolveMarketingCardPrompt(item, cards),
                  prompt_text: resolveMarketingCardPrompt(item, cards),
                  caption: resolveMarketingCardCaption(item, cards),
                })
              }
            />
          ))}
        </div>
      )}

      {editingItem ? (
        <EditContentModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleEditSaved}
        />
      ) : null}
    </>
  );
}
