'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  CalendarHeart,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import { openInterestModal } from '@/app/_components/home/InterestModal';
import {
  CONCIERGE_CLOSING_CTA_AR,
  CONCIERGE_WELCOME_AR,
  type ConciergeChatMessage,
  type ConciergePreferences,
} from '@/lib/ai-concierge';

const STORAGE_ID = 'wanderloom_ai_concierge_id';
const STORAGE_PROFILE = 'wanderloom_ai_concierge_profile';
const STORAGE_VERIFIED = 'wanderloom_ai_concierge_verified';

type UiMessage = ConciergeChatMessage & { id: string };

type StoredProfile = {
  clientName?: string;
  userPhone?: string;
  userEmail?: string;
  isVerified?: boolean;
  verificationToken?: string;
  clientId?: number;
};

type OtpStep = 'identity' | 'otp';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toUiMessages(history: ConciergeChatMessage[]): UiMessage[] {
  return history.map((m) => ({ ...m, id: makeId() }));
}

function loadProfile(): StoredProfile {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PROFILE);
    if (!raw) return {};
    return JSON.parse(raw) as StoredProfile;
  } catch {
    return {};
  }
}

function saveProfile(profile: StoredProfile) {
  try {
    window.sessionStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

const fieldClass =
  'h-10 w-full rounded-xl border border-[#9C7A3C]/35 bg-white/80 px-3 text-xs font-bold text-[#1C2E3A] outline-none transition focus:border-[#9C7A3C] focus:ring-2 focus:ring-[#9C7A3C]/20';

export function AiConciergeWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [otpPending, setOtpPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<OtpStep>('identity');
  const [isVerified, setIsVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ConciergePreferences>({});
  const [showClosingCta, setShowClosingCta] = useState(false);
  const [closingCopy, setClosingCopy] = useState(CONCIERGE_CLOSING_CTA_AR);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: CONCIERGE_WELCOME_AR,
      at: new Date().toISOString(),
    },
  ]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_ID);
      if (saved) setConsultationId(saved);
      const profile = loadProfile();
      if (profile.clientName) setClientName(profile.clientName);
      if (profile.userPhone) setUserPhone(profile.userPhone);
      if (profile.userEmail) setUserEmail(profile.userEmail);
      if (profile.clientId) setClientId(profile.clientId);
      if (profile.isVerified && profile.verificationToken) {
        setIsVerified(true);
        setVerificationToken(profile.verificationToken);
        setOtpStep('identity');
      }
      const verifiedFlag = window.sessionStorage.getItem(STORAGE_VERIFIED);
      if (verifiedFlag === '1' && profile.verificationToken) {
        setIsVerified(true);
        setVerificationToken(profile.verificationToken);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    saveProfile({
      clientName: clientName.trim() || undefined,
      userPhone: userPhone.trim() || undefined,
      userEmail: userEmail.trim() || undefined,
      isVerified,
      verificationToken: verificationToken || undefined,
      clientId: clientId ?? undefined,
    });
    try {
      window.sessionStorage.setItem(STORAGE_VERIFIED, isVerified ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [clientName, userPhone, userEmail, isVerified, verificationToken, clientId]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, pending, open, showClosingCta, otpStep]);

  useEffect(() => {
    if (!open || !isVerified) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => window.clearTimeout(t);
  }, [open, isVerified]);

  useEffect(() => {
    if (!open || isVerified || otpStep !== 'otp') return;
    const t = window.setTimeout(() => otpRef.current?.focus(), 180);
    return () => window.clearTimeout(t);
  }, [open, isVerified, otpStep]);

  async function sendOtp() {
    const name = clientName.trim();
    const phone = userPhone.trim();
    if (!name || !phone) {
      setError('أدخل الاسم الكريم ورقم الواتساب لإرسال رمز التحقق.');
      return;
    }
    setError(null);
    setOtpHint(null);
    setOtpPending(true);
    try {
      const res = await fetch('/api/ai-concierge/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          clientName: name,
          userPhone: phone,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        phone?: string;
        simulated?: boolean;
        devCode?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'تعذّر إرسال رمز التحقق');
      }
      if (data.phone) setUserPhone(data.phone);
      setOtpStep('otp');
      setOtpCode('');
      if (data.devCode) {
        setOtpHint(`رمز تجريبي: ${data.devCode}`);
        setOtpCode(data.devCode);
      } else {
        setOtpHint(data.message || 'تم إرسال الرمز إلى واتسابك.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الرمز');
    } finally {
      setOtpPending(false);
    }
  }

  async function verifyOtp() {
    const code = otpCode.replace(/\D/g, '').slice(0, 4);
    if (code.length !== 4) {
      setError('أدخل رمز التحقق المكوّن من 4 أرقام.');
      return;
    }
    setError(null);
    setOtpPending(true);
    try {
      const res = await fetch('/api/ai-concierge/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          clientName: clientName.trim(),
          userPhone: userPhone.trim(),
          code,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        verificationToken?: string;
        clientId?: number | null;
        clientName?: string;
        userPhone?: string;
      };
      if (!res.ok || !data.ok || !data.verificationToken) {
        throw new Error(data.error || 'فشل التحقق من الرمز');
      }
      setVerificationToken(data.verificationToken);
      setIsVerified(true);
      if (data.clientId != null) setClientId(Number(data.clientId));
      if (data.clientName) setClientName(data.clientName);
      if (data.userPhone) setUserPhone(data.userPhone);
      setOtpHint(null);
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content: `تشرفنا بك${data.clientName ? ` يا ${data.clientName}` : ''}. تم تأكيد رقمك — يمكننا الآن هندسة لمحاتك الحسية بهدوء.`,
          at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحقق');
    } finally {
      setOtpPending(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || pending || !isVerified || !verificationToken) return;

    setError(null);
    setInput('');
    const userMsg: UiMessage = {
      id: makeId(),
      role: 'user',
      content: text,
      at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPending(true);

    try {
      const res = await fetch('/api/ai-concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: consultationId || undefined,
          message: text,
          clientName: clientName.trim() || undefined,
          userPhone: userPhone.trim() || undefined,
          userEmail: userEmail.trim() || undefined,
          verificationToken,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        needsVerification?: boolean;
        consultationId?: string;
        clientId?: number | null;
        reply?: string;
        conversation?: ConciergeChatMessage[];
        messages?: ConciergeChatMessage[];
        preferences?: ConciergePreferences;
        showClosingCta?: boolean;
        closingCta?: string | null;
        clientName?: string | null;
        userPhone?: string | null;
        userEmail?: string | null;
      };

      if (data.needsVerification || res.status === 401) {
        setIsVerified(false);
        setVerificationToken(null);
        setOtpStep('identity');
        throw new Error(data.error || 'يلزم إعادة التحقق من رقم الجوال');
      }

      if (!res.ok || !data.ok || !data.reply) {
        throw new Error(data.error || 'تعذّر إكمال الرد الآن');
      }

      if (data.consultationId) {
        setConsultationId(data.consultationId);
        try {
          window.sessionStorage.setItem(STORAGE_ID, data.consultationId);
        } catch {
          /* ignore */
        }
      }

      if (data.clientId != null) setClientId(Number(data.clientId));
      if (data.preferences) setPreferences(data.preferences);
      if (data.showClosingCta) {
        setShowClosingCta(true);
        if (data.closingCta) setClosingCopy(data.closingCta);
      }
      if (data.clientName) setClientName(data.clientName);
      if (data.userPhone) setUserPhone(data.userPhone);
      if (data.userEmail) setUserEmail(data.userEmail);

      const history = data.messages ?? data.conversation;
      if (Array.isArray(history) && history.length > 0) {
        setMessages(toUiMessages(history));
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content: data.reply!,
            at: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content:
            'عذراً، تعذّر الوصول للمستشار الآن. حاول مجدداً بعد لحظات، أو أكمل التحقق من رقمك.',
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isVerified) void sendMessage();
    }
  }

  const preferenceChips = [
    preferences.preferred_destination,
    preferences.travel_style,
    preferences.budget,
    preferences.target_date,
  ].filter(Boolean) as string[];

  const chatLocked = !isVerified;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-end p-4 sm:p-6">
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {open ? (
          <div
            className="flex h-[min(74dvh,600px)] w-[min(100vw-2rem,390px)] flex-col overflow-hidden rounded-3xl border border-[#1C2E3A]/12 bg-[#F4EFE6] shadow-[0_24px_60px_rgba(28,46,58,0.18)]"
            role="dialog"
            aria-label="مستشار السفر الذكي"
            dir="rtl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-[#1C2E3A]/10 bg-[#1C2E3A] px-4 py-3.5 text-[#F4EFE6]">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-black tracking-wide">
                  <Sparkles className="h-4 w-4 text-[#9C7A3C]" aria-hidden />
                  مستشار واندرلوم الفاخر
                </p>
                <p className="mt-1 text-[11px] font-medium text-[#F4EFE6]/70">
                  {isVerified
                    ? `موثّق · عميل Ai${clientId ? ` · #${clientId}` : ''}`
                    : 'يلزم تأكيد الاسم ورقم الواتساب'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-[#F4EFE6]/10 p-2 text-[#F4EFE6] transition hover:bg-[#F4EFE6]/20"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {!isVerified ? (
              <div className="border-b border-[#9C7A3C]/25 bg-[#F4EFE6] px-4 py-3">
                <p className="text-[11px] font-bold tracking-wide text-[#9C7A3C]">
                  بوابة الدخول
                </p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#1C2E3A]/65">
                  {otpStep === 'identity'
                    ? 'أدخل اسمك وواتسابك لإرسال رمز تحقق رباعي.'
                    : 'أدخل الرمز المكوّن من 4 أرقام لإطلاق المستشار.'}
                </p>

                {otpStep === 'identity' ? (
                  <div className="mt-3 grid gap-2">
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="الاسم الكريم"
                      className={fieldClass}
                      disabled={otpPending}
                    />
                    <input
                      type="tel"
                      dir="ltr"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      placeholder="WhatsApp"
                      className={`${fieldClass} text-left`}
                      disabled={otpPending}
                    />
                    <button
                      type="button"
                      onClick={() => void sendOtp()}
                      disabled={otpPending || !clientName.trim() || !userPhone.trim()}
                      className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1C2E3A] px-4 text-xs font-black text-[#F4EFE6] transition hover:bg-[#122029] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {otpPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      إرسال رمز التحقق
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2">
                    <input
                      ref={otpRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      dir="ltr"
                      maxLength={4}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      className={`${fieldClass} text-center text-lg tracking-[0.55em]`}
                      disabled={otpPending}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void verifyOtp();
                        }
                      }}
                    />
                    {otpHint ? (
                      <p className="text-[10px] font-semibold text-[#9C7A3C]">{otpHint}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void verifyOtp()}
                      disabled={otpPending || otpCode.replace(/\D/g, '').length !== 4}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1C2E3A] px-4 text-xs font-black text-[#F4EFE6] transition hover:bg-[#122029] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {otpPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      تأكيد الرمز
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('identity');
                        setOtpCode('');
                        setOtpHint(null);
                      }}
                      className="text-[10px] font-bold text-[#9C7A3C] transition hover:text-[#826533]"
                    >
                      تعديل الرقم / إعادة الإرسال
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-b border-[#1C2E3A]/8 px-4 py-2">
                <p className="text-[11px] font-bold text-[#1C2E3A]/75">
                  {clientName.trim()} · {userPhone.trim()}
                </p>
                {preferenceChips.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {preferenceChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-[#9C7A3C]/35 bg-white/80 px-2.5 py-0.5 text-[10px] font-bold text-[#1C2E3A]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm font-medium leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#1C2E3A] text-[#F4EFE6]'
                        : 'border border-[#1C2E3A]/10 bg-white/90 text-[#1C2E3A] shadow-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {pending ? (
                <div className="flex justify-end">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-[#1C2E3A]/10 bg-white/90 px-3.5 py-2.5 text-xs font-bold text-[#1C2E3A]/70">
                    <span className="flex gap-1" aria-hidden>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9C7A3C]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9C7A3C] [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9C7A3C] [animation-delay:300ms]" />
                    </span>
                    يكتب المستشار…
                  </div>
                </div>
              ) : null}

              {showClosingCta && !pending && isVerified ? (
                <div className="rounded-2xl border border-[#9C7A3C]/35 bg-white/90 p-3.5 shadow-sm">
                  <p className="text-[12px] font-bold leading-relaxed text-[#1C2E3A]">
                    {closingCopy}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <a
                      href="/#lead"
                      onClick={() => setOpen(false)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#9C7A3C] px-4 py-3 text-sm font-black text-[#F4EFE6] transition-all hover:bg-[#826533]"
                    >
                      <CalendarHeart className="h-4 w-4" aria-hidden />
                      حجز جلسة تصميم خاصة
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        openInterestModal();
                      }}
                      className="inline-flex w-full items-center justify-center rounded-full border border-[#9C7A3C] bg-transparent px-4 py-2.5 text-xs font-black text-[#9C7A3C] transition hover:bg-[#9C7A3C]/10"
                    >
                      تأكيد طلب التواصل
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="px-4 pb-1 text-[11px] font-bold text-rose-700">{error}</p>
            ) : null}

            <form
              className={`border-t border-[#1C2E3A]/10 bg-white/55 p-3 transition-opacity duration-300 ${
                chatLocked ? 'opacity-55' : 'opacity-100'
              }`}
              onSubmit={(e) => {
                e.preventDefault();
                if (isVerified) void sendMessage();
              }}
            >
              <div className="flex items-end gap-2">
                <div className="relative min-w-0 flex-1">
                  {chatLocked ? (
                    <Lock
                      className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-[#9C7A3C]/80"
                      aria-hidden
                    />
                  ) : null}
                  <textarea
                    ref={inputRef}
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={chatLocked || pending}
                    placeholder={
                      chatLocked
                        ? 'يرجى تأكيد رقم الجوال لتفعيل المستشار الذكي...'
                        : 'صف ذوقك أو وجهتك بهدوء…'
                    }
                    className={`max-h-28 min-h-[44px] w-full resize-none rounded-2xl border bg-[#F4EFE6] px-3 py-2.5 text-sm font-medium text-[#1C2E3A] outline-none transition placeholder:text-[#1C2E3A]/40 focus:ring-2 disabled:cursor-not-allowed ${
                      chatLocked
                        ? 'border-[#9C7A3C]/30 pe-3 ps-9 focus:border-[#9C7A3C]/40 focus:ring-[#9C7A3C]/10'
                        : 'border-[#1C2E3A]/15 focus:border-[#9C7A3C] focus:ring-[#9C7A3C]/25'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={chatLocked || pending || !input.trim()}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1C2E3A] text-[#F4EFE6] transition-all hover:bg-[#122029] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="إرسال"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : chatLocked ? (
                    <Lock className="h-4 w-4 text-[#9C7A3C]" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-[#1C2E3A] px-5 py-3 text-sm font-medium text-[#F4EFE6] shadow-[0_12px_28px_rgba(28,46,58,0.28)] transition-all hover:bg-[#122029]"
          aria-expanded={open}
          aria-label={open ? 'إغلاق مستشار السفر' : 'فتح مستشار السفر'}
        >
          {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4 text-[#9C7A3C]" />}
          <span>{open ? 'إغلاق' : 'مستشار السفر'}</span>
        </button>
      </div>
    </div>
  );
}
