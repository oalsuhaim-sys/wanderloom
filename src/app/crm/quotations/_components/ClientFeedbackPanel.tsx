'use client';

import { MessageSquareWarning, X } from 'lucide-react';

import {
  hasClientFeedback,
  listClientFeedbackEntries,
  type ClientFeedbackEntry,
  type QuotationClientFeedback,
} from '@/lib/interactive-quotation';

export function buildFeedbackLabelMaps(input: {
  days?: Array<{ id: string; dayNumber?: number; title?: string; city?: string }>;
  hotels?: Array<{ id: string; name?: string; city?: string }>;
  transports?: Array<{ id: string; name?: string }>;
  activities?: Array<{ id: string; name?: string }>;
}): {
  days: Record<string, string>;
  hotels: Record<string, string>;
  transport: Record<string, string>;
  activities: Record<string, string>;
} {
  const days: Record<string, string> = {};
  for (const d of input.days ?? []) {
    const title = String(d.title ?? '').trim();
    const city = String(d.city ?? '').trim();
    days[d.id] = `يوم ${d.dayNumber ?? ''}`.trim() + (title ? ` · ${title}` : city ? ` · ${city}` : '');
  }
  const hotels: Record<string, string> = {};
  for (const h of input.hotels ?? []) {
    const name = String(h.name ?? '').trim() || 'فندق';
    const city = String(h.city ?? '').trim();
    hotels[h.id] = city ? `${name} · ${city}` : name;
  }
  const transport: Record<string, string> = {};
  for (const t of input.transports ?? []) {
    transport[t.id] = String(t.name ?? '').trim() || 'مواصلات';
  }
  const activities: Record<string, string> = {};
  for (const a of input.activities ?? []) {
    activities[a.id] = String(a.name ?? '').trim() || 'فعالية';
  }
  return { days, hotels, transport, activities };
}

export function ClientFeedbackAlert({
  feedback,
  labels,
  className = '',
}: {
  feedback: QuotationClientFeedback | null | undefined;
  labels?: Parameters<typeof listClientFeedbackEntries>[1];
  className?: string;
}) {
  const entries = listClientFeedbackEntries(feedback, labels);
  if (!entries.length) return null;

  return (
    <section
      dir="rtl"
      className={`rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm ${className}`}
      role="status"
    >
      <h2 className="flex items-center gap-2 text-sm font-black text-amber-950 sm:text-base">
        <MessageSquareWarning className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        📝 ملاحظات وطلبات العميل
      </h2>
      {feedback?.submitted_at ? (
        <p className="mt-1 text-[10px] font-bold text-amber-800/80" dir="ltr">
          {new Date(feedback.submitted_at).toLocaleString('ar-SA')}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {entries.map((entry) => (
          <FeedbackNoteRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

function FeedbackNoteRow({ entry }: { entry: ClientFeedbackEntry }) {
  return (
    <li className="rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2.5">
      <p className="text-[11px] font-black text-amber-900">{entry.label}</p>
      <p className="mt-1 text-sm font-semibold leading-relaxed text-amber-950">{entry.text}</p>
    </li>
  );
}

export function ClientFeedbackNotesModal({
  open,
  onClose,
  feedback,
  title,
}: {
  open: boolean;
  onClose: () => void;
  feedback: QuotationClientFeedback | null | undefined;
  title?: string;
}) {
  if (!open) return null;
  const entries = listClientFeedbackEntries(feedback);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-feedback-modal-title"
      onClick={onClose}
    >
      <div
        dir="rtl"
        className="max-h-[85vh] w-[95%] max-w-lg overflow-y-auto rounded-2xl border border-amber-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2
              id="client-feedback-modal-title"
              className="text-base font-black text-[#1C4532]"
            >
              📝 ملاحظات وطلبات العميل
            </h2>
            {title ? (
              <p className="mt-1 text-xs font-bold text-slate-500">{title}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {!hasClientFeedback(feedback) || entries.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm font-bold text-slate-600">
            لا توجد ملاحظات نصية من العميل على هذا العرض.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <FeedbackNoteRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
