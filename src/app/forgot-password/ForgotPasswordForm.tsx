'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react';

import { supabase } from '@/lib/supabase';

function siteOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return (
    String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '') ||
    'https://wanderloom-travel.vercel.app'
  );
}

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const redirectTo = useMemo(
    () => `${siteOrigin()}/update-password`,
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError('الخدمة غير مهيأة. أضف مفاتيح Supabase في البيئة.');
      return;
    }
    const em = email.trim().toLowerCase();
    if (!em || !em.includes('@')) {
      setError('يرجى إدخال بريد إلكتروني صالح.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo,
      });
      if (resetErr) {
        setError(resetErr.message || 'تعذر إرسال رابط إعادة التعيين.');
        return;
      }
      setSent(true);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-[#1e3f20]">نسيت كلمة المرور؟</h1>
        <p className="mt-3 text-sm font-semibold text-gray-600">
          أدخل بريدك وسنرسل رابطاً آمناً لتعيين كلمة مرور جديدة.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-[2rem] border border-[#1e3f20]/10 bg-white p-8 shadow-lg shadow-[#1e3f20]/5"
      >
        {sent ? (
          <div className="space-y-4 text-right">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
              تم إرسال الرابط إلى بريدك إن كان مسجّلاً في النظام. تحقق من صندوق الوارد
              والبريد غير المرغوب.
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#cda04c] py-3.5 text-sm font-black text-white"
            >
              العودة لتسجيل الدخول
            </button>
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                {error}
              </div>
            ) : null}

            <label className="mb-8 block text-right">
              <span className="mb-2 flex items-center gap-2 text-xs font-black text-gray-600">
                <Mail className="h-3.5 w-3.5 text-[#cda04c]" />
                البريد الإلكتروني
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-[#1e3f20]/15 bg-[#FDFBF7] px-4 py-3.5 text-sm outline-none ring-[#cda04c]/20 focus:ring-2"
                placeholder="name@wanderloom.com"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#cda04c] py-4 text-sm font-black text-white disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  جارٍ الإرسال...
                </>
              ) : (
                'إرسال رابط إعادة التعيين'
              )}
            </button>
          </>
        )}
      </form>

      <Link
        href="/login"
        className="mt-8 inline-flex items-center justify-center gap-2 text-sm font-bold text-[#9a7b45] hover:text-[#1e3f20]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة لتسجيل الدخول
      </Link>
    </div>
  );
}
