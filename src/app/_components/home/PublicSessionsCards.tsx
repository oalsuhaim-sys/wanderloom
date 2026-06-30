'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarClock, Loader2, MapPin, Ticket, Users, X } from 'lucide-react';

import { registerSessionAction } from '@/app/actions/registerSession';
import { useLanguage } from '@/context/LanguageContext';
import type { Session } from '@/types/session-tables';

import { requestScrollToTripForm } from './ScrollToLeadOnMount';

function formatSeatsRemaining(tpl: string, left: number): string {
  return String(tpl).replace(/\{n\}/g, String(left));
}

function formatRegistrationSuccess(
  base: string,
  withTimeTpl: string,
  at: string,
): string {
  if (at && withTimeTpl.includes('{time}')) {
    return withTimeTpl.replace('{time}', at);
  }
  if (at) return `${base} (${at})`;
  return base;
}

type EventListEntry = {
  matchTitle: string;
  title: string;
  desc: string;
};

function normalizeSessionTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().replace(/[–—−]/g, '-');
}

function resolveEventCopy(
  session: Session,
  index: number,
  eventsList: EventListEntry[],
): { title: string; description: string } {
  const raw = String(session.title ?? '').trim();
  const normalized = normalizeSessionTitle(raw);
  const entry =
    eventsList.find(
      (e) => e.matchTitle === raw || normalizeSessionTitle(e.matchTitle) === normalized,
    ) ?? eventsList[index];

  return {
    title: entry?.title ?? raw,
    description: entry?.desc ?? String(session.description ?? ''),
  };
}

