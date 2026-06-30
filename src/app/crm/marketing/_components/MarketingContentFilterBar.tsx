'use client';

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

const PILL_ACTIVE = 'border-[#1e3f20] bg-[#1e3f20] text-white shadow-md';
const PILL_INACTIVE =
  'border-[#1e3f20]/15 bg-white text-[#1e3f20] hover:border-[#cda04c]/45 hover:bg-[#f4f0e6]';

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
      className="mb-6 space-y-4 rounded-[1.75rem] border border-[#1e3f20]/10 bg-white p-4 shadow-[0_12px_40px_rgba(30,63,32,0.06)] sm:p-5"
      dir="rtl"
      aria-label="تصفية المحتوى التسويقي"
    >
      <div>
        <p className="mb-2 text-xs font-black text-[#cda04c]">نوع الوسائط</p>
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          {MEDIA_TYPE_FILTERS.map((option) => {
            const isActive = selectedMediaType === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelectMediaType(option.trim())}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition sm:px-5 sm:text-sm ${
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
        <p className="mb-2 text-xs font-black text-[#cda04c]">تصنيف المحتوى</p>
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          {CATEGORY_FILTERS.map((option) => {
            const isActive = selectedCategory === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelectCategory(option.trim())}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition sm:px-5 sm:text-sm ${
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
  T extends { media_type?: string; content_category?: string },
>(cards: T[], selectedMediaType: string, selectedCategory: string): T[] {
  return cards.filter((card) => {
    const cardMedia = String(card.media_type || 'فيديو').trim();
    const cardCat = String(card.content_category || 'عام').trim();

    const filterMedia = selectedMediaType.trim();
    const filterCat = selectedCategory.trim();

    const matchesMedia =
      filterMedia === 'الكل' || cardMedia.includes(filterMedia) || filterMedia.includes(cardMedia);

    const matchesCat =
      filterCat === 'الكل' || cardCat.includes(filterCat) || filterCat.includes(cardCat);

    return matchesMedia && matchesCat;
  });
}
