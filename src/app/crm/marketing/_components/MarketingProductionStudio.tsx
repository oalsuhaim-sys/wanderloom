'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import toast from 'react-hot-toast';
import { Clapperboard, Image as ImageIcon, Loader2, Pencil, Sparkles, Upload, Video, Wand2, X } from 'lucide-react';

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
  updateMarketingContent,
  type MarketingContentCategory,
  type MarketingContentItem,
  type MarketingMediaType,
  type MarketingProductionType,
} from '@/lib/marketing-content';

const OUTER_CARD =
  'flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#1e3f20]/10 bg-white shadow-[0_12px_40px_rgba(30,63,32,0.06)]';

const DARK_STUDIO =
  'rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

const DARK_TEXTAREA =
  'min-h-[140px] w-full resize-y rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 font-mono text-xs leading-relaxed text-gray-200 outline-none transition placeholder:text-gray-600 focus:border-[#cda04c]/50 focus:ring-1 focus:ring-[#cda04c]/30';

const FIELD =
  'w-full rounded-lg border border-gray-300 bg-[#FDFBF7] p-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#cda04c] focus:ring-1 focus:ring-[#cda04c]';

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
      <Upload className="h-8 w-8 text-white/20" aria-hidden />
      <p className="text-xs font-bold text-white/35">{label}</p>
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
  actionIcon: typeof Wand2;
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
  accentClass: 'text-[#cda04c]',
  fieldLabel: 'البرومبت',
  fieldPlaceholder: 'اكتب البرومبت البصري لـ Midjourney / Sora…',
  actionLabel: 'توليد',
  actionIcon: Wand2,
  getFieldValue: (item) => item.prompt,
  patchField: (value) => ({ prompt: value }),
  emptyVideoLabel: 'سيظهر الفيديو المُولَّد هنا بعد الرفع',
  onAction: async ({ item, fieldValue, setItem, setBusy }) => {
    setBusy(true);
    const res = await updateCard(item, {
      prompt: fieldValue,
      status: 'جاري التوليد',
    });
    setBusy(false);
    if (!res.ok || !res.item) {
      toast.error(res.error ?? 'تعذّر حفظ البرومبت');
      return;
    }
    setItem(res.item);
    toast.success('تم حفظ البرومبت — جاهز للتوليد في Sora / Midjourney', {
      style: { background: '#1e3f20', color: '#fff' },
    });
  },
};

const HUMAN_CONFIG: ProductionCardConfig = {
  productionType: 'human',
  header: 'الإنتاج البشري',
  headerIcon: Clapperboard,
  accentClass: 'text-[#cda04c]',
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
    <span className="inline-flex items-center gap-1 rounded-full border border-[#1e3f20]/20 bg-[#f4f0e6]/80 px-3 py-1 text-[10px] font-black text-[#1e3f20]">
      <Icon className="h-3 w-3 text-[#cda04c]" aria-hidden />
      {mediaType}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="rounded-full border border-[#cda04c]/40 bg-[#cda04c]/10 px-3 py-1 text-[10px] font-black text-[#7a5f28]">
      {category}
    </span>
  );
}

