'use client';

import React, { useId, useState } from 'react';

export interface SouvenirCardProps {
  destination: string;
  dateRange: string;
  tripId: string;
  stampText?: string;
}

const DEMO_CARDS: SouvenirCardProps[] = [
  {
    destination: 'بودابست · المجر',
    dateRange: '١٤ أغسطس ٢٠٢٦ – ١٨ سبتمبر ٢٠٢٦',
    tripId: 'VIP-BUD-002',
    stampText: 'معتمد من Wanderloom',
  },
  {
    destination: 'طوكيو · اليابان',
    dateRange: '١٠ إبريل ٢٠٢٦ – ٢٤ إبريل ٢٠٢٦',
    tripId: 'VIP-TYO-001',
    stampText: 'رحلة الخريف الكلاسيكية',
  },
];

type SouvenirVaultSectionProps = {
  cards?: SouvenirCardProps[];
};

export const SouvenirVaultSection: React.FC<SouvenirVaultSectionProps> = ({ cards }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const pinPrefix = useId();

  const CORRECT_PIN = '2026';
  const souvenirCards = cards ?? DEMO_CARDS;

  const focusBox = (index: number) => {
    const nextInput = document.getElementById(`${pinPrefix}-pin-${index}`);
    nextInput?.focus();
  };

  const commitPin = (nextPin: string[]) => {
    setPin(nextPin);
    setPinError(false);
    if (nextPin.every((digit) => digit !== '')) {
      if (nextPin.join('') === CORRECT_PIN) {
        setIsUnlocked(true);
      } else {
        setPinError(true);
      }
    }
  };

  const handlePinInput = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    if (value && !digit) return;
    const newPin = [...pin];
    newPin[index] = digit;
    commitPin(newPin);
    if (digit && index < 3) focusBox(index + 1);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !pin[index] && index > 0) {
      const newPin = [...pin];
      newPin[index - 1] = '';
      commitPin(newPin);
      focusBox(index - 1);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length < 2) return;
    event.preventDefault();
    const newPin = ['', '', '', ''];
    pasted.split('').forEach((digit, index) => {
      newPin[index] = digit;
    });
    commitPin(newPin);
    focusBox(Math.min(pasted.length, 3));
  };

  return (
    <section className="mx-auto my-8 w-full max-w-5xl rounded-3xl border border-[#EADBCC] bg-white/80 p-6 shadow-sm">
      <style>{`
        @keyframes souvenir-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes souvenir-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-lg">
            🔒
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#1B242F]">
              الخزنة الخاصة · أرشيف التذكارات الرقمية
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              بطاقات سينمائية موثقة آلياً لرحلاتك الفاخرة – مشفرة ومحفوفة بالخصوصية المطلقة.
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
            isUnlocked
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {isUnlocked ? '🔓 الخزنة مفتوحة' : '🔒 الخزنة مقفلة برمز PIN'}
        </span>
      </div>

      {!isUnlocked ? (
        <div className="mx-auto max-w-md space-y-5 rounded-2xl border border-amber-200/60 bg-[#F8F5EE] px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1B242F] text-2xl text-amber-400 shadow-md">
            🗝️
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1B242F]">أدخل رمز الأمان الخاص بك</h3>
            <p className="mt-1 text-xs text-slate-500">
              أدخل رمز الـ PIN لتأكيد ملكيتك واستعراض بطاقات التذكارات الرقمية
            </p>
          </div>

          <div className="flex justify-center gap-3" dir="ltr">
            {pin.map((digit, idx) => (
              <input
                key={idx}
                id={`${pinPrefix}-pin-${idx}`}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinInput(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                aria-label={`رقم ${idx + 1} من رمز الأمان`}
                className={`h-14 w-12 rounded-xl border bg-white text-center font-mono text-lg font-bold shadow-sm outline-none transition-all ${
                  pinError
                    ? 'border-red-500 bg-red-50 text-red-600'
                    : 'border-slate-300 text-[#1B242F] focus:border-[#BA8E48]'
                }`}
                style={pinError ? { animation: 'souvenir-shake 0.35s ease' } : undefined}
              />
            ))}
          </div>

          {pinError ? (
            <p className="text-xs font-bold text-red-600">
              ⚠️ الرمز غير صحيح، حاول مرة أخرى (الرمز التجريبي: 2026)
            </p>
          ) : null}

          <p className="text-[11px] text-slate-400">
            🔒 محتوى هذه الخزنة لا يمكن الوصول إليه حتى من قِبل موظفي وفريق المنصة.
          </p>
        </div>
      ) : (
        <div className="space-y-6" style={{ animation: 'souvenir-fade-in 0.35s ease' }}>
          {souvenirCards.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {souvenirCards.map((card) => (
                <SouvenirCard key={card.tripId} {...card} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-amber-200 bg-[#F8F5EE] px-6 py-10 text-center text-sm font-semibold text-slate-500">
              لا توجد بطاقات تذكارية بعد. تظهر هنا بعد اكتمال رحلاتك.
            </p>
          )}

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setIsUnlocked(false);
                setPin(['', '', '', '']);
                setPinError(false);
              }}
              className="rounded-full border border-slate-300 px-5 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-100"
            >
              🔒 قفل الخزنة الخاصة مجدداً
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

const SouvenirCard: React.FC<SouvenirCardProps> = ({
  destination,
  dateRange,
  tripId,
  stampText = 'WANDERLOOM CERTIFIED',
}) => {
  return (
    <div className="group relative flex h-64 flex-col justify-between overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#1B242F] to-[#0D131A] p-6 text-white shadow-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#BA8E48_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />

      <div className="z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg font-bold text-amber-400">Wanderloom</span>
          <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-200/80">
            Souvenir Card
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">{tripId}</span>
      </div>

      <div className="z-10 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/70">
          Destination
        </p>
        <h3 className="text-2xl font-bold leading-snug text-white">{destination}</h3>
        <p className="text-xs font-medium text-slate-300">{dateRange}</p>
      </div>

      <div className="z-10 flex items-end justify-between gap-3">
        <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] font-bold text-amber-200">
          {stampText}
        </span>
        <span className="text-[10px] tracking-[0.2em] text-white/35">CERTIFIED</span>
      </div>
    </div>
  );
};
