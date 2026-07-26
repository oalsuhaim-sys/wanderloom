'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Crown, Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { accessFromEmployeeRow, defaultCrmLandingPath, FULL_CRM_PERMISSIONS } from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
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

  const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

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

      console.log('Auth Debug - Email:', user?.email);

      const normalizedEmail = user.email?.trim().toLowerCase() ?? '';
      if (isEmergencyCrmOwnerBypass(normalizedEmail)) {
        console.log('Auth Debug - Emergency owner bypass on login');
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(
            'wanderloom_profile',
            JSON.stringify({
              is_admin: true,
              is_expert: false,
              is_suspended: false,
              permissions: { ...FULL_CRM_PERMISSIONS },
            }),
          );
        }
        router.replace(nextPath);
        router.refresh();
        return;
      }

      let employeeResult = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!employeeResult.data && normalizedEmail) {
        employeeResult = await supabase
          .from('employees')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();
      }

      console.log('Auth Debug - DB Result:', employeeResult.data);

      if (employeeResult.error) {
        console.error(employeeResult.error);
      }
      if (typeof window !== 'undefined') {
        const row = employeeResult.data;
        if (row) {
          window.sessionStorage.setItem(
            'wanderloom_employee',
            JSON.stringify({
              id: row.id,
              full_name: row.full_name,
              role: row.role,
              job_title: row.job_title,
            }),
          );
          const access = accessFromEmployeeRow(row, user.email);
          window.sessionStorage.setItem('wanderloom_profile', JSON.stringify(access));
          router.replace(
            nextPath !== '/crm/itineraries' && nextPath.startsWith('/crm')
              ? nextPath
              : defaultCrmLandingPath(access),
          );
          router.refresh();
          return;
        }
        window.sessionStorage.removeItem('wanderloom_employee');
        window.sessionStorage.removeItem('wanderloom_profile');
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

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError('الخدمة غير مهيأة. أضف مفاتيح Supabase في البيئة.');
      return;
    }
    const em = resetEmail.trim().toLowerCase();
    if (!em || !em.includes('@')) {
      setError('يرجى إدخال بريد إلكتروني صالح.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (resetErr) throw resetErr;
      toast.success('تم إرسال رابط تعديل الرقم السري إلى بريدك الإلكتروني بنجاح.');
      setIsForgotPasswordView(false);
      setResetEmail('');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إرسال الرابط. تأكد من صحة الإيميل.');
      setError('حدث خطأ أثناء إرسال الرابط. تأكد من صحة الإيميل.');
    } finally {
      setLoading(false);
    }
  }

  function openForgotPasswordView() {
    setError(null);
    setResetEmail(email.trim());
    setIsForgotPasswordView(true);
  }

  function backToLoginView() {
    setError(null);
    setIsForgotPasswordView(false);
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <Toaster position="top-center" />
      <div className="mb-10 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#cda04c]/30 bg-[#cda04c]/10 shadow-lg shadow-[#cda04c]/10">
          <Crown className="h-10 w-10 text-[#cda04c]" strokeWidth={1.25} />
        </div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.45em] text-[#1e3f20]/80">Wanderloom</p>
        <h1 className="bg-gradient-to-l from-[#1e3f20] via-[#cda04c] to-[#9a7b45] bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          {isForgotPasswordView ? 'استعادة كلمة المرور' : 'بوابة الموظفين'}
        </h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-600">
          {isForgotPasswordView
            ? 'أدخل بريدك وسنرسل رابطاً آمناً لتعيين كلمة مرور جديدة.'
            : 'دخول آمن إلى نظام إدارة الرحلات — للاستخدام الداخلي فقط.'}
        </p>
      </div>

      {isForgotPasswordView ? (
        <form
          onSubmit={(e) => void handleResetPassword(e)}
          className="rounded-[2rem] border border-[#1e3f20]/10 bg-white p-8 shadow-lg shadow-[#1e3f20]/5 sm:p-10"
        >
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#cda04c]/20 bg-[#cda04c]/5 px-4 py-3 text-xs font-bold text-[#9a7b45]">
            <Mail className="h-4 w-4 shrink-0 text-[#cda04c]" />
            إرسال رابط الاستعادة عبر البريد
          </div>

          {error || urlConfigError ? (
            <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
              {error ?? urlConfigError}
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
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="w-full rounded-2xl border border-[#1e3f20]/15 bg-[#FDFBF7] px-4 py-3.5 text-sm text-[#111111] outline-none ring-[#cda04c]/20 placeholder:text-gray-400 focus:ring-2"
              placeholder="name@wanderloom.com"
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
                جارٍ الإرسال...
              </>
            ) : (
              'إرسال رابط الاستعادة'
            )}
          </button>

          <button
            type="button"
            onClick={backToLoginView}
            className="mt-5 w-full text-center text-xs font-black text-[#9a7b45] underline-offset-2 hover:text-[#1e3f20] hover:underline"
          >
            العودة لتسجيل الدخول
          </button>
        </form>
      ) : (
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

          <label className="mb-3 block text-right">
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

          <div className="mb-8 text-left">
            <button
              type="button"
              onClick={openForgotPasswordView}
              className="text-xs font-black text-[#9a7b45] underline-offset-2 hover:text-[#1e3f20] hover:underline"
            >
              نسيت الرقم السري؟
            </button>
          </div>

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
      )}

      <p className="mt-10 text-center text-[10px] font-bold uppercase tracking-[0.35em] text-gray-400">Internal · CRM</p>
    </div>
  );
}
