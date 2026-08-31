'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import {
  createAccountAction,
  deleteAccountAction,
  listAccountsAction,
  syncOldExpertAccountsAction,
  updateAccountAction,
  type AccountCreateRole,
  type AccountRow,
} from '@/app/actions/accountsActions';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { EXPERT_DEFAULT_PASSWORD } from '@/lib/expert-auth-constants';
import {
  ACCOUNT_PERMISSION_OPTIONS,
  defaultPermissionsForAccountRole,
  type GranularPermissionKey,
  type CrmPermissions,
} from '@/lib/crm-permissions';

const ROLE_OPTIONS: { value: AccountCreateRole; label: string }[] = [
  { value: 'employee', label: 'موظف (مبيعات / عمليات)' },
  { value: 'expert', label: 'خبير / قائد رحلات' },
  { value: 'admin', label: 'مدير عام' },
];

function defaultPermissionsForRole(role: AccountCreateRole): CrmPermissions {
  return defaultPermissionsForAccountRole(role);
}

const FIELD_CLASS =
  'min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-500 focus:bg-white';

const FIELD_DISABLED_CLASS =
  'min-h-[44px] w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-500 outline-none';

const BTN_PRIMARY_GOLD =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-sm transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-50';

const BTN_PRIMARY_GOLD_FULL =
  'inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500 py-3 text-sm font-extrabold text-slate-950 shadow-sm transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-50';

const BTN_EDIT_SOFT =
  'flex cursor-pointer items-center gap-1 rounded-lg border border-amber-300/80 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 transition-all hover:bg-amber-100 disabled:opacity-40';

function roleBadgeClass(roleKey: AccountCreateRole): string {
  if (roleKey === 'employee') {
    return 'inline-flex items-center gap-1 rounded-lg border border-sky-200/60 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800';
  }
  return 'inline-flex items-center gap-1 rounded-lg border border-amber-200/60 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800';
}

