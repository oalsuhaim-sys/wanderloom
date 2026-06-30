'use client';

import { Plus, Trash2 } from 'lucide-react';

import {
  createEmptyActivityTicket,
  type ActivityTicket,
} from '@/lib/itinerary-tickets';

type Props = {
  tickets: ActivityTicket[];
  onChange: (tickets: ActivityTicket[]) => void;
};

export default function ActivityTicketsEditor({ tickets, onChange }: Props) {
  const update = (index: number, patch: Partial<ActivityTicket>) => {
    onChange(tickets.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-4">
      {tickets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#D4AF37]/40 bg-[#FEFDF9] px-4 py-6 text-center text-sm text-gray-600">
          لا توجد تذاكر فعاليات بعد — أضف مدينة الألعاب، السيرك، المتحف، …
        </p>
      ) : (
        tickets.map((ticket, index) => (
          <div
            key={ticket.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#D4AF37]">
                تذكرة #{index + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(tickets.filter((_, i) => i !== index))}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                حذف
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-bold text-gray-600">اسم الفعالية *</span>
                <input
                  type="text"
                  value={ticket.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  placeholder="مثال: مدينة الألعاب — يونيفرسal"
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-[#D4AF37]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-gray-600">تاريخ ووقت الدخول</span>
                <input
                  type="datetime-local"
                  value={ticket.date.length >= 16 ? ticket.date.slice(0, 16) : ticket.date}
                  onChange={(e) => update(index, { date: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#D4AF37] [color-scheme:light]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-gray-600">رقم التذكرة / التأكيد</span>
                <input
                  type="text"
                  value={ticket.ticket_number}
                  onChange={(e) => update(index, { ticket_number: e.target.value })}
                  placeholder="ABC-12345"
                  dir="ltr"
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
                />
              </label>
            </div>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={() => onChange([...tickets, createEmptyActivityTicket()])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/50 bg-[#1E2720] px-4 py-2.5 text-sm font-bold text-[#D4AF37] transition hover:bg-[#2a362c]"
      >
        <Plus className="h-4 w-4" aria-hidden />
        إضافة تذكرة فعالية
      </button>
    </div>
  );
}