function EditContentModal({
  item,
  onClose,
  onSaved,
}: {
  item: MarketingContentItem;
  onClose: () => void;
  onSaved: (updated: MarketingContentItem) => void;
}) {
  const [category, setCategory] = useState<MarketingContentCategory>(() =>
    normalizeContentCategory(item.contentCategory),
  );
  const [mediaType, setMediaType] = useState<MarketingMediaType>(() =>
    normalizeMediaType(item.mediaType),
  );
  const [prompt, setPrompt] = useState(item.prompt);
  const [caption, setCaption] = useState(item.caption);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCategory(normalizeContentCategory(item.contentCategory));
    setMediaType(normalizeMediaType(item.mediaType));
    setPrompt(item.prompt);
    setCaption(item.caption);
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateCard(item, {
      media_type: mediaType,
      content_category: category,
      prompt,
      caption,
    });
    setSaving(false);
    if (!res.ok || !res.item) {
      toast.error(res.error ?? 'تعذّر حفظ التعديلات');
      return;
    }
    onSaved(res.item);
    toast.success('تم تحديث المحتوى', { style: { background: '#1e3f20', color: '#fff' } });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      dir="rtl"
      lang="ar"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-[95%] max-w-lg overflow-y-auto rounded-t-2xl border border-[#cda04c]/30 bg-[#FDFBF7] p-4 shadow-2xl sm:max-h-[90vh] sm:w-full sm:rounded-2xl sm:p-6 md:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black text-[#cda04c]">تعديل المحتوى</p>
            <h2 className="text-lg font-black text-[#1e3f20]">{item.title || configForItem(item).header}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 hover:bg-white"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <label className="mb-2 block text-xs font-black text-[#1e3f20]">نوع الوسائط</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MarketingMediaType)}
              className={FIELD}
            >
              {EDIT_MEDIA_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-[#1e3f20]">التصنيف</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MarketingContentCategory)}
              className={FIELD}
            >
              {EDIT_CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-[#1e3f20]">البرومبت (AI Prompt)</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              dir="ltr"
              className={`${FIELD} font-mono text-xs`}
              placeholder="Visual prompt for Midjourney / Sora…"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-[#1e3f20]">الكابشن (Caption)</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              className={FIELD}
              placeholder="النص التسويقي للمنشور…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1e3f20] py-3 text-sm font-black text-white transition hover:bg-[#163018] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              حفظ التعديلات
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductionStudioCard({
  item: initialItem,
  onItemChange,
  onEdit,
}: {
  item: MarketingContentItem;
  onItemChange: (item: MarketingContentItem) => void;
  onEdit: () => void;
}) {
  const config = configForItem(initialItem);
  const HeaderIcon = config.headerIcon;
  const ActionIcon = config.actionIcon;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [item, setItem] = useState(initialItem);
  const [fieldValue, setFieldValue] = useState(config.getFieldValue(initialItem));

  useEffect(() => {
    setItem(initialItem);
    const cfg = initialItem.productionType === 'ai' ? AI_CONFIG : HUMAN_CONFIG;
    setFieldValue(cfg.getFieldValue(initialItem));
  }, [initialItem]);

  const syncItem = useCallback(
    (next: MarketingContentItem) => {
      setItem(next);
      onItemChange(next);
    },
    [onItemChange],
  );

  const persistField = useCallback(async () => {
    const current = config.getFieldValue(item);
    if (fieldValue === current) return;
    const res = await updateCard(item, config.patchField(fieldValue));
    if (res.ok && res.item) syncItem(res.item);
  }, [config, fieldValue, item, syncItem]);

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
        ...config.patchField(fieldValue),
      });
      setBusy(false);

      if (!save.ok || !save.item) {
        toast.error(save.error ?? 'تعذّر حفظ رابط الفيديو');
        return;
      }

      syncItem(save.item);
      toast.success('تم رفع الفيديو بنجاح', { style: { background: '#1e3f20', color: '#fff' } });
    },
    [config, fieldValue, item, persistField, syncItem],
  );

  return (
    <article className={OUTER_CARD} dir="rtl">
      <div className="border-b border-[#1e3f20]/8 bg-gradient-to-l from-[#1e3f20]/[0.04] to-transparent px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`flex items-center gap-2 text-xs font-black ${config.accentClass}`}>
              <HeaderIcon className="h-4 w-4" aria-hidden />
              Production Studio
            </p>
            <h2 className="mt-1 text-xl font-black text-[#1e3f20]">{config.header}</h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MediaBadge mediaType={item.media_type} />
            <CategoryBadge category={item.content_category} />
            <span className="rounded-full border border-[#1e3f20]/15 bg-[#FDFBF7] px-3 py-1 text-[10px] font-black text-[#1e3f20]">
              {item.status}
            </span>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-gray-200 bg-white p-2 transition hover:border-[#cda04c]/40 hover:bg-[#f4f0e6]"
              aria-label="تعديل المحتوى"
            >
              <Pencil className="h-4 w-4 text-[#1e3f20]" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        {item.caption ? (
          <div className="rounded-xl border border-[#cda04c]/25 bg-[#FFFBF0] px-4 py-3">
            <p className="mb-1 text-[10px] font-black text-[#cda04c]">الكابشن</p>
            <p className="text-sm font-bold leading-relaxed text-[#2d3a33]">{item.caption}</p>
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-xs font-black text-[#1e3f20]">{config.fieldLabel}</label>
          <div className={DARK_STUDIO}>
            <textarea
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              onBlur={() => void persistField()}
              placeholder={config.fieldPlaceholder}
              className={DARK_TEXTAREA}
              dir={config.productionType === 'ai' ? 'ltr' : 'rtl'}
            />
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void config.onAction({ item, fieldValue, setItem: syncItem, setBusy, fileInputRef })
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#cda04c] to-[#b3893d] px-5 py-3 text-sm font-black text-[#111111] shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
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
            <span className="mb-2 block text-[10px] font-bold text-gray-400">
              أو ارفع الفيديو المُولَّد يدوياً
            </span>
            <div className="rounded-xl border border-dashed border-[#1e3f20]/20 bg-[#FDFBF7] px-3 py-2 text-center text-[11px] font-bold text-[#1e3f20]/70 transition hover:border-[#cda04c]/40">
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

  const handleEditSaved = useCallback((updated: MarketingContentItem) => {
    handleItemChange(updated);
    setEditingItem(null);
  }, [handleItemChange]);

  return (
    <>
      <MarketingContentFilterBar
        selectedMediaType={selectedMediaType}
        selectedCategory={selectedCategory}
        onSelectMediaType={setSelectedMediaType}
        onSelectCategory={setSelectedCategory}
      />

      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-[#1e3f20]/10 bg-white p-10 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-[#cda04c]" aria-hidden />
          <p className="text-sm font-bold text-gray-500">جاري تحميل بطاقات الإنتاج…</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-[#1e3f20]/15 bg-white px-6 py-12 text-center">
          <p className="text-sm font-black text-[#1e3f20]">لا توجد بطاقات تطابق هذا التصفية</p>
          <p className="mt-2 text-xs font-bold text-gray-500">
            جرّب نوع وسائط أو تصنيفاً آخر، أو عدّل البطاقات من نافذة التعديل
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredCards.map((item) => (
            <ProductionStudioCard
              key={item.id}
              item={item}
              onItemChange={handleItemChange}
              onEdit={() => setEditingItem(item)}
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
