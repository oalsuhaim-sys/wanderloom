'use client';

import type { ReactNode } from 'react';
import { Suspense, useEffect, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';

import { submitCustomerLead, type CustomerLeadState } from '@/app/actions/submitCustomerLead';
import { useLanguage } from '@/context/LanguageContext';
import { ReferralCodeField } from '@/components/ReferralCodeField';
import { useTripDestinations } from '@/hooks/useCountries';
import {
  normalizeAffiliateRef,
  persistAffiliateRef,
  readPersistedAffiliateRef,
} from '@/lib/referral-url';
import { getTripCountryById } from '@/lib/trip-destination-data';

const INPUT_CLASS =
  'h-10 w-full rounded-lg border border-gray-200/90 bg-white/50 px-3 text-sm font-bold text-[#111111] outline-none transition placeholder:text-gray-400 focus:border-[#cda04c]/70 focus:ring-2 focus:ring-[#cda04c]/25';

const DATE_INPUT_CLASS = `${INPUT_CLASS} [color-scheme:light] cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100`;

const TEXTAREA_CLASS =
  'w-full resize-y rounded-lg border border-gray-200/90 bg-white/50 px-3 py-2.5 text-sm font-bold leading-relaxed text-[#111111] outline-none transition placeholder:text-gray-400 focus:border-[#cda04c]/70 focus:ring-2 focus:ring-[#cda04c]/25';

const FIELD_LABEL = 'mb-1.5 block text-right text-xs font-black tracking-wide text-[#cda04c]';

const PILL_ROW = 'flex flex-wrap gap-3 justify-start dir-rtl';

const QUESTION_BLOCK = 'flex flex-col space-y-3';

const PILL_BASE =
  'inline-flex cursor-pointer select-none items-center justify-center rounded-full px-4 py-1.5 text-sm font-bold transition-all duration-200';

const PILL_OFF =
  'border border-gray-300/90 bg-transparent text-[#111111] hover:border-[#cda04c]/45 hover:bg-[#f4f0e6]/40';

const PILL_ON = 'border border-transparent bg-[#1e3f20] text-white shadow-sm';

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
    <fieldset className="rounded-2xl border border-gray-100/90 bg-white p-4 shadow-sm sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="mb-5 flex items-start gap-3 border-b border-gray-100 pb-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#1e3f20]/30 bg-[#f4f0e6]/50 text-xs font-black text-[#1e3f20]">
          {n}
        </span>
        <div className="min-w-0 flex-1 text-right">
          <h3 className="text-base font-black text-[#111111] sm:text-lg">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-xs font-bold leading-relaxed text-gray-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

function DestinationTag({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${PILL_BASE} ${selected ? PILL_ON : PILL_OFF}`}
    >
      {label}
    </button>
  );
}

function CheckboxPill({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  if (onChange !== undefined && checked !== undefined) {
    return (
      <label className={`${PILL_BASE} ${checked ? PILL_ON : PILL_OFF}`}>
        <input
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        {label}
      </label>
    );
  }

  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value} className="peer sr-only" />
      <span
        className={`${PILL_BASE} ${PILL_OFF} peer-checked:border-transparent peer-checked:bg-[#1e3f20] peer-checked:text-white peer-checked:shadow-sm`}
      >
        {label}
      </span>
    </label>
  );
}

function RadioPill({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        className={`${PILL_BASE} ${PILL_OFF} peer-checked:border-transparent peer-checked:bg-[#1e3f20] peer-checked:text-white peer-checked:shadow-sm`}
      >
        {label}
      </span>
    </label>
  );
}

function PillGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={QUESTION_BLOCK}>
      <p className="text-right text-xs font-black text-[#111111]">{label}</p>
      <div className={PILL_ROW}>{children}</div>
    </div>
  );
}

