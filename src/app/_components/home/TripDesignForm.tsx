'use client';

import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';
import { Loader2, Send } from 'lucide-react';

import { submitCustomerLead, type CustomerLeadState } from '@/app/actions/submitCustomerLead';
import { TRIP_DESTINATIONS, getTripCountryById } from '@/lib/trip-destination-data';
import { ar } from '@/messages/ar';

const t = ar.tripForm;

function PillCheckbox({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3 transition hover:border-[#c9a84c]/35 has-[:checked]:border-[#c9a84c]/60 has-[:checked]:bg-[#c9a84c]/12">
      <input
        type="checkbox"
        name={name}
        value={value}
        className="h-4 w-4 shrink-0 rounded border-white/30 bg-[#050f0c] text-[#c9a84c] accent-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/50"
      />
      <span className="text-sm font-bold text-white/88">{label}</span>
    </label>
  );
}

function RadioRow({
  name,
  options,
}: {
  name: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-2.5 transition hover:border-[#c9a84c]/35 has-[:checked]:border-[#c9a84c] has-[:checked]:bg-[#c9a84c]/15"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            className="h-4 w-4 shrink-0 border-white/30 bg-[#050f0c] accent-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/50"
          />
          <span className="text-sm font-bold text-white/85">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function SectionCard({
  n,
  title,
  subtitle,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-[2rem] border border-[#c9a84c]/18 bg-[#071612]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,.25)] backdrop-blur-md sm:p-8">
      <legend className="sr-only">{title}</legend>
      <div className="mb-6 flex flex-wrap items-baseline gap-3 border-b border-white/10 pb-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#c9a84c] to-[#8a6b2a] text-sm font-black text-[#1c4532]">
          {n}
        </span>
        <div>
          <h3 className="text-lg font-black text-[#e8d5a8] sm:text-xl">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs font-bold text-white/45">{subtitle}</p> : null}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

function toggleListItem(list: string[], value: string, on: boolean): string[] {
  if (on) return list.includes(value) ? list : [...list, value];
  return list.filter((x) => x !== value);
}

export function TripDesignForm() {
  const [state, setState] = useState<CustomerLeadState | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  function setCountry(id: string, on: boolean) {
    setSelectedCountries((prev) => toggleListItem(prev, id, on));
    if (!on) {
      setSelectedCities((prev) => prev.filter((k) => !k.startsWith(`${id}:`)));
    }
  }

  function setCity(composite: string, on: boolean) {
    setSelectedCities((prev) => toggleListItem(prev, composite, on));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setState(null);
    startTransition(async () => {
      const res = await submitCustomerLead(fd);
      setState(res);
      if (res.ok) {
        form.reset();
        setSelectedCountries([]);
        setSelectedCities([]);
      }
    });
  }

  const showCityPicker = selectedCountries.length > 0;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-8" dir="rtl">
      {selectedCountries.map((id) => (
        <input key={id} type="hidden" name="dest_countries" value={id} />
      ))}
      {selectedCities.map((k) => (
        <input key={k} type="hidden" name="cities" value={k} />
      ))}
      <SectionCard n={1} title={t.section1Title} subtitle={t.section1Subtitle}>
        <div>
          <label className="mb-2 block text-xs font-black tracking-wide text-[#c9a84c]/90">{t.fullName}</label>
          <input
            name="full_name"
            required
            autoComplete="name"
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-5 py-3.5 text-sm font-bold text-white outline-none ring-[#c9a84c] placeholder:text-white/30 focus:ring-2"
            placeholder={t.fullNamePlaceholder}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-black text-[#c9a84c]/90">{t.phoneWa}</label>
          <input
            name="phone_wa"
            required
            type="tel"
            autoComplete="tel"
            dir="ltr"
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-5 py-3.5 text-sm font-bold text-white outline-none ring-[#c9a84c] placeholder:text-white/30 focus:ring-2"
            placeholder={t.phonePlaceholder}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-black text-[#c9a84c]/90">{t.sourceLabel}</label>
          <select
            name="source"
            className="w-full rounded-2xl border border-white/10 bg-[#050f0c] px-5 py-3.5 text-sm font-bold text-white outline-none ring-[#c9a84c] focus:ring-2"
            defaultValue=""
          >
            <option value="" disabled>
              {t.sourcePlaceholder}
            </option>
            <option value="instagram">{t.sourceInstagram}</option>
            <option value="tiktok">{t.sourceTiktok}</option>
            <option value="snap">{t.sourceSnap}</option>
            <option value="friend">{t.sourceFriend}</option>
            <option value="google">{t.sourceGoogle}</option>
            <option value="event">{t.sourceEvent}</option>
            <option value="other">{t.sourceOther}</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard n={2} title={t.section2Title} subtitle={t.section2Subtitle}>
        <div>
          <p className="mb-3 text-xs font-black text-white/50">{t.countriesLabel}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TRIP_DESTINATIONS.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-3 py-3 transition hover:border-[#c9a84c]/35 has-[:checked]:border-[#c9a84c]/60 has-[:checked]:bg-[#c9a84c]/12"
              >
                <input
                  type="checkbox"
                  checked={selectedCountries.includes(c.id)}
                  onChange={(e) => setCountry(c.id, e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-white/30 bg-[#050f0c] accent-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/50"
                />
                <span className="text-sm font-bold text-white/88">{c.labelAr}</span>
              </label>
            ))}
          </div>
        </div>

        {showCityPicker ? (
          <div className="space-y-8 border-t border-white/10 pt-8">
            <p className="text-xs font-black text-[#e8d5a8]">{t.citiesHeading}</p>
            {selectedCountries.map((cid) => {
              const country = getTripCountryById(cid);
              if (!country) return null;
              return (
                <div key={cid} className="rounded-2xl border border-white/8 bg-black/20 p-5">
                  <p className="mb-4 text-sm font-black text-[#d4b87a]">{country.labelAr}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {country.cities.map((city) => {
                      const composite = `${cid}:${city.id}`;
                      return (
                        <label
                          key={composite}
                          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition hover:border-[#c9a84c]/35 has-[:checked]:border-[#c9a84c]/55 has-[:checked]:bg-[#c9a84c]/10"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCities.includes(composite)}
                            onChange={(e) => setCity(composite, e.target.checked)}
                            className="h-4 w-4 shrink-0 rounded border-white/30 bg-[#050f0c] accent-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/50"
                          />
                          <span className="text-sm font-bold text-white/85">{city.labelAr}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-black text-[#c9a84c]/90">{t.travelDate}</label>
            <input
              name="travel_start_date"
              type="date"
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none ring-[#c9a84c] focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-black text-[#c9a84c]/90">{t.travelDays}</label>
            <input
              name="travel_days"
              type="number"
              min={3}
              max={30}
              defaultValue={10}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none ring-[#c9a84c] focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-black text-[#c9a84c]/90">{t.travelersCount}</label>
            <input
              name="travelers_count"
              type="number"
              min={1}
              max={20}
              defaultValue={2}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none ring-[#c9a84c] focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-black text-[#c9a84c]/90">{t.budget}</label>
            <select
              name="budget_range"
              className="w-full rounded-2xl border border-white/10 bg-[#050f0c] px-4 py-3 text-sm font-bold text-white outline-none ring-[#c9a84c] focus:ring-2"
              defaultValue=""
            >
              <option value="">{t.budgetUndecided}</option>
              <option value="economical">{t.budgetEconomical}</option>
              <option value="moderate">{t.budgetModerate}</option>
              <option value="comfortable">{t.budgetComfortable}</option>
              <option value="premium">{t.budgetPremium}</option>
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard n={3} title={t.section3Title} subtitle={t.section3Subtitle}>
        <div className="grid gap-2 sm:grid-cols-2">
          <PillCheckbox name="interests" value="anime" label={t.interestAnime} />
          <PillCheckbox name="interests" value="history" label={t.interestHistory} />
          <PillCheckbox name="interests" value="nature" label={t.interestNature} />
          <PillCheckbox name="interests" value="kpop" label={t.interestKpop} />
          <PillCheckbox name="interests" value="shopping" label={t.interestShopping} />
          <PillCheckbox name="interests" value="seasonal_festivals" label={t.interestSeasonal} />
          <PillCheckbox name="interests" value="adventure_local" label={t.interestAdventure} />
          <PillCheckbox name="interests" value="workshops_crafts" label={t.interestWorkshops} />
          <PillCheckbox name="interests" value="spa_wellness" label={t.interestSpa} />
          <PillCheckbox name="interests" value="photo_tours" label={t.interestPhoto} />
        </div>
        {selectedCountries.length > 0 ? (
          <div className="space-y-6 border-t border-white/10 pt-8">
            <p className="text-xs font-black text-[#e8d5a8]">{t.visitSectionTitle}</p>
            <div className="grid gap-6 sm:grid-cols-2">
              {selectedCountries.map((cid) => {
                const country = getTripCountryById(cid);
                if (!country) return null;
                return (
                  <div key={cid}>
                    <p className="mb-2 text-xs font-black text-white/50">
                      {(t.visitBeforeCountry ?? 'هل سبق لك السفر إلى {country} من قبل؟').replace(
                        '{country}',
                        country.labelAr
                      )}
                    </p>
                    <RadioRow
                      name={`visited_before_${cid}`}
                      options={[
                        { value: 'yes', label: t.yes },
                        { value: 'no', label: t.no },
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard n={4} title={t.section4Title} subtitle={t.section4Subtitle}>
        <div>
          <p className="mb-2 text-xs font-black text-white/50">{t.paceLabel}</p>
          <RadioRow
            name="pace"
            options={[
              { value: 'calm', label: t.paceCalm },
              { value: 'medium', label: t.paceMedium },
              { value: 'active', label: t.paceActive },
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-black text-white/50">{t.walkingLabel}</p>
          <RadioRow
            name="walking"
            options={[
              { value: 'low', label: t.walkLow },
              { value: 'medium', label: t.walkMed },
              { value: 'high', label: t.walkHigh },
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-black text-white/50">{t.dayStartLabel}</p>
          <RadioRow
            name="day_start"
            options={[
              { value: 'early', label: t.startEarly },
              { value: 'mid', label: t.startMid },
              { value: 'late', label: t.startLate },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard n={5} title={t.section5Title} subtitle={t.section5Subtitle}>
        <div>
          <p className="mb-3 text-xs font-black text-white/50">{t.foodLabel}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <PillCheckbox name="food_prefs" value="halal" label={t.foodHalal} />
            <PillCheckbox name="food_prefs" value="seafood" label={t.foodSeafood} />
            <PillCheckbox name="food_prefs" value="vegetarian" label={t.foodVegetarian} />
            <PillCheckbox name="food_prefs" value="flex" label={t.foodFlex} />
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-black text-white/50">{t.lodgingLabel}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <PillCheckbox name="lodging_prefs" value="boutique" label={t.lodgingBoutique} />
            <PillCheckbox name="lodging_prefs" value="star4" label={t.lodging4} />
            <PillCheckbox name="lodging_prefs" value="star5" label={t.lodging5} />
            <PillCheckbox name="lodging_prefs" value="ryokan" label={t.lodgingRyokan} />
          </div>
        </div>
      </SectionCard>

      <SectionCard n={6} title={t.section6Title} subtitle={t.section6Subtitle}>
        <div>
          <label className="mb-2 block text-xs font-black text-[#c9a84c]/90">{t.dreamLabel}</label>
          <textarea
            name="dream_feeling"
            required
            rows={6}
            className="w-full resize-y rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-sm font-bold leading-relaxed text-white outline-none ring-[#c9a84c] placeholder:text-white/30 focus:ring-2"
            placeholder={t.dreamPlaceholder}
          />
        </div>
      </SectionCard>

      {state?.error ? (
        <div className="rounded-2xl border border-red-400/35 bg-red-950/45 px-5 py-4 text-sm font-bold text-red-100">
          {state.error}
        </div>
      ) : null}

      {state?.ok && state.message ? (
        <div className="rounded-2xl border border-emerald-400/35 bg-emerald-950/40 px-5 py-4 text-sm font-bold text-emerald-50">
          {state.message}
        </div>
      ) : null}

      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-w-[240px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-[#8a6b2a] to-[#d4b87a] px-10 py-4 text-sm font-black text-[#0a1814] shadow-[0_16px_48px_rgba(0,0,0,.35)] transition hover:opacity-95 disabled:opacity-55"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {t.submit}
        </button>
      </div>
    </form>
  );
}
