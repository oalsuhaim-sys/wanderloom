'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import {
  fetchAgencyBankDetailsAction,
  updateAgencyBankDetailsAction,
} from '@/app/actions/systemSettingsActions';
import { getClientAccessToken } from '@/lib/crm-session-token';
import type { AgencyBankDetails } from '@/lib/system-settings';
import { CRM_INPUT } from '@/lib/crm-luxury-ui';

export default function CrmSettingsPage() {
  const { profileAccess, loading: loadingSession } = useCrmEmployee();
  const isAdmin = Boolean(profileAccess?.is_admin);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [iban, setIban] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const applyDetails = useCallback((data: AgencyBankDetails) => {
    setBankName(data.bankName === '[أدخل اسم البنك]' ? '' : data.bankName)
    setAccountName(data.accountName === '[أدخل اسم المؤسسة]' ? '' : data.accountName)
    setIban(data.iban === 'SA0000000000000000000000' ? '' : data.iban)
  }, [])

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getClientAccessToken();
      const result = await fetchAgencyBankDetailsAction(token, { requireAdmin: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.message) setHint(result.message);
      else setHint(null);
      if (result.data) applyDetails(result.data);
    } catch (err) {
      console.error(err);
      toast.error('تعذر تحميل الإعدادات.');
    } finally {
      setLoading(false);
    }
  }, [applyDetails]);

  useEffect(() => {
    if (loadingSession || !isAdmin) return;
    void load();
  }, [loadingSession, isAdmin, load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getClientAccessToken();
      const result = await updateAgencyBankDetailsAction({
        bank_name: bankName,
        account_name: accountName,
        iban,
        access_token: token,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message || 'تم الحفظ.');
      if (result.data) applyDetails(result.data);
    } catch (err) {
      console.error(err);
      toast.error('تعذر حفظ الإعدادات.');
    } finally {
      setSaving(false);
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
        <p className="text-sm font-black text-rose-800">غير مصرح — إعدادات الوكالة للمدير فقط.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6" dir="rtl">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C5A059]">
          Settings · Admin
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-[#1A3B2A]">
          <Building2 className="h-7 w-7 text-[#C5A059]" />
          إعدادات الوكالة
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          تفاصيل الحساب البنكي تظهر للعملاء في صفحة السداد `/checkout/[id]`.
        </p>
      </div>

      {hint ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
          {hint}
        </p>
      ) : null}

      <form
        onSubmit={(e) => void handleSave(e)}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-black text-[#1A3B2A]">الحساب البنكي الرسمي</h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-[#C5A059]" />
          </div>
        ) : (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-slate-500">اسم البنك</span>
              <input
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={`${CRM_INPUT} w-full`}
                placeholder="مثال: البنك الأهلي السعودي"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-slate-500">اسم الحساب</span>
              <input
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className={`${CRM_INPUT} w-full`}
                placeholder="Wanderloom Travel"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-slate-500">رقم الآيبان (IBAN)</span>
              <input
                required
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                className={`${CRM_INPUT} w-full font-mono`}
                placeholder="SA…"
                dir="ltr"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C5A059] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              حفظ التفاصيل البنكية
            </button>
          </>
        )}
      </form>
    </div>
  );
}
