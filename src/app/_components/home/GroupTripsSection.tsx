'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Users, X } from 'lucide-react';

import { submitGroupTripLead } from '@/app/actions/submitGroupTripLead';
import GroupTripLeaderBadge from '@/app/crm/groups/_components/GroupTripLeaderBadge';
import { useLanguage } from '@/context/LanguageContext';
import { supabaseClient } from '@/lib/supabaseClient';
import type { GroupTripRow } from '@/types/group-trip';

const CARD_STYLES = [
  { ring: 'ring-[#cda04c]/35', chip: 'bg-[#1e3f20]/10 text-[#1e3f20]' },
  { ring: 'ring-sky-300/40', chip: 'bg-sky-50 text-sky-900' },
  { ring: 'ring-violet-300/40', chip: 'bg-violet-50 text-violet-900' },
] as const;

type DisplayTrip = GroupTripRow & {
  title: string;
  description: string;
  badge: string;
  ring: string;
  chip: string;
};

const GROUP_TRIPS_SELECT =
  'id, title_ar, title_en, description_ar, description_en, badge_ar, badge_en, sort_order, leader_id, leader_name';

const INITIAL_REG_FORM = {
  fullName: '',
  whatsapp: '',
  email: '',
  age: '',
};

const REG_FIELD_CLASS =
  'w-full rounded-lg border border-[#1e3f20]/20 bg-[#FDFBF7] p-3 text-sm font-bold text-[#111111] outline-none transition-colors placeholder:text-gray-400 focus:border-[#cda04c]';

function GroupTripCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col rounded-2xl border border-gray-100 bg-white p-8 shadow-sm md:p-10">
      <div className="h-6 w-20 rounded-full bg-stone-200" />
      <div className="mt-4 h-6 w-3/4 rounded-lg bg-stone-200" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-stone-100" />
        <div className="h-3 w-5/6 rounded bg-stone-100" />
      </div>
      <div className="mt-6 h-12 rounded-2xl bg-stone-200" />
    </div>
  );
}

