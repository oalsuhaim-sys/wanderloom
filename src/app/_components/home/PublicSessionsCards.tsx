'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarClock, Loader2, MapPin, Ticket, Users, X } from 'lucide-react';

import { registerSessionAction } from '@/app/actions/registerSession';
import type { Session } from '@/types/session-tables';
import { ar } from '@/messages/ar';

import { requestScrollToTripForm } from './ScrollToLeadOnMount';

const s = ar.sessions;
const c = ar.common;

/** يمنع تعطّل الواجهة إن غاب مفتاح الترجمة `seatsLeft` في الكاش أو نسخة قديمة من `ar`. */
function formatSeatsRemaining(left: number): string {
  const tpl = s.seatsLeft ?? '{n} مقعد متبقي';
  return String(tpl).replace(/\{n\}/g, String(left));
}

function formatRegistrationSuccess(at: string): string {
  const withTime = s.successWithTime;
  const base = s.success ?? 'تم إرسال تسجيلك بنجاح!';
  if (at && typeof withTime === 'string' && withTime.includes('{time}')) {
    return withTime.replace('{time}', at);
  }
  if (at) return `${base} (${at})`;
  return base;
}

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

function priceLabel(p: number) {
  if (p === 0) return c.free;
  return `${Number(p)} ${c.currencySuffix}`;
}

