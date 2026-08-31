'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import {
  EMPTY_PARTNER_DNA,
  EXPERT_ACTIVITY_STRENGTH_OPTIONS,
  EXPERT_ROUTING_STYLE_OPTIONS,
  LEADER_PREFERRED_STYLE_OPTIONS,
  LEADER_SPECIAL_SKILL_OPTIONS,
  PARTNER_ROUTING_STYLE_OPTIONS,
  parsePartnerDnaType,
  partnerTypeLabel,
  type PartnerDnaProfile,
  type PartnerDnaType,
} from '@/lib/partner-dna';
import { useCountries } from '@/hooks/useCountries';

const FIELD =
  'w-full rounded-xl border border-[#D4AF37]/30 bg-[#0D0F0E] px-4 py-3 text-sm font-semibold text-white placeholder:text-white/35 outline-none focus:border-[#D4AF37]/70 focus:ring-2 focus:ring-[#D4AF37]/20';

export default function PartnerDnaPublicPage() {
  const params = useParams();
  const rawType = typeof params?.type === 'string' ? params.type : '';
  const id = typeof params?.id === 'string' ? params.id : '';
  const type = parsePartnerDnaType(rawType);
  const { countries: destinationCountries } = useCountries();

  const [name, setName] = useState('');
  const [dna, setDna] = useState<PartnerDnaProfile>(EMPTY_PARTNER_DNA);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !type) {
      setError('رابط البصمة غير صالح');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ id, type });
      const res = await fetch(`/api/partners/dna?${qs.toString()}`);
      const payload = (await res.json()) as {
        ok?: boolean;
        partner?: {
          name?: string;
          specialtyRegions?: string | null;
          dnaProfile?: PartnerDnaProfile;
        };
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.partner) {
        throw new Error(payload.error || 'رابط البصمة غير صالح');
      }
      setName(payload.partner.name ?? 'الشريك');
      const loadedDna = payload.partner.dnaProfile ?? EMPTY_PARTNER_DNA;
      const specialtyDestinations = String(payload.partner.specialtyRegions ?? '')
        .split(/[,،]/)
        .map((item) => item.trim())
        .filter(Boolean);
      setDna({
        ...loadedDna,
        approvedDestinations:
          loadedDna.approvedDestinations.length > 0
            ? loadedDna.approvedDestinations
            : specialtyDestinations,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحميل');
    } finally {
      setLoading(false);
    }
  }, [id, type]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !type) return;
    if (type !== 'leaders' && dna.routingStyles.length === 0) {
      setError('يرجى اختيار أسلوب واحد على الأقل لتصميم المسار.');
      return;
    }
    if (type === 'leaders' && dna.specialSkills.length === 0) {
      setError('يرجى اختيار مهارة أو رخصة تخصصية واحدة على الأقل.');
      return;
    }
    if (type === 'leaders' && dna.preferredStyles.length === 0) {
      setError('يرجى اختيار نمط رحلة مفضل واحد على الأقل.');
      return;
    }
    if (type === 'experts' && dna.approvedDestinations.length === 0) {
      setError('يرجى اختيار وجهة معتمدة واحدة على الأقل.');
      return;
    }
    if (type === 'experts' && dna.activityStrengths.length === 0) {
      setError('يرجى اختيار نقطة قوة واحدة على الأقل في ترتيب الفعاليات.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/partners/dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          type,
          dnaData: {
            specialSkills: dna.specialSkills,
            preferredStyles: dna.preferredStyles,
            approvedDestinations: dna.approvedDestinations,
            routingStyles: dna.routingStyles,
            activityStrengths: dna.activityStrengths,
            tripStyle: dna.tripStyle,
            strengths: dna.strengths,
            competitiveAdvantage: dna.competitiveAdvantage,
            agencyRequirements: dna.agencyRequirements,
          },
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر الحفظ');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0D0C]" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (done) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0B0D0C] px-6 text-center"
        dir="rtl"
      >
        <CheckCircle2 className="h-14 w-14 text-[#D4AF37]" />
        <h1 className="text-2xl font-black text-white">شكراً لك، {name}</h1>
        <p className="max-w-md text-sm font-semibold text-white/70">
          تم حفظ بصمتك بنجاح. فريق Wanderloom سيراجعها ويوائم التعاون مع أسلوبك.
        </p>
      </div>
    );
  }

  if (error && !name) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0D0C] px-6 text-center"
        dir="rtl"
      >
        <p className="font-bold text-rose-300">{error}</p>
      </div>
    );
  }

  const role = type ? partnerTypeLabel(type as PartnerDnaType) : 'شريك';
  const toggleDestination = (name: string) => {
    setDna((current) => ({
      ...current,
      approvedDestinations: current.approvedDestinations.includes(name)
        ? current.approvedDestinations.filter((item) => item !== name)
        : [...current.approvedDestinations, name],
    }));
  };
  const toggleRoutingStyle = (label: string) => {
    setDna((current) => ({
      ...current,
      routingStyles: current.routingStyles.includes(label)
        ? current.routingStyles.filter((item) => item !== label)
        : [...current.routingStyles, label],
      tripStyle: current.routingStyles.includes(label)
        ? current.routingStyles.filter((item) => item !== label).join('، ')
        : [...current.routingStyles, label].join('، '),
    }));
  };
  const toggleSpecialSkill = (value: string) => {
    setDna((current) => ({
      ...current,
      specialSkills: current.specialSkills.includes(value)
        ? current.specialSkills.filter((item) => item !== value)
        : [...current.specialSkills, value],
    }));
  };
  const togglePreferredStyle = (value: string) => {
    setDna((current) => ({
      ...current,
      preferredStyles: current.preferredStyles.includes(value)
        ? current.preferredStyles.filter((item) => item !== value)
        : [...current.preferredStyles, value],
    }));
  };
  const toggleActivityStrength = (value: string) => {
    setDna((current) => ({
      ...current,
      activityStrengths: current.activityStrengths.includes(value)
        ? current.activityStrengths.filter((item) => item !== value)
        : [...current.activityStrengths, value],
    }));
  };

  return (
    <div
      className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a2a22_0%,_#0B0D0C_55%)] px-4 py-10 sm:px-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-[#D4AF37]/80">
            <Sparkles className="h-3.5 w-3.5" />
            Partner DNA
          </p>
          <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">
            أهلاً بك {name} في منصة Wanderloom
          </h1>
          <p className="mt-2 text-sm font-semibold text-white/60">
            بصمة الشريك — {role}. أخبرنا بأسلوب عملك لنوائم التعاون معك.
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-5 rounded-3xl border border-[#D4AF37]/20 bg-black/40 p-6 shadow-2xl backdrop-blur-sm sm:p-8"
        >
          {type === 'leaders' ? (
            <>
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-[#D4AF37]">
                  المهارات والرخص التخصصية
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {LEADER_SPECIAL_SKILL_OPTIONS.map((option) => {
                    const selected = dna.specialSkills.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleSpecialSkill(option)}
                        className={`rounded-xl border px-3 py-3 text-xs font-bold transition ${
                          selected
                            ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                            : 'border-white/15 bg-white/5 text-white/75 hover:border-emerald-400/60'
                        }`}
                      >
                        {selected ? '✓ ' : ''}
                        {option}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-[#D4AF37]">
                  نمط الرحلات المفضل
                </legend>
                <div className="grid gap-2">
                  {LEADER_PREFERRED_STYLE_OPTIONS.map((option) => {
                    const selected = dna.preferredStyles.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => togglePreferredStyle(option)}
                        className={`rounded-xl border px-4 py-3 text-right text-xs font-bold transition ${
                          selected
                            ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#F5D978]'
                            : 'border-white/15 bg-white/5 text-white/75 hover:border-[#D4AF37]/60'
                        }`}
                      >
                        {selected ? '✓ ' : ''}
                        {option}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          ) : type === 'experts' ? (
            <>
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-[#D4AF37]">
                  الوجهات المختص بها
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {destinationCountries.map((country) => {
                    const selected = dna.approvedDestinations.includes(country.name);
                    return (
                      <button
                        key={country.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleDestination(country.name)}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                          selected
                            ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#F5D978]'
                            : 'border-white/15 bg-white/5 text-white/70 hover:border-[#D4AF37]/50'
                        }`}
                      >
                        {selected ? '✓ ' : ''}
                        {country.flag ? `${country.flag} ` : ''}
                        {country.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-[#D4AF37]">
                  أسلوب تصميم المسارات
                </legend>
                <div className="grid gap-2">
                  {EXPERT_ROUTING_STYLE_OPTIONS.map((option) => {
                    const selected = dna.routingStyles.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleRoutingStyle(option)}
                        className={`rounded-xl border px-4 py-3 text-right text-xs font-bold transition ${
                          selected
                            ? 'border-sky-400 bg-sky-400/20 text-sky-200'
                            : 'border-white/15 bg-white/5 text-white/75 hover:border-sky-400/60'
                        }`}
                      >
                        {selected ? '✓ ' : ''}
                        {option}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-[#D4AF37]">
                  مميزات ترتيب الفعاليات
                </legend>
                <div className="grid gap-2">
                  {EXPERT_ACTIVITY_STRENGTH_OPTIONS.map((option) => {
                    const selected = dna.activityStrengths.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleActivityStrength(option)}
                        className={`rounded-xl border px-4 py-3 text-right text-xs font-bold transition ${
                          selected
                            ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                            : 'border-white/15 bg-white/5 text-white/75 hover:border-emerald-400/60'
                        }`}
                      >
                        {selected ? '✓ ' : ''}
                        {option}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          ) : (
            <fieldset className="space-y-3">
              <legend className="text-xs font-bold text-[#D4AF37]">
                أسلوب تصميم المسار
              </legend>
              <div className="flex flex-wrap gap-2">
                {PARTNER_ROUTING_STYLE_OPTIONS.map((option) => {
                  const selected = dna.routingStyles.includes(option.label);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleRoutingStyle(option.label)}
                      className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                        selected
                          ? 'border-[#D4AF37] bg-[#D4AF37] text-[#0B0D0C]'
                          : 'border-white/15 bg-white/5 text-white/75 hover:border-[#D4AF37]/60'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <label className="block space-y-2">
            <span className="text-xs font-bold text-[#D4AF37]">نقاط القوة</span>
            <textarea
              className={`${FIELD} min-h-[88px] resize-y`}
              value={dna.strengths}
              onChange={(e) => setDna((d) => ({ ...d, strengths: e.target.value }))}
              placeholder="أنواع العملاء أو التجارب التي تتميّز فيها"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-bold text-[#D4AF37]">ما الذي يميزك عن غيرك؟</span>
            <textarea
              className={`${FIELD} min-h-[88px] resize-y`}
              value={dna.competitiveAdvantage}
              onChange={(e) =>
                setDna((d) => ({ ...d, competitiveAdvantage: e.target.value }))
              }
              placeholder="ميزتك التنافسية الفريدة"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-bold text-[#D4AF37]">
              متطلباتك الخاصة من الشركة
            </span>
            <textarea
              className={`${FIELD} min-h-[88px] resize-y`}
              value={dna.agencyRequirements}
              onChange={(e) =>
                setDna((d) => ({ ...d, agencyRequirements: e.target.value }))
              }
              placeholder="ما تحتاجه من Wanderloom للتعاون بسلاسة"
            />
          </label>

          {error ? <p className="text-sm font-bold text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#B5914F] to-[#D4AF37] px-5 py-3.5 text-sm font-black text-[#0B0D0C] transition hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            حفظ بصمة الشريك
          </button>
        </form>
      </div>
    </div>
  );
}
