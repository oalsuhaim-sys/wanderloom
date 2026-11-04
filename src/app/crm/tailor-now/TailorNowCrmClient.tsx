'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, MessageCircle, Receipt, RefreshCw } from 'lucide-react';

import { getClientAccessToken } from '@/lib/crm-session-token';
import { formatWhatsAppPhone } from '@/lib/crm-lead-actions';

type CrmPlan = {
  id: string;
  token: string;
  createdAt: string;
  locale: string;
  fullName: string;
  phoneWa: string;
  email: string | null;
  country: string;
  segments: { city: string; days: number }[];
  startDate: string | null;
  daysTotal: number;
  daysBuilt: number;
  totalPrice: number;
  status: string;
  receiptUrl: string | null;
  paidAt: string | null;
  lastError: string | null;
  costUsd: number;
  calls: number;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  preview: { label: 'شاهد اليوم الأول', cls: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200' },
  receipt_submitted: { label: 'أرسل إيصال التحويل', cls: 'bg-amber-100 text-amber-900' },
  paid: { label: 'مدفوع · قيد التفصيل', cls: 'bg-sky-100 text-sky-900' },
  ready: { label: 'مكتمل', cls: 'bg-emerald-100 text-emerald-900' },
  failed: { label: 'تعثّر التفصيل', cls: 'bg-red-100 text-red-900' },
};

const USD_TO_SAR = 3.75;

function planUrl(token: string) {
  return `${window.location.origin}/tailor-now/${token}`;
}

export default function TailorNowCrmClient() {
  const [plans, setPlans] = useState<CrmPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    try {
      const token = await getClientAccessToken();
      const res = await fetch('/api/crm/tailor-now', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const json = (await res.json()) as { ok?: boolean; plans?: CrmPlan[]; error?: string };
      setError(null);
      if (!json.ok) {
        setError(json.error === 'table_missing' ? 'جدول «فصّل الآن» غير موجود بعد في قاعدة البيانات.' : 'تعذّر تحميل الخطط.');
        setPlans([]);
      } else {
        setPlans(json.plans ?? []);
      }
    } catch {
      setError('تعذّر تحميل الخطط.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await reload();
    })();
  }, [reload]);

  /** Builds the missing days one batch at a time (each call adds up to two days). */
  const buildDays = async (plan: CrmPlan) => {
    for (let i = 0; i < 40; i += 1) {
      setBusy((b) => ({ ...b, [plan.id]: `نفصّل الأيام…` }));
      const res = await fetch(`/api/tailor-now/${plan.token}/generate`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; plan?: { pendingDays: number[]; days: unknown[] }; error?: string };
      if (json.ok && json.plan) {
        setPlans((list) => list.map((p) => (p.id === plan.id ? { ...p, daysBuilt: json.plan!.days.length } : p)));
        if (!json.plan.pendingDays.length) break;
        continue;
      }
      if (json.error === 'in_progress') {
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }
      setError(`تعذّر تفصيل أيام ${plan.fullName}. أعد المحاولة من زر «استكمال التفصيل».`);
      break;
    }
  };

  const confirm = async (plan: CrmPlan) => {
    if (!window.confirm(`تأكيد استلام تحويل ${plan.totalPrice} ريال من ${plan.fullName}؟ ستُفتح كل الأيام.`)) return;
    setBusy((b) => ({ ...b, [plan.id]: 'نؤكد التحويل…' }));
    try {
      const token = await getClientAccessToken();
      const res = await fetch(`/api/crm/tailor-now/${plan.id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { ok?: boolean };
      if (!json.ok) throw new Error('confirm_failed');
      setPlans((list) => list.map((p) => (p.id === plan.id ? { ...p, status: 'paid', paidAt: new Date().toISOString() } : p)));
      await buildDays(plan);
    } catch {
      setError('تعذّر تأكيد التحويل.');
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[plan.id];
        return next;
      });
      void reload();
    }
  };

  const resume = async (plan: CrmPlan) => {
    try {
      await buildDays(plan);
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[plan.id];
        return next;
      });
      void reload();
    }
  };

  const waLink = (plan: CrmPlan) => {
    const first = plan.fullName.split(/\s+/)[0] ?? '';
    const text =
      plan.locale === 'en'
        ? `Hello ${first}, your Tailor Now plan is complete: ${planUrl(plan.token)}`
        : `أهلاً ${first}، خطتك في «فصّل الآن» صارت كاملة: ${planUrl(plan.token)}`;
    return `https://wa.me/${formatWhatsAppPhone(plan.phoneWa)}?text=${encodeURIComponent(text)}`;
  };

  const totals = plans.reduce(
    (acc, p) => {
      acc.cost += p.costUsd;
      if (p.paidAt) acc.revenue += p.totalPrice;
      return acc;
    },
    { cost: 0, revenue: 0 },
  );

  return (
    <div dir="rtl" className="mx-auto w-full max-w-[min(100%,88rem)] space-y-6 px-4 pb-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-[#D4AF37]/80">Tailor Now</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">فصّل الآن</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            خطط يوماً بيوم: العميل يشوف اليوم الأول، وبعد تأكيد التحويل هنا تُفصَّل باقي الأيام تلقائياً على نفس رابطه.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void reload();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">
          <RefreshCw className="h-4 w-4" aria-hidden /> تحديث
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-bold text-slate-500">عدد الخطط</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{plans.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-bold text-slate-500">إيراد مؤكد</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{totals.revenue.toLocaleString('en-US')} ريال</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-bold text-slate-500">تكلفة Claude التقديرية</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            {(totals.cost * USD_TO_SAR).toFixed(1)} ريال <span className="text-sm font-bold text-slate-400">(${totals.cost.toFixed(2)})</span>
          </p>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p> : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> جاري التحميل…
        </p>
      ) : !plans.length && !error ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">لا توجد خطط بعد.</p>
      ) : (
        <ul className="space-y-3">
          {plans.map((plan) => {
            const st = STATUS[plan.status] ?? STATUS.preview!;
            const unlocked = Boolean(plan.paidAt);
            const working = busy[plan.id];
            return (
              <li key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-black text-slate-900 dark:text-white">
                      {plan.fullName}{' '}
                      <span dir="ltr" className="text-sm font-bold text-slate-500">+{plan.phoneWa}</span>
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
                      {plan.country} · {plan.segments.map((s) => `${s.city} (${s.days})`).join(' ← ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(plan.createdAt).toLocaleString('ar-SA-u-nu-latn')} · {plan.locale === 'en' ? 'English' : 'عربي'}
                      {plan.startDate ? ` · أول يوم ${plan.startDate}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${st.cls}`}>{st.label}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{plan.totalPrice.toLocaleString('en-US')} ريال</span>
                    <span className="text-[11px] text-slate-400">
                      {plan.daysBuilt}/{plan.daysTotal} أيام · تكلفة {(plan.costUsd * USD_TO_SAR).toFixed(2)} ريال
                    </span>
                  </div>
                </div>
                {plan.lastError ? <p className="mt-2 text-xs font-bold text-red-700">آخر خطأ في التفصيل: {plan.lastError}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/tailor-now/${plan.token}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> فتح الخطة
                  </a>
                  {plan.receiptUrl ? (
                    <a href={plan.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                      <Receipt className="h-3.5 w-3.5" aria-hidden /> الإيصال
                    </a>
                  ) : null}
                  {!unlocked ? (
                    <button type="button" disabled={Boolean(working)} onClick={() => void confirm(plan)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60">
                      {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                      {working ?? 'تأكيد التحويل وفتح الأيام'}
                    </button>
                  ) : plan.daysBuilt < plan.daysTotal ? (
                    <button type="button" disabled={Boolean(working)} onClick={() => void resume(plan)} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60">
                      {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                      {working ?? 'استكمال التفصيل'}
                    </button>
                  ) : null}
                  {unlocked ? (
                    <a href={waLink(plan)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden /> إرسال الرابط واتساب
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
