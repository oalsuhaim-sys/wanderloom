'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Loader2, Users } from 'lucide-react';
import { GroupOnboardingStepNav } from '@/app/group-onboarding/_components/GroupOnboardingStepNav';
import GroupTripLeaderBadge from '@/app/crm/groups/_components/GroupTripLeaderBadge';
import { ReferralCodeField } from '@/components/ReferralCodeField';
import { useLanguage } from '@/context/LanguageContext';
import {
  brandGoldBadgeStyle,
  brandGoldButtonStyle,
  brandOliveHeadingStyle,
  brandOliveLabelStyle,
} from '@/lib/brand-gold';
import { normalizeAffiliateRef, persistAffiliateRef } from '@/lib/referral-url';
import {
  buildGroupConfirmHref,
  persistGroupRegistrationDraft,
} from '@/lib/group-registration-contact';
import { requireValidPhone } from '@/lib/phoneUtils';
import { supabaseClient } from '@/lib/supabaseClient';
import type { GroupTripRow } from '@/types/group-trip';

const CARD_STYLES = [
  { ring: 'ring-[#9C7A3C]/20', chip: 'text-[#9C7A3C]' },
  { ring: 'ring-[#1C2E3A]/10', chip: 'text-[#9C7A3C]' },
  { ring: 'ring-[#9C7A3C]/15', chip: 'text-[#9C7A3C]' },
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
  birth_date: '',
  referral_code: '',
};

const REG_FIELD_CLASS =
  'w-full rounded-xl border border-[#1C2E3A]/15 bg-white p-3 text-xs font-bold text-[#1C2E3A] outline-none transition placeholder:text-[#1C2E3A]/40 focus:border-[#9C7A3C] focus:ring-2 focus:ring-[#9C7A3C]/40 disabled:cursor-text disabled:bg-white disabled:text-[#1C2E3A] disabled:opacity-100';

const REG_LABEL_CLASS = 'mb-1 block text-xs font-extrabold';

function GroupTripCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col rounded-3xl border border-[#1C2E3A]/10 bg-white/80 p-8 shadow-sm backdrop-blur-sm md:p-10">
      <div className="h-4 w-20 rounded-full bg-[#F4EFE6]" />
      <div className="mt-4 h-6 w-3/4 rounded-lg bg-[#F4EFE6]" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-[#F4EFE6]/80" />
        <div className="h-3 w-5/6 rounded bg-[#F4EFE6]/80" />
      </div>
      <div className="mt-6 h-12 rounded-full bg-[#F4EFE6]" />
    </div>
  );
}

