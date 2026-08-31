'use client';

import { Plus, Trash2 } from 'lucide-react';

import { createEmptyActivityTicket, type ActivityTicket } from '@/lib/itinerary-tickets';
import {
  WL_BTN_DANGER,
  WL_BTN_PRIMARY,
  WL_CARD,
  WL_EMPTY,
  WL_INPUT,
  WL_LABEL,
} from '@/lib/itinerary-builder-ui';

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
        <p className={WL_EMPTY}>
          لا توجد تذاكر فعاليات بعد — أضف مدينة الألعاب، السيرك، المتحف، …
        </p>
      ) : (
        tickets.map((ticket, index) => (
          <div key={ticket.id} className={WL_CARD}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#D4AF37]">
                تذكرة #{index + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(tickets.filter((_, i) => i !== index))}
                className={WL_BTN_DANGER}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                حذف
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className={WL_LABEL}>اسم الفعالية *</span>
                <input
                  type="text"
                  value={ticket.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  placeholder="مثال: مدينة الألعاب — يونيفرسال"
                  className={`${WL_INPUT} font-bold`}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={WL_LABEL}>تاريخ ووقت الدخول</span>
                <input
                  type="datetime-local"
                  value={ticket.date.length >= 16 ? ticket.date.slice(0, 16) : ticket.date}
                  onChange={(e) => update(index, { date: e.target.value })}
                  className={WL_INPUT}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={WL_LABEL}>رقم التذكرة / التأكيد</span>
                <input
                  type="text"
                  value={ticket.ticket_number}
                  onChange={(e) => update(index, { ticket_number: e.target.value })}
                  placeholder="ABC-12345"
                  dir="ltr"
                  className={WL_INPUT}
                />
              </label>
            </div>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={() => onChange([...tickets, createEmptyActivityTicket()])}
        className={WL_BTN_PRIMARY}
      >
        <Plus className="h-4 w-4" aria-hidden />
        إضافة تذكرة فعالية
      </button>
    </div>
  );
}
