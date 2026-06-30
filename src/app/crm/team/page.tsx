'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Crown, Loader2, Mail, Phone, Plus, Shield, UserRound, X } from 'lucide-react';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import { hasCrmAdminAccess, isEmployeeAdminRole } from '@/lib/crm-roles';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';
import { supabase } from '@/lib/supabase';

type EmployeeRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone_wa: string | null;
  role: string | null;
  created_at: string | null;
};

function randomTempPassword() {
  const base = Math.random().toString(36).slice(2, 8);
  const num = Math.floor(Math.random() * 900 + 100);
  return `Wanderloom!${base}${num}`;
}

export default function CrmTeamPage() {
  const {
    employee: currentEmployee,
    authEmail,
    loading: loadingCurrent,
    reload: reloadEmployee,
  } = useCrmEmployee();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneWa, setPhoneWa] = useState('');
  const [role, setRole] = useState<'Admin' | 'Advisor'>('Advisor');

  const isAdmin = useMemo(
    () => hasCrmAdminAccess(currentEmployee?.role ?? null, authEmail),
    [currentEmployee?.role, authEmail],
  );

  const loadEmployees = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setNotice({ type: 'err', text: 'قاعدة البيانات غير مهيأة.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, user_id, full_name, email, phone_wa, role, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as EmployeeRow[]);
    } catch (e) {
      console.error(e);
      setNotice({ type: 'err', text: e instanceof Error ? e.message : 'تعذر تحميل بيانات الفريق.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadingCurrent && isAdmin) void loadEmployees();
    if (!loadingCurrent && !isAdmin) setLoading(false);
  }, [isAdmin, loadEmployees, loadingCurrent]);

  function resetForm() {
    setFullName('');
    setEmail('');
    setPhoneWa('');
    setRole('Advisor');
    setCreatedPassword(null);
  }

  async function createEmployee() {
    if (!supabase) return;
    const n = fullName.trim();
    const em = email.trim().toLowerCase();
    if (!n || !em) {
      setNotice({ type: 'err', text: 'يرجى إدخال الاسم والإيميل.' });
      return;
    }

    setCreating(true);
    setNotice(null);
    setCreatedPassword(null);

    const tempPassword = randomTempPassword();
    try {
      const isolatedAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: authData, error: authErr } = await isolatedAuthClient.auth.signUp({
        email: em,
        password: tempPassword,
      });
      if (authErr) throw authErr;

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('تعذر إنشاء مستخدم Auth. تأكد من إعدادات Supabase Auth.');
      }

      const { error: insertErr } = await supabase.from('employees').insert({
        user_id: userId,
        full_name: n,
        email: em,
        phone_wa: phoneWa.trim() || null,
        role,
        job_title: role === 'Admin' ? 'CRM Admin' : 'Travel Advisor',
      });
      if (insertErr) throw insertErr;

      await loadEmployees();
      setCreatedPassword(tempPassword);
      setNotice({ type: 'ok', text: 'تم إنشاء حساب الموظف وحفظ بياناته بنجاح.' });
      resetForm();
      setModalOpen(false);
    } catch (e) {
      console.error(e);
      setNotice({
        type: 'err',
        text: e instanceof Error ? e.message : 'فشل إنشاء الموظف. تحقق من صلاحيات Auth/RLS.',
      });
    } finally {
      setCreating(false);
    }
  }

  async function updateEmployeeRole(row: EmployeeRow, nextRole: 'Admin' | 'Advisor') {
    if (!supabase) return;
    if (nextRole === 'Admin' && isEmployeeAdminRole(row.role)) return;
    if (nextRole === 'Advisor' && !isEmployeeAdminRole(row.role)) return;
    setRoleUpdatingId(row.id);
    setNotice(null);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          role: nextRole,
          job_title: nextRole === 'Admin' ? 'CRM Admin' : 'Travel Advisor',
        })
        .eq('id', row.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, role: nextRole } : r)));
      setNotice({ type: 'ok', text: 'تم تحديث دور الموظف.' });
      if (currentEmployee?.id === row.id) await reloadEmployee();
    } catch (e) {
      console.error(e);
      setNotice({ type: 'err', text: e instanceof Error ? e.message : 'تعذر تحديث الدور.' });
    } finally {
      setRoleUpdatingId(null);
    }
  }

  if (loadingCurrent) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
        <Shield className="mx-auto mb-3 h-10 w-10" />
        <h1 className="text-xl font-black">صلاحية غير كافية</h1>
        <p className="mt-2 text-sm font-semibold">هذه الصفحة مخصصة للمدير فقط (Admin).</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-slate-800 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-7 text-white shadow-[0_18px_50px_rgba(2,6,23,0.28)] sm:p-9">
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.35em] text-amber-200/90">
            <Crown className="h-4 w-4" />
            Team Management
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">إدارة فريق العمل</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">إدارة حسابات موظفي CRM وتحديد الأدوار داخل النظام.</p>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-900 transition hover:bg-amber-300"
          >
            <Plus className="h-4 w-4" />
            إضافة موظف جديد
          </button>
        </div>

        {notice ? (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
              notice.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {notice.text}
          </div>
        ) : null}
        {createdPassword ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-black">كلمة المرور المؤقتة للموظف:</p>
            <p className="mt-1 font-mono font-bold">{createdPassword}</p>
            <p className="mt-1 text-xs font-semibold">يرجى مشاركتها مع الموظف وتغييرها بعد أول دخول.</p>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">لا يوجد موظفون بعد.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  <UserRound className="h-5 w-5 text-slate-700" />
                </div>
                <h2 className="text-base font-black text-slate-900">{r.full_name}</h2>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Mail className="h-3.5 w-3.5" />
                  {r.email || '—'}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Phone className="h-3.5 w-3.5" />
                  {r.phone_wa || '—'}
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                    isEmployeeAdminRole(r.role)
                      ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                      : 'bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200'
                  }`}
                >
                  {isEmployeeAdminRole(r.role) ? 'Admin' : 'Advisor'}
                </span>
                <label className="mt-4 block text-xs font-black text-slate-600">تغيير الدور</label>
                <select
                  value={isEmployeeAdminRole(r.role) ? 'Admin' : 'Advisor'}
                  disabled={roleUpdatingId === r.id}
                  onChange={(e) => void updateEmployeeRole(r, e.target.value as 'Admin' | 'Advisor')}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/15 disabled:opacity-50"
                >
                  <option value="Advisor">Advisor</option>
                  <option value="Admin">Admin</option>
                </select>
              </article>
            ))}
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => !creating && setModalOpen(false)}
              className="absolute left-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-4 text-lg font-black text-slate-900">إضافة موظف جديد</h3>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-black text-slate-600">الاسم</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="مثال: أحمد فهد"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black text-slate-600">الإيميل</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="advisor@wanderloom.com"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black text-slate-600">الجوال</span>
                <input
                  value={phoneWa}
                  onChange={(e) => setPhoneWa(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="05xxxxxxxx"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black text-slate-600">الدور</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'Admin' | 'Advisor')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="Advisor">Advisor</option>
                  <option value="Admin">Admin</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={creating}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void createEmployee()}
                disabled={creating}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {creating ? 'جارٍ الإنشاء...' : 'حفظ الموظف'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
