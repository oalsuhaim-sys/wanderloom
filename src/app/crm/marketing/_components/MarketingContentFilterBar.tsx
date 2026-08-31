'use client';

import {
  marketingItemCategory,
  normalizeMediaType,
} from '@/lib/marketing-content';

export const MEDIA_TYPE_FILTERS = ['الكل', 'فيديو', 'صورة'] as const;

export const CATEGORY_FILTERS = [
  'الكل',
  'بيع الشعور',
  'قروبات',
  'حياة المدينة',
  'طبيعة',
  'أخرى',
] as const;

export const EDIT_MEDIA_TYPE_OPTIONS = ['فيديو', 'صورة'] as const;

export const EDIT_CATEGORY_OPTIONS = [
  'بيع الشعور',
  'قروبات',
  'حياة المدينة',
  'طبيعة',
  'أخرى',
] as const;

const PILL_ACTIVE =
  'bg-slate-900 text-white dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] border-transparent shadow-sm';
const PILL_INACTIVE =
  'bg-white dark:bg-[#1A2421] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2D3F3A] hover:bg-slate-50 dark:hover:bg-[#22302C] transition-all';

export default function MarketingContentFilterBar({
  selectedMediaType,
  selectedCategory,
  onSelectMediaType,
  onSelectCategory,
}: {
  selectedMediaType: string;
  selectedCategory: string;
  onSelectMediaType: (value: string) => void;
  onSelectCategory: (value: string) => void;
}) {
  return (
    <section
      className="mb-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-5"
      dir="rtl"
      aria-label="تصفية المحتوى التسويقي"
    >
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-500 dark:text-[#D4AF37]">
          نوع الوسائط
        </p>
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          {MEDIA_TYPE_FILTERS.map((option) => {
            const isActive = selectedMediaType === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelectMediaType(option.trim())}
                className={`shrink-0 rounded-lg border px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98] sm:px-5 sm:text-sm ${
                  isActive ? PILL_ACTIVE : PILL_INACTIVE
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-slate-500 dark:text-[#D4AF37]">
          تصنيف المحتوى
        </p>
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          {CATEGORY_FILTERS.map((option) => {
            const isActive = selectedCategory === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelectCategory(option.trim())}
                className={`shrink-0 rounded-lg border px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98] sm:px-5 sm:text-sm ${
                  isActive ? PILL_ACTIVE : PILL_INACTIVE
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function filterMarketingContentCards<
  T extends {
    category?: string;
    media_type?: string;
    mediaType?: string;
    content_category?: string;
    contentCategory?: string;
  },
>(cards: T[], selectedMediaType: string, selectedCategory: string): T[] {
  return cards.filter((card) => {
    const cardMedia = normalizeMediaType(card.media_type ?? card.mediaType);
    const cardCat = marketingItemCategory(card);

    const filterMedia = selectedMediaType.trim();
    const filterCat = selectedCategory.trim();

    const matchesMedia = filterMedia === 'الكل' || cardMedia === filterMedia;
    const matchesCat = filterCat === 'الكل' || cardCat === filterCat;

    return matchesMedia && matchesCat;
  });
}
