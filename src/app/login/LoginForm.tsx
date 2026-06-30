'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Crown, Loader2, Lock, Mail, Sparkles } from 'lucide-react';

import { supabase } from '@/lib/supabase';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const n = searchParams.get('next');
    if (n && n.startsWith('/crm') && !n.includes('//')) return n;
    return '/crm/itineraries';
  }, [searchParams]);

  const urlConfigError = useMemo(() => {
    if (searchParams.get('error') === 'supabase_config') {
      return 'تعذر فتح لوحة CRM: مفاتيح Supabase غير مضبوطة على الخادم (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).';
    }
    return null;
  }, [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError('الخدمة غير مهيأة. أضف مفاتيح Supabase في البيئة.');
      return;
    }
    const em = email.trim();
    if (!em || !password) {
      setError('يرجى إدخال البريد وكلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: em,
        password,
      });
      if (signErr) {
        setError(signErr.message || 'فشل تسجيل الدخول.');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('تعذر التحقق من الجلسة بعد تسجيل الدخول.');
        return;
      }

      const { data: employee, error: empErr } = await supabase
        .from('employees')
        .select('id, full_name, role, job_title')
        .eq('user_id', user.id)
        .maybeSingle();

      if (empErr) {
        console.error(empErr);
      }
      if (typeof window !== 'undefined') {
        if (employee) {
          window.sessionStorage.setItem('wanderloom_employee', JSON.stringify(employee));
        } else {
          window.sessionStorage.removeItem('wanderloom_employee');
        }
      }

      router.replace(nextPath);
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
      <div className="mb-10 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#cda04c]/30 bg-[#cda04c]/10 shadow-lg shadow-[#cda04c]/10">
          <Crown className="h-10 w-10 text-[#cda04c]" strokeWidth={1.25} />
        </div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.45em] text-[#1e3f20]/80">Wanderloom</p>
        <h1 className="bg-gradient-to-l from-[#1e3f20] via-[#cda04c] to-[#9a7b45] bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          بوابة الموظفين
        </h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-600">
          دخول آمن إلى نظام إدارة الرحلات — للاستخدام الداخلي فقط.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-[2rem] border border-[#1e3f20]/10 bg-white p-8 shadow-lg shadow-[#1e3f20]/5 sm:p-10"
      >
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#cda04c]/20 bg-[#cda04c]/5 px-4 py-3 text-xs font-bold text-[#9a7b45]">
          <Sparkles className="h-4 w-4 shrink-0 text-[#cda04c]" />
          تسجيل الدخول عبر Supabase Auth
        </div>

        {error || urlConfigError ? (
          <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
            {error ?? urlConfigError}
          </div>
        ) : null}

        <label className="mb-5 block text-right">
          <span className="mb-2 flex items-center gap-2 text-xs font-black text-gray-600">
            <Mail className="h-3.5 w-3.5 text-[#cda04c]" />
            البريد الإلكتروني
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-[#1e3f20]/15 bg-[#FDFBF7] px-4 py-3.5 text-sm text-[#111111] outline-none ring-[#cda04c]/20 placeholder:text-gray-400 focus:ring-2"
            placeholder="name@wanderloom.com"
          />
        </label>

        <label className="mb-8 block text-right">
          <span className="mb-2 flex items-center gap-2 text-xs font-black text-gray-600">
            <Lock className="h-3.5 w-3.5 text-[#cda04c]" />
            كلمة المرور
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-[#1e3f20]/15 bg-[#FDFBF7] px-4 py-3.5 text-sm text-[#111111] outline-none ring-[#cda04c]/20 placeholder:text-gray-400 focus:ring-2"
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#cda04c] py-4 text-sm font-black text-white shadow-lg shadow-[#cda04c]/20 transition hover:bg-[#b3893d] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              جارٍ الدخول...
            </>
          ) : (
            'دخول النظام'
          )}
        </button>
      </form>

      <p className="mt-10 text-center text-[10px] font-bold uppercase tracking-[0.35em] text-gray-400">Internal · CRM</p>
    </div>
  );
}
