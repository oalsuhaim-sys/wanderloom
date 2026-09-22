'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Sparkles, X } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import type { Dictionary } from '@/context/LanguageContext';
import { buildPersuasionEvidence } from '@/lib/quiz-persuasion-engine';
import { QuizResult } from '@/components/QuizResult';

function QuizOptionCard({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={`wl-quiz-option flex w-full cursor-pointer items-center justify-between rounded-2xl border p-5 text-start transition-all duration-300 ${
        checked
          ? 'border-[#9C7A3C] bg-[#1C2E3A] font-medium text-[#F4EFE6] shadow-md'
          : 'border-[#1C2E3A]/10 bg-white/80 font-medium text-[#1C2E3A] hover:border-[#9C7A3C]/50'
      }`}
    >
      <span className="flex-1 leading-relaxed">{label}</span>
      <span
        className={`ms-4 h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-300 ${
          checked ? 'bg-[#9C7A3C] shadow-[0_0_0_4px_rgba(156,122,60,0.18)]' : 'bg-[#1C2E3A]/15'
        }`}
        aria-hidden
      />
    </button>
  );
}

type DestinationKey = keyof Dictionary['quiz']['destinations'];

type DestinationExtras = {
  persuasionDesc?: string;
  secretsCta?: string;
  registerLuxuryCta?: string;
};

function computeResult(
  questions: Dictionary['quiz']['questions'],
  answers: Record<string, number>,
): DestinationKey {
  const totals: Record<string, number> = {};

  for (const question of questions) {
    const optionIndex = answers[question.id];
    if (optionIndex == null) continue;
    const option = question.options[optionIndex];
    if (!option) continue;
    for (const tag of option.tags) {
      totals[tag] = (totals[tag] ?? 0) + 1;
    }
  }

  const keys = Object.keys(totals);
  if (keys.length === 0) return 'japan';
  return keys.sort((a, b) => totals[b] - totals[a])[0] as DestinationKey;
}

