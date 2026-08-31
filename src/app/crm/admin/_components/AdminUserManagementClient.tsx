'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  UserPlus,
  UserX,
} from 'lucide-react';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import {
  createTeamMember,
  listTeamMembersAction,
  suspendTeamMemberAction,
  updateTeamMemberAction,
  type AdminTeamMember,
} from '@/app/actions/adminActions';
import {
  ACCOUNT_PERMISSION_OPTIONS,
  DEFAULT_CRM_PERMISSIONS,
  FULL_CRM_PERMISSIONS,
  type GranularPermissionKey,
  type CrmPermissions,
} from '@/lib/crm-permissions';
import { getClientAccessToken } from '@/lib/crm-session-token';

type TeamProfile = AdminTeamMember;

function PermissionCheckboxGrid({
  permissions,
  isAdmin,
  disabled,
  onTogglePermission,
  onToggleAdmin,
}: {
  permissions: CrmPermissions;
  isAdmin: boolean;
  disabled?: boolean;
  onTogglePermission: (key: GranularPermissionKey, value: boolean) => void;
  onToggleAdmin: (value: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ACCOUNT_PERMISSION_OPTIONS.map((perm) => (
        <label
          key={perm.id}
          className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
            isAdmin || permissions[perm.id]
              ? 'border-[#cda04c]/45 bg-[#cda04c]/10 text-white'
              : 'border-white/10 bg-white/[0.03] text-white/70'
          } ${disabled ? 'pointer-events-none opacity-50' : 'hover:border-[#cda04c]/35'}`}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 accent-[#cda04c]"
            checked={isAdmin || permissions[perm.id]}
            disabled={disabled || isAdmin}
            onChange={(e) => onTogglePermission(perm.id, e.target.checked)}
          />
          <span className="leading-snug">{perm.label}</span>
        </label>
      ))}
      <label
        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-black transition sm:col-span-2 ${
          isAdmin
            ? 'border-amber-400/50 bg-amber-400/15 text-amber-100'
            : 'border-white/10 bg-white/[0.03] text-white/70'
        } ${disabled ? 'pointer-events-none opacity-50' : 'hover:border-amber-400/40'}`}
      >
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/20 accent-amber-400"
          checked={isAdmin}
          disabled={disabled}
          onChange={(e) => onToggleAdmin(e.target.checked)}
        />
        <Shield className="h-4 w-4 shrink-0" />
        <span>صلاحيات مدير كاملة</span>
      </label>
    </div>
  );
}

export default function AdminUserManagementClient() {
  const { profileAccess, authUserId, loading: loadingSession, reload } = useCrmEmployee();
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createPermissions, setCreatePermissions] = useState<CrmPermissions>({ ...DEFAULT_CRM_PERMISSIONS });
  const [createIsAdmin, setCreateIsAdmin] = useState(false);

  const isAdmin = Boolean(profileAccess?.is_admin);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const accessToken = await getClientAccessToken();
      const result = await listTeamMembersAction(accessToken);
      if (!result.ok) throw new Error(result.error);
      setProfiles(
        (result.data ?? []).map((p) => ({
          ...p,
          permissions: { ...DEFAULT_CRM_PERMISSIONS, ...p.permissions },
          created_at: p.created_at ?? '',
        })),
      );
    } catch (e) {
      setNotice({ type: 'err', text: e instanceof Error ? e.message : 'تعذر تحميل الفريق' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadingSession && isAdmin) void loadProfiles();
    if (!loadingSession && !isAdmin) setLoading(false);
  }, [isAdmin, loadProfiles, loadingSession]);

  async function patchUser(
    userId: string,
    patch: { permissions?: CrmPermissions; is_admin?: boolean; is_suspended?: boolean },
  ) {
    setSavingId(userId);
    setNotice(null);
    try {
      const accessToken = await getClientAccessToken();
      const result = await updateTeamMemberAction(userId, patch, accessToken);
      if (!result.ok) throw new Error(result.error);
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id !== userId) return p;
          const nextAdmin = typeof patch.is_admin === 'boolean' ? patch.is_admin : p.is_admin;
          return {
            ...p,
            is_admin: nextAdmin,
            is_suspended: typeof patch.is_suspended === 'boolean' ? patch.is_suspended : p.is_suspended,
            permissions: patch.permissions ?? p.permissions,
          };
        }),
      );
    } catch (e) {
      setNotice({ type: 'err', text: e instanceof Error ? e.message : 'فشل تحديث الصلاحيات' });
      void loadProfiles();
    } finally {
      setSavingId(null);
    }
  }

  function handleCreatePermissionToggle(key: GranularPermissionKey, value: boolean) {
    if (createIsAdmin) return;
    setCreatePermissions((prev) => ({ ...prev, [key]: value }));
  }

  function handleCreateAdminToggle(value: boolean) {
    setCreateIsAdmin(value);
    if (value) {
      setCreatePermissions({ ...FULL_CRM_PERMISSIONS });
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setNotice(null);
    try {
      const accessToken = await getClientAccessToken();
      const result = await createTeamMember({
        full_name: fullName,
        email,
        password,
        is_admin: createIsAdmin,
        permissions: createPermissions,
        access_token: accessToken,
      });
      if (!result.ok) throw new Error(result.error);
      setFullName('');
      setEmail('');
      setPassword('');
      setCreateIsAdmin(false);
      setCreatePermissions({ ...DEFAULT_CRM_PERMISSIONS });
      setNotice({ type: 'ok', text: result.message ?? '✅ تم إنشاء حساب الموظف بنجاح' });
      await loadProfiles();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'فشل إنشاء الحساب' });
    } finally {
      setCreating(false);
    }
  }

  async function handleSuspend(userId: string) {
    if (!window.confirm('تعليق هذا الحساب؟ لن يتمكن من تسجيل الدخول.')) return;
    setSavingId(userId);
    setNotice(null);
    try {
      const accessToken = await getClientAccessToken();
      const result = await suspendTeamMemberAction(userId, accessToken);
      if (!result.ok) throw new Error(result.error);
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, is_suspended: true } : p)),
      );
      setNotice({ type: 'ok', text: 'تم تعليق الحساب.' });
    } catch (e) {
      setNotice({ type: 'err', text: e instanceof Error ? e.message : 'فشل تعليق الحساب.' });
    } finally {
      setSavingId(null);
    }
  }

  function handleRowPermissionToggle(profile: TeamProfile, key: GranularPermissionKey, value: boolean) {
    if (profile.is_admin) return;
    const next = { ...profile.permissions, [key]: value };
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, permissions: next } : p)));
    void patchUser(profile.id, { permissions: next });
  }

  function handleRowAdminToggle(profile: TeamProfile, value: boolean) {
    const nextPermissions = value ? { ...FULL_CRM_PERMISSIONS } : profile.permissions;
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profile.id ? { ...p, is_admin: value, permissions: nextPermissions } : p,
      ),
    );
    void patchUser(profile.id, { is_admin: value, permissions: nextPermissions });
  }

  const activeCount = useMemo(() => profiles.filter((p) => !p.is_suspended).length, [profiles]);

  if (loadingSession) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10" />
        <h1 className="text-xl font-black">صلاحية غير كافية</h1>
        <p className="mt-2 text-sm font-semibold">هذه الصفحة مخصصة للمديرين فقط.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8" dir="rtl">
      <header className="rounded-3xl border border-[#cda04c]/25 bg-gradient-to-br from-[#07100D] via-[#0F1E16] to-[#1a2f24] p-7 text-white shadow-[0_18px_50px_rgba(7,16,13,0.45)] sm:p-9">
        <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.35em] text-[#cda04c]">
          <Crown className="h-4 w-4" />
          Admin · RBAC
        </p>
        <h1 className="text-2xl font-black sm:text-3xl">إدارة المستخدمين والصلاحيات</h1>
        <p className="mt-2 text-sm font-semibold text-white/55">
          إنشاء حسابات الفريق وضبط صلاحيات الوصول لكل قسم — التغييرات تُحفظ فوراً.
        </p>
        <p className="mt-3 text-xs font-bold text-[#cda04c]/80">{activeCount} عضو نشط</p>
      </header>

      {notice ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === 'ok'
              ? 'border-emerald-300/40 bg-emerald-950/30 text-emerald-100'
              : 'border-rose-300/40 bg-rose-950/30 text-rose-100'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[#cda04c]/20 bg-gradient-to-b from-[#0a1410] to-[#0f1e16] p-6 shadow-lg sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#cda04c]/30 bg-[#cda04c]/10">
            <UserPlus className="h-5 w-5 text-[#cda04c]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">إنشاء حساب فريق جديد</h2>
            <p className="text-xs font-semibold text-white/45">اسم · بريد · كلمة مرور · صلاحيات</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleCreateUser(e)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-[#cda04c]/90">الاسم</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#cda04c]/50 focus:ring-1 focus:ring-[#cda04c]/30"
                placeholder="مثال: سارة العتيبي"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-[#cda04c]/90">البريد الإلكتروني</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3 pr-10 text-sm text-white outline-none focus:border-[#cda04c]/50 focus:ring-1 focus:ring-[#cda04c]/30"
                  placeholder="advisor@wanderloom.com"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-[#cda04c]/90">كلمة المرور</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3 pr-10 text-sm text-white outline-none focus:border-[#cda04c]/50 focus:ring-1 focus:ring-[#cda04c]/30"
                  placeholder="8 أحرف على الأقل"
                />
              </div>
            </label>
          </div>

          <div>
            <p className="mb-3 text-xs font-black text-amber-300/90">الصلاحيات حسب أقسام اللوحة:</p>
            <PermissionCheckboxGrid
              permissions={createPermissions}
              isAdmin={createIsAdmin}
              disabled={creating}
              onTogglePermission={handleCreatePermissionToggle}
              onToggleAdmin={handleCreateAdminToggle}
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-[#cda04c] to-[#b3893d] px-5 py-2.5 text-sm font-black text-[#1e3f20] shadow-md shadow-[#cda04c]/20 transition hover:brightness-110 disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {creating ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-[#cda04c]/20 bg-white p-4 shadow-lg sm:p-6">
        <h2 className="mb-4 text-lg font-black text-[#1e3f20]">أعضاء الفريق النشطون</h2>

        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : profiles.length === 0 ? (
          <p className="py-12 text-center text-sm font-semibold text-slate-500">لا يوجد أعضاء بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-black text-slate-500">
                  <th className="px-3 py-3">العضو</th>
                  {ACCOUNT_PERMISSION_OPTIONS.map((perm) => (
                    <th
                      key={perm.id}
                      className="max-w-[7.5rem] px-2 py-3 text-center text-[10px] font-black leading-snug"
                      title={perm.label}
                    >
                      {perm.label}
                    </th>
                  ))}
                  <th className="px-2 py-3 text-center">مدير</th>
                  <th className="px-3 py-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => {
                  const isSelf = profile.id === authUserId;
                  const rowBusy = savingId === profile.id;
                  return (
                    <tr
                      key={profile.id}
                      className={`border-b border-slate-100 ${profile.is_suspended ? 'bg-rose-50/60 opacity-70' : ''}`}
                    >
                      <td className="px-3 py-4">
                        <div className="font-black text-slate-900">{profile.full_name}</div>
                        <div className="text-xs font-semibold text-slate-500">{profile.email ?? '—'}</div>
                        {profile.is_suspended ? (
                          <span className="mt-1 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800">
                            معلّق
                          </span>
                        ) : null}
                        {isSelf ? (
                          <span className="mt-1 inline-block rounded-full bg-[#cda04c]/15 px-2 py-0.5 text-[10px] font-black text-[#9a7b45]">
                            أنت
                          </span>
                        ) : null}
                      </td>
                      {ACCOUNT_PERMISSION_OPTIONS.map((perm) => (
                        <td key={perm.id} className="px-2 py-4 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#cda04c] disabled:opacity-40"
                            checked={profile.is_admin || profile.permissions[perm.id]}
                            disabled={isSelf || rowBusy || profile.is_suspended || profile.is_admin}
                            onChange={(e) => handleRowPermissionToggle(profile, perm.id, e.target.checked)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-4 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-amber-500 disabled:opacity-40"
                          checked={profile.is_admin}
                          disabled={isSelf || rowBusy || profile.is_suspended}
                          onChange={(e) => handleRowAdminToggle(profile, e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-4">
                        {isSelf || profile.is_suspended ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => void handleSuspend(profile.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            {rowBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserX className="h-3.5 w-3.5" />
                            )}
                            تعليق
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
