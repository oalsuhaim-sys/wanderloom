'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, Loader2, Sparkles } from 'lucide-react';

import { getClientAccessToken } from '@/lib/crm-session-token';
import { CRM_BTN_PRIMARY, CRM_INPUT } from '@/lib/crm-luxury-ui';
import {
  FALLBACK_GENERATOR_OPTIONS,
  type MarketingGeneratorOptions,
} from '@/lib/marketing-generator-options';
import type { MarketingPipelineItem } from '@/lib/marketing-content-pipeline';
import {
  COLOR_PALETTE,
  resolvePhilosophyForFormat,
  type WanderloomGeneratorResult,
} from '@/lib/wanderloom-generator';

const FIELD_LABEL = 'block text-xs font-semibold text-slate-600 dark:text-slate-300';
const PANEL =
  'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6';
const SECTION =
  'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({
  label,
  text,
  className = '',
}: {
  label: string;
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={
        className ||
        'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-200 dark:hover:bg-[#2A3834]'
      }
      onClick={async () => {
        const ok = await copyText(text);
        if (!ok) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? 'تم النسخ' : label}
    </button>
  );
}

function BeatCard({
  title,
  timing,
  direction,
  line,
}: {
  title: string;
  timing: string;
  direction: string;
  line: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h4>
        <span className="inline-flex rounded-md bg-[#1C2E3A] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#F4EFE6]">
          {timing}
        </span>
      </div>
      <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-[#D4AF37]">الإخراج: </span>
        {direction}
      </p>
      <blockquote className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-100">
        {line}
      </blockquote>
    </article>
  );
}

function GeneratorResultView({ result }: { result: WanderloomGeneratorResult }) {
  const directionRows: { label: string; value: string }[] = [
    { label: 'مصادر الفيديو', value: result.direction_section.video_sources },
    { label: 'الظهور', value: result.direction_section.on_camera },
    { label: 'الصيغة', value: result.direction_section.format_note },
    { label: 'نغمة الصوت', value: result.direction_section.voice_tone },
    { label: 'ASMR', value: result.direction_section.asmr },
    { label: 'الموسيقى', value: result.direction_section.music },
    { label: 'التدرج اللوني', value: result.direction_section.color_grade },
    { label: 'الأصول', value: result.direction_section.assets },
  ];

  const captionBlock = [
    result.caption_section.body.trim(),
    '',
    result.caption_section.hashtags.join(' '),
  ].join('\n');

  return (
    <div className="space-y-5" dir="rtl">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-l from-[#F4EFE6] to-white p-5 dark:border-[#2D3F3A] dark:from-[#1A2421] dark:to-[#22302C] sm:p-6">
        <p className="text-xs font-semibold tracking-wide text-[#9C7A3C]">النتيجة المباشرة</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{result.idea_name}</h2>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" dir="ltr">
          `{result.id}` · {result.format} · {result.platform} · {result.destination} ·{' '}
          {result.funnel_stage}
        </p>
      </header>

      {/* SECTION 1 */}
      <section className={SECTION} aria-labelledby="sec-script">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="sec-script" className="text-base font-bold text-slate-900 dark:text-white">
              ١. السكريبت كلمة بكلمة
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              أربع ضربات زمنية + خطّافات بديلة للافتتاحية
            </p>
          </div>
          <CopyButton label="انسخي السكريبت كاملاً" text={result.script_section.full_script_text} />
        </div>

        <div className="grid gap-3">
          {result.script_section.beats.map((beat) => (
            <BeatCard
              key={beat.key}
              title={beat.title}
              timing={beat.timing}
              direction={beat.direction}
              line={beat.line}
            />
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 dark:border-[#2D3F3A]">
          <p className="mb-2 text-xs font-bold text-slate-700 dark:text-[#D4AF37]">
            خطّافات بديلة للافتتاحية
          </p>
          <ul className="space-y-2">
            {result.script_section.alt_hooks.map((hook) => (
              <li
                key={hook}
                className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-[#1A2421] dark:text-slate-200"
              >
                {hook}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* SECTION 2 */}
      <section className={SECTION} aria-labelledby="sec-caption">
        <h3 id="sec-caption" className="mb-3 text-base font-bold text-slate-900 dark:text-white">
          ٢. الكابشن الجاهز للنشر
        </h3>
        <pre
          className="overflow-x-auto whitespace-pre-wrap rounded-xl p-4 text-sm leading-relaxed text-[#F4EFE6]"
          style={{ backgroundColor: '#1e293b' }}
          dir="rtl"
        >
          {captionBlock}
        </pre>
        <div className="mt-3 flex justify-end">
          <CopyButton label="انسخي الكابشن" text={captionBlock} />
        </div>
      </section>

      {/* SECTION 3 */}
      <section className={SECTION} aria-labelledby="sec-direction">
        <h3 id="sec-direction" className="mb-3 text-base font-bold text-slate-900 dark:text-white">
          ٣. التوجيهات الإخراجية
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2D3F3A]">
          <table className="w-full min-w-[520px] border-collapse text-right text-sm">
            <tbody>
              {directionRows.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-slate-100 last:border-b-0 dark:border-[#2D3F3A]"
                >
                  <th className="w-[38%] bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 dark:bg-[#1A2421] dark:text-slate-300">
                    {row.label}
                  </th>
                  <td className="px-3 py-2.5 text-slate-800 dark:text-slate-100">{row.value}</td>
                </tr>
              ))}
              <tr>
                <th className="bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 dark:bg-[#1A2421] dark:text-slate-300">
                  Color Palette
                </th>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-2">
                    {(result.direction_section.color_palette.length
                      ? result.direction_section.color_palette
                      : COLOR_PALETTE
                    ).map((hex) => (
                      <span
                        key={hex}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-mono font-semibold text-slate-700 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-200"
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: hex }}
                          aria-hidden
                        />
                        {hex}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 4 */}
      <section className={SECTION} aria-labelledby="sec-cta">
        <h3 id="sec-cta" className="mb-3 text-base font-bold text-slate-900 dark:text-white">
          ٤. النداء (CTA)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2D3F3A]">
          <table className="w-full min-w-[520px] border-collapse text-right text-sm">
            <tbody>
              {(
                [
                  ['المرحلة', result.cta_section.stage],
                  ['النص', result.cta_section.text],
                  ['ملاحظة الإخراج', result.cta_section.direction_note],
                  ['كود الحملة', result.cta_section.campaign_code],
                  ['lead_source', result.cta_section.lead_source],
                ] as const
              ).map(([label, value]) => (
                <tr
                  key={label}
                  className="border-b border-slate-100 last:border-b-0 dark:border-[#2D3F3A]"
                >
                  <th className="w-[38%] bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 dark:bg-[#1A2421] dark:text-slate-300">
                    {label}
                  </th>
                  <td className="px-3 py-2.5 text-slate-800 dark:text-slate-100">{value}</td>
                </tr>
              ))}
              <tr>
                <th className="bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 dark:bg-[#1A2421] dark:text-slate-300">
                  رابط UTM
                </th>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <code
                      dir="ltr"
                      className="break-all text-left text-[11px] text-slate-600 dark:text-slate-300"
                    >
                      {result.cta_section.utm_url}
                    </code>
                    <CopyButton label="انسخي رابط UTM" text={result.cta_section.utm_url} />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function ContentGeneratorTab({
  onSaved,
}: {
  onSaved?: (item: MarketingPipelineItem) => void;
} = {}) {
  const [options, setOptions] = useState<MarketingGeneratorOptions>(FALLBACK_GENERATOR_OPTIONS);
  const [optionsSource, setOptionsSource] = useState<MarketingGeneratorOptions['source']>('fallback');
  const [format, setFormat] = useState<string>(FALLBACK_GENERATOR_OPTIONS.formats[0] ?? '');
  const [platform, setPlatform] = useState<string>(FALLBACK_GENERATOR_OPTIONS.platforms[0] ?? '');
  const [destination, setDestination] = useState<string>(
    FALLBACK_GENERATOR_OPTIONS.destinations[0] ?? '',
  );
  const [funnelStage, setFunnelStage] = useState<string>(
    FALLBACK_GENERATOR_OPTIONS.funnelStages[0] ?? '',
  );
  const [audience, setAudience] = useState<string>(FALLBACK_GENERATOR_OPTIONS.audiences[0] ?? '');
  const [philosophy, setPhilosophy] = useState<string>(
    FALLBACK_GENERATOR_OPTIONS.philosophies[0] ?? '',
  );
  const [ideaName, setIdeaName] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [result, setResult] = useState<WanderloomGeneratorResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const token = await getClientAccessToken();
        const res = await fetch('/api/marketing/generator-options', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = (await res.json()) as {
          ok?: boolean;
          options?: MarketingGeneratorOptions;
        };
        if (cancelled || !data.options) return;

        setOptions(data.options);
        setOptionsSource(data.options.source);

        // Keep current selection if still present; otherwise snap to first option.
        const pick = (current: string, list: string[]) =>
          list.includes(current) ? current : list[0] ?? current;

        setFormat((prev) => pick(prev, data.options!.formats));
        setPlatform((prev) => pick(prev, data.options!.platforms));
        setDestination((prev) => pick(prev, data.options!.destinations));
        setFunnelStage((prev) => pick(prev, data.options!.funnelStages));
        setAudience((prev) => pick(prev, data.options!.audiences));
        setPhilosophy((prev) => pick(prev, data.options!.philosophies));
      } catch {
        /* keep fallbacks */
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedPhilosophy = useMemo(
    () => resolvePhilosophyForFormat(format, philosophy),
    [format, philosophy],
  );

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setError('اكتبي الموضوع أولاً.');
      return;
    }

    setBusy(true);
    setError(null);
    setSaveNote(null);

    try {
      const token = await getClientAccessToken();
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          format,
          platform,
          destination,
          funnel_stage: funnelStage,
          audience,
          philosophy,
          theme: resolvedPhilosophy,
          idea_name: ideaName.trim() || undefined,
          topic: trimmedTopic,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        result?: WanderloomGeneratorResult;
        saved?: boolean;
        saveError?: string | null;
        pipelineItem?: MarketingPipelineItem | null;
      };

      if (!data.result) {
        setError(data.error || 'تعذر توليد المحتوى.');
        return;
      }

      setResult(data.result);
      if (!data.ok && data.error) {
        setError(`${data.error} — تم عرض نموذج احتياطي.`);
      }

      if (data.saved && data.pipelineItem) {
        setSaveNote('تم حفظ الفكرة في جدول المحتوى (marketing_content).');
        onSaved?.(data.pipelineItem);
      } else if (data.saveError) {
        setSaveNote(`التوليد نجح لكن الحفظ فشل: ${data.saveError}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاتصال بواجهة التوليد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <section className={PANEL} aria-labelledby="content-generator-heading">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-wide text-slate-400 dark:text-[#D4AF37]/80">
            Claude Prototype · Generator
          </p>
          <h2
            id="content-generator-heading"
            className="mt-1 text-lg font-bold text-slate-900 dark:text-white sm:text-xl"
          >
            توليد المحتوى
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            اختاري الصيغة والمنصّة والوجهة — ثم ولّدي السكريبت والكابشن والتوجيهات الإخراجية مباشرة
            أسفل النموذج.
          </p>
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            مصدر القوائم:{' '}
            {optionsSource === 'supabase'
              ? 'قاعدة البيانات'
              : optionsSource === 'mixed'
                ? 'قاعدة البيانات + ثوابت احتياطية'
                : 'ثوابت احتياطية'}
          </p>
        </div>

        <form className="space-y-5" onSubmit={onGenerate}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block space-y-1.5 sm:col-span-2 lg:col-span-1">
              <span className={FIELD_LABEL}>الصيغة الإنتاجية</span>
              <select className={CRM_INPUT} value={format} onChange={(e) => setFormat(e.target.value)}>
                {options.formats.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>المنصّة</span>
              <select
                className={CRM_INPUT}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {options.platforms.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>الوجهة</span>
              <select
                className={CRM_INPUT}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                {options.destinations.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>مرحلة القمع</span>
              <select
                className={CRM_INPUT}
                value={funnelStage}
                onChange={(e) => setFunnelStage(e.target.value)}
              >
                {options.funnelStages.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>الشريحة المستهدفة</span>
              <select
                className={CRM_INPUT}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                {options.audiences.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={FIELD_LABEL}>العمود الفلسفي</span>
              <select
                className={CRM_INPUT}
                value={philosophy}
                onChange={(e) => setPhilosophy(e.target.value)}
              >
                {options.philosophies.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {philosophy === 'تلقائي حسب الصيغة —' ? (
                <span className="mt-1 block text-[11px] text-slate-400">
                  سيُستخدم: {resolvedPhilosophy}
                </span>
              ) : null}
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className={FIELD_LABEL}>اسم الفكرة (اختياري)</span>
            <input
              className={CRM_INPUT}
              value={ideaName}
              onChange={(e) => setIdeaName(e.target.value)}
              placeholder="يُبنى تلقائياً من الموضوع والوجهة"
            />
          </label>

          <label className="block space-y-1.5">
            <span className={FIELD_LABEL}>الموضوع</span>
            <textarea
              className={`${CRM_INPUT} min-h-[120px] resize-y leading-relaxed`}
              placeholder="مثال: صباح مطر في سيول — قهوة، أسواق، وهدوء المدينة…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {error}
            </div>
          ) : null}

          {saveNote ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              {saveNote}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-[#2D3F3A]">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              الناتج يظهر مباشرة أسفل النموذج — بدون تحويل لصفحة أخرى.
            </p>
            <button type="submit" className={CRM_BTN_PRIMARY} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {busy ? 'جاري التوليد…' : 'ولّدي المحتوى'}
            </button>
          </div>
        </form>
      </section>

      {result ? <GeneratorResultView result={result} /> : null}
    </div>
  );
}