function PreferenceWithOther({
  label,
  otherLabel,
  otherFieldName,
  otherSelected,
  onOtherSelected,
  otherText,
  onOtherTextChange,
  otherPlaceholder,
  children,
}: {
  label: string;
  otherLabel: string;
  otherFieldName: string;
  otherSelected: boolean;
  onOtherSelected: (on: boolean) => void;
  otherText: string;
  onOtherTextChange: (value: string) => void;
  otherPlaceholder: string;
  children: ReactNode;
}) {
  return (
    <div className={QUESTION_BLOCK}>
      <p className="text-right text-xs font-black text-[#111111]">{label}</p>
      <div className={PILL_ROW}>
        {children}
        <label className={`${PILL_BASE} ${otherSelected ? PILL_ON : PILL_OFF}`}>
          <input
            type="checkbox"
            checked={otherSelected}
            onChange={(e) => onOtherSelected(e.target.checked)}
            className="sr-only"
          />
          {otherLabel}
        </label>
      </div>
      {otherSelected ? (
        <input
          type="text"
          name={otherFieldName}
          value={otherText}
          onChange={(e) => onOtherTextChange(e.target.value)}
          className={INPUT_CLASS}
          placeholder={otherPlaceholder}
        />
      ) : null}
    </div>
  );
}

function toggleListItem(list: string[], value: string, on: boolean): string[] {
  if (on) return list.includes(value) ? list : [...list, value];
  return list.filter((x) => x !== value);
}

export function TripDesignForm() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[200px] max-w-3xl items-center justify-center rounded-2xl border border-gray-100 bg-white p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#cda04c]" aria-hidden />
        </div>
      }
    >
      <TripDesignFormInner />
    </Suspense>
  );
}

