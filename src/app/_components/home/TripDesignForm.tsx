'use client';

import type { ReactNode } from 'react';
import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Loader2, Send, Sparkles } from 'lucide-react';

import { submitCustomerLead, type CustomerLeadState } from '@/app/actions/submitCustomerLead';
import { InstantDnaSuccess } from '@/app/_components/home/InstantDnaSuccess';
import { clearPendingDna, readPendingDna, type PendingDna } from '@/lib/instant-dna-status';
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
  'h-10 w-full rounded-lg border border-gray-200/90 bg-white/50 px-3 text-sm font-bold text-[#1C2E3A] outline-none transition placeholder:text-gray-400 focus:border-[#9C7A3C]/70 focus:ring-2 focus:ring-[#9C7A3C]/25';

const DATE_INPUT_CLASS = `${INPUT_CLASS} [color-scheme:light] cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100`;

const TEXTAREA_CLASS =
  'w-full resize-y rounded-lg border border-gray-200/90 bg-white/50 px-3 py-2.5 text-sm font-bold leading-relaxed text-[#1C2E3A] outline-none transition placeholder:text-gray-400 focus:border-[#9C7A3C]/70 focus:ring-2 focus:ring-[#9C7A3C]/25';

const FIELD_LABEL = 'mb-1.5 block text-right text-xs font-black tracking-wide text-[#9C7A3C]';

const PILL_ROW = 'flex flex-wrap gap-3 justify-start dir-rtl';

const QUESTION_BLOCK = 'flex flex-col space-y-3';

const PILL_BASE =
  'inline-flex cursor-pointer select-none items-center justify-center rounded-full px-4 py-1.5 text-sm font-bold transition-all duration-200';

const PILL_OFF =
  'border border-gray-300/90 bg-transparent text-[#1C2E3A] hover:border-[#9C7A3C]/45 hover:bg-[#f4f0e6]/40';

const PILL_ON = 'border border-[#9C7A3C] bg-[#1C2E3A] text-[#F4EFE6] shadow-sm';

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
        className={`${PILL_BASE} ${PILL_OFF} peer-checked:border-[#9C7A3C] peer-checked:bg-[#1C2E3A] peer-checked:text-[#F4EFE6] peer-checked:shadow-sm`}
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
        className={`${PILL_BASE} ${PILL_OFF} peer-checked:border-[#9C7A3C] peer-checked:bg-[#1C2E3A] peer-checked:text-[#F4EFE6] peer-checked:shadow-sm`}
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

/* ───────────────────────── Zero-Wait multi-step form ───────────────────────── */

const DRAFT_KEY = 'wl:trip-draft:v1';
const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const STEP_COUNT = 4;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** One tap → country + its signature city (satisfies the «at least one city» rule). */
const POPULAR_PICKS = [
  { country: 'japan', city: 'tokyo', flag: '🇯🇵' },
  { country: 'korea', city: 'seoul', flag: '🇰🇷' },
  { country: 'uk', city: 'london', flag: '🇬🇧' },
] as const;

/** Values held in React state — restored through state, never written back into the DOM. */
const STATE_FIELDS = new Set([
  'dest_countries',
  'cities',
  'cities_ui',
  'phone_wa',
  'birth_date',
  'interests_other',
  'food_prefs_other',
  'lodging_prefs_other',
  'ref_code',
  'referral_code',
]);

type DraftState = {
  selectedCountries: string[];
  selectedCities: string[];
  isOtherCountry: boolean;
  customCountry: string;
  customCities: Record<string, string>;
  interestOther: boolean;
  interestOtherText: string;
  foodOther: boolean;
  foodOtherText: string;
  lodgingOther: boolean;
  lodgingOtherText: string;
  birthDate: string;
  fullPhone: string;
};

type TripDraft = {
  v: 1;
  savedAt: number;
  step: number;
  fields: Array<[string, string]>;
  state: DraftState;
};

type SuccessState = {
  name: string;
  phone: string;
  dnaPath: string | null;
  autoWelcomeQueued: boolean;
};