export function GroupTripsSection() {
  const router = useRouter();
  const { locale, dir, t } = useLanguage();
  const g = t.groups;

  const [trips, setTrips] = useState<GroupTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [open, setOpen] = useState<DisplayTrip | null>(null);
  const [formData, setFormData] = useState(INITIAL_REG_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

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
        rows = (fallback.data ?? []).map((row) => ({
          ...row,
          leader_id: null,
          leader_name: null,
        })) as typeof data;
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
    const emailTrimmed = formData.email.trim();
    const birthDate = formData.birth_date.trim().slice(0, 10);
    const referralCode = normalizeAffiliateRef(formData.referral_code);

    if (!formData.fullName.trim() || !formData.whatsapp.trim()) {
      setMsg({ type: 'err', text: g.errors.namePhone });
      return;
    }
    const phoneCheck = requireValidPhone(formData.whatsapp);
    if (!phoneCheck.isValid) {
      setMsg({ type: 'err', text: phoneCheck.error ?? g.errors.namePhone });
      return;
    }
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setMsg({ type: 'err', text: g.errors.invalidEmail });
      return;
    }
    if (!birthDate) {
      setMsg({ type: 'err', text: g.errors.birthDateRequired });
      return;
    }
    const birthMs = Date.parse(birthDate);
    if (!Number.isFinite(birthMs) || birthMs > Date.now()) {
      setMsg({ type: 'err', text: g.errors.invalidBirthDate });
      return;
    }

    setSubmitting(true);
    setMsg(null);
    try {
      if (referralCode) persistAffiliateRef(referralCode);

      persistGroupRegistrationDraft({
        full_name: formData.fullName.trim(),
        phone_wa: phoneCheck.formattedPhone,
        email: emailTrimmed,
        age: null,
        birth_date: birthDate,
        referral_code: referralCode ?? '',
        preferred_trip_id: open.id,
        trip_label: open.title,
      });

      closeModal();
      resetRegForm();
      router.push(buildGroupConfirmHref());
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : g.errors.generic,
      });
    } finally {
      setSubmitting(false);
    }
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
        <div className="mx-auto mt-12 max-w-xl rounded-[1.75rem] border border-[#1C2E3A]/10 bg-white px-6 py-12 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#1C2E3A]/40" aria-hidden />
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
              className={`wl-lift-card group flex flex-col overflow-hidden rounded-3xl border border-[#1C2E3A]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm ring-1 transition-all duration-300 hover:border-[#9C7A3C]/40 hover:shadow-xl ${trip.ring}`}
            >
              <div className="wl-card-media overflow-hidden rounded-2xl bg-gradient-to-br from-[#F4EFE6] via-white to-[#F4EFE6]/60 px-5 py-5">
                <div className="wl-card-media-icon flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1C2E3A] text-[#9C7A3C] transition-transform duration-500 group-hover:scale-105">
                  <Users className="h-5 w-5" aria-hidden />
                </div>
              </div>
              <div className="mt-5 flex flex-1 flex-col">
                <span className={`w-fit text-[11px] font-medium tracking-wide ${trip.chip}`}>
                  {trip.badge}
                </span>
                <h3 className="mt-3 text-lg font-semibold leading-snug text-[#1C2E3A]">
                  {trip.title}
                </h3>
                {trip.leader_name?.trim() ? (
                  <div className="mt-3">
                    <GroupTripLeaderBadge name={trip.leader_name} compact />
                  </div>
                ) : null}
                <p className="mt-3 flex-1 text-sm font-medium leading-relaxed text-[#1C2E3A]/70">
                  {trip.description}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(trip);
                    resetRegForm();
                    setMsg(null);
                  }}
                  className="mt-6 w-full rounded-full bg-[#1C2E3A] py-3.5 text-sm font-medium tracking-wide text-[#F4EFE6] transition-all hover:bg-[#122029] hover:shadow-lg"
                >
                  {g.registerCta}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && portalReady
        ? createPortal(
            <div
              className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[#1C2E3A]/70 p-4 backdrop-blur-md"
              role="dialog"
              aria-modal="true"
              aria-labelledby="group-trip-modal-title"
              onClick={() => closeModal()}
            >
              <div
                className="relative my-auto max-h-[min(92dvh,720px)] w-full max-w-lg space-y-5 overflow-y-auto rounded-3xl border border-[#1C2E3A]/15 bg-white p-6 text-right shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
                dir={dir}
              >
                <GroupOnboardingStepNav
                  currentStep={1}
                  onBack={closeModal}
                  backDisabled={submitting}
                />

                <div className="space-y-1.5">
                  <span
                    style={brandGoldBadgeStyle}
                    className="mb-1 inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-extrabold"
                  >
                    {g.modal.title}
                  </span>
                  <h3
                    id="group-trip-modal-title"
                    style={brandOliveHeadingStyle}
                    className="text-lg font-extrabold leading-snug sm:text-xl"
                  >
                    {open.title}
                  </h3>
                  {open.description ? (
                    <p className="pt-1 text-xs font-semibold leading-relaxed text-[#1C2E3A]/70">
                      {open.description}
                    </p>
                  ) : (
                    <p className="pt-1 text-xs font-semibold text-[#1C2E3A]/70">
                      {g.modal.tripLabel}: {open.title}
                    </p>
                  )}
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <label className={REG_LABEL_CLASS} style={brandOliveLabelStyle}>
                        {g.modal.nameLabel}
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="name"
                        className={REG_FIELD_CLASS}
                        placeholder={g.modal.namePlaceholder}
                        value={formData.fullName || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-1 text-right">
                      <label className={REG_LABEL_CLASS} style={brandOliveLabelStyle}>
                        {g.modal.emailLabel}{' '}
                        <span className="font-normal text-[#1C2E3A]/50">({g.modal.optionalHint})</span>
                      </label>
                      <input
                        type="email"
                        dir="ltr"
                        className={`${REG_FIELD_CLASS} text-left`}
                        placeholder={g.modal.emailPlaceholder}
                        value={formData.email || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-1 text-right">
                      <label className={REG_LABEL_CLASS} style={brandOliveLabelStyle}>
                        {g.modal.waLabel.replace(/\s*\*$/, '')}{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        className={`${REG_FIELD_CLASS} text-right`}
                        placeholder={g.modal.waPlaceholder}
                        value={formData.whatsapp || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, whatsapp: e.target.value }))
                        }
                        autoComplete="tel"
                      />
                    </div>

                    <div className="space-y-1 text-right">
                      <label className={REG_LABEL_CLASS} style={brandOliveLabelStyle}>
                        {g.modal.birthDateLabel}{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.birth_date || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, birth_date: e.target.value }))
                        }
                        onClick={(e) => {
                          try {
                            e.currentTarget.showPicker?.();
                          } catch {
                            /* showPicker unsupported — native date input still works */
                          }
                        }}
                        className={`${REG_FIELD_CLASS} cursor-pointer text-right`}
                        dir="rtl"
                      />
                    </div>

                    <ReferralCodeField
                      value={formData.referral_code}
                      onChange={(referral_code) =>
                        setFormData((prev) => ({ ...prev, referral_code }))
                      }
                      labelClassName={REG_LABEL_CLASS}
                      labelStyle={brandOliveLabelStyle}
                    />
                  </div>

                  {msg ? (
                    <div
                      className={`mt-4 whitespace-pre-wrap rounded-xl border px-3 py-2 text-xs font-black ${
                        msg.type === 'ok'
                          ? 'border-[#1C2E3A]/20 bg-[#F4EFE6] text-[#1C2E3A]'
                          : 'border-red-200 bg-red-50 text-red-800'
                      }`}
                    >
                      {msg.text}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    style={brandGoldButtonStyle}
                    className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-extrabold shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    <span>{g.modal.submit}</span>
                    <span aria-hidden>➔</span>
                  </button>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