function TripDesignFormInner() {
  const searchParams = useSearchParams();
  const { dir, t } = useLanguage();
  const f = t.form;
  const labels = t.tripLabels;
  const { tripDestinations } = useTripDestinations();

  const countryLabel = (id: string) =>
    labels.countries[id as keyof typeof labels.countries] ??
    tripDestinations.find((country) => country.id === id)?.labelAr ??
    getTripCountryById(id)?.labelAr ??
    id;

  const cityLabel = (countryId: string, cityId: string) =>
    labels.cities[countryId as keyof typeof labels.cities]?.[
      cityId as keyof (typeof labels.cities)[keyof typeof labels.cities]
    ] ??
    tripDestinations.find((country) => country.id === countryId)?.cities.find((c) => c.id === cityId)
      ?.labelAr ??
    getTripCountryById(countryId)?.cities.find((c) => c.id === cityId)?.labelAr ??
    cityId;

  const [state, setState] = useState<CustomerLeadState | null>(null);
  const [pending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [isOtherCountry, setIsOtherCountry] = useState(false);
  const [customCountry, setCustomCountry] = useState('');
  const [activeCustomCityFor, setActiveCustomCityFor] = useState<string | null>(null);
  const [customCities, setCustomCities] = useState<Record<string, string>>({});
  const [interestOther, setInterestOther] = useState(false);
  const [interestOtherText, setInterestOtherText] = useState('');
  const [foodOther, setFoodOther] = useState(false);
  const [foodOtherText, setFoodOtherText] = useState('');
  const [lodgingOther, setLodgingOther] = useState(false);
  const [lodgingOtherText, setLodgingOtherText] = useState('');
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    const fromUrl = normalizeAffiliateRef(searchParams.get('ref'));
    if (fromUrl) {
      persistAffiliateRef(fromUrl);
      setReferralCode(fromUrl);
      return;
    }
    const stored = readPersistedAffiliateRef();
    if (stored) setReferralCode(stored);
  }, [searchParams]);

  function setCountry(id: string, on: boolean) {
    setSelectedCountries((prev) => toggleListItem(prev, id, on));
    if (!on) {
      setSelectedCities((prev) => prev.filter((k) => !k.startsWith(`${id}:`)));
      setCustomCities((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setActiveCustomCityFor((cur) => (cur === id ? null : cur));
    }
  }

  function setCity(composite: string, on: boolean) {
    setSelectedCities((prev) => toggleListItem(prev, composite, on));
  }

  function toggleOtherCountry(on: boolean) {
    setIsOtherCountry(on);
    if (on) {
      // Other country has no catalog cities — open custom city input immediately
      setCity('other:other', true);
      setActiveCustomCityFor('other');
    } else {
      setCustomCountry('');
      setSelectedCities((prev) => prev.filter((k) => !k.startsWith('other:')));
      setCustomCities((prev) => {
        if (!('other' in prev)) return prev;
        const next = { ...prev };
        delete next.other;
        return next;
      });
      setActiveCustomCityFor((cur) => (cur === 'other' ? null : cur));
    }
  }

  function toggleOtherCity(countryId: string, on: boolean) {
    const composite = `${countryId}:other`;
    setCity(composite, on);
    if (on) {
      setActiveCustomCityFor(countryId);
    } else {
      setActiveCustomCityFor((cur) => (cur === countryId ? null : cur));
      setCustomCities((prev) => {
        if (!(countryId in prev)) return prev;
        const next = { ...prev };
        delete next[countryId];
        return next;
      });
    }
  }

  function displayCountryLabel(id: string): string {
    if (id === 'other') return customCountry.trim() || f.otherCountry;
    return countryLabel(id);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting || pending || submitLockRef.current) return;

    if (isOtherCountry && !customCountry.trim()) {
      setState({ ok: false, error: f.otherCountryRequired });
      return;
    }

    for (const composite of selectedCities) {
      if (!composite.endsWith(':other')) continue;
      const countryId = composite.slice(0, composite.lastIndexOf(':'));
      if (!String(customCities[countryId] ?? '').trim()) {
        setState({ ok: false, error: f.otherCityRequired });
        return;
      }
    }

    // Other country selected but no city yet — require a custom city
    if (isOtherCountry && !selectedCities.some((k) => k.startsWith('other:'))) {
      setState({ ok: false, error: f.otherCityRequired });
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    const form = e.currentTarget;
    const fd = new FormData(form);

    // Sanitize "Other" placeholders → typed values (server also re-sanitizes before insert)
    if (isOtherCountry) {
      const countryName = customCountry.trim();
      fd.append('dest_countries', 'other');
      fd.set('dest_countries_other', countryName);
    }

    // Drop any stale city_other_* then write only active custom cities
    for (const key of [...fd.keys()]) {
      if (key.startsWith('city_other_')) fd.delete(key);
    }
    for (const [countryId, cityName] of Object.entries(customCities)) {
      const trimmed = cityName.trim();
      if (!trimmed) continue;
      if (!selectedCities.includes(`${countryId}:other`)) continue;
      // Never send the literal label "أخرى" / "Other" as the city name
      if (trimmed === 'أخرى' || trimmed === 'Other' || trimmed.toLowerCase() === 'other') {
        setState({ ok: false, error: f.otherCityRequired });
        submitLockRef.current = false;
        setIsSubmitting(false);
        return;
      }
      fd.set(`city_other_${countryId}`, trimmed);
    }

    if (
      isOtherCountry &&
      (customCountry.trim() === 'أخرى' ||
        customCountry.trim() === 'Other' ||
        customCountry.trim().toLowerCase() === 'other')
    ) {
      setState({ ok: false, error: f.otherCountryRequired });
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }
    if (interestOther) {
      fd.append('interests', 'other');
      if (interestOtherText.trim()) fd.set('interests_other', interestOtherText.trim());
    }
    if (foodOther) {
      fd.append('food_prefs', 'other');
      if (foodOtherText.trim()) fd.set('food_prefs_other', foodOtherText.trim());
    }
    if (lodgingOther) {
      fd.append('lodging_prefs', 'other');
      if (lodgingOtherText.trim()) fd.set('lodging_prefs_other', lodgingOtherText.trim());
    }
    const ref = normalizeAffiliateRef(referralCode) || normalizeAffiliateRef(fd.get('referral_code') as string);
    if (ref) fd.set('referral_code', ref);
    setState(null);
    startTransition(() => {
      void (async () => {
        try {
          const res = await submitCustomerLead(fd);
          setState(res);
          if (res.ok) {
            form.reset();
            setSelectedCountries([]);
            setSelectedCities([]);
            setIsOtherCountry(false);
            setCustomCountry('');
            setActiveCustomCityFor(null);
            setCustomCities({});
            setInterestOther(false);
            setInterestOtherText('');
            setFoodOther(false);
            setFoodOtherText('');
            setLodgingOther(false);
            setLodgingOtherText('');
          }
        } catch (err) {
          console.error('Supabase Error:', err);
          const detail =
            err instanceof Error
              ? err.message
              : typeof err === 'string'
                ? err
                : 'Unknown client error';
          setState({ ok: false, error: `عذراً، تعذر الحفظ: ${detail}` });
        } finally {
          submitLockRef.current = false;
          setIsSubmitting(false);
        }
      })();
    });
  }

  const effectiveCountries = [
    ...selectedCountries,
    ...(isOtherCountry ? (['other'] as const) : []),
  ];
  const showCityPicker = effectiveCountries.length > 0;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6 bg-[#FDFBF7]" dir={dir}>
      {selectedCountries.map((id) => (
        <input key={id} type="hidden" name="dest_countries" value={id} />
      ))}
      {selectedCities.map((k) => (
        <input key={k} type="hidden" name="cities" value={k} />
      ))}

      <SectionCard n={1} title={f.section1Title} subtitle={f.section1Subtitle}>
        <div>
          <label className={FIELD_LABEL}>{f.fullName}</label>
          <input
            name="full_name"
            required
            autoComplete="name"
            className={INPUT_CLASS}
            placeholder={f.fullNamePlaceholder}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>{f.phoneWa}</label>
          <input
            name="phone_wa"
            required
            type="tel"
            autoComplete="tel"
            dir="ltr"
            className={INPUT_CLASS}
            placeholder={f.phonePlaceholder}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>{f.sourceLabel}</label>
          <select name="source" className={INPUT_CLASS} defaultValue="">
            <option value="" disabled>
              {f.sourcePlaceholder}
            </option>
            <option value="instagram">{f.sourceInstagram}</option>
            <option value="tiktok">{f.sourceTiktok}</option>
            <option value="snap">{f.sourceSnap}</option>
            <option value="friend">{f.sourceFriend}</option>
            <option value="google">{f.sourceGoogle}</option>
            <option value="event">{f.sourceEvent}</option>
            <option value="other">{f.sourceOther}</option>
          </select>
        </div>
        <ReferralCodeField
          value={referralCode}
          onChange={setReferralCode}
          autoPrefill={false}
          inputClassName={INPUT_CLASS}
        />
      </SectionCard>

      <SectionCard n={2} title={f.section2Title} subtitle={f.section2Subtitle}>
        <div className={QUESTION_BLOCK}>
          <p className="text-right text-xs font-black text-[#111111]">{f.countriesLabel}</p>
          <div className={PILL_ROW}>
            {tripDestinations.map((c) => {
              const isSelected = selectedCountries.includes(c.id);
              return (
                <DestinationTag
                  key={c.id}
                  label={countryLabel(c.id)}
                  selected={isSelected}
                  onToggle={() => setCountry(c.id, !isSelected)}
                />
              );
            })}
            <DestinationTag
              label={f.otherCountry}
              selected={isOtherCountry}
              onToggle={() => toggleOtherCountry(!isOtherCountry)}
            />
          </div>
          {isOtherCountry ? (
            <div className="mt-4">
              <input
                type="text"
                value={customCountry}
                onChange={(e) => setCustomCountry(e.target.value)}
                placeholder={f.otherCountryPlaceholder}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-[#111111] outline-none transition-all placeholder:text-gray-400 focus:border-[#1A3B2A] focus:ring-1 focus:ring-[#1A3B2A] md:w-1/2"
              />
            </div>
          ) : null}
        </div>

        {showCityPicker ? (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <p className="text-right text-xs font-black text-[#111111]">{f.citiesHeading}</p>
            {effectiveCountries.map((cid) => {
              const country = cid === 'other' ? null : tripDestinations.find((c) => c.id === cid) ?? getTripCountryById(cid);
              if (cid !== 'other' && !country) return null;
              const otherCityOn =
                selectedCities.includes(`${cid}:other`) || activeCustomCityFor === cid;
              return (
                <div key={cid} className={QUESTION_BLOCK}>
                  <p className="text-right text-[11px] font-black text-gray-500">
                    {displayCountryLabel(cid)}
                  </p>
                  <div className={PILL_ROW}>
                    {country?.cities.map((city) => {
                      const composite = `${cid}:${city.id}`;
                      const isSelected = selectedCities.includes(composite);
                      return (
                        <CheckboxPill
                          key={composite}
                          name="cities_ui"
                          value={composite}
                          label={cityLabel(cid, city.id)}
                          checked={isSelected}
                          onChange={(on) => setCity(composite, on)}
                        />
                      );
                    })}
                    <DestinationTag
                      label={f.otherCity}
                      selected={otherCityOn}
                      onToggle={() => toggleOtherCity(cid, !otherCityOn)}
                    />
                  </div>
                  {otherCityOn ? (
                    <input
                      type="text"
                      value={customCities[cid] || ''}
                      onChange={(e) =>
                        setCustomCities((prev) => ({ ...prev, [cid]: e.target.value }))
                      }
                      placeholder={f.otherCityPlaceholder.replace(
                        '{country}',
                        displayCountryLabel(cid),
                      )}
                      className="mt-2 inline-block w-full max-w-md rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-[#111111] outline-none transition placeholder:text-gray-400 focus:border-[#1A3B2A] focus:ring-1 focus:ring-[#1A3B2A]"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={FIELD_LABEL}>{f.travelDate}</label>
            <input name="travel_start_date" type="date" className={DATE_INPUT_CLASS} />
          </div>
          <div>
            <label className={FIELD_LABEL}>{f.travelDays}</label>
            <input
              name="travel_days"
              type="number"
              min={3}
              max={30}
              defaultValue={10}
              required
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>{f.travelersCount}</label>
            <input
              name="travelers_count"
              type="number"
              min={1}
              max={20}
              defaultValue={2}
              required
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>{f.budget}</label>
            <select name="budget_range" className={INPUT_CLASS} defaultValue="">
              <option value="">{f.budgetUndecided}</option>
              <option value="economical">{f.budgetEconomical}</option>
              <option value="moderate">{f.budgetModerate}</option>
              <option value="comfortable">{f.budgetComfortable}</option>
              <option value="premium">{f.budgetPremium}</option>
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard n={3} title={f.section3Title} subtitle={f.section3Subtitle}>
        <PreferenceWithOther
          label={f.section3Title}
          otherLabel={f.sourceOther}
          otherFieldName="interests_other"
          otherSelected={interestOther}
          onOtherSelected={setInterestOther}
          otherText={interestOtherText}
          onOtherTextChange={setInterestOtherText}
          otherPlaceholder="اكتب اهتمامك…"
        >
          <CheckboxPill name="interests" value="anime" label={f.interestAnime} />
          <CheckboxPill name="interests" value="history" label={f.interestHistory} />
          <CheckboxPill name="interests" value="nature" label={f.interestNature} />
          <CheckboxPill name="interests" value="kpop" label={f.interestKpop} />
          <CheckboxPill name="interests" value="shopping" label={f.interestShopping} />
          <CheckboxPill name="interests" value="seasonal_festivals" label={f.interestSeasonal} />
          <CheckboxPill name="interests" value="adventure_local" label={f.interestAdventure} />
          <CheckboxPill name="interests" value="workshops_crafts" label={f.interestWorkshops} />
          <CheckboxPill name="interests" value="spa_wellness" label={f.interestSpa} />
          <CheckboxPill name="interests" value="photo_tours" label={f.interestPhoto} />
        </PreferenceWithOther>

        {effectiveCountries.length > 0 ? (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <p className="text-right text-xs font-black text-[#111111]">{f.visitSectionTitle}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {effectiveCountries.map((cid) => {
                if (
                  cid !== 'other' &&
                  !tripDestinations.some((country) => country.id === cid) &&
                  !getTripCountryById(cid)
                ) {
                  return null;
                }
                return (
                  <div key={cid} className={QUESTION_BLOCK}>
                    <p className="text-right text-[11px] font-bold text-gray-600">
                      {f.visitBeforeCountry.replace("{country}", displayCountryLabel(cid))}
                    </p>
                    <div className={PILL_ROW}>
                      <RadioPill name={`visited_before_${cid}`} value="yes" label={f.yes} />
                      <RadioPill name={`visited_before_${cid}`} value="no" label={f.no} defaultChecked />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard n={4} title={f.section4Title} subtitle={f.section4Subtitle}>
        <PillGroup label={f.paceLabel}>
          <RadioPill name="pace" value="calm" label={f.paceCalm} />
          <RadioPill name="pace" value="medium" label={f.paceMedium} defaultChecked />
          <RadioPill name="pace" value="active" label={f.paceActive} />
        </PillGroup>
        <PillGroup label={f.walkingLabel}>
          <RadioPill name="walking" value="low" label={f.walkLow} />
          <RadioPill name="walking" value="medium" label={f.walkMed} defaultChecked />
          <RadioPill name="walking" value="high" label={f.walkHigh} />
        </PillGroup>
        <PillGroup label={f.dayStartLabel}>
          <RadioPill name="day_start" value="early" label={f.startEarly} />
          <RadioPill name="day_start" value="mid" label={f.startMid} defaultChecked />
          <RadioPill name="day_start" value="late" label={f.startLate} />
        </PillGroup>
      </SectionCard>

      <SectionCard n={5} title={f.section5Title} subtitle={f.section5Subtitle}>
        <PreferenceWithOther
          label={f.foodLabel}
          otherLabel={f.sourceOther}
          otherFieldName="food_prefs_other"
          otherSelected={foodOther}
          onOtherSelected={setFoodOther}
          otherText={foodOtherText}
          onOtherTextChange={setFoodOtherText}
          otherPlaceholder="اكتب تفضيلك الغذائي…"
        >
          <CheckboxPill name="food_prefs" value="halal" label={f.foodHalal} />
          <CheckboxPill name="food_prefs" value="seafood" label={f.foodSeafood} />
          <CheckboxPill name="food_prefs" value="vegetarian" label={f.foodVegetarian} />
          <CheckboxPill name="food_prefs" value="flex" label={f.foodFlex} />
        </PreferenceWithOther>
        <PreferenceWithOther
          label={f.lodgingLabel}
          otherLabel={f.sourceOther}
          otherFieldName="lodging_prefs_other"
          otherSelected={lodgingOther}
          onOtherSelected={setLodgingOther}
          otherText={lodgingOtherText}
          onOtherTextChange={setLodgingOtherText}
          otherPlaceholder="اكتب نوع الإقامة المفضل…"
        >
          <CheckboxPill name="lodging_prefs" value="boutique" label={f.lodgingBoutique} />
          <CheckboxPill name="lodging_prefs" value="star4" label={f.lodging4} />
          <CheckboxPill name="lodging_prefs" value="star5" label={f.lodging5} />
          <CheckboxPill name="lodging_prefs" value="ryokan" label={f.lodgingRyokan} />
        </PreferenceWithOther>
      </SectionCard>

      <SectionCard n={6} title={f.section6Title} subtitle={f.section6Subtitle}>
        <div>
          <label className={FIELD_LABEL}>{f.dreamLabel}</label>
          <textarea
            name="dream_feeling"
            required
            rows={5}
            className={TEXTAREA_CLASS}
            placeholder={f.dreamPlaceholder}
          />
        </div>
      </SectionCard>

      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {state.error}
        </div>
      ) : null}

      {state?.ok && state.message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
          {state.message}
        </div>
      ) : null}

      <div className="flex justify-center pb-2 pt-1">
        <button
          type="submit"
          disabled={pending || isSubmitting}
          className={`inline-flex h-11 min-w-[220px] items-center justify-center gap-2 rounded-full bg-[#cda04c] px-8 text-sm font-black text-white shadow-sm transition hover:bg-[#b3893d] disabled:cursor-not-allowed disabled:opacity-50 ${
            pending || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {pending || isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {f.submit}
        </button>
      </div>
    </form>
  );
}
