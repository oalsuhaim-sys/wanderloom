'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';

import { supabase } from '@/lib/supabase';

export default function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      setError('الخدمة غير مهيأة.');
      return;
    }

    let cancelled = false;
    void (async () => {
      // Recovery links establish a session via URL hash / code exchange
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setReady(true);
      } else {
        setError('رابط إعادة التعيين غير صالح أو منتهٍ. اطلب رابطاً جديداً من صفحة نسيت كلمة المرور.');
      }
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true);
        setError(null);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError('الخدمة غير مهيأة.');
      return;
    }
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
      return;
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message || 'تعذر تحديث كلمة المرور.');
        return;
      }
      router.replace('/crm/itineraries');
      router.refresh();
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
        <h1 className="text-3xl font-black text-[#1e3f20]">تعيين كلمة مرور جديدة</h1>
        <p className="mt-3 text-sm font-semibold text-gray-600">
          غيّر كلمة المرور الافتراضية إلى كلمة خاصة بك.
        </p>
      </div>

      <div className="rounded-[2rem] border border-[#1e3f20]/10 bg-white p-8 shadow-lg">
        {checking ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-[#cda04c]" />
          </div>
        ) : !ready ? (
          <div className="space-y-4 text-right">
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
              {error || 'الجلسة غير جاهزة لتحديث كلمة المرور.'}
            </p>
            <Link
              href="/forgot-password"
              className="block text-center text-sm font-black text-[#cda04c]"
            >
              طلب رابط جديد
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 text-right">
            {error ? (
              <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                {error}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black text-gray-600">
                <Lock className="h-3.5 w-3.5 text-[#cda04c]" />
                كلمة المرور الجديدة
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-[#1e3f20]/15 bg-[#FDFBF7] px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-[#cda04c]/30"
                placeholder="••••••••"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black text-gray-600">
                <Lock className="h-3.5 w-3.5 text-[#cda04c]" />
                تأكيد كلمة المرور
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-2xl border border-[#1e3f20]/15 bg-[#FDFBF7] px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-[#cda04c]/30"
                placeholder="••••••••"
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
                  جارٍ الحفظ...
                </>
              ) : (
                'حفظ كلمة المرور'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
