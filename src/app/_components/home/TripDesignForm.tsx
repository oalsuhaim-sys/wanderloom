'use client';

import type { ReactNode, Ref } from 'react';
import { Suspense, useEffect, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';

import { submitCustomerLead, type CustomerLeadState } from '@/app/actions/submitCustomerLead';
import { useLanguage } from '@/context/LanguageContext';
import { ReferralCodeField } from '@/components/ReferralCodeField';
import { WhatsAppInput } from '@/components/WhatsAppInput';
import { useTripDestinations } from '@/hooks/useCountries';
import {
  normalizeAffiliateRef,
  persistAffiliateRef,
  readPersistedAffiliateRef,
} from '@/lib/referral-url';
import { requireValidPhone, WHATSAPP_INCOMPLETE_ERROR } from '@/lib/phoneUtils';
import { getTripCountryById } from '@/lib/trip-destination-data';

const INPUT_CLASS =
  'h-10 w-full rounded-lg border border-gray-200/90 bg-white/50 px-3 text-sm font-bold text-[#1C2E3A] outline-none transition placeholder:text-gray-400 focus:border-public-gold/70 focus:ring-2 focus:ring-public-gold/25';

const DATE_INPUT_CLASS = `${INPUT_CLASS} [color-scheme:light] cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100`;

const TEXTAREA_CLASS =
  'w-full resize-y rounded-lg border border-gray-200/90 bg-white/50 px-3 py-2.5 text-sm font-bold leading-relaxed text-[#1C2E3A] outline-none transition placeholder:text-gray-400 focus:border-public-gold/70 focus:ring-2 focus:ring-public-gold/25';

const FIELD_LABEL = 'mb-1.5 block text-right text-xs font-black tracking-wide text-public-gold';

const PILL_ROW = 'flex flex-wrap gap-3 justify-start dir-rtl';

const QUESTION_BLOCK = 'flex flex-col space-y-3';

const PILL_BASE =
  'inline-flex cursor-pointer select-none items-center justify-center rounded-full px-4 py-1.5 text-sm font-bold transition-all duration-200';

const PILL_OFF =
  'border border-gray-300/90 bg-transparent text-[#1C2E3A] hover:border-public-gold/45 hover:bg-[#f4f0e6]/40';

const PILL_ON = 'border border-public-gold bg-[#1C2E3A] text-[#F4EFE6] shadow-sm';

const TRIP_DESIGN_DRAFT_KEY = 'wanderloom.tripDesign.draft.v1';

type TripDesignDraft = {
  full_name: string;
  phone_wa: string;
  birth_date: string;
  source: string;
  referral_code: string;
  selectedCountries: string[];
  selectedCities: string[];
  isOtherCountry: boolean;
  customCountry: string;
  customCities: Record<string, string>;
  activeCustomCityFor: string | null;
  interestOther: boolean;
  interestOtherText: string;
  foodOther: boolean;
  foodOtherText: string;
  lodgingOther: boolean;
  lodgingOtherText: string;
  interests: string[];
  food_prefs: string[];
  lodging_prefs: string[];
  travel_start_date: string;
  travel_days: string;
  travelers_count: string;
  budget_range: string;
  pace: string;
  walking: string;
  day_start: string;
  dream_feeling: string;
  visited: Record<string, string>;
};

function readTripDesignDraft(): TripDesignDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TRIP_DESIGN_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TripDesignDraft>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as TripDesignDraft;
  } catch {
    return null;
  }
}

function clearTripDesignDraft() {
  try {
    window.localStorage.removeItem(TRIP_DESIGN_DRAFT_KEY);
  } catch {
    /* private mode */
  }
}

