'use client';

import { useMemo } from 'react';
import { ExternalLink, MapPin, Pencil, Trash2, Users, Video } from 'lucide-react';

import type { Session, SessionRegistration } from '@/types/session-tables';
import { CRM_BTN_PRIMARY, partnerInitials } from '@/lib/crm-luxury-ui';

type SessionsTableProps = {
  sessions: Session[];
  registrations: SessionRegistration[];
  loading?: boolean;
  onEdit?: (session: Session) => void;
  onDelete?: (session: Session) => void;
};

function parseSessionDate(value: string): Date | null {
  const day = String(value).slice(0, 10);
  const d = new Date(`${day}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sessionTypeLabel(type: string) {
  const t = String(type).toLowerCase().replace(/-/g, '_');
  if (t === 'online') return 'أونلاين';
  if (t === 'in_person' || t === 'inperson') return 'حضوري';
  return 'جلسة';
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
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
    }
    return map;
  }, [registrations]);

  const sorted = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const da = parseSessionDate(String(a.date))?.getTime() ?? 0;
      const db = parseSessionDate(String(b.date))?.getTime() ?? 0;
      return da - db;
    });
  }, [sessions]);

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm font-semibold text-slate-500 dark:border-[#2D3F3A] dark:bg-[#22302C]"
      >
        جارٍ تحميل الجلسات…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm font-semibold text-slate-500 dark:border-[#2D3F3A] dark:bg-[#22302C]"
      >
        لا توجد جلسات بعد. أضف أول جلسة من النموذج أعلاه.
      </div>
    );
  }

  return (
    <div dir="rtl" className="w-full space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">الجلسات القادمة</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{sessions.length} جلسة</p>
        </div>
      </header>

      <ul className="flex list-none flex-col gap-3 p-0">
        {sorted.map((s) => {
          const sid = String(s.id ?? '');
          const regs = sid ? bySession[sid] ?? [] : [];
          const rowKey = sid || `${s.title}-${s.date}`;
          const inPerson = isInPerson(String(s.session_type));
          const d = parseSessionDate(String(s.date));
          const dayNum = d ? d.getDate() : '—';
          const month = d
            ? d.toLocaleDateString('ar-SA', { month: 'short' })
            : String(s.date).slice(5, 7) || '—';
          const lead = regs[0];
          const joinHref = inPerson
            ? s.location_url || '/portal/sessions'
            : s.location_url || '/portal/sessions';

          return (
            <li
              key={rowKey}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-[#2D3F3A] dark:bg-[#22302C]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-50 p-2 text-center dark:bg-[#1A2421]">
                    <span className="text-2xl font-bold leading-none text-slate-900 dark:text-white">
                      {dayNum}
                    </span>
                    <span className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      {month}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                      {s.title}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-[#1A2421] dark:text-slate-300">
                        {sessionTypeLabel(String(s.session_type))}
                      </span>
                      <span className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-[#1A2421] dark:text-slate-300">
                        {priceLabel(Number(s.price) || 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-[#1A2421] dark:text-slate-300">
                        <Users className="h-3 w-3" aria-hidden />
                        {s.spots} مقعد · {regs.length} مسجّل
                      </span>
                    </div>

                    {lead ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-[#D4AF37] dark:text-slate-900">
                          {partnerInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {lead.name}
                          </p>
                          <p className="text-[10px] text-slate-400" dir="ltr">
                            {lead.whatsapp}
                          </p>
                        </div>
                        {regs.length > 1 ? (
                          <span className="text-[10px] font-medium text-slate-400">
                            +{regs.length - 1}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs font-medium text-slate-400">لا يوجد مسجّلون بعد</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <a
                    href={joinHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={CRM_BTN_PRIMARY}
                  >
                    {inPerson ? (
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Video className="h-3.5 w-3.5" aria-hidden />
                    )}
                    دخول الجلسة
                    <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                  </a>
                  <button
                    type="button"
                    onClick={() => onEdit?.(s)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(s)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-transparent dark:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    حذف
                  </button>
                </div>
              </div>

              {regs.length > 0 ? (
                <details className="mt-3 border-t border-slate-100 pt-3 dark:border-[#2D3F3A]">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                    عرض كل المسجّلين ({regs.length})
                  </summary>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-[#2D3F3A] dark:border-[#2D3F3A]">
                    {regs.map((r) => (
                      <li
                        key={r.id ?? `${r.session_id}-${r.whatsapp}-${r.created_at}`}
                        className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {r.name}
                        </span>
                        <span className="text-xs text-slate-500" dir="ltr">
                          {r.whatsapp}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
