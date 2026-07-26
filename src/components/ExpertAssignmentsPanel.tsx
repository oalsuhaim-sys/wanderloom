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
    ? 'rounded-xl border border-slate-100 bg-slate-50/70 p-3'
    : 'rounded-2xl border border-slate-100 bg-slate-50/70 p-4';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'} dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
            <FolderKanban className="h-4 w-4 text-[#A88849]" />
            المهام المسندة للخبير
          </h3>
          {!compact ? (
            <p className="mt-1 text-xs font-semibold text-slate-500">
              عرض فقط للمسارات وعروض الأسعار المرتبطة بمعرّف الخبير
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-[#10251B] px-2.5 py-1 text-[10px] font-black text-[#E1C78F]">
          {itineraries.length + quotations.length}
        </span>
      </div>

      <div className={`grid gap-3 ${compact ? '' : 'xl:grid-cols-2'}`}>
        <section className={sectionClass}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="inline-flex items-center gap-2 text-xs font-black text-slate-800">
              <Plane className="h-4 w-4 text-emerald-700" />
              المسارات
            </h4>
            <span className="text-xs font-black text-slate-500">
              {itineraries.length}
            </span>
          </div>
          {itineraries.length ? (
            <ul className="space-y-2">
              {itineraries.map((itinerary) => (
                <li key={itinerary.id}>
                  <Link
                    href={`/crm/itineraries/${encodeURIComponent(itinerary.id)}/edit`}
                    className="block rounded-xl border border-slate-100 bg-white px-3 py-3 transition hover:border-emerald-200 hover:bg-emerald-50/50"
                  >
                    <p className="truncate text-sm font-black text-slate-800">
                      {itinerary.title}
                    </p>
                    <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
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
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs font-bold text-slate-400">
              لا توجد مسارات مسندة.
            </p>
          )}
        </section>

        <section className={sectionClass}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="inline-flex items-center gap-2 text-xs font-black text-slate-800">
              <FileText className="h-4 w-4 text-amber-700" />
              عروض الأسعار
            </h4>
            <span className="text-xs font-black text-slate-500">
              {quotations.length}
            </span>
          </div>
          {quotations.length ? (
            <ul className="space-y-2">
              {quotations.map((quotation) => (
                <li key={quotation.id}>
                  <Link
                    href={`/crm/quotations/edit/${encodeURIComponent(quotation.id)}`}
                    className="block rounded-xl border border-slate-100 bg-white px-3 py-3 transition hover:border-amber-200 hover:bg-amber-50/50"
                  >
                    <p className="truncate text-sm font-black text-slate-800">
                      {quotation.title}
                    </p>
                    <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
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
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs font-bold text-slate-400">
              لا توجد عروض أسعار مسندة.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