function readDraft(): TripDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as TripDraft;
    if (draft?.v !== 1 || !draft.state || !Array.isArray(draft.fields)) return null;
    if (Date.now() - Number(draft.savedAt ?? 0) > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(draft: TripDraft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* private mode / quota — the form still works without a draft */
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** Writes saved uncontrolled values (text, selects, pills) back into the form. */
function applyDraftFields(form: HTMLFormElement, fields: Array<[string, string]>) {
  const byName = new Map<string, string[]>();
  for (const [k, v] of fields) {
    if (STATE_FIELDS.has(k)) continue;
    byName.set(k, [...(byName.get(k) ?? []), v]);
  }
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
    const name = el.name;
    if (!name || STATE_FIELDS.has(name) || !byName.has(name)) continue;
    const values = byName.get(name) ?? [];
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      el.checked = values.includes(el.value);
    } else if (!(el instanceof HTMLInputElement && el.type === 'hidden')) {
      el.value = values[0] ?? '';
    }
  }
}

export function TripDesignForm() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[200px] max-w-3xl items-center justify-center rounded-2xl border border-gray-100 bg-white p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#9C7A3C]" aria-hidden />
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
  const m = t.instant;
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

  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CustomerLeadState | null>(null);
  const [pending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [pendingDna, setPendingDna] = useState<PendingDna | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [pendingDomFields, setPendingDomFields] = useState<Array<[string, string]> | null>(null);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | undefined>(undefined);

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
  const [fullPhone, setFullPhone] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);

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

  // ── Draft restore (once, after mount — localStorage is browser-only) ──
  useEffect(() => {
    // A previous request whose Travel DNA was postponed («أكملها لاحقاً»)
    const pending = readPendingDna();
    // localStorage only exists after hydration — syncing from it here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pending) setPendingDna(pending);
    const draft = readDraft();
    hydratedRef.current = true;
    if (!draft) return;
    const d = draft.state;
    setSelectedCountries(d.selectedCountries ?? []);
    setSelectedCities(d.selectedCities ?? []);
    setIsOtherCountry(Boolean(d.isOtherCountry));
    setCustomCountry(d.customCountry ?? '');
    setCustomCities(d.customCities ?? {});
    setActiveCustomCityFor(null);
    setInterestOther(Boolean(d.interestOther));
    setInterestOtherText(d.interestOtherText ?? '');
    setFoodOther(Boolean(d.foodOther));
    setFoodOtherText(d.foodOtherText ?? '');
    setLodgingOther(Boolean(d.lodgingOther));
    setLodgingOtherText(d.lodgingOtherText ?? '');
    setFormData({ birth_date: d.birthDate ?? '' });
    if (d.fullPhone) {
      setFullPhone(d.fullPhone);
      setIsPhoneValid(requireValidPhone(d.fullPhone).isValid);
    }
    const restoredStep = Math.min(Math.max(Number(draft.step) || 0, 0), STEP_COUNT - 1);
    setStep(restoredStep);
    setMaxStep(restoredStep);
    setPendingDomFields(draft.fields);
    setDraftRestored(true);
  }, []);

  // Second pass: dependent inputs (cities, «visited before» radios) now exist in the DOM.
  useEffect(() => {
    if (!pendingDomFields || !formRef.current) return;
    applyDraftFields(formRef.current, pendingDomFields);
    setPendingDomFields(null);
  }, [pendingDomFields]);

  const latestRef = useRef<{ step: number; state: DraftState }>({ step: 0, state: {} as DraftState });
  // Keep the latest snapshot for the debounced saver (declared before the save effect below).
  useEffect(() => {
    latestRef.current = {
    step,
    state: {
      selectedCountries,
      selectedCities,
      isOtherCountry,
      customCountry,
      customCities,
      interestOther,
      interestOtherText,
      foodOther,
      foodOtherText,
      lodgingOther,
      lodgingOtherText,
      birthDate: formData.birth_date,
      fullPhone,
    },
    };
  });

  const scheduleSave = useCallback(() => {
    if (!hydratedRef.current) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const fields: Array<[string, string]> = [];
      new FormData(form).forEach((value, key) => {
        if (typeof value === 'string' && !STATE_FIELDS.has(key)) fields.push([key, value]);
      });
      const { step: currentStep, state: snapshot } = latestRef.current;
      const hasContent =
        fields.some(([k, v]) => ['full_name', 'email', 'dream_feeling'].includes(k) && v.trim() !== '') ||
        snapshot.selectedCountries.length > 0 ||
        snapshot.isOtherCountry ||
        snapshot.fullPhone !== '';
      if (!hasContent) return;
      writeDraft({ v: 1, savedAt: Date.now(), step: currentStep, fields, state: snapshot });
      setDraftSaved(true);
    }, 450);
  }, []);

  useEffect(() => {
    scheduleSave();
  }, [
    scheduleSave,
    step,
    selectedCountries,
    selectedCities,
    isOtherCountry,
    customCountry,
    customCities,
    interestOther,
    interestOtherText,
    foodOther,
    foodOtherText,
    lodgingOther,
    lodgingOtherText,
    formData.birth_date,
    fullPhone,
  ]);

  useEffect(() => () => window.clearTimeout(saveTimerRef.current), []);

  function resetAllState() {
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
    setFullPhone('');
    setIsPhoneValid(false);
    setStep(0);
    setMaxStep(0);
    setStepError(null);
    setDraftRestored(false);
    setDraftSaved(false);
  }

  function startOver() {
    window.clearTimeout(saveTimerRef.current);
    clearDraft();
    formRef.current?.reset();
    resetAllState();
    setState(null);
  }

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

  function countryCities(id: string) {
    return tripDestinations.find((c) => c.id === id)?.cities ?? getTripCountryById(id)?.cities ?? [];
  }

  function togglePopular(pick: (typeof POPULAR_PICKS)[number]) {
    const on = selectedCountries.includes(pick.country);
    setStepError(null);
    if (on) {
      setCountry(pick.country, false);
      return;
    }
    setCountry(pick.country, true);
    if (countryCities(pick.country).some((c) => c.id === pick.city)) {
      setCity(`${pick.country}:${pick.city}`, true);
    }
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

  /** Client-side gate per step — the server re-validates everything on submit. */
  function validateStep(n: number): string | null {
    const form = formRef.current;
    const value = (name: string) => String((form?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '').trim();
    if (n === 0) {
      if (!value('full_name')) return m.nameRequired;
      const phoneCheck = requireValidPhone(fullPhone);
      if (!isPhoneValid || !phoneCheck.isValid) return phoneCheck.error ?? WHATSAPP_INCOMPLETE_ERROR;
      const email = value('email');
      if (email && !EMAIL_RE.test(email)) return m.emailInvalid;
      if (!formData.birth_date) return f.birthDateRequired;
      return null;
    }
    if (n === 1) {
      if (selectedCountries.length === 0 && !isOtherCountry) return m.countryRequired;
      if (isOtherCountry && !customCountry.trim()) return f.otherCountryRequired;
      for (const composite of selectedCities) {
        if (!composite.endsWith(':other')) continue;
        const countryId = composite.slice(0, composite.lastIndexOf(':'));
        if (!String(customCities[countryId] ?? '').trim()) return f.otherCityRequired;
      }
      if (isOtherCountry && !selectedCities.some((k) => k.startsWith('other:'))) return f.otherCityRequired;
      if (selectedCities.length === 0) return m.cityRequired;
      return null;
    }
    if (n === 3) {
      if (!value('dream_feeling')) return m.dreamRequired;
    }
    return null;
  }

  function scrollToTop() {
    window.requestAnimationFrame(() => {
      const el = topRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      if (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().top > window.innerHeight * 0.6) {
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }

  function goToStep(n: number) {
    const target = Math.min(Math.max(n, 0), STEP_COUNT - 1);
    setStepError(null);
    setState(null);
    setStep(target);
    setMaxStep((prev) => Math.max(prev, target));
    scrollToTop();
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    goToStep(step + 1);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting || pending || submitLockRef.current) return;

    // Enter key on an earlier step = «next», never a premature submit
    if (step < STEP_COUNT - 1) {
      goNext();
      return;
    }

    for (let n = 0; n < STEP_COUNT; n += 1) {
      const err = validateStep(n);
      if (err) {
        if (n !== step) goToStep(n);
        setStepError(err);
        return;
      }
    }

    const form = e.currentTarget;
    const fd = new FormData(form);
    const phoneCheck = requireValidPhone(fullPhone || String(fd.get('phone_wa') ?? ''));
    if (!isPhoneValid || !phoneCheck.isValid) {
      goToStep(0);
      setStepError(phoneCheck.error ?? WHATSAPP_INCOMPLETE_ERROR);
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
        goToStep(1);
        setStepError(f.otherCityRequired);
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
      goToStep(1);
      setStepError(f.otherCountryRequired);
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
    const ref = normalizeAffiliateRef(referralCode) || normalizeAffiliateRef(fd.get('ref_code') as string) || normalizeAffiliateRef(fd.get('referral_code') as string);
    if (ref) fd.set('ref_code', ref);
    const submittedName = String(fd.get('full_name') ?? '').trim();
    const submittedPhone = phoneCheck.formattedPhone;
    setState(null);
    setStepError(null);
    startTransition(() => {
      void (async () => {
        try {
          const res = await submitCustomerLead(fd);
          setState(res);
          if (res.ok) {
            window.clearTimeout(saveTimerRef.current);
            clearDraft();
            form.reset();
            resetAllState();
            setSuccess({
              name: submittedName,
              phone: submittedPhone,
              dnaPath: res.dnaPath ?? null,
              autoWelcomeQueued: Boolean(res.autoWelcomeQueued),
            });
            scrollToTop();
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
  const stepLabels = [m.stepContact, m.stepDestination, m.stepStyle, m.stepDream];
  const isLastStep = step === STEP_COUNT - 1;
  const busy = pending || isSubmitting;
  const NextIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const popularPicks = POPULAR_PICKS.filter(
    (p) => tripDestinations.some((c) => c.id === p.country) || Boolean(getTripCountryById(p.country)),
  );

  if (success) {
    return (
      <div ref={topRef}>
        <InstantDnaSuccess
          name={success.name}
          dnaPath={success.dnaPath}
          onReset={() => {
            setSuccess(null);
            setState(null);
          }}
          onLater={() => {
            setSuccess(null);
            setState(null);
            setPendingDna(readPendingDna());
            scrollToTop();
          }}
        />
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onInput={scheduleSave}
      onChange={scheduleSave}
      noValidate
      className="mx-auto max-w-3xl space-y-5 bg-[#F4EFE6]"
      dir={dir}
    >
      {selectedCountries.map((id) => (
        <input key={id} type="hidden" name="dest_countries" value={id} />
      ))}
      {selectedCities.map((k) => (
        <input key={k} type="hidden" name="cities" value={k} />
      ))}

      {pendingDna ? (
        <div className="wl-instant-success flex flex-col gap-3 rounded-2xl border border-[#9C7A3C]/30 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4EFE6] text-[#9C7A3C]" aria-hidden>
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 text-start">
            <p className="text-sm font-black text-[#1C2E3A]">
              {m.resumeTitle.replace('{name}', pendingDna.name).replace(/\s+،/, '،')}
            </p>
            <p className="mt-0.5 text-xs font-bold leading-relaxed text-gray-500">{m.resumeBody}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`${pendingDna.path}${pendingDna.path.includes('?') ? '&' : '?'}arrived=1`}
              className="wl-instant-cta inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-xs font-black text-white"
              style={{ background: 'linear-gradient(135deg, #B8913F 0%, #9C7A3C 48%, #7E6230 100%)' }}
            >
              {m.resumeCta}
            </a>
            <button
              type="button"
              onClick={() => {
                clearPendingDna();
                setPendingDna(null);
              }}
              className="h-10 rounded-full px-3 text-[11px] font-bold text-gray-400 hover:text-[#1C2E3A]"
            >
              {m.resumeDismiss}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Progress ── */}
      <div ref={topRef} className="rounded-2xl border border-gray-100/90 bg-white px-4 py-3.5 shadow-sm sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-black tracking-wide text-[#9C7A3C]">
            {m.stepOf.replace('{n}', String(step + 1)).replace('{total}', String(STEP_COUNT))}
          </p>
          <p className={`flex items-center gap-1 text-[10px] font-bold text-gray-400 transition-opacity duration-300 ${draftSaved ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
            <Check className="h-3 w-3 text-[#9C7A3C]" aria-hidden />
            {m.draftSaved}
          </p>
        </div>
        <ol className="mt-3 grid grid-cols-4 gap-2" aria-label={m.stepOf.replace('{n}', String(step + 1)).replace('{total}', String(STEP_COUNT))}>
          {stepLabels.map((label, i) => {
            const done = i < step;
            const current = i === step;
            const reachable = i <= maxStep;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!reachable || busy}
                  onClick={() => (i < step ? goToStep(i) : i > step ? goNext() : undefined)}
                  aria-current={current ? 'step' : undefined}
                  className="group block w-full text-start disabled:cursor-not-allowed"
                >
                  <span className="block h-1.5 overflow-hidden rounded-full bg-[#E9E1D2]">
                    <span
                      className="block h-full rounded-full bg-[#9C7A3C] transition-[width] duration-500 ease-out"
                      style={{ width: done || current ? '100%' : '0%' }}
                    />
                  </span>
                  <span
                    className={`mt-1.5 block truncate text-[11px] font-black transition-colors ${
                      current ? 'text-[#1C2E3A]' : done ? 'text-[#9C7A3C]' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {draftRestored ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F4EFE6] px-3 py-2 text-[11px] font-bold text-[#1C2E3A]">
            <span>{m.draftRestored}</span>
            <button type="button" onClick={startOver} className="font-black text-[#9C7A3C] underline underline-offset-4">
              {m.draftClear}
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Step 1 · About you ── */}
      <div hidden={step !== 0} className="wl-step-panel">
        <SectionCard n={1} title={f.section1Title} subtitle={f.section1Subtitle}>
          <div>
            <label className={FIELD_LABEL} htmlFor="trip-full-name">{f.fullName}</label>
            <input
              id="trip-full-name"
              name="full_name"
              required
              autoComplete="name"
              enterKeyHint="next"
              className={INPUT_CLASS}
              placeholder={f.fullNamePlaceholder}
            />
          </div>
          <WhatsAppInput
            name="phone_wa"
            value={fullPhone}
            autoDetectCountry
            onChange={(phone, isValid) => {
              setFullPhone(phone);
              setIsPhoneValid(isValid);
            }}
            required
          />
          <div>
            <label className={FIELD_LABEL} htmlFor="trip-email">{m.emailLabel}</label>
            <input
              id="trip-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="next"
              dir="ltr"
              className={`${INPUT_CLASS} text-left`}
              placeholder={m.emailPlaceholder}
            />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="trip-birth-date">{f.birthDateLabel}</label>
            <input
              id="trip-birth-date"
              name="birth_date"
              required
              type="date"
              className={`${INPUT_CLASS} cursor-pointer`}
              value={formData.birth_date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, birth_date: e.target.value }))
              }
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
            <label className={FIELD_LABEL} htmlFor="trip-source">{f.sourceLabel}</label>
            <select id="trip-source" name="source" className={INPUT_CLASS} defaultValue="">
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
      </div>

      {/* ── Step 2 · Destination ── */}
      <div hidden={step !== 1} className="wl-step-panel">
        <SectionCard n={2} title={f.section2Title} subtitle={f.section2Subtitle}>
          {popularPicks.length ? (
            <div className="rounded-xl border border-[#9C7A3C]/20 bg-[#F4EFE6]/60 p-3">
              <p className="flex items-center gap-1.5 text-right text-[11px] font-black text-[#9C7A3C]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {m.popularTitle}
              </p>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {popularPicks.map((pick) => {
                  const on = selectedCountries.includes(pick.country);
                  return (
                    <button
                      key={pick.country}
                      type="button"
                      onClick={() => togglePopular(pick)}
                      aria-pressed={on}
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2.5 transition-all duration-200 active:scale-[0.97] ${
                        on
                          ? 'border-[#9C7A3C] bg-[#1C2E3A] text-[#F4EFE6] shadow-sm'
                          : 'border-gray-200 bg-white text-[#1C2E3A] hover:border-[#9C7A3C]/50'
                      }`}
                    >
                      <span className="text-xl leading-none" aria-hidden>
                        {pick.flag}
                      </span>
                      <span className="text-sm font-black">{countryLabel(pick.country)}</span>
                      <span className={`text-[10px] font-bold ${on ? 'text-[#E6D3A8]' : 'text-gray-400'}`}>
                        {on ? <Check className="inline h-3 w-3" aria-hidden /> : null} {cityLabel(pick.country, pick.city)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

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
                    onToggle={() => {
                      setStepError(null);
                      setCountry(c.id, !isSelected);
                    }}
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
                            onChange={(on) => {
                              setStepError(null);
                              setCity(composite, on);
                            }}
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
              <label className={FIELD_LABEL} htmlFor="trip-start">{f.travelDate}</label>
              <input id="trip-start" name="travel_start_date" type="date" className={DATE_INPUT_CLASS} />
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="trip-days">{f.travelDays}</label>
              <input
                id="trip-days"
                name="travel_days"
                type="number"
                inputMode="numeric"
                min={3}
                max={30}
                defaultValue={10}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="trip-travelers">{f.travelersCount}</label>
              <input
                id="trip-travelers"
                name="travelers_count"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                defaultValue={2}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="trip-budget">{f.budget}</label>
              <select id="trip-budget" name="budget_range" className={INPUT_CLASS} defaultValue="">
                <option value="">{f.budgetUndecided}</option>
                <option value="economical">{f.budgetEconomical}</option>
                <option value="moderate">{f.budgetModerate}</option>
                <option value="comfortable">{f.budgetComfortable}</option>
                <option value="premium">{f.budgetPremium}</option>
              </select>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Step 3 · Style ── */}
      <div hidden={step !== 2} className="wl-step-panel space-y-5">
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
      </div>

      {/* ── Step 4 · Taste & dream ── */}
      <div hidden={step !== 3} className="wl-step-panel space-y-5">
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
            <label className={FIELD_LABEL} htmlFor="trip-dream">{f.dreamLabel}</label>
            <textarea
              id="trip-dream"
              name="dream_feeling"
              required
              rows={5}
              className={TEXTAREA_CLASS}
              placeholder={f.dreamPlaceholder}
            />
          </div>
        </SectionCard>
      </div>

      {stepError || state?.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {stepError || state?.error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pb-2 pt-1">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => goToStep(step - 1)}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#1C2E3A]/20 bg-white px-5 text-sm font-black text-[#1C2E3A] transition hover:border-[#9C7A3C]/50 disabled:opacity-50"
          >
            <BackIcon className="h-4 w-4" aria-hidden />
            {m.back}
          </button>
        ) : (
          <span />
        )}

        {isLastStep ? (
          <button
            type="submit"
            disabled={busy}
            className={`inline-flex h-12 min-w-[220px] items-center justify-center gap-2 rounded-full bg-[#1C2E3A] px-8 text-sm font-black text-[#F4EFE6] shadow-sm transition-all hover:bg-[#122029] disabled:cursor-not-allowed disabled:opacity-50 ${
              busy ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {f.submit}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex h-12 min-w-[160px] items-center justify-center gap-2 rounded-full bg-[#1C2E3A] px-7 text-sm font-black text-[#F4EFE6] shadow-sm transition-all hover:bg-[#122029]"
          >
            {m.next}
            <NextIcon className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