function applyDraftToForm(form: HTMLFormElement, draft: TripDesignDraft) {
  const setValue = (name: string, value: string) => {
    const el = form.elements.namedItem(name);
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      el.value = value;
    }
  };

  setValue('source', draft.source ?? '');
  setValue('travel_start_date', draft.travel_start_date ?? '');
  setValue('travel_days', draft.travel_days || '10');
  setValue('travelers_count', draft.travelers_count || '2');
  setValue('budget_range', draft.budget_range ?? '');
  setValue('dream_feeling', draft.dream_feeling ?? '');

  const check = (name: string, selected: string[]) => {
    form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((el) => {
      el.checked = selected.includes(el.value);
    });
  };
  check('interests', draft.interests ?? []);
  check('food_prefs', draft.food_prefs ?? []);
  check('lodging_prefs', draft.lodging_prefs ?? []);

  for (const [name, value] of Object.entries(draft.visited ?? {})) {
    const el = form.querySelector<HTMLInputElement>(
      `input[name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`,
    );
    if (el) el.checked = true;
  }

  if (draft.pace) {
    const pace = form.querySelector<HTMLInputElement>(
      `input[name="pace"][value="${CSS.escape(draft.pace)}"]`,
    );
    if (pace) pace.checked = true;
  }
  if (draft.walking) {
    const walking = form.querySelector<HTMLInputElement>(
      `input[name="walking"][value="${CSS.escape(draft.walking)}"]`,
    );
    if (walking) walking.checked = true;
  }
  if (draft.day_start) {
    const dayStart = form.querySelector<HTMLInputElement>(
      `input[name="day_start"][value="${CSS.escape(draft.day_start)}"]`,
    );
    if (dayStart) dayStart.checked = true;
  }
}

function SectionCard({
  n,
  title,
  subtitle,
  children,
  anchorRef,
  id,
}: {
  n: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  anchorRef?: Ref<HTMLFieldSetElement>;
  id?: string;
}) {
  return (
    <fieldset
      ref={anchorRef}
      id={id}
      className="scroll-mt-28 rounded-2xl border border-gray-100/90 bg-white p-4 shadow-sm sm:p-6"
    >
      <legend className="sr-only">{title}</legend>
      <div className="mb-5 flex items-start gap-3 border-b border-gray-100 pb-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#1C2E3A]/30 bg-[#f4f0e6]/50 text-xs font-black text-[#1C2E3A]">
          {n}
        </span>
        <div className="min-w-0 flex-1 text-right">
          <h3 className="text-base font-black text-[#1C2E3A] sm:text-lg">{title}</h3>
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
        className={`${PILL_BASE} ${PILL_OFF} peer-checked:border-public-gold peer-checked:bg-[#1C2E3A] peer-checked:text-[#F4EFE6] peer-checked:shadow-sm`}
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
        className={`${PILL_BASE} ${PILL_OFF} peer-checked:border-public-gold peer-checked:bg-[#1C2E3A] peer-checked:text-[#F4EFE6] peer-checked:shadow-sm`}
      >
        {label}
      </span>
    </label>
  );
}

function PillGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={QUESTION_BLOCK}>
      <p className="text-right text-xs font-black text-[#1C2E3A]">{label}</p>
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
      <p className="text-right text-xs font-black text-[#1C2E3A]">{label}</p>
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
          <Loader2 className="h-8 w-8 animate-spin text-public-gold" aria-hidden />
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
  const [formData, setFormData] = useState({ birth_date: '' });
  const [fullName, setFullName] = useState('');
  const [fullPhone, setFullPhone] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftTick, setDraftTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const section2Ref = useRef<HTMLFieldSetElement>(null);
  const contactWasReadyRef = useRef(false);
  const suppressDraftRef = useRef(false);
  const pendingDomDraftRef = useRef<TripDesignDraft | null>(null);
  const hydratedOnceRef = useRef(false);
  const restoredBirthRef = useRef<string | null>(null);

  useEffect(() => {
    const fromUrl = normalizeAffiliateRef(
      searchParams.get('ref') || searchParams.get('referral') || searchParams.get('code'),
    );
    if (fromUrl) {
      const upper = fromUrl.toUpperCase();
      persistAffiliateRef(upper);
      setReferralCode(upper);
      return;
    }
    const stored = readPersistedAffiliateRef();
    if (stored) setReferralCode(stored.toUpperCase());
  }, [searchParams]);

  useEffect(() => {
    if (hydratedOnceRef.current) return;
    hydratedOnceRef.current = true;
    const draft = readTripDesignDraft();
    if (draft) {
      const phone = String(draft.phone_wa ?? '');
      const birth = String(draft.birth_date ?? '').slice(0, 10);
      const name = String(draft.full_name ?? '');
      restoredBirthRef.current = /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null;
      setFullName(name);
      setFullPhone(phone);
      setIsPhoneValid(requireValidPhone(phone).isValid);
      setFormData({ birth_date: birth });
      if (!searchParams.get('ref') && !searchParams.get('referral') && !searchParams.get('code')) {
        const savedRef = normalizeAffiliateRef(draft.referral_code);
        if (savedRef) setReferralCode(savedRef.toUpperCase());
      }
      setSelectedCountries(Array.isArray(draft.selectedCountries) ? draft.selectedCountries : []);
      setSelectedCities(Array.isArray(draft.selectedCities) ? draft.selectedCities : []);
      setIsOtherCountry(Boolean(draft.isOtherCountry));
      setCustomCountry(String(draft.customCountry ?? ''));
      setCustomCities(draft.customCities && typeof draft.customCities === 'object' ? draft.customCities : {});
      setActiveCustomCityFor(draft.activeCustomCityFor ?? null);
      setInterestOther(Boolean(draft.interestOther));
      setInterestOtherText(String(draft.interestOtherText ?? ''));
      setFoodOther(Boolean(draft.foodOther));
      setFoodOtherText(String(draft.foodOtherText ?? ''));
      setLodgingOther(Boolean(draft.lodgingOther));
      setLodgingOtherText(String(draft.lodgingOtherText ?? ''));
      const nameOk = name.trim().length > 0;
      const birthOk = /^\d{4}-\d{2}-\d{2}$/.test(birth);
      if (nameOk && requireValidPhone(phone).isValid && birthOk) {
        contactWasReadyRef.current = true;
      }
      pendingDomDraftRef.current = draft;
    }
    setDraftHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    if (!draftHydrated || !pendingDomDraftRef.current || !formRef.current) return;
    applyDraftToForm(formRef.current, pendingDomDraftRef.current);
    pendingDomDraftRef.current = null;
  }, [draftHydrated, selectedCountries, isOtherCountry]);

  useEffect(() => {
    if (!draftHydrated) return;
    if (suppressDraftRef.current) {
      suppressDraftRef.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const form = formRef.current;
      const fd = form ? new FormData(form) : null;
      const read = (name: string) => (fd ? String(fd.get(name) ?? '') : '');
      const readAll = (name: string) =>
        fd ? fd.getAll(name).filter((v): v is string => typeof v === 'string') : [];
      const visited: Record<string, string> = {};
      if (fd) {
        for (const [key, value] of fd.entries()) {
          if (key.startsWith('visited_before_') && typeof value === 'string') visited[key] = value;
        }
      }
      const birthDate =
        formData.birth_date ||
        (document.activeElement instanceof HTMLInputElement &&
        document.activeElement.name === 'birth_date'
          ? ''
          : restoredBirthRef.current || '');
      const payload: TripDesignDraft = {
        full_name: fullName,
        phone_wa: fullPhone,
        birth_date: birthDate,
        source: read('source'),
        referral_code: referralCode,
        selectedCountries,
        selectedCities,
        isOtherCountry,
        customCountry,
        customCities,
        activeCustomCityFor,
        interestOther,
        interestOtherText,
        foodOther,
        foodOtherText,
        lodgingOther,
        lodgingOtherText,
        interests: readAll('interests'),
        food_prefs: readAll('food_prefs'),
        lodging_prefs: readAll('lodging_prefs'),
        travel_start_date: read('travel_start_date'),
        travel_days: read('travel_days'),
        travelers_count: read('travelers_count'),
        budget_range: read('budget_range'),
        pace: read('pace'),
        walking: read('walking'),
        day_start: read('day_start'),
        dream_feeling: read('dream_feeling'),
        visited,
      };
      try {
        window.localStorage.setItem(TRIP_DESIGN_DRAFT_KEY, JSON.stringify(payload));
      } catch {
        /* quota / private mode */
      }
    }, 180);
    return () => window.clearTimeout(handle);
  }, [
    draftHydrated,
    draftTick,
    fullName,
    fullPhone,
    formData.birth_date,
    referralCode,
    selectedCountries,
    selectedCities,
    isOtherCountry,
    customCountry,
    customCities,
    activeCustomCityFor,
    interestOther,
    interestOtherText,
    foodOther,
    foodOtherText,
    lodgingOther,
    lodgingOtherText,
  ]);

  const contactReady =
    fullName.trim().length > 0 &&
    isPhoneValid &&
    /^\d{4}-\d{2}-\d{2}$/.test(formData.birth_date);

  useEffect(() => {
    if (!draftHydrated) return;
    if (contactReady && !contactWasReadyRef.current) {
      section2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    contactWasReadyRef.current = contactReady;
  }, [draftHydrated, contactReady]);

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

    const form = e.currentTarget;
    const fd = new FormData(form);
    const phoneCheck = requireValidPhone(fullPhone || String(fd.get('phone_wa') ?? ''));
    if (!isPhoneValid || !phoneCheck.isValid) {
      setState({ ok: false, error: phoneCheck.error ?? WHATSAPP_INCOMPLETE_ERROR });
      return;
    }
    fd.set('phone_wa', phoneCheck.formattedPhone);

    submitLockRef.current = true;
    setIsSubmitting(true);

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
    const ref = (
      normalizeAffiliateRef(referralCode) ||
      normalizeAffiliateRef(fd.get('ref_code') as string) ||
      normalizeAffiliateRef(fd.get('referral_code') as string)
    )?.toUpperCase();
    if (ref) {
      fd.set('ref_code', ref);
      fd.set('referral_code', ref);
      persistAffiliateRef(ref);
    }
    setState(null);
    startTransition(() => {
      void (async () => {
        try {
          const res = await submitCustomerLead(fd);
          setState(res);
          if (res.ok) {
            suppressDraftRef.current = true;
            clearTripDesignDraft();
            form.reset();
            setFullName('');
            setFullPhone('');
            setIsPhoneValid(false);
            setFormData({ birth_date: '' });
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
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onInput={() => setDraftTick((n) => n + 1)}
      onChange={() => setDraftTick((n) => n + 1)}
      className="mx-auto max-w-3xl space-y-6 bg-[#F4EFE6]"
      dir={dir}
    >
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
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <WhatsAppInput
          name="phone_wa"
          value={fullPhone}
          onChange={(phone, isValid) => {
            setFullPhone(phone);
            setIsPhoneValid(isValid);
          }}
          required
        />
        <div>
          <label className={FIELD_LABEL}>{f.birthDateLabel}</label>
          <input
            name="birth_date"
            required
            type="date"
            className={`${INPUT_CLASS} cursor-pointer`}
            value={formData.birth_date}
            onFocus={() => {
              restoredBirthRef.current = null;
            }}
            onChange={(e) => {
              const next = e.target.value;
              const restored = restoredBirthRef.current;
              if (!next && restored && document.activeElement !== e.currentTarget) {
                setFormData({ birth_date: restored });
                return;
              }
              restoredBirthRef.current = null;
              setFormData((prev) => ({ ...prev, birth_date: next }));
            }}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                /* native date input still works */
              }
            }}
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

      <SectionCard
        n={2}
        title={f.section2Title}
        subtitle={f.section2Subtitle}
        anchorRef={section2Ref}
        id="trip-design-destination"
      >
        <div className={QUESTION_BLOCK}>
          <p className="text-right text-xs font-black text-[#1C2E3A]">{f.countriesLabel}</p>
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
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-[#1C2E3A] outline-none transition-all placeholder:text-gray-400 focus:border-[#1C2E3A] focus:ring-1 focus:ring-[#1C2E3A] md:w-1/2"
              />
            </div>
          ) : null}
        </div>

        {showCityPicker ? (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <p className="text-right text-xs font-black text-[#1C2E3A]">{f.citiesHeading}</p>
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
                      className="mt-2 inline-block w-full max-w-md rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-[#1C2E3A] outline-none transition placeholder:text-gray-400 focus:border-[#1C2E3A] focus:ring-1 focus:ring-[#1C2E3A]"
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
            <p className="text-right text-xs font-black text-[#1C2E3A]">{f.visitSectionTitle}</p>
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
        <div className="space-y-3 rounded-lg border border-[#1C2E3A]/20 bg-[#F4EFE6] px-4 py-3 text-sm font-bold text-[#1C2E3A]">
          <p>{state.message}</p>
          {state.dnaUrl ? (
            <p className="text-xs font-bold leading-relaxed">
              رابط ملف DNA الخاص بك جاهز:
              <a
                href={state.dnaUrl}
                className="mt-1 block break-all font-mono text-[#1C2E3A] underline decoration-public-gold underline-offset-4"
              >
                {state.dnaUrl}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-center pb-2 pt-1">
        <button
          type="submit"
          disabled={pending || isSubmitting || !isPhoneValid}
          className={`inline-flex h-11 min-w-[220px] items-center justify-center gap-2 rounded-full bg-[#1C2E3A] px-8 text-sm font-black text-[#F4EFE6] shadow-sm transition-all hover:bg-[#122029] disabled:cursor-not-allowed disabled:opacity-50 ${
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
