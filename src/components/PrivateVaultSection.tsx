'use client';

import React, { useId, useState } from 'react';

type PrivateVaultSectionProps = {
  children?: React.ReactNode;
};

export const PrivateVaultSection: React.FC<PrivateVaultSectionProps> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const pinPrefix = useId();

  const CORRECT_PIN = '2026';

  const focusBox = (index: number) => {
    document.getElementById(`${pinPrefix}-vault-pin-${index}`)?.focus();
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

  return (
    <section className="mx-auto my-8 w-full max-w-4xl rounded-3xl border border-[#EADBCC] bg-white/80 p-6 shadow-sm">
      <style>{`
        @keyframes vault-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes vault-fade-in {
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
              الخزنة الخاصة (Private Vault)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              مساحتك الخاصة المشفرة برمز PIN – محفوفة بالخصوصية المطلقة حتى عن فريق المنصة.
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
          {isUnlocked ? '🔓 الخزنة مفتوحة' : '🔒 الخزنة مقفلة'}
        </span>
      </div>

      {!isUnlocked ? (
        <div className="mx-auto max-w-md space-y-5 rounded-2xl border border-amber-200/60 bg-[#F8F5EE] px-6 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1B242F] text-2xl text-amber-400 shadow-md">
            🗝️
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1B242F]">أدخل رمز الأمان الخاص بك</h3>
            <p className="mt-1 text-xs text-slate-500">
              أدخل رمز الـ PIN المكون من 4 أرقام لفتح الخزنة
            </p>
          </div>

          <div className="flex justify-center gap-3" dir="ltr">
            {pin.map((digit, idx) => (
              <input
                key={idx}
                id={`${pinPrefix}-vault-pin-${idx}`}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinInput(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                aria-label={`رقم ${idx + 1} من رمز الأمان`}
                className={`h-14 w-12 rounded-xl border bg-white text-center font-mono text-lg font-bold shadow-sm outline-none transition-all ${
                  pinError
                    ? 'border-red-500 bg-red-50 text-red-600'
                    : 'border-slate-300 text-[#1B242F] focus:border-[#BA8E48]'
                }`}
                style={pinError ? { animation: 'vault-shake 0.35s ease' } : undefined}
              />
            ))}
          </div>

          {pinError ? (
            <p className="text-xs font-bold text-red-600">
              ⚠️ الرمز غير صحيح، حاول مرة أخرى (الرمز التجريبي: 2026)
            </p>
          ) : null}

          <p className="text-[11px] text-slate-400">
            🔒 تشفير متكامل لحماية خصوصية بياناتك ورحلاتك.
          </p>
        </div>
      ) : (
        <div className="space-y-6 py-4" style={{ animation: 'vault-fade-in 0.35s ease' }}>
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-[#F8F5EE] p-6 text-right">
            <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              محتوى الخزنة الخاص
            </span>
            <h3 className="text-xl font-bold text-[#1B242F]">أرشيف الرحلات والمستندات المحمية</h3>
            <p className="text-xs leading-relaxed text-slate-600">
              هنا تظهر كافة التفاصيل، الملاحظات الشخصية، وتأكيدات الحجز الخاصة بك التي تم قفلها بنجاح عن أي زائر أو موظف.
            </p>
          </div>

          {children}

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
              🔒 إغلاق وقفل الخزنة مجدداً
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default PrivateVaultSection;