export default function WanderloomQuiz() {
  const { dir, t } = useLanguage();
  const q = t.quiz;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [isPersuasionModalOpen, setIsPersuasionModalOpen] = useState(false);

  const questions = q.questions;
  const totalSteps = questions.length;
  const currentQuestion = questions[step];
  const progress = finished ? 100 : Math.round((step / totalSteps) * 100);

  const resultDestination = useMemo(() => {
    if (!finished) return null;
    const key = computeResult(questions, answers);
    return { key, ...q.destinations[key] };
  }, [answers, finished, q.destinations, questions]);

  const destExtras = useMemo((): DestinationExtras => {
    if (!resultDestination) return {};
    return q.destinations[resultDestination.key] as DestinationExtras;
  }, [q.destinations, resultDestination]);

  const persuasionEvidence = useMemo(() => {
    if (!resultDestination) return [];
    return buildPersuasionEvidence(
      questions,
      answers,
      resultDestination.key,
      resultDestination.name,
    );
  }, [answers, questions, resultDestination]);

  const secretsButtonLabel = destExtras.secretsCta ?? q.whyFitCta;
  const registerButtonLabel = q.registerTripCta;
  const persuasionModalHeader = q.persuasionModalHeader.replace(
    '{country}',
    resultDestination?.name ?? '',
  );

  const handleSelect = (optionIndex: number) => {
    if (!currentQuestion) return;

    const questionId = currentQuestion.id;

    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));

    if (step >= totalSteps - 1) {
      setFinished(true);
      return;
    }

    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (finished || step <= 0) return;
    setStep((s) => Math.max(0, s - 1));
  };

  const handleRestart = () => {
    setStep(0);
    setAnswers({});
    setFinished(false);
    setIsPersuasionModalOpen(false);
  };

  return (
    <div className="isolate w-full bg-[#F4EFE6]" dir={dir}>
      <div className="mx-auto max-w-2xl px-2 text-center sm:px-0">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#9C7A3C]/30 bg-[#9C7A3C]/10 px-4 py-1.5 text-[11px] font-black tracking-wide text-[#9C7A3C] sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {q.kicker}
        </p>
        <h2 className="mt-6 text-3xl font-black text-[#1C2E3A] sm:text-4xl">{q.title}</h2>
        <p className="mt-4 text-sm font-bold leading-relaxed text-gray-600 sm:text-base">{q.intro}</p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl px-2 sm:px-0">
        {!finished ? (
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
            {questions.map((_, index) => {
              const active = index === step;
              const done = index < step;
              return (
                <span
                  key={index}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black transition-colors ${
                    active
                      ? 'border border-[#9C7A3C] bg-[#1C2E3A] text-[#F4EFE6]'
                      : done
                        ? 'border-2 border-[#1C2E3A] text-[#1C2E3A]'
                        : 'border border-gray-200 text-gray-400'
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  {index + 1}
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="mb-8 h-1 overflow-hidden rounded-full bg-[#9C7A3C]/15">
          <div
            className="h-full rounded-full bg-gradient-to-l from-[#9C7A3C] to-[#9C7A3C] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {!finished && currentQuestion ? (
          <div className="rounded-3xl border border-[#1C2E3A]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
            <div className="mb-6 flex w-full items-center justify-between gap-4">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#1C2E3A]/10 bg-white/90 px-3 py-1.5 text-xs font-medium text-[#1C2E3A] shadow-sm transition hover:border-[#9C7A3C] hover:text-[#9C7A3C]"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                  رجوع
                </button>
              ) : (
                <span className="w-[72px] shrink-0" aria-hidden />
              )}
              <span className="flex-1" aria-hidden />
              <span className="w-[72px] shrink-0" aria-hidden />
            </div>

            <div className="space-y-3 text-center">
              <p className="text-[11px] font-medium tracking-[0.25em] text-[#9C7A3C]">
                {q.questionLabel
                  .replace('{current}', String(step + 1))
                  .replace('{total}', String(totalSteps))}
              </p>
              <h3 className="text-xl font-semibold leading-relaxed text-[#1C2E3A] sm:text-2xl">
                {currentQuestion.prompt}
              </h3>
            </div>

            <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-3.5">
              {currentQuestion.options.map((option, index) => (
                <QuizOptionCard
                  key={`${currentQuestion.id}-${index}`}
                  label={option.label}
                  checked={answers[currentQuestion.id] === index}
                  onSelect={() => handleSelect(index)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {finished && resultDestination ? (
          <QuizResult
            kicker={q.resultKicker}
            countryName={resultDestination.name}
            tagline={resultDestination.tagline}
            description={resultDestination.desc}
            vibeTags={resultDestination.vibe}
            registerLabel={registerButtonLabel}
            persuasionLabel={secretsButtonLabel}
            restartLabel={q.restart}
            onOpenPersuasion={() => setIsPersuasionModalOpen(true)}
            onRestart={handleRestart}
          />
        ) : null}
      </div>

      {isPersuasionModalOpen && resultDestination
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="quiz-persuasion-title"
              onClick={() => setIsPersuasionModalOpen(false)}
            >
              <div
                className="relative z-[101] mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-[#F4EFE6] p-8 shadow-2xl"
                dir={dir}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="text-start">
                    <p className="text-[10px] font-black tracking-[0.3em] text-[#9C7A3C]">
                      {resultDestination.name}
                    </p>
                    <h3
                      id="quiz-persuasion-title"
                      className="mt-2 text-2xl font-bold leading-snug text-[#1C2E3A] sm:text-3xl"
                    >
                      {persuasionModalHeader}
                    </h3>
                    {destExtras.persuasionDesc ? (
                      <p className="mt-4 text-sm font-bold leading-[1.9] text-gray-600">
                        {destExtras.persuasionDesc}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPersuasionModalOpen(false)}
                    className="shrink-0 rounded-full border border-[#1C2E3A]/20 bg-white p-2 text-[#1C2E3A] transition hover:bg-[#f4efe6]"
                    aria-label={q.insiderModalClose}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {persuasionEvidence.map((item) => (
                    <article
                      key={`${item.destination}-${item.userAnswer}`}
                      className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
                    >
                      <div className="mb-3 flex items-start gap-3">
                        <span className="text-2xl" aria-hidden>
                          {item.icon}
                        </span>
                        <span className="inline-flex rounded-full border border-[#9C7A3C]/35 bg-[#9C7A3C]/10 px-3 py-1 text-sm font-black text-[#1C2E3A]">
                          {q.persuasionBasedOn} {item.userAnswer}
                        </span>
                      </div>
                      {item.destination ? (
                        <h4 className="text-lg font-black text-[#1C2E3A]">{item.destination}</h4>
                      ) : null}
                      <p
                        className={`text-sm font-bold leading-[1.85] text-gray-700 ${item.destination ? 'mt-2' : ''}`}
                      >
                        {item.description}
                      </p>
                    </article>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsPersuasionModalOpen(false)}
                  className="mt-6 w-full rounded-lg border-2 border-[#1C2E3A] bg-white py-2.5 text-sm font-bold text-[#1C2E3A] transition hover:bg-[#f4efe6]"
                >
                  {q.insiderModalClose}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