function spotsLeft(s: Session): number {
  const n = Number(s.spots ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

type PublicSessionsCardsProps = {
  sessions: Session[];
  loadError: string | null;
  demo: boolean;
  initialLoading?: boolean;
};

export function PublicSessionsCards({
  sessions,
  loadError,
  demo,
  initialLoading = false,
}: PublicSessionsCardsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [list, setList] = useState<Session[]>(sessions);
  const [openFor, setOpenFor] = useState<Session | null>(null);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setList(sessions);
  }, [sessions]);

  function goToTripForm() {
    setOpenFor(null);
    if (pathname === '/' || pathname === '') {
      document.getElementById('lead')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    requestScrollToTripForm();
    router.push('/');
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!openFor?.id) {
      setFormMsg({ type: 'err', text: s.clientMissingSession });
      return;
    }
    if (!name.trim() || !whatsapp.trim()) {
      setFormMsg({ type: 'err', text: s.clientNameWaRequired });
      return;
    }

    setSubmitting(true);
    setFormMsg(null);

    const res = await registerSessionAction({
      session_id: String(openFor.id),
      name: name.trim(),
      whatsapp: whatsapp.trim(),
    });

    setSubmitting(false);

    if (!res.ok) {
      setFormMsg({ type: 'err', text: res.error });
      return;
    }

    const sid = String(openFor.id);
    const nextSpots =
      typeof res.spotsRemaining === 'number'
        ? res.spotsRemaining
        : Math.max(0, spotsLeft(openFor) - 1);

    setList((prev) =>
      prev.map((row) => (String(row.id) === sid ? { ...row, spots: nextSpots } : row))
    );

    const at = res.data.created_at
      ? new Date(res.data.created_at).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })
      : '';
    setFormMsg({
      type: 'ok',
      text: formatRegistrationSuccess(at),
    });

    router.refresh();

    setTimeout(() => {
      setOpenFor(null);
      setName('');
      setWhatsapp('');
      setFormMsg(null);
    }, 1800);
  }

  if (initialLoading) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[2rem] border border-[#c9a84c]/20 bg-white/[0.04] py-16">
        <Loader2 className="h-9 w-9 animate-spin text-[#d4b87a]" aria-hidden />
        <p className="text-sm font-bold text-white/55">{s.loading}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-950/35 px-5 py-4 text-center text-sm font-bold text-red-100">
        {s.loadErrorPrefix} {loadError}
      </div>
    );
  }

  const sorted = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (sorted.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-[#c9a84c]/15 bg-gradient-to-b from-white/[0.06] to-transparent px-8 py-20 text-center">
        <p className="text-base font-black leading-relaxed text-[#e8d5a8] sm:text-lg">{s.emptyTitle}</p>
        <p className="mt-4 text-sm font-bold text-white/45">
          {s.emptyLeadPrefix}{' '}
          <Link href="/#lead" className="font-black text-[#d4b87a] underline underline-offset-4">
            {s.emptyLeadLink}
          </Link>{' '}
          {s.emptyLeadSuffix}
        </p>
      </div>
    );
  }

  return (
    <>
      {demo ? (
        <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-amber-400/30 bg-amber-950/30 px-4 py-3 text-center text-xs font-black text-amber-100">
          {s.demoBanner}
        </div>
      ) : null}

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((s) => {
          const left = spotsLeft(s);
          const full = left < 1;
          return (
            <article
              key={String(s.id ?? `${s.title}-${s.date}`)}
              className="flex flex-col rounded-[2rem] border border-[#c9a84c]/22 bg-gradient-to-b from-white/[0.07] to-transparent p-7 shadow-[0_24px_70px_rgba(0,0,0,.4)]"
            >
              <h3 className="text-xl font-black leading-snug text-white">{s.title}</h3>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold text-white/55">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-[#d4b87a]" aria-hidden />
                  {formatSessionDate(String(s.date))}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-3 py-1.5 font-black text-[#f0e4c4]">
                  <Ticket className="h-3.5 w-3.5" aria-hidden />
                  {priceLabel(Number(s.price) || 0)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5">
                  <Users className="h-3.5 w-3.5 text-[#d4b87a]" aria-hidden />
                  {full ? (s.full ?? 'مكتمل') : formatSeatsRemaining(left)}
                </span>
              </div>
              {s.description ? (
                <p className="mt-4 line-clamp-3 flex-1 text-sm font-bold leading-relaxed text-white/55">{s.description}</p>
              ) : (
                <div className="flex-1" />
              )}
              <div className="mt-8 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={!s.id || full}
                  onClick={() => {
                    if (full) return;
                    setOpenFor(s);
                    setName('');
                    setWhatsapp('');
                    setFormMsg(null);
                  }}
                  className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-l from-[#7a5f28] to-[#d4b87a] py-3.5 text-sm font-black text-[#0a1814] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {full ? (s.full ?? 'مكتمل') : (s.register ?? 'سجّل الآن')}
                </button>
                {String(s.session_type).toLowerCase().includes('person') && s.location_url ? (
                  <a
                    href={s.location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#c9a84c]/35 py-2.5 text-xs font-black text-[#e8d5a8]"
                  >
                    <MapPin className="h-4 w-4" aria-hidden />
                    {s.location}
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {openFor ? (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center bg-black/65 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-register-title"
          onClick={() => !submitting && setOpenFor(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[#c9a84c]/25 bg-[#071612] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 id="session-register-title" className="text-sm font-black text-[#d4b87a]">
                  {s.modalTitle}
                </h3>
                <p className="mt-1 text-xs font-bold text-white/50">{openFor.title}</p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOpenFor(null)}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/15 disabled:opacity-50"
                aria-label={s.modalClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-black text-white/80">{s.nameLabel}</label>
                <input
                  className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-sm font-bold text-white outline-none ring-[#c9a84c] placeholder:text-white/30 focus:ring-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={s.namePlaceholder}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black text-white/80">{s.waLabel}</label>
                <input
                  type="tel"
                  dir="ltr"
                  className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-sm font-bold text-white outline-none ring-[#c9a84c] placeholder:text-white/30 focus:ring-2"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder={s.waPlaceholder}
                  autoComplete="tel"
                />
              </div>

              {formMsg ? (
                <div
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${
                    formMsg.type === 'ok'
                      ? 'border-emerald-400/40 bg-emerald-950/50 text-emerald-100'
                      : 'border-red-400/40 bg-red-950/50 text-red-100'
                  }`}
                >
                  {formMsg.text}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting || spotsLeft(openFor) < 1}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#7a5f28] to-[#d4b87a] py-3 text-sm font-black text-[#0a1814] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {s.submit}
              </button>
              <p className="text-center text-[10px] font-bold text-white/35">
                {s.modalFooterPrefix}{' '}
                <button
                  type="button"
                  onClick={goToTripForm}
                  className="font-black text-[#d4b87a] underline underline-offset-2"
                >
                  {s.modalFooterLink}
                </button>
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
