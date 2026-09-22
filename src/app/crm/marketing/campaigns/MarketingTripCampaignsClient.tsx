'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  Check,
  Copy,
  Dna,
  Loader2,
  Megaphone,
  Plane,
  Settings2,
  Sparkles,
  Users,
  UserRound,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  clearSocialSchedulerSettingsAction,
  updateSocialSchedulerSettingsAction,
} from '@/app/actions/systemSettingsActions';
import { getClientAccessToken } from '@/lib/crm-session-token';
import type { MarketingActiveGroupTrip } from '@/lib/marketing-active-group-trips';
import type {
  MarketingCampaignMode,
  MarketingCampaignResult,
} from '@/lib/marketing-trip-campaigns';
import type { SocialSchedulerProvider } from '@/lib/social-scheduler-settings';

const PANEL =
  'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6';

type HubMode = MarketingCampaignMode;

const MODE_TABS: {
  id: HubMode;
  label: string;
  hint: string;
  icon: typeof Dna;
}[] = [
  {
    id: 'brand',
    label: '🌟 تسويق البراند والروح',
    hint: 'Brand & DNA Concept — منشورات وسكربتات عن منهجية DNA',
    icon: Dna,
  },
  {
    id: 'private',
    label: '✈️ رحلات الأفراد والمسارات الخاصة',
    hint: 'Custom & Private — عائلات، أزواج، باقات ذكية',
    icon: UserRound,
  },
  {
    id: 'group',
    label: '👥 رحلات الجروبات المتاحة',
    hint: 'Group Trips — مقاعد مفتوحة وحجز عاجل',
    icon: Users,
  },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyBtn({ text, label = 'نسخ' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text);
        if (!ok) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-200"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'تم' : label}
    </button>
  );
}

