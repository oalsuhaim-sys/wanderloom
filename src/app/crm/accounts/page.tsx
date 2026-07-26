'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import {
  createExpertAccountAction,
  deleteAccountAction,
  listAccountsAction,
  syncOldExpertAccountsAction,
  type AccountRow,
} from '@/app/actions/accountsActions';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { EXPERT_DEFAULT_PASSWORD } from '@/lib/expert-auth-constants';

export default function AccountsManagementClient() {
  const { profileAccess, authUserId, loading: loadingSession } = useCrmEmployee();
  const isAdmin = Boolean(profileAccess?.is_admin);

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getClientAccessToken();
      const result = await listAccountsAction(token);
      if (!result.ok) {
        toast.error(result.error);
        setRows([]);
        return;
      }
      setRows(result.data ?? []);
    } catch (err) {
      console.error(err);
      toast.error('تعذر تحميل الحسابات.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loadingSession) return;
    if (!isAdmin) return;
    void load();
  }, [loadingSession, isAdmin, load]);

  async function handleCreateExpert(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const token = await getClientAccessToken();
      const result = await createExpertAccountAction({
        full_name: name,
        email,
        access_token: token,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.message ||
          `تم إنشاء الخبير. كلمة المرور الافتراضية: ${EXPERT_DEFAULT_PASSWORD}`,
      );
      setModalOpen(false);
      setName('');
      setEmail('');
      await load();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إنشاء الخبير.');
    } finally {
      setCreating(false);
    }
  }

  async function handleBulkSync() {
    const ok = window.confirm(
      `مزامنة الحسابات القديمة؟\nسيتم إنشاء Auth للخبراء الذين لديهم بريد، بكلمة المرور ${EXPERT_DEFAULT_PASSWORD}.\nالحسابات الموجودة مسبقاً تُتخطى.`,
    );
    if (!ok) return;

    setSyncing(true);
    const toastId = toast.loading('جاري توليد الحسابات...');
    try {
      const token = await getClientAccessToken();
      const result = await syncOldExpertAccountsAction(token);
      if (!result.ok) {
        toast.error(result.error, { id: toastId });
        return;
      }
      const stats = result.data;
      toast.success(
        result.message ||
          `تم: ${stats?.created ?? 0} جديد · ${stats?.reused ?? 0} موجود · ${stats?.failed ?? 0} فشل`,
        { id: toastId, duration: 6000 },
      );
      await load();
    } catch (err) {
      console.error(err);
      toast.error('تعذر إكمال مزامنة الحسابات.', { id: toastId });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(row: AccountRow) {
    if (!row.user_id) {
      toast.error('معرّف Auth مفقود لهذا الحساب.');
      return;
    }
    if (row.user_id === authUserId) {
      toast.error('لا يمكنك حذف حسابك الحالي.');
      return;
    }
    const ok = window.confirm(
      `حذف حساب «${row.full_name}» نهائياً من النظام وAuth؟ لا يمكن التراجع.`,
    );
    if (!ok) return;

    setDeletingId(row.user_id);
    try {
      const token = await getClientAccessToken();
      const result = await deleteAccountAction(row.user_id, token);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message || 'تم حذف الحساب.');
      setRows((prev) => prev.filter((r) => r.user_id !== row.user_id));
    } catch (err) {
      console.error(err);
      toast.error('تعذر حذف الحساب.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loadingSession) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#C5A059]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
        <p className="text-sm font-black text-rose-800">غير مصرح — إدارة الحسابات للمدير فقط.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6" dir="rtl">
      <Toaster position="top-center" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C5A059]">
            RBAC · Admin
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-[#1A3B2A]">
            <Users className="h-7 w-7 text-[#C5A059]" />
            إدارة الحسابات
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            إنشاء وحذف حسابات الخبراء والموظفين — كلمة المرور الافتراضية للخبير:{' '}
            <span className="font-mono text-[#1A3B2A]">{EXPERT_DEFAULT_PASSWORD}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleBulkSync()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            title="أداة مؤقتة — توليد Auth للخبراء القدامى"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            مزامنة الحسابات القديمة
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#b3893d]"
          >
            <UserPlus className="h-4 w-4" />
            إضافة خبير
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-[#C5A059]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm font-bold text-slate-500">
            لا توجد حسابات بعد.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black text-slate-500">
                <tr>
                  <th className="px-4 py-3">الاسم</th>
                  <th className="px-4 py-3">البريد</th>
                  <th className="px-4 py-3">الدور</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.user_id || row.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-bold text-slate-800">{row.full_name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600" dir="ltr">
                      {row.email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
                          row.is_admin
                            ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                            : row.is_expert
                              ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-200'
                              : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                        }`}
                      >
                        {row.is_admin ? (
                          <>
                            <Shield className="h-3 w-3" /> مدير
                          </>
                        ) : row.is_expert ? (
                          'خبير'
                        ) : (
                          row.role || 'موظف'
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold">
                      {row.is_suspended ? (
                        <span className="text-rose-600">موقوف</span>
                      ) : (
                        <span className="text-emerald-700">نشط</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={
                          deletingId === row.user_id || row.user_id === authUserId
                        }
                        onClick={() => void handleDelete(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-40"
                      >
                        {deletingId === row.user_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-[#1A3B2A]">إضافة خبير</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleCreateExpert(e)} className="space-y-4 text-right">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-slate-500">الاسم</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[#C5A059]/30"
                  placeholder="اسم الخبير"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-slate-500">البريد</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[#C5A059]/30"
                  placeholder="expert@wanderloom.com"
                  dir="ltr"
                />
              </label>
              <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">
                يُنشأ الحساب بكلمة المرور الافتراضية{' '}
                <span className="font-mono">{EXPERT_DEFAULT_PASSWORD}</span> ويمكن للخبير تغييرها
                عبر نسيت كلمة المرور.
              </p>
              <button
                type="submit"
                disabled={creating}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C5A059] py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جارٍ الإنشاء...
                  </>
                ) : (
                  'إنشاء حساب الخبير'
                )}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