export function GroupTripsSection() {
  const { locale, dir, t } = useLanguage();
  const g = t.groups;

  const [trips, setTrips] = useState<GroupTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [open, setOpen] = useState<DisplayTrip | null>(null);
  const [formData, setFormData] = useState(INITIAL_REG_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTrips() {
      setLoading(true);
      setFetchError(null);

      if (!supabaseClient) {
        if (!cancelled) {
          setTrips([]);
          setFetchError('Supabase is not configured.');
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabaseClient
        .from('group_trips')
        .select(GROUP_TRIPS_SELECT)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      let rows = data;
      let fetchErr = error;

      if (fetchErr && /leader_/i.test(fetchErr.message ?? '')) {
        const fallback = await supabaseClient
          .from('group_trips')
          .select('id, title_ar, title_en, description_ar, description_en, badge_ar, badge_en, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        rows = fallback.data;
        fetchErr = fallback.error;
      }

      if (cancelled) return;

      if (fetchErr) {
        setTrips([]);
        setFetchError(fetchErr.message);
        setLoading(false);
        return;
      }

      setTrips((rows ?? []) as GroupTripRow[]);
      setLoading(false);
    }

    void loadTrips();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayTrips = useMemo<DisplayTrip[]>(
    () =>
      trips.map((trip, index) => {
        const style = CARD_STYLES[index % CARD_STYLES.length];
        const isAr = locale === 'ar';
        return {
          ...trip,
          title: isAr ? trip.title_ar : trip.title_en,
          description: isAr ? trip.description_ar : trip.description_en,
          badge: isAr ? trip.badge_ar : trip.badge_en,
          ring: style.ring,
          chip: style.chip,
        };
      }),
    [trips, locale],
  );

  function closeModal() {
    if (submitting) return;
    setOpen(null);
    setMsg(null);
  }

  function resetRegForm() {
    setFormData(INITIAL_REG_FORM);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    const ageNum = parseInt(formData.age, 10);

    if (!formData.fullName.trim() || !formData.whatsapp.trim()) {
      setMsg({ type: 'err', text: g.errors.namePhone });
      return;
    }
    if (!formData.email.trim()) {
      setMsg({ type: 'err', text: g.errors.emailRequired });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setMsg({ type: 'err', text: g.errors.invalidEmail });
      return;
    }
    if (!formData.age.trim()) {
      setMsg({ type: 'err', text: g.errors.ageRequired });
      return;
    }
    if (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > 120) {
      setMsg({ type: 'err', text: g.errors.invalidAge });
      return;
    }

    setSubmitting(true);
    setMsg(null);
    const res = await submitGroupTripLead({
      full_name: formData.fullName.trim(),
      phone_wa: formData.whatsapp.trim(),
      email: formData.email.trim(),
      age: ageNum,
      trip_label: open.title,
    });
    setSubmitting(false);

    if (!res.ok) {
      setMsg({ type: 'err', text: res.error ?? g.errors.generic });
      return;
    }

    setMsg({ type: 'ok', text: res.message ?? g.success });
    setTimeout(() => {
      closeModal();
      resetRegForm();
      setMsg(null);
    }, 2200);
  }

  return (
    <>
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm font-bold leading-relaxed text-[#3d4a42] sm:text-base">
        {g.cardsHint}
      </p>

      {loading ? (
        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          <GroupTripCardSkeleton />
          <GroupTripCardSkeleton />
          <GroupTripCardSkeleton />
        </div>
      ) : displayTrips.length === 0 ? (
        <div className="mx-auto mt-12 max-w-xl rounded-[1.75rem] border border-[#1e3f20]/10 bg-white px-6 py-12 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#1e3f20]/40" aria-hidden />
          <p className="text-sm font-bold text-[#3d4a42]">
            {locale === 'ar'
              ? 'لا توجد رحلات مجموعات متاحة حالياً.'
              : 'No group trips are available right now.'}
          </p>
          {fetchError ? (
            <p className="mt-2 text-xs font-bold text-[#6b5c38]/80">{fetchError}</p>
          ) : null}
        </div>
      ) : (
        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {displayTrips.map((trip) => (
            <article
              key={trip.id}
              className={`wl-lift-card group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ring-1 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] ${trip.ring}`}
            >
              <div className="wl-card-media overflow-hidden border-b border-gray-50 bg-gradient-to-br from-[#F9F9F6] via-white to-[#f4efe6] px-5 py-6 sm:px-8">
                <div className="wl-card-media-icon flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1A3B2A] text-[#C5A059] shadow-md transition-transform duration-700 group-hover:scale-105">
                  <Users className="h-6 w-6" aria-hidden />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-8 md:p-10">
                <span className={`w-fit rounded-full px-3 py-1 text-[10px] font-black ${trip.chip}`}>
                  {trip.badge}
                </span>
                <h3 className="mt-4 text-lg font-black leading-snug text-[#0f1e16]">{trip.title}</h3>
                {trip.leader_name?.trim() ? (
                  <div className="mt-3">
                    <GroupTripLeaderBadge name={trip.leader_name} compact />
                  </div>
                ) : null}
                <p className="mt-3 flex-1 text-sm font-bold leading-relaxed text-[#4a5650]">
                  {trip.description}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(trip);
                    resetRegForm();
                    setMsg(null);
                  }}
                  className="mt-6 w-full rounded-full bg-[#1A3B2A] py-3.5 text-sm font-black text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#163018] hover:shadow-lg"
                >
                  {g.registerCta}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-[340] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-trip-modal-title"
          onClick={() => closeModal()}
        >
          <div
            className="max-h-[92dvh] w-[95%] max-w-md overflow-y-auto rounded-t-3xl border border-[#1e3f20]/15 bg-white p-4 shadow-2xl sm:max-h-[min(90vh,720px)] sm:w-full sm:rounded-3xl sm:p-6 md:w-3/4 md:max-w-lg lg:w-1/2 lg:max-w-xl"
            onClick={(e) => e.stopPropagation()}
            dir={dir}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 id="group-trip-modal-title" className="text-sm font-black text-[#1e3f20]">
                  {g.modal.title}
                </h3>
                <p className="mt-1 text-xs font-bold text-gray-500">
                  {g.modal.tripLabel}: {open.title}
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={closeModal}
                className="rounded-full bg-gray-100 p-2 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                aria-label={g.modal.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-5">
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-800">{g.modal.nameLabel}</label>
                  <input
                    type="text"
                    required
                    className={REG_FIELD_CLASS}
                    placeholder={g.modal.namePlaceholder}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-800">{g.modal.emailLabel}</label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    className={REG_FIELD_CLASS}
                    placeholder={g.modal.emailPlaceholder}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    autoComplete="email"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-800">{g.modal.waLabel}</label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      className={REG_FIELD_CLASS}
                      placeholder={g.modal.waPlaceholder}
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-800">{g.modal.ageLabel}</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={120}
                      className={REG_FIELD_CLASS}
                      placeholder={g.modal.agePlaceholder}
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {msg ? (
                <div
                  className={`mt-4 rounded-xl border px-3 py-2 text-xs font-black ${
                    msg.type === 'ok'
                      ? 'border-emerald-400/40 bg-emerald-950/50 text-emerald-100'
                      : 'border-red-400/40 bg-red-950/50 text-red-100'
                  }`}
                >
                  {msg.text}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#cda04c] py-3 text-sm font-black text-white transition hover:bg-[#b3893d] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {g.modal.submit}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