function formatSessionDate(value: string, locale: 'ar' | 'en') {
  const day = String(value).slice(0, 10);
  try {
    const d = new Date(day + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
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
  const { locale, dir, t } = useLanguage();
  const ev = t.events;
  const c = t.common;

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

  const sortedSessions = useMemo(
    () => [...list].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [list],
  );

  const displaySessions = useMemo(
    () =>
      sortedSessions.map((session, index) => {
        const copy = resolveEventCopy(session, index, ev.eventsList ?? []);
        return { ...session, title: copy.title, description: copy.description };
      }),
    [sortedSessions, ev.eventsList],
  );

  function priceLabel(p: number) {
    if (p === 0) return c.free;
    return `${Number(p)} ${c.currencySuffix}`;
  }

  function spotsLeft(session: Session): number {
    const n = Number(session.spots ?? 0);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

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
      setFormMsg({ type: 'err', text: ev.clientMissingSession });
      return;
    }
    if (!name.trim() || !whatsapp.trim()) {
      setFormMsg({ type: 'err', text: ev.clientNameWaRequired });
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
      prev.map((row) => (String(row.id) === sid ? { ...row, spots: nextSpots } : row)),
    );

    const at = res.data.created_at
      ? new Date(res.data.created_at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : '';
    setFormMsg({
      type: 'ok',
      text: formatRegistrationSuccess(ev.success, ev.successWithTime, at),
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
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[2rem] border border-[#1e3f20]/10 bg-white py-16">
        <Loader2 className="h-9 w-9 animate-spin text-[#cda04c]" aria-hidden />
        <p className="text-sm font-bold text-gray-600">{ev.loading}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-950/35 px-5 py-4 text-center text-sm font-bold text-red-100">
        {ev.loadErrorPrefix} {loadError}
      </div>
    );
  }

  if (displaySessions.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-[#1e3f20]/10 bg-white px-8 py-20 text-center shadow-sm">
        <p className="text-base font-black leading-relaxed text-[#111111] sm:text-lg">{ev.emptyTitle}</p>
        <p className="mt-4 text-sm font-bold text-gray-600">
          {ev.emptyLeadPrefix}{' '}
          <Link href="/#lead" className="font-black text-[#cda04c] underline underline-offset-4">
            {ev.emptyLeadLink}
          </Link>{' '}
          {ev.emptyLeadSuffix}
        </p>
      </div>
    );
  }

  return (
    <>
      {demo ? (
        <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-amber-400/30 bg-amber-950/30 px-4 py-3 text-center text-xs font-black text-amber-100">
          {ev.demoBanner}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
        {displaySessions.map((session) => {
          const left = spotsLeft(session);
          const full = left < 1;
          return (
            <article
              key={String(session.id ?? `${session.title}-${session.date}`)}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8 md:p-10"
            >
              <h3 className="text-xl font-black leading-snug text-[#111111]">{session.title}</h3>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-600">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-[#FDFBF7] px-3 py-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-[#cda04c]" aria-hidden />
                  {formatSessionDate(String(session.date), locale)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cda04c]/30 bg-[#cda04c]/10 px-3 py-1.5 font-black text-[#9a7b45]">
                  <Ticket className="h-3.5 w-3.5" aria-hidden />
                  {priceLabel(Number(session.price) || 0)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-[#FDFBF7] px-3 py-1.5">
                  <Users className="h-3.5 w-3.5 text-[#cda04c]" aria-hidden />
                  {full ? ev.full : formatSeatsRemaining(ev.seatsLeft, left)}
                </span>
              </div>
              {session.description ? (
                <p className="mt-4 line-clamp-3 flex-1 text-sm font-bold leading-relaxed text-gray-600">
                  {session.description}
                </p>
              ) : (
                <div className="flex-1" />
              )}
              <div className="mt-8 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={!session.id || full}
                  onClick={() => {
                    if (full) return;
                    setOpenFor(session);
                    setName('');
                    setWhatsapp('');
                    setFormMsg(null);
                  }}
                  className="flex w-full items-center justify-center rounded-2xl bg-[#cda04c] py-3.5 text-sm font-black text-white transition hover:bg-[#b3893d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {full ? ev.full : ev.register}
                </button>
                {String(session.session_type).toLowerCase().includes('person') && session.location_url ? (
                  <a
                    href={session.location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#cda04c]/35 py-2.5 text-xs font-black text-[#cda04c]"
                  >
                    <MapPin className="h-4 w-4" aria-hidden />
                    {ev.location}
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {openFor ? (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-register-title"
          onClick={() => !submitting && setOpenFor(null)}
        >
          <div
            className="max-h-[92dvh] w-[95%] max-w-md overflow-y-auto rounded-t-3xl border border-[#cda04c]/25 bg-white p-4 shadow-2xl sm:max-h-[90vh] sm:w-full sm:rounded-3xl sm:p-6 md:w-3/4 md:max-w-lg lg:w-1/2 lg:max-w-xl"
            onClick={(e) => e.stopPropagation()}
            dir={dir}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 id="session-register-title" className="text-sm font-black text-[#cda04c]">
                  {ev.modalTitle}
                </h3>
                <p className="mt-1 text-xs font-bold text-gray-500">{openFor.title}</p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOpenFor(null)}
                className="rounded-full bg-gray-100 p-2 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                aria-label={ev.modalClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-black text-gray-700">{ev.nameLabel}</label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-[#FDFBF7] px-3 py-2.5 text-sm font-bold text-[#111111] outline-none ring-[#cda04c] placeholder:text-gray-400 focus:ring-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={ev.namePlaceholder}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black text-gray-700">{ev.waLabel}</label>
                <input
                  type="tel"
                  dir="ltr"
                  className="w-full rounded-xl border border-gray-200 bg-[#FDFBF7] px-3 py-2.5 text-sm font-bold text-[#111111] outline-none ring-[#cda04c] placeholder:text-gray-400 focus:ring-2"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder={ev.waPlaceholder}
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#cda04c] py-3 text-sm font-black text-white transition hover:bg-[#b3893d] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {ev.submit}
              </button>
              <p className="text-center text-[10px] font-bold text-gray-500">
                {ev.modalFooterPrefix}{' '}
                <button
                  type="button"
                  onClick={goToTripForm}
                  className="font-black text-[#cda04c] underline underline-offset-2"
                >
                  {ev.modalFooterLink}
                </button>
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
