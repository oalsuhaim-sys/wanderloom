'use client';

import { useMemo } from 'react';
import { Calendar, MapPin, Pencil, Trash2, Users } from 'lucide-react';

import type { Session, SessionRegistration } from '@/types/session-tables';

type SessionsTableProps = {
  sessions: Session[];
  registrations: SessionRegistration[];
  loading?: boolean;
  onEdit?: (session: Session) => void;
  onDelete?: (session: Session) => void;
};

function formatDate(value: string) {
  const day = String(value).slice(0, 10);
  try {
    const d = new Date(day + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('ar-SA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ar-SA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function sessionTypeLabel(type: string) {
  const t = String(type).toLowerCase().replace(/-/g, '_');
  if (t === 'online') return 'أونلاين';
  if (t === 'in_person' || t === 'inperson') return 'حضوري';
  return 'نوع الجلسة';
}

function isInPerson(type: string) {
  const t = String(type).toLowerCase();
  return t.includes('person') || t === 'inperson';
}

function priceLabel(p: number) {
  if (p === 0) return 'مجاني';
  return `${p} ر.س`;
}

export function SessionsTable({ sessions, registrations, loading, onEdit, onDelete }: SessionsTableProps) {
  const bySession = useMemo(() => {
    const map: Record<string, SessionRegistration[]> = {};
    for (const r of registrations) {
      const sid = String(r.session_id);
      if (!map[sid]) map[sid] = [];
      map[sid].push(r);
    }
    for (const sid of Object.keys(map)) {
      map[sid].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    }
    return map;
  }, [registrations]);

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white text-sm font-black text-stone-500"
      >
        جارٍ تحميل الجلسات…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-12 text-center text-sm font-black text-stone-500"
      >
        لا توجد جلسات بعد. أضف أول جلسة من النموذج أعلاه.
      </div>
    );
  }

  return (
    <div dir="rtl" className="w-full space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-stone-200 pb-3">
        <div>
          <h2 className="text-base font-black text-[#1C4532]">الجلسات الحالية</h2>
          <p className="mt-0.5 text-xs font-bold text-stone-500">{sessions.length} جلسة</p>
        </div>
      </header>

      <ul className="grid list-none gap-4 p-0 sm:grid-cols-1 xl:grid-cols-2">
        {sessions.map((s) => {
          const sid = String(s.id ?? '');
          const regs = sid ? bySession[sid] ?? [] : [];
          const rowKey = sid || `${s.title}-${s.date}`;
          const inPerson = isInPerson(String(s.session_type));

          return (
            <li
              key={rowKey}
              className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm ring-1 ring-black/[0.03]"
            >
              <div className="flex flex-col gap-3 border-b border-stone-100 bg-gradient-to-bl from-stone-50/90 to-white p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="text-sm font-black leading-snug text-[#1C4532] sm:text-base">{s.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${
                        inPerson
                          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                          : 'bg-sky-50 text-sky-800 ring-sky-200'
                      }`}
                    >
                      {sessionTypeLabel(String(s.session_type))}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-900 ring-1 ring-amber-200">
                      {priceLabel(Number(s.price) || 0)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-black text-stone-700 ring-1 ring-stone-200">
                      <Users className="h-3 w-3 opacity-70" aria-hidden />
                      {s.spots} مقعد
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                  <button
                    type="button"
                    onClick={() => onEdit?.(s)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700 shadow-sm hover:bg-stone-50"
                    title="تعديل"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(s)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700 shadow-sm hover:bg-red-50"
                    title="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    حذف
                  </button>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-stone-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#C9A84C]" aria-hidden />
                    {formatDate(String(s.date))}
                  </span>
                  {inPerson && s.location_url ? (
                    <a
                      href={s.location_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-black text-[#1C4532] underline decoration-[#C9A84C]/50 underline-offset-2 hover:decoration-[#C9A84C]"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#C9A84C]" aria-hidden />
                      الموقع على الخريطة
                    </a>
                  ) : null}
                </div>

                {s.description ? (
                  <p className="text-xs font-bold leading-relaxed text-stone-700">{s.description}</p>
                ) : (
                  <p className="text-xs font-bold text-stone-400">لا يوجد وصف لهذه الجلسة.</p>
                )}

                <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-black text-[#1C4532]">قائمة المسجّلين</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black tabular-nums text-stone-700 ring-1 ring-stone-200">
                      {regs.length}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-stone-600">المسجلون: (الأحدث أولاً)</p>
                  {regs.length === 0 ? (
                    <p className="mt-2 text-xs font-bold text-stone-500">لا يوجد مسجّلون بعد.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-stone-200/80 rounded-lg border border-stone-200 bg-white">
                      {regs.map((r) => (
                        <li key={r.id ?? `${r.session_id}-${r.whatsapp}-${r.created_at}`} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <span className="text-xs font-black text-stone-800">{r.name}</span>
                          <span className="text-xs font-bold tabular-nums text-stone-600" dir="ltr">
                            {r.whatsapp}
                          </span>
                          <span className="text-[11px] font-bold text-stone-500 sm:text-left">{formatDateTime(r.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
