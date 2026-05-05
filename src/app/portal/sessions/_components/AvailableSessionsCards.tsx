'use client';

import { useState } from 'react';
import { CalendarClock, Loader2, MapPin, Tag, Ticket, Users, X } from 'lucide-react';

import { registerForSession } from '@/app/portal/services/sessions';
import type { Session } from '@/types/session-tables';

type AvailableSessionsCardsProps = {
  sessions: Session[];
  loading?: boolean;
  loadError?: string | null;
  onRegistered?: () => void;
};

function formatSessionDate(value: string) {
  const day = String(value).slice(0, 10);
  try {
    const d = new Date(day + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('ar-SA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function sessionTypeLabel(type: string) {
  const t = String(type).toLowerCase();
  if (t === 'online') return 'أونلاين';
  if (t === 'in_person' || t === 'in-person' || t === 'inperson') return 'حضوري';
  return type;
}

function priceLabel(p: number) {
  if (p === 0) return 'مجاني';
  return `${p} ر.س`;
}

export function AvailableSessionsCards({
  sessions,
  loading,
  loadError,
  onRegistered,
}: AvailableSessionsCardsProps) {
  const [openFor, setOpenFor] = useState<Session | null>(null);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!openFor?.id) {
      setFormMsg({ type: 'err', text: 'معرف الجلسة غير متوفر.' });
      return;
    }
    if (!name.trim() || !whatsapp.trim()) {
      setFormMsg({ type: 'err', text: 'الاسم ورقم الواتساب مطلوبان.' });
      return;
    }

    setSubmitting(true);
    setFormMsg(null);

    const res = await registerForSession({
      session_id: String(openFor.id),
      name: name.trim(),
      whatsapp: whatsapp.trim(),
    });

    setSubmitting(false);

    if (!res.ok) {
      setFormMsg({ type: 'err', text: res.error });
      return;
    }

    const at = res.data.created_at
      ? new Date(res.data.created_at).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })
      : '';
    setFormMsg({
      type: 'ok',
      text: at ? `تم التسجيل بنجاح (وقت التسجيل: ${at}).` : 'تم التسجيل بنجاح.',
    });
    onRegistered?.();
    setTimeout(() => {
      setOpenFor(null);
      setName('');
      setWhatsapp('');
      setFormMsg(null);
    }, 1400);
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-[#C9A84C]/25 bg-white/5 text-sm font-bold text-white/80 shadow-[0_10px_40px_rgba(0,0,0,.35)]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" />
        جاري التحميل...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm font-bold text-red-200">
        {loadError}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-[#C9A84C]/20 bg-white/5 px-4 py-12 text-center text-sm font-bold text-white/70">
        لا توجد جلسات متاحة حالياً
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((s) => (
          <article
            key={String(s.id ?? `${s.title}-${s.date}`)}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-[0_8px_40px_rgba(0,0,0,.25)] backdrop-blur-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-black leading-snug text-white">{s.title}</h2>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-[#E8C96A] ring-1 ring-white/15">
                {sessionTypeLabel(String(s.session_type))}
              </span>
            </div>

            <div className="mt-3 space-y-2 text-xs font-bold text-white/55">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/85">
                  <CalendarClock className="h-3.5 w-3.5 text-[#C9A84C]" />
                  {formatSessionDate(String(s.date))}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/85">
                  <Tag className="h-3.5 w-3.5 text-[#C9A84C]" />
                  {sessionTypeLabel(String(s.session_type))}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#C9A84C]/35 bg-[#C9A84C]/10 px-2 py-1 text-[11px] text-[#E8C96A]">
                  <Ticket className="h-3.5 w-3.5" />
                  {priceLabel(Number(s.price) || 0)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/85">
                  <Users className="h-3.5 w-3.5 text-[#C9A84C]" />
                  {s.spots} مقعد
                </span>
              </div>
              {s.description ? (
                <p className="line-clamp-3 text-white/65">{s.description}</p>
              ) : null}
            </div>

            <button
              type="button"
              disabled={!s.id}
              onClick={() => {
                setOpenFor(s);
                setName('');
                setWhatsapp('');
                setFormMsg(null);
              }}
              className="mt-4 w-full rounded-xl bg-gradient-to-l from-[#8A6B2A] to-[#C9A84C] py-2.5 text-sm font-black text-[#1C4532] shadow-lg shadow-black/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              تسجيل الآن
            </button>
            {String(s.session_type).toLowerCase().includes('person') && s.location_url ? (
              <a
                href={s.location_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#C9A84C]/35 bg-[#C9A84C]/10 py-2 text-xs font-black text-[#E8C96A] hover:bg-[#C9A84C]/15"
              >
                <MapPin className="h-4 w-4" />
                عرض الموقع على الخريطة
              </a>
            ) : null}
          </article>
        ))}
      </div>

      {openFor && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-title"
          onClick={() => !submitting && setOpenFor(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0F1E16] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 id="register-title" className="text-sm font-black text-[#C9A84C]">
                  التسجيل في الجلسة
                </h3>
                <p className="mt-1 text-xs font-bold text-white/50">{openFor.title}</p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOpenFor(null)}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/15 disabled:opacity-50"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-black text-white/80">الاسم الكامل *</label>
                <input
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white outline-none ring-[#C9A84C] placeholder:text-white/30 focus:ring-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: نورة العتيبي"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black text-white/80">رقم الواتساب *</label>
                <input
                  type="tel"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white outline-none ring-[#C9A84C] placeholder:text-white/30 focus:ring-2"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  autoComplete="tel"
                />
              </div>

              {formMsg && (
                <div
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${
                    formMsg.type === 'ok'
                      ? 'border-emerald-400/40 bg-emerald-950/50 text-emerald-100'
                      : 'border-red-400/40 bg-red-950/40 text-red-100'
                  }`}
                >
                  {formMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#8A6B2A] to-[#C9A84C] py-3 text-sm font-black text-[#1C4532] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                إرسال التسجيل
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
