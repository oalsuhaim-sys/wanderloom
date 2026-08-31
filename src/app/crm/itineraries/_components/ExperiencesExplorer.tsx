'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { Loader2, Search, Star, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';

import { searchExperiencesAPI, type ExperienceApiResult } from '@/app/actions/experiences';
import type { PlacesBankPlaceRowData } from '@/app/crm/itineraries/_components/PlacesBankPlaceRow';
import {
  experienceToPlaceBankRow,
  formatExperiencePrice,
  renderExperienceStars,
} from '@/lib/experiences-api';
import { WL_BTN_PRIMARY, WL_INPUT } from '@/lib/itinerary-builder-ui';

type Props = {
  activeDayLabel: string;
  defaultDestination?: string;
  onAddPlace: (place: PlacesBankPlaceRowData) => void;
};

export default function ExperiencesExplorer({
  activeDayLabel,
  defaultDestination = '',
  onAddPlace,
}: Props) {
  const [destination, setDestination] = useState(defaultDestination);
  const [isSearchingAPI, setIsSearchingAPI] = useState(false);
  const [results, setResults] = useState<ExperienceApiResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const query = destination.trim();
    if (!query) {
      toast.error('أدخل اسم المدينة أولاً');
      return;
    }

    setIsSearchingAPI(true);
    setHasSearched(true);
    try {
      const response = await searchExperiencesAPI(query);
      if (!response.ok) {
        toast.error(response.error);
        setResults([]);
        return;
      }
      setResults(response.results);
    } catch (err) {
      console.error(err);
      toast.error('تعذّر البحث في مزوّد التجارب');
      setResults([]);
    } finally {
      setIsSearchingAPI(false);
    }
  }, [destination]);

  const handleAdd = useCallback(
    (experience: ExperienceApiResult) => {
      const place = experienceToPlaceBankRow(experience, destination.trim());
      onAddPlace(place);
      toast.success(`تمت إضافة «${experience.title}» إلى ${activeDayLabel}`);
    },
    [activeDayLabel, destination, onAddPlace],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          <Ticket className="h-4 w-4 text-[#D4AF37]" aria-hidden />
          <span>بحث Viator / GetYourGuide — بيانات تجريبية حتى تفعيل المفتاح</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSearch();
            }}
            placeholder="ابحث عن مدينة (مثال: باريس، بالي)..."
            className={`flex-1 ${WL_INPUT}`}
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={isSearchingAPI}
            className={WL_BTN_PRIMARY}
          >
            {isSearchingAPI ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
            بحث
          </button>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto p-4">
        {isSearchingAPI ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" aria-hidden />
            <p className="text-sm font-bold">جاري البحث في مزوّد التجارب…</p>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {results.map((experience) => (
              <article
                key={experience.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-xl transition-shadow hover:border-[#D4AF37]/40"
              >
                <div className="relative aspect-[16/10] w-full bg-slate-50">
                  <Image
                    src={experience.image_url}
                    alt={experience.title}
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {experience.provider}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h4 className="line-clamp-2 text-sm font-bold leading-snug text-slate-800">
                    {experience.title}
                  </h4>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-[#D4AF37]">
                      {formatExperiencePrice(experience.price, experience.currency)}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600"
                      title={`${experience.rating} / 5`}
                    >
                      <Star className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" aria-hidden />
                      {experience.rating.toFixed(1)}
                      <span className="text-[10px] tracking-tight" aria-hidden>
                        {renderExperienceStars(experience.rating)}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(experience)}
                    className={`mt-4 w-full ${WL_BTN_PRIMARY}`}
                  >
                    إضافة للرحلة
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : hasSearched ? (
          <div className="py-16 text-center text-sm font-bold text-slate-500">
            لا توجد تجارب مطابقة — جرّب مدينة أخرى
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-slate-500">
            ابحث عن مدينة لاستكشاف التجارب والأنشطة المتاحة
          </div>
        )}
      </div>
    </div>
  );
}
