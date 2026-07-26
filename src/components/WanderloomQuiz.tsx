'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Sparkles, X } from 'lucide-react';

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
      className={`wl-quiz-option flex w-full cursor-pointer items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-start transition-all duration-300 hover:bg-white hover:shadow-md ${
        checked
          ? 'is-selected border-[#C5A059] bg-[#FFFBF0] font-black text-[#111111] shadow-md'
          : 'font-bold text-[#111111]'
      }`}
    >
      <span
        className={`wl-quiz-option-mark flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
          checked
            ? 'border-[#C5A059] bg-[#C5A059] text-white'
            : 'border-gray-300 bg-transparent text-transparent'
        }`}
        aria-hidden
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span className="flex-1 leading-snug">{label}</span>
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
    <div className="isolate w-full bg-[#FDFBF7]" dir={dir}>
      <div className="mx-auto max-w-2xl px-2 text-center sm:px-0">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#cda04c]/30 bg-[#cda04c]/10 px-4 py-1.5 text-[11px] font-black tracking-wide text-[#9a7b45] sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {q.kicker}
        </p>
        <h2 className="mt-6 text-3xl font-black text-[#111111] sm:text-4xl">{q.title}</h2>
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
                      ? 'bg-[#1e3f20] text-white'
                      : done
                        ? 'border-2 border-[#1e3f20] text-[#1e3f20]'
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

        <div className="mb-8 h-1 overflow-hidden rounded-full bg-[#cda04c]/15">
          <div
            className="h-full rounded-full bg-gradient-to-l from-[#7a5f28] to-[#d4b87a] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {!finished && currentQuestion ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex w-full items-center justify-between gap-4">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-[#111111] shadow-sm transition hover:border-[#cda04c]/50 hover:bg-[#f4efe6]"
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
              <p className="text-[11px] font-black tracking-[0.25em] text-[#cda04c]">
                {q.questionLabel
                  .replace('{current}', String(step + 1))
                  .replace('{total}', String(totalSteps))}
              </p>
              <h3 className="text-xl font-black leading-relaxed text-[#111111] sm:text-2xl">
                {currentQuestion.prompt}
              </h3>
            </div>

            <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-4">
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
                className="relative z-[101] mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-[#FDFBF7] p-8 shadow-2xl"
                dir={dir}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="text-start">
                    <p className="text-[10px] font-black tracking-[0.3em] text-[#cda04c]">
                      {resultDestination.name}
                    </p>
                    <h3
                      id="quiz-persuasion-title"
                      className="mt-2 text-2xl font-bold leading-snug text-[#1e3f20] sm:text-3xl"
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
                    className="shrink-0 rounded-full border border-[#1e3f20]/20 bg-white p-2 text-[#1e3f20] transition hover:bg-[#f4efe6]"
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
                        <span className="inline-flex rounded-full border border-[#cda04c]/35 bg-[#cda04c]/10 px-3 py-1 text-sm font-black text-[#1e3f20]">
                          {q.persuasionBasedOn} {item.userAnswer}
                        </span>
                      </div>
                      {item.destination ? (
                        <h4 className="text-lg font-black text-[#1e3f20]">{item.destination}</h4>
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
                  className="mt-6 w-full rounded-lg border-2 border-[#1e3f20] bg-white py-2.5 text-sm font-bold text-[#1e3f20] transition hover:bg-[#f4efe6]"
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
