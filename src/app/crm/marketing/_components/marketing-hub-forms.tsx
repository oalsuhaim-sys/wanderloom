'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { EDIT_CATEGORY_OPTIONS, EDIT_MEDIA_TYPE_OPTIONS } from '@/app/crm/marketing/_components/MarketingContentFilterBar';
import {
  normalizeContentCategory,
  normalizeMediaType,
  type MarketingContentCategory,
  type MarketingMediaType,
} from '@/lib/marketing-content';
import type {
  AiContentItem,
  ContentCalendarItem,
  HumanProductionGuide,
} from '@/lib/marketing-hub-types';

export const MARKETING_FIELD =
  'w-full rounded-lg border border-gray-300 bg-[#FDFBF7] p-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#cda04c] focus:ring-1 focus:ring-[#cda04c]';

export const MARKETING_TEXTAREA =
  'crm-marketing-textarea w-full resize-y overflow-y-auto rounded-lg border border-gray-300 bg-[#FDFBF7] p-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#cda04c] focus:ring-1 focus:ring-[#cda04c] min-h-[200px]';

export type OperationsModalKind = 'human' | 'calendar';

export type OperationsModalState =
  | { open: false }
  | {
      open: true;
      kind: OperationsModalKind;
      mode: 'add' | 'edit';
      item?: HumanProductionGuide | ContentCalendarItem;
    };

export function guideStatusClass(status: string | null | undefined): string {
  const s = status ?? '';
  if (s.includes('مونتاج')) return 'border-[#cda04c]/50 bg-[#cda04c]/10 text-[#7a5f28]';
  if (s.includes('بانتظار')) return 'border-amber-300/60 bg-amber-50 text-amber-900';
  return 'border-[#1e3f20]/25 bg-[#1e3f20]/8 text-[#1e3f20]';
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      dir="rtl"
      lang="ar"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-[95%] max-w-lg overflow-y-auto rounded-t-2xl border border-[#cda04c]/30 bg-[#FDFBF7] p-4 shadow-2xl sm:max-h-[90vh] sm:w-full sm:rounded-2xl sm:p-6 md:w-3/4 md:max-w-2xl lg:w-1/2 lg:max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#1e3f20]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full border p-2 hover:bg-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function HumanForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: HumanProductionGuide;
  onSubmit: (data: Omit<HumanProductionGuide, 'id'>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [hook, setHook] = useState(initial?.hook ?? '');
  const [shotListText, setShotListText] = useState(initial?.shotList.join('\n') ?? '');
  const [voiceover, setVoiceover] = useState(initial?.voiceover ?? '');
  const [carouselStructure, setCarouselStructure] = useState(initial?.carouselStructure ?? '');
  const [platform, setPlatform] = useState(initial?.platform ?? 'Instagram');
  const [status, setStatus] = useState(initial?.status ?? 'بانتظار التصوير');

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          hook,
          shotList: shotListText.split('\n').map((s) => (s ?? '').trim()).filter(Boolean),
          voiceover,
          platform,
          carouselStructure,
          status,
        });
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" className={MARKETING_FIELD} required />
      <textarea value={hook} onChange={(e) => setHook(e.target.value)} placeholder="الخطاف" className={MARKETING_FIELD} rows={2} required />
      <textarea value={shotListText} onChange={(e) => setShotListText(e.target.value)} placeholder="زوايا التصوير (سطر لكل زاوية)" className={MARKETING_FIELD} rows={4} required />
      <textarea value={voiceover} onChange={(e) => setVoiceover(e.target.value)} placeholder="Voiceover" className={MARKETING_FIELD} rows={3} required />
      <textarea value={carouselStructure} onChange={(e) => setCarouselStructure(e.target.value)} placeholder="Carousel structure (اختياري)" className={MARKETING_FIELD} rows={2} />
      <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="المنصة" className={MARKETING_FIELD} />
      <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="الحالة" className={MARKETING_FIELD} />
      <div className="flex gap-3">
        <button type="submit" className="flex-1 rounded-lg bg-[#1e3f20] py-2.5 text-sm font-bold text-white">
          حفظ
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2.5 text-sm font-bold">
          إلغاء
        </button>
      </div>
    </form>
  );
}