function roleBadgeLabel(roleKey: AccountCreateRole): string {
  if (roleKey === 'admin') return 'مدير';
  if (roleKey === 'expert') return 'خبير';
  return 'موظف';
}

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
  const [role, setRole] = useState<AccountCreateRole>('employee');
  const [permissions, setPermissions] = useState<CrmPermissions>(() =>
    defaultPermissionsForRole('employee'),
  );

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AccountRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<AccountCreateRole>('employee');
  const [editPermissions, setEditPermissions] = useState<CrmPermissions>(() =>
    defaultPermissionsForRole('employee'),
  );
  const [editSuspended, setEditSuspended] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editRoleTouched, setEditRoleTouched] = useState(false);

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

  function resetForm() {
    setName('');
    setEmail('');
    setRole('employee');
    setPermissions(defaultPermissionsForRole('employee'));
  }

  function closeModal() {
    if (creating) return;
    setModalOpen(false);
    resetForm();
  }

  function handleRoleChange(nextRole: AccountCreateRole) {
    setRole(nextRole);
    setPermissions(defaultPermissionsForRole(nextRole));
  }

  function togglePermission(key: GranularPermissionKey, checked: boolean) {
    if (role === 'admin') return;
    setPermissions((prev) => ({ ...prev, [key]: checked }));
  }

  function handleOpenEditModal(user: AccountRow) {
    const roleKey =
      user.role_key ?? (user.is_admin ? 'admin' : user.is_expert ? 'expert' : 'employee');
    setEditingUser(user);
    setEditName(user.full_name === '—' ? '' : user.full_name);
    setEditRole(roleKey);
    setEditPermissions(
      user.permissions
        ? { ...defaultPermissionsForRole(roleKey), ...user.permissions }
        : defaultPermissionsForRole(roleKey),
    );
    setEditSuspended(Boolean(user.is_suspended));
    setEditRoleTouched(false);
    setEditModalOpen(true);
  }

  function closeEditModal() {
    if (updating) return;
    setEditModalOpen(false);
    setEditingUser(null);
    setEditRoleTouched(false);
  }

  function handleEditRoleChange(nextRole: AccountCreateRole) {
    setEditRole(nextRole);
    setEditRoleTouched(true);
    setEditPermissions(defaultPermissionsForRole(nextRole));
  }

  function toggleEditPermission(key: GranularPermissionKey, checked: boolean) {
    if (editRole === 'admin') return;
    setEditPermissions((prev) => ({ ...prev, [key]: checked }));
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const token = await getClientAccessToken();
      const result = await createAccountAction({
        full_name: name,
        email,
        role,
        permissions,
        access_token: token,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.message ||
          `تم إنشاء الحساب. كلمة المرور الافتراضية: ${EXPERT_DEFAULT_PASSWORD}`,
      );
      setModalOpen(false);
      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إنشاء الحساب.');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser?.user_id) {
      toast.error('معرّف المستخدم غير صالح.');
      return;
    }
    setUpdating(true);
    try {
      const token = await getClientAccessToken();
      const result = await updateAccountAction({
        user_id: editingUser.user_id,
        full_name: editName,
        role: editRole,
        permissions: editPermissions,
        is_suspended: editSuspended,
        access_token: token,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message || 'تم تحديث بيانات وصلاحيات المستخدم بنجاح!');
      setEditModalOpen(false);
      setEditingUser(null);
      await load();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء التحديث');
    } finally {
      setUpdating(false);
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
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
        <p className="text-sm font-black text-rose-700">غير مصرح — إدارة الحسابات للمدير فقط.</p>
      </div>
    );
  }

  const isEditingSelf = Boolean(editingUser?.user_id && editingUser.user_id === authUserId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6" dir="rtl">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-600">
            RBAC · Admin
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">
            <Users className="h-7 w-7 text-amber-700" />
            إدارة الحسابات
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            إنشاء وتعديل وحذف حسابات الموظفين والخبراء والمدراء — كلمة المرور الافتراضية:{' '}
            <span className="font-mono text-amber-700">{EXPERT_DEFAULT_PASSWORD}</span>
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleBulkSync()}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:border-amber-300 hover:text-amber-700 disabled:opacity-50 sm:w-auto"
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
            className={`${BTN_PRIMARY_GOLD} min-h-[44px] w-full sm:w-auto`}
          >
            <UserPlus className="h-4 w-4" />
            <span>إضافة حساب / مستخدم جديد</span>
          </button>
        </div>
      </div>

      <div className="w-full overflow-hidden overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-amber-700" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm font-bold text-slate-500">
            لا توجد حسابات بعد.
          </p>
        ) : (
          <table className="w-full min-w-[650px] text-right text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-extrabold text-slate-700">
              <tr>
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">البريد</th>
                <th className="px-4 py-3">الدور</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const roleKey =
                  row.role_key ?? (row.is_admin ? 'admin' : row.is_expert ? 'expert' : 'employee');
                const busyDelete = deletingId === row.user_id;
                return (
                  <tr
                    key={row.user_id || row.id}
                    className="border-b border-slate-100 text-xs font-bold text-slate-800 transition-all hover:bg-slate-50/50 last:border-0"
                  >
                    <td className="px-4 py-3 font-bold text-slate-900">{row.full_name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-500" dir="ltr">
                      {row.email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={roleBadgeClass(roleKey)}>
                        {roleKey === 'admin' ? <Shield className="h-3 w-3" /> : null}
                        {roleBadgeLabel(roleKey)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold">
                      {row.is_suspended ? (
                        <span className="inline-flex rounded-lg border border-rose-200/60 bg-rose-50 px-2.5 py-1 text-rose-700">
                          موقوف
                        </span>
                      ) : (
                        <span className="inline-flex rounded-lg border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                          نشط
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={busyDelete || updating}
                          onClick={() => handleOpenEditModal(row)}
                          className={BTN_EDIT_SOFT}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyDelete || row.user_id === authUserId}
                          onClick={() => void handleDelete(row)}
                          className="flex cursor-pointer items-center gap-1 rounded-lg border border-rose-200/60 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition-all hover:bg-rose-100 disabled:opacity-40"
                        >
                          {busyDelete ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>حذف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
          <div
            role="dialog"
            aria-modal
            className="relative my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">إضافة حساب / مستخدم جديد</h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={creating}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleCreateAccount(e)} className="space-y-4 text-right">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">الاسم</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="اسم المستخدم"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">البريد</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="user@wanderloom.com"
                  dir="ltr"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">
                  الدور / الصلاحية *
                </span>
                <select
                  required
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as AccountCreateRole)}
                  className={FIELD_CLASS}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2 border-t border-slate-200 pt-3 text-right">
                <label className="block text-xs font-extrabold text-amber-700">
                  الصلاحيات حسب أقسام اللوحة:
                </label>
                <div className="grid grid-cols-1 gap-2.5 space-y-0 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs font-bold sm:grid-cols-2">
                  {ACCOUNT_PERMISSION_OPTIONS.map((perm) => {
                    const checked = role === 'admin' || Boolean(permissions[perm.id]);
                    return (
                      <label
                        key={perm.id}
                        className={`flex cursor-pointer items-center gap-2 text-xs font-bold transition-all hover:text-amber-800 ${
                          checked ? 'text-slate-900' : 'text-slate-700'
                        } ${role === 'admin' ? 'opacity-80' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={creating || role === 'admin'}
                          onChange={(e) => togglePermission(perm.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 bg-white text-amber-500 focus:ring-amber-500"
                        />
                        <span className="leading-snug">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-xs font-bold text-amber-900">
                يُنشأ الحساب بكلمة المرور الافتراضية{' '}
                <span className="font-mono">{EXPERT_DEFAULT_PASSWORD}</span> ويمكن تغييرها لاحقاً عبر
                نسيت كلمة المرور.
              </p>
              <button
                type="submit"
                disabled={creating}
                className={BTN_PRIMARY_GOLD_FULL}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جارٍ الإنشاء...
                  </>
                ) : (
                  'إنشاء الحساب'
                )}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit modal */}
      {editModalOpen && editingUser ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
          <div
            role="dialog"
            aria-modal
            className="relative my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">تعديل الحساب / الصلاحيات</h2>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={updating}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleUpdateUser(e)} className="space-y-4 text-right">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">الاسم</span>
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="اسم المستخدم"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">البريد</span>
                <input
                  type="email"
                  value={editingUser.email ?? ''}
                  readOnly
                  disabled
                  className={FIELD_DISABLED_CLASS}
                  dir="ltr"
                />
                <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                  البريد مرتبط بحساب Auth ولا يُعدَّل من هنا.
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">
                  الدور / الصلاحية *
                </span>
                <select
                  required
                  value={editRole}
                  onChange={(e) => handleEditRoleChange(e.target.value as AccountCreateRole)}
                  disabled={isEditingSelf}
                  className={`${FIELD_CLASS} disabled:opacity-60`}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {isEditingSelf ? (
                  <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                    لا يمكنك تغيير دور حسابك الحالي.
                  </span>
                ) : editRoleTouched ? (
                  <span className="mt-1 block text-[10px] font-semibold text-amber-700">
                    تم إعادة ضبط الصلاحيات حسب الدور الجديد — يمكنك تعديلها يدوياً.
                  </span>
                ) : null}
              </label>

              <div className="space-y-2 border-t border-slate-200 pt-3 text-right">
                <label className="block text-xs font-extrabold text-amber-700">
                  الصلاحيات حسب أقسام اللوحة:
                </label>
                <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs font-bold sm:grid-cols-2">
                  {ACCOUNT_PERMISSION_OPTIONS.map((perm) => {
                    const checked = editRole === 'admin' || Boolean(editPermissions[perm.id]);
                    return (
                      <label
                        key={perm.id}
                        className={`flex cursor-pointer items-center gap-2 text-xs font-bold transition-all hover:text-amber-800 ${
                          checked ? 'text-slate-900' : 'text-slate-700'
                        } ${editRole === 'admin' ? 'opacity-80' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={updating || editRole === 'admin'}
                          onChange={(e) => toggleEditPermission(perm.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 bg-white text-amber-500 focus:ring-amber-500"
                        />
                        <span className="leading-snug">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
                {editRole === 'admin' ? (
                  <p className="text-[11px] font-semibold text-slate-500">
                    المدير يحصل على جميع الصلاحيات تلقائياً.
                  </p>
                ) : null}
              </div>

              <label
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                  editSuspended
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                } ${isEditingSelf ? 'pointer-events-none opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={editSuspended}
                  disabled={updating || isEditingSelf}
                  onChange={(e) => setEditSuspended(e.target.checked)}
                  className="rounded border-slate-300 bg-white text-rose-500 focus:ring-rose-500"
                />
                <span>إيقاف الحساب (موقوف)</span>
              </label>

              <button
                type="submit"
                disabled={updating}
                className={BTN_PRIMARY_GOLD_FULL}
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جارٍ الحفظ...
                  </>
                ) : (
                  'حفظ التعديلات'
                )}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