function SocialSettingsModal({
  open,
  onClose,
  initialProvider,
  keyHint,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialProvider: SocialSchedulerProvider;
  keyHint: string | null;
  onSaved: (status: {
    configured: boolean;
    provider: string;
    message: string;
    keyHint?: string | null;
  }) => void;
}) {
  const [provider, setProvider] = useState<'metricool' | 'buffer'>(
    initialProvider === 'buffer' ? 'buffer' : 'metricool',
  );
  const [apiKey, setApiKey] = useState('');
  const [extra, setExtra] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProvider(initialProvider === 'buffer' ? 'buffer' : 'metricool');
    setApiKey('');
    setExtra('');
  }, [open, initialProvider]);

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    try {
      const token = await getClientAccessToken();
      const result = await updateSocialSchedulerSettingsAction({
        provider,
        apiKey,
        extra,
        keepExistingKey: Boolean(keyHint) && !apiKey.trim(),
        access_token: token,
      });
      if (!result.ok) {
        throw new Error(result.error || 'تعذر الحفظ');
      }
      if (!result.data) {
        throw new Error('تعذر الحفظ');
      }
      onSaved({
        configured: result.data.configured,
        provider: result.data.provider,
        message: result.data.message,
        keyHint: result.data.keyHint,
      });
      toast.success(result.message || 'تم حفظ إعدادات الربط');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const clearDb = async () => {
    setClearing(true);
    try {
      const token = await getClientAccessToken();
      const result = await clearSocialSchedulerSettingsAction({ access_token: token });
      if (!result.ok) {
        throw new Error(result.error || 'تعذر المسح');
      }
      if (!result.data) {
        throw new Error('تعذر المسح');
      }
      onSaved({
        configured: result.data.configured,
        provider: result.data.provider,
        message: result.data.message,
        keyHint: result.data.keyHint,
      });
      toast.success(result.message || 'تم المسح');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر المسح');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="social-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        dir="rtl"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-[#2D3F3A] dark:bg-[#22302C]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3
              id="social-settings-title"
              className="text-base font-black text-slate-900 dark:text-white"
            >
              ضبط إعدادات الربط (API)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              يُحفظ المفتاح في جدول إعدادات النظام — لا يُعرض بالكامل بعد الحفظ.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#1A2421]"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              المزوّد
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'metricool' as const, label: 'Metricool' },
                  { id: 'buffer' as const, label: 'Buffer' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setProvider(opt.id)}
                  className={[
                    'rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                    provider === opt.id
                      ? 'border-[#C9A84C] bg-[#D4AF37]/15 text-[#1C4532] dark:text-[#D4AF37]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {provider === 'buffer' ? 'Access Token' : 'API Key'}
              {keyHint ? (
                <span className="mr-2 font-mono font-medium text-slate-400">
                  (الحالي: {keyHint})
                </span>
              ) : null}
            </span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                keyHint
                  ? 'اتركه فارغاً للإبقاء على المفتاح الحالي'
                  : provider === 'buffer'
                    ? 'BUFFER_ACCESS_TOKEN'
                    : 'METRICOOL_API_KEY'
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#D4AF37]/20 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-white"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {provider === 'buffer'
                ? 'Profile IDs (مفصولة بفاصلة)'
                : 'Blog ID (اختياري)'}
            </span>
            <input
              type="text"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={
                provider === 'buffer' ? 'profileId1, profileId2' : 'METRICOOL_BLOG_ID'
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#D4AF37]/20 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-white"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => void clearDb()}
              disabled={clearing || saving}
              className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-50"
            >
              {clearing ? 'جاري المسح…' : 'مسح مفاتيح قاعدة البيانات'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-600 dark:border-[#2D3F3A] dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#1C4532]"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                حفظ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignResultPanel({
  campaign,
  resultKey,
}: {
  campaign: MarketingCampaignResult;
  resultKey: string;
}) {
  return (
    <div className="mt-5 space-y-4 border-t border-slate-100 pt-5 dark:border-[#2D3F3A]">
      <div>
        <h3 className="text-base font-black text-slate-900 dark:text-white">
          {campaign.campaignTitle}
        </h3>
        {campaign.summary ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{campaign.summary}</p>
        ) : null}
      </div>

      <section>
        <h4 className="mb-2 text-xs font-black text-[#9C7A3C]">
          منشورات اجتماعية ({campaign.socialPosts.length})
        </h4>
        <div className="grid gap-3 md:grid-cols-3">
          {campaign.socialPosts.map((post, idx) => {
            const block = [post.body, post.hashtags.join(' ')].filter(Boolean).join('\n\n');
            return (
              <div
                key={`${resultKey}-post-${idx}`}
                className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-[#2D3F3A] dark:bg-[#1A2421]"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    {post.platform}
                  </span>
                  <CopyBtn text={block} />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                  {post.body}
                </p>
                {post.hashtags.length ? (
                  <p className="mt-2 text-xs text-[#9C7A3C]">{post.hashtags.join(' ')}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-black text-[#9C7A3C]">
          سكربتات فيديو ({campaign.videoScripts.length})
        </h4>
        <div className="grid gap-3 md:grid-cols-2">
          {campaign.videoScripts.map((script, idx) => (
            <div
              key={`${resultKey}-script-${idx}`}
              className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-[#2D3F3A] dark:bg-[#1A2421]"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {script.title} · {script.platform} · {script.durationHint}
                </p>
                <CopyBtn
                  text={[script.visualHook, script.voiceover, script.onScreenCta].join('\n\n')}
                />
              </div>
              <p className="text-xs text-slate-500">
                <span className="font-bold text-slate-700 dark:text-[#D4AF37]">Visual: </span>
                {script.visualHook}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                {script.voiceover}
              </p>
              <p className="mt-2 text-xs font-bold text-[#1C4532] dark:text-[#D4AF37]">
                CTA: {script.onScreenCta}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-black text-[#9C7A3C]">تعليقات جاهزة للجدولة</h4>
        <div className="space-y-2">
          {campaign.captions.map((cap, idx) => (
            <div
              key={`${resultKey}-cap-${idx}`}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-[#2D3F3A] dark:bg-[#1A2421] sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black text-slate-500">{cap.label}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
                  {cap.text}
                </p>
              </div>
              <CopyBtn text={cap.text} label="نسخ التعليق" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function MarketingTripCampaignsClient() {
  const [mode, setMode] = useState<HubMode>('brand');
  const [trips, setTrips] = useState<MarketingActiveGroupTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [campaignByKey, setCampaignByKey] = useState<Record<string, MarketingCampaignResult>>(
    {},
  );
  const [schedulerStatus, setSchedulerStatus] = useState<{
    configured: boolean;
    provider: string;
    message: string;
    keyHint?: string | null;
  } | null>(null);
  const [schedulingKey, setSchedulingKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const authHeaders = useCallback(async () => {
    const token = await getClientAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    } as HeadersInit;
  }, []);

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    setTripsError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/marketing/active-trips', {
        headers,
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        ok?: boolean;
        trips?: MarketingActiveGroupTrip[];
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || 'تعذر جلب الرحلات');
      }
      setTrips(Array.isArray(data.trips) ? data.trips : []);
    } catch (err) {
      setTripsError(err instanceof Error ? err.message : 'تعذر جلب الرحلات');
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, [authHeaders]);

  const loadScheduler = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/social/schedule', { headers, cache: 'no-store' });
      const data = (await res.json()) as {
        ok?: boolean;
        configured?: boolean;
        provider?: string;
        message?: string;
        keyHint?: string | null;
      };
      if (data.ok) {
        setSchedulerStatus({
          configured: Boolean(data.configured),
          provider: String(data.provider ?? 'none'),
          message: String(data.message ?? ''),
          keyHint: data.keyHint ?? null,
        });
      }
    } catch {
      setSchedulerStatus({
        configured: false,
        provider: 'none',
        message: 'تعذر فحص إعدادات الجدولة.',
        keyHint: null,
      });
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadScheduler();
  }, [loadScheduler]);

  useEffect(() => {
    if (mode === 'group') void loadTrips();
  }, [mode, loadTrips]);

  const pushScheduleForCampaign = useCallback(
    async (key: string, campaign: MarketingCampaignResult, silent?: boolean) => {
      const posts = [
        ...campaign.captions.map((c) => ({
          text: c.text,
          platforms: ['instagram', 'twitter'],
          title: c.label,
        })),
        ...campaign.socialPosts.map((p) => ({
          text: [p.body, p.hashtags.join(' ')].filter(Boolean).join('\n\n'),
          platforms: [
            p.platform === 'twitter' || p.platform === 'x' ? 'twitter' : 'instagram',
          ],
          title: p.platform,
        })),
      ].filter((p) => p.text.trim());

      if (!posts.length) {
        if (!silent) toast.error('لا توجد منشورات للجدولة.');
        return false;
      }

      setSchedulingKey(key);
      const toastId = silent ? undefined : toast.loading('جاري دفع المنشورات لطابور الجدولة…');
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/social/schedule', {
          method: 'POST',
          headers,
          body: JSON.stringify({ posts }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          error?: string;
          queued?: number;
        };
        if (toastId) toast.dismiss(toastId);
        if (!res.ok || !data.ok) {
          throw new Error(data.message || data.error || 'تعذر الجدولة');
        }
        toast.success(data.message || `تمت جدولة ${data.queued ?? posts.length} منشور`);
        void loadScheduler();
        return true;
      } catch (err) {
        if (toastId) toast.dismiss(toastId);
        toast.error(err instanceof Error ? err.message : 'تعذر الجدولة');
        return false;
      } finally {
        setSchedulingKey(null);
      }
    },
    [authHeaders, loadScheduler],
  );

  const generateCampaign = async (opts: {
    mode: HubMode;
    trip?: MarketingActiveGroupTrip;
  }) => {
    const key = opts.trip?.id || opts.mode;
    setGeneratingKey(key);
    const toastLabel =
      opts.mode === 'brand'
        ? 'البراند والـ DNA'
        : opts.mode === 'private'
          ? 'الرحلات الخاصة'
          : opts.trip?.title || 'الجروب';
    const toastId = toast.loading(`Claude يكتب حملة «${toastLabel}»…`);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/marketing/campaigns/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: opts.mode,
          tripId: opts.trip?.id,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        campaign?: MarketingCampaignResult;
        message?: string;
        error?: string;
      };
      toast.dismiss(toastId);
      if (!res.ok || !data.ok || !data.campaign) {
        throw new Error(data.message || data.error || 'فشل توليد الحملة');
      }
      setCampaignByKey((prev) => ({ ...prev, [key]: data.campaign! }));
      toast.success(`تم توليد حملة «${data.campaign.campaignTitle}» ✨`);

      if (schedulerStatus?.configured) {
        await pushScheduleForCampaign(key, data.campaign, true);
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err instanceof Error ? err.message : 'فشل توليد الحملة');
    } finally {
      setGeneratingKey(null);
    }
  };

  const scheduleCampaign = async (key: string) => {
    const campaign = campaignByKey[key];
    if (!campaign) {
      toast.error('ولّد الحملة أولاً قبل الجدولة.');
      return;
    }
    if (!schedulerStatus?.configured) {
      setSettingsOpen(true);
      toast.error('اضبط إعدادات الربط أولاً.');
      return;
    }
    await pushScheduleForCampaign(key, campaign);
  };

  const activeTab = MODE_TABS.find((t) => t.id === mode) ?? MODE_TABS[0];
  const conceptKey = mode;
  const conceptCampaign = campaignByKey[conceptKey];
  const conceptGenerating = generatingKey === conceptKey;
  const conceptScheduling = schedulingKey === conceptKey;

  return (
    <div dir="rtl" className="space-y-6">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-xs font-black tracking-wide text-[#9C7A3C]">
          <Megaphone className="h-3.5 w-3.5" aria-hidden />
          محرك التسويق الآلي · WanderLoom
        </p>
        <h2 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
          مولّد الحملات الشامل
        </h2>
        <p className="max-w-2xl text-sm font-medium text-slate-600 dark:text-slate-300">
          اختر نوع الحملة: براند DNA، رحلات خاصة، أو جروبات بمقاعد مفتوحة — ثم ولّد عبر Claude
          وادفع للجدولة الاجتماعية.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {schedulerStatus?.configured ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
              {schedulerStatus.message.startsWith('✅')
                ? schedulerStatus.message
                : `✅ التوصيل مفعل بـ ${
                    schedulerStatus.provider === 'buffer' ? 'Buffer' : 'Metricool'
                  }`}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              لم يُضبط Buffer أو Metricool بعد
            </span>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-200"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden />
            ضبط إعدادات الربط (API)
          </button>
        </div>
      </header>

      <SocialSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialProvider={
          schedulerStatus?.provider === 'buffer'
            ? 'buffer'
            : schedulerStatus?.provider === 'metricool'
              ? 'metricool'
              : 'none'
        }
        keyHint={schedulerStatus?.keyHint ?? null}
        onSaved={(status) => {
          setSchedulerStatus({
            configured: status.configured,
            provider: status.provider,
            message: status.message,
            keyHint: status.keyHint ?? null,
          });
        }}
      />

      <div
        role="tablist"
        aria-label="أنواع الحملات"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-[#2D3F3A] dark:bg-[#1A2421]"
      >
        {MODE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setMode(tab.id)}
              className={[
                'inline-flex min-h-[48px] shrink-0 flex-col items-start justify-center gap-0.5 rounded-xl px-3.5 py-2 text-right transition sm:min-w-[11rem]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:focus-visible:ring-[#D4AF37]/40',
                isActive
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#22302C] dark:text-[#D4AF37] dark:ring-1 dark:ring-[#D4AF37]/30'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-[#22302C]/70',
              ].join(' ')}
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {tab.label}
              </span>
              <span className="max-w-[16rem] truncate text-[10px] font-medium opacity-80">
                {tab.hint}
              </span>
            </button>
          );
        })}
      </div>

      {mode === 'brand' || mode === 'private' ? (
        <article className={PANEL}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {activeTab.label}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{activeTab.hint}</p>
              <p className="text-xs text-slate-500">
                {mode === 'brand'
                  ? 'يكتب Claude قصة البراند ومنهجية DNA: منشورات تعريفية وسكربتات ريلز ملهمة.'
                  : 'يركّز Claude على المسارات المخصصة، الفخامة العائلية، وباقات الاقتصاد الذكي.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void generateCampaign({ mode })}
                disabled={conceptGenerating || Boolean(generatingKey)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#C9A84C]/60 bg-gradient-to-l from-[#D4AF37] to-[#C9A84C] px-4 py-2.5 text-sm font-black text-[#1C4532] shadow-sm transition hover:brightness-105 disabled:opacity-50"
              >
                {conceptGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {conceptGenerating ? 'جاري التوليد…' : '✨ توليد الحملة'}
              </button>
              <button
                type="button"
                onClick={() => void scheduleCampaign(conceptKey)}
                disabled={!conceptCampaign || conceptScheduling}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-white"
              >
                {conceptScheduling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarClock className="h-4 w-4 text-[#C9A84C]" />
                )}
                📅 جدولة النشر
              </button>
            </div>
          </div>
          {conceptCampaign ? (
            <CampaignResultPanel campaign={conceptCampaign} resultKey={conceptKey} />
          ) : null}
        </article>
      ) : null}

      {mode === 'group' ? (
        loadingTrips ? (
          <div className={`${PANEL} flex items-center justify-center gap-2 py-16 text-slate-600`}>
            <Loader2 className="h-5 w-5 animate-spin" />
            جاري جلب الرحلات النشطة…
          </div>
        ) : tripsError ? (
          <div className={`${PANEL} border-rose-200 bg-rose-50 text-sm font-bold text-rose-800`}>
            {tripsError}
            <button
              type="button"
              onClick={() => void loadTrips()}
              className="mt-3 block text-xs underline"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : !trips.length ? (
          <div className={`${PANEL} text-sm font-bold text-slate-600 dark:text-slate-300`}>
            لا توجد رحلات جماعية نشطة بمقاعد مفتوحة حالياً.
          </div>
        ) : (
          <div className="space-y-5">
            {trips.map((trip) => {
              const campaign = campaignByKey[trip.id];
              const generating = generatingKey === trip.id;
              const scheduling = schedulingKey === trip.id;
              return (
                <article key={trip.id} className={PANEL}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Plane className="h-4 w-4 text-[#C9A84C]" aria-hidden />
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          {trip.title}
                        </h3>
                        {trip.badge ? (
                          <span className="rounded-full bg-[#D4AF37]/15 px-2.5 py-0.5 text-[10px] font-black text-[#9C7A3C]">
                            {trip.badge}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {[
                          trip.datesLabel,
                          trip.price,
                          trip.openSeats != null ? `${trip.openSeats} مقعد متاح` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {trip.highlights.length ? (
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {trip.highlights.slice(0, 4).join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void generateCampaign({ mode: 'group', trip })}
                        disabled={generating || Boolean(generatingKey)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#C9A84C]/60 bg-gradient-to-l from-[#D4AF37] to-[#C9A84C] px-4 py-2.5 text-sm font-black text-[#1C4532] shadow-sm transition hover:brightness-105 disabled:opacity-50"
                      >
                        {generating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {generating ? 'جاري التوليد…' : '✨ توليد حملة الجروب'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void scheduleCampaign(trip.id)}
                        disabled={!campaign || scheduling}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-white"
                      >
                        {scheduling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CalendarClock className="h-4 w-4 text-[#C9A84C]" />
                        )}
                        📅 جدولة النشر
                      </button>
                    </div>
                  </div>
                  {campaign ? (
                    <CampaignResultPanel campaign={campaign} resultKey={trip.id} />
                  ) : null}
                </article>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