export function CalendarForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: ContentCalendarItem;
  onSubmit: (data: Omit<ContentCalendarItem, 'id'>) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [format, setFormat] = useState(initial?.format ?? 'Reel');
  const [platform, setPlatform] = useState(initial?.platform ?? 'Instagram');

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ date, topic, format, platform });
      }}
    >
      <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="الأسبوع / التاريخ" className={MARKETING_FIELD} required />
      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="الموضوع" className={MARKETING_FIELD} required />
      <input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="الصيغة" className={MARKETING_FIELD} />
      <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="المنصة" className={MARKETING_FIELD} />
      <div className="flex gap-3">
        <button type="submit" className="flex-1 rounded-lg bg-[#1e3f20] py-2.5 text-sm font-bold text-white">
          حفظ
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2.5 text-sm font-bold">
          إلغاء
        </button>
      </div>
    </form>
  );
}

export function OperationsModal({
  modal,
  onClose,
  onSaveHuman,
  onSaveCalendar,
}: {
  modal: Extract<OperationsModalState, { open: true }>;
  onClose: () => void;
  onSaveHuman: (data: Omit<HumanProductionGuide, 'id'>, id?: string) => void | Promise<void>;
  onSaveCalendar: (data: Omit<ContentCalendarItem, 'id'>, id?: string) => void | Promise<void>;
}) {
  const isEdit = modal.mode === 'edit';
  const item = modal.item;

  if (modal.kind === 'human') {
    const h = item as HumanProductionGuide | undefined;
    return (
      <ModalShell title={isEdit ? 'تعديل دليل تصوير' : 'إضافة دليل تصوير'} onClose={onClose}>
        <HumanForm
          initial={h}
          onSubmit={(data) => onSaveHuman(data, isEdit ? h?.id : undefined)}
          onCancel={onClose}
        />
      </ModalShell>
    );
  }

  const c = item as ContentCalendarItem | undefined;
  return (
    <ModalShell title={isEdit ? 'تعديل موعد' : 'إضافة موعد نشر'} onClose={onClose}>
      <CalendarForm
        initial={c}
        onSubmit={(data) => onSaveCalendar(data, isEdit ? c?.id : undefined)}
        onCancel={onClose}
      />
    </ModalShell>
  );
}

/** @deprecated — kept for MarketingHubClient legacy */
export function AiForm({
  initial,
  defaultCategory,
  defaultMediaType,
  onSubmit,
  onCancel,
}: {
  initial?: AiContentItem;
  defaultCategory?: MarketingContentCategory;
  defaultMediaType?: MarketingMediaType;
  onSubmit: (data: Omit<AiContentItem, 'id'>) => void;
  onCancel: () => void;
}) {
  const [mediaType, setMediaType] = useState<MarketingMediaType>(() =>
    normalizeMediaType(initial?.media_type ?? initial?.mediaType ?? defaultMediaType),
  );
  const [category, setCategory] = useState<MarketingContentCategory>(() =>
    normalizeContentCategory(
      initial?.category ?? initial?.content_category ?? initial?.contentCategory ?? defaultCategory,
    ),
  );
  const [campaign, setCampaign] = useState(initial?.campaign ?? '');
  const [visualPrompt, setVisualPrompt] = useState(initial?.visualPrompt ?? '');
  const [caption, setCaption] = useState(initial?.caption ?? '');
  const [hashtags, setHashtags] = useState(initial?.hashtags ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'جاهز للتوليد');

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          mediaType,
          contentCategory: category,
          media_type: mediaType,
          category,
          content_category: category,
          campaign,
          visualPrompt,
          caption,
          hashtags,
          status,
        });
      }}
    >
      <label className="block text-xs font-black text-[#1e3f20]">نوع الوسائط</label>
      <select value={mediaType} onChange={(e) => setMediaType(e.target.value as MarketingMediaType)} className={MARKETING_FIELD}>
        {EDIT_MEDIA_TYPE_OPTIONS.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <label className="block text-xs font-black text-[#1e3f20]">التصنيف</label>
      <select value={category} onChange={(e) => setCategory(e.target.value as MarketingContentCategory)} className={MARKETING_FIELD}>
        {EDIT_CATEGORY_OPTIONS.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
      <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="اسم الحملة" className={MARKETING_FIELD} required />
      <textarea value={visualPrompt} onChange={(e) => setVisualPrompt(e.target.value)} placeholder="Visual Prompt" className={`${MARKETING_TEXTAREA} font-mono text-xs`} rows={10} dir="ltr" spellCheck={false} required />
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" className={MARKETING_TEXTAREA} rows={8} spellCheck={false} required />
      <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="Hashtags" className={MARKETING_FIELD} />
      <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="الحالة" className={MARKETING_FIELD} />
      <div className="flex gap-3 pt-2">
        <button type="submit" className="flex-1 rounded-lg bg-[#1e3f20] py-2.5 text-sm font-bold text-white">حفظ</button>
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2.5 text-sm font-bold">إلغاء</button>
      </div>
    </form>
  );
}
