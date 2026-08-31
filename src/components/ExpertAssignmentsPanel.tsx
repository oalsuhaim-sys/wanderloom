import Link from 'next/link';
import { FileText, FolderKanban, Plane } from 'lucide-react';

export type ExpertAssignedItinerary = {
  id: string;
  title: string;
  destination: string | null;
  status: string | null;
  dates: string | null;
};

export type ExpertAssignedQuotation = {
  id: string;
  title: string;
  destinations: string[];
  status: string | null;
  startDate: string | null;
  endDate: string | null;
};

function metadata(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' · ') || '—';
}

export function ExpertAssignmentsPanel({
  itineraries,
  quotations,
  compact = false,
}: {
  itineraries: ExpertAssignedItinerary[];
  quotations: ExpertAssignedQuotation[];
  compact?: boolean;
}) {
  const sectionClass = compact
    ? 'rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#2D3F3A] dark:bg-[#1A2421]/50'
    : 'rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]/50';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'} dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="inline-flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-gray-100">
            <FolderKanban className="h-4 w-4 text-slate-400 dark:text-[#D4AF37]" />
            المهام المسندة للخبير
          </h3>
          {!compact ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              عرض فقط للمسارات وعروض الأسعار المرتبطة بمعرّف الخبير
            </p>
          ) : null}
        </div>
        <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:border-[#D4AF37]/30 dark:bg-[#1A2421] dark:text-[#D4AF37]">
          {itineraries.length + quotations.length}
        </span>
      </div>

      <div className={`grid gap-3 ${compact ? '' : 'xl:grid-cols-2'}`}>
        <section className={sectionClass}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-gray-100">
              <Plane className="h-4 w-4 text-slate-500 dark:text-[#D4AF37]" />
              المسارات
            </h4>
            <span className="text-xs font-medium text-slate-500">
              {itineraries.length}
            </span>
          </div>
          {itineraries.length ? (
            <ul className="space-y-2">
              {itineraries.map((itinerary) => (
                <li key={itinerary.id}>
                  <Link
                    href={`/crm/itineraries/${encodeURIComponent(itinerary.id)}/edit`}
                    className="block rounded-xl border border-slate-100 bg-white px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:hover:border-[#D4AF37]/40"
                  >
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-white">
                      {itinerary.title}
                    </p>
                    <p className="mt-1 truncate text-[10px] font-medium text-slate-500">
                      {metadata([
                        itinerary.destination,
                        itinerary.dates,
                        itinerary.status,
                      ])}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs font-medium text-slate-400 dark:border-[#2D3F3A] dark:bg-[#22302C]">
              لا توجد مسارات مسندة.
            </p>
          )}
        </section>

        <section className={sectionClass}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-gray-100">
              <FileText className="h-4 w-4 text-slate-500 dark:text-[#D4AF37]" />
              عروض الأسعار
            </h4>
            <span className="text-xs font-medium text-slate-500">
              {quotations.length}
            </span>
          </div>
          {quotations.length ? (
            <ul className="space-y-2">
              {quotations.map((quotation) => (
                <li key={quotation.id}>
                  <Link
                    href={`/crm/quotations/edit/${encodeURIComponent(quotation.id)}`}
                    className="block rounded-xl border border-slate-100 bg-white px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:hover:border-[#D4AF37]/40"
                  >
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-white">
                      {quotation.title}
                    </p>
                    <p className="mt-1 truncate text-[10px] font-medium text-slate-500">
                      {metadata([
                        quotation.destinations.join('، ') || null,
                        quotation.startDate && quotation.endDate
                          ? `${quotation.startDate} ← ${quotation.endDate}`
                          : quotation.startDate,
                        quotation.status,
                      ])}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs font-medium text-slate-400 dark:border-[#2D3F3A] dark:bg-[#22302C]">
              لا توجد عروض أسعار مسندة.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
