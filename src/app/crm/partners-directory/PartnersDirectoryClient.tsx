"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  Handshake,
  LayoutGrid,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Radar,
  Search,
  Table2,
  UserRound,
} from "lucide-react";

import { CrmSlideOver, CRM_DRAWER_SAVE } from "@/app/crm/_components/CrmSlideOver";
import type {
  CelebrityRecord,
  ExpertRecord,
  LeaderRecord,
} from "@/lib/partner-entities";
import { whatsAppHref } from "@/lib/crm-lead-actions";
import { getClientAccessToken } from "@/lib/crm-session-token";
import { CRM_BTN_PRIMARY, CRM_INPUT, partnerInitials } from "@/lib/crm-luxury-ui";
import {
  formatCompletedTrips,
  formatPartnerLocation,
  formatPartnerRating,
  normalizePartnerAvailability,
  partnerAvailabilityBadge,
} from "@/lib/partner-intelligence";
import { toast } from "@/lib/crm-toast";

type PartnerTab = "leaders" | "experts" | "celebrities";
type ViewMode = "cards" | "table";

type PartnerCardModel = {
  id: string;
  name: string;
  roleBadge: string;
  phone: string | null;
  status: string | null;
  tags: string[];
  href: string;
  countryCode: string | null;
  city: string | null;
  rating: number | null;
  completedTrips: number;
  availabilityStatus: string | null;
  category: string | null;
  iban: string | null;
  /** Show copy availability magic-link (leaders only) */
  showCalendarLink?: boolean;
};

const TABS: { id: PartnerTab; label: string; badge: string }[] = [
  { id: "leaders", label: "القادة", badge: "🚀 قائد رحلات" },
  { id: "experts", label: "خبراء الوجهات", badge: "🧭 خبير وجهات" },
  { id: "celebrities", label: "المشاهير والمؤثرين", badge: "🌟 مشهور / مؤثر" },
];

function toTags(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const text = String(value ?? "").trim();
  if (!text) return [];
  return text
    .split(/[,،/|·\-–]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function expertTags(expert: ExpertRecord): string[] {
  const approved = expert.partnerDna?.approvedDestinations ?? [];
  if (approved.length > 0) return approved.map((d) => String(d).trim()).filter(Boolean);
  return toTags(expert.specialtyRegions);
}

function parseTab(raw: string | null): PartnerTab {
  if (raw === "experts" || raw === "celebrities" || raw === "leaders") return raw;
  return "leaders";
}

function statusPillClass(status: string | null) {
  const value = (status ?? "active").toLowerCase();
  if (value === "active" || value === "approved") {
    return "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30";
  }
  if (value === "inactive") {
    return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-[#1A2421] dark:text-slate-400 dark:border-[#2D3F3A]";
  }
  if (value === "rejected") {
    return "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30";
  }
  return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:border-[#D4AF37]/30";
}

function statusLabel(status: string | null) {
  const value = (status ?? "active").toLowerCase();
  if (value === "active" || value === "approved") return "نشط";
  if (value === "pending") return "قيد المراجعة";
  if (value === "rejected") return "مرفوض";
  if (value === "inactive") return "غير نشط";
  return status || "نشط";
}

function isActiveInDirectory(status: string | null) {
  const value = (status ?? "active").toLowerCase();
  return value === "active" || value === "approved";
}

function profileHref(type: PartnerTab, id: string) {
  return `/crm/partners-directory/profile?id=${encodeURIComponent(id)}&type=${type}`;
}

async function copyIban(iban: string) {
  const clean = iban.replace(/\s+/g, "");
  try {
    await navigator.clipboard.writeText(clean);
    toast.success("تم نسخ الآيبان");
  } catch {
    window.prompt("انسخ رقم الآيبان:", clean);
  }
}

async function copyLeaderCalendarLink(leaderId: string) {
  try {
    const accessToken = await getClientAccessToken();
    const res = await fetch("/api/crm/leaders/calendar-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ leader_id: leaderId }),
    });
    const payload = (await res.json()) as { ok?: boolean; url?: string; error?: string };
    if (!res.ok || !payload.ok || !payload.url) {
      throw new Error(payload.error || "تعذر إنشاء رابط التفرغ");
    }
    await navigator.clipboard.writeText(payload.url);
    toast.success("تم نسخ رابط التفرغ — أرسله عبر واتساب");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "تعذر نسخ الرابط");
  }
}

const EMPTY_INFLUENCER_FORM = {
  name: "",
  phone: "",
  email: "",
  platforms: "",
  content_type: "",
};

const FILTER_ACTIVE =
  "rounded-xl border border-transparent bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]";

const FILTER_INACTIVE =
  "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-400";

export default function PartnersDirectoryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PartnerTab>(() =>
    parseTab(searchParams.get("tab")),
  );
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const [leaders, setLeaders] = useState<LeaderRecord[]>([]);
  const [experts, setExperts] = useState<ExpertRecord[]>([]);
  const [celebrities, setCelebrities] = useState<CelebrityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [influencerForm, setInfluencerForm] = useState(EMPTY_INFLUENCER_FORM);
  const [savingInfluencer, setSavingInfluencer] = useState(false);
  const [influencerError, setInfluencerError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const accessToken = await getClientAccessToken();
        const res = await fetch("/api/crm/notifications/counts", {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        const payload = (await res.json()) as { pendingPartners?: number };
        if (!cancelled) {
          setPendingRequestsCount(Number(payload.pendingPartners ?? 0) || 0);
        }
      } catch {
        if (!cancelled) setPendingRequestsCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = await getClientAccessToken();
      const authenticatedRequest = {
        cache: "no-store" as const,
        headers: { Authorization: `Bearer ${accessToken}` },
      };
      const [leadersRes, expertsRes, celebritiesRes] = await Promise.all([
        fetch("/api/crm/leaders", authenticatedRequest),
        fetch("/api/crm/experts", authenticatedRequest),
        fetch("/api/crm/celebrities", authenticatedRequest),
      ]);

      const [leadersPayload, expertsPayload, celebritiesPayload] = await Promise.all([
        leadersRes.json() as Promise<{ ok?: boolean; rows?: LeaderRecord[]; error?: string }>,
        expertsRes.json() as Promise<{ ok?: boolean; rows?: ExpertRecord[]; error?: string }>,
        celebritiesRes.json() as Promise<{
          ok?: boolean;
          rows?: CelebrityRecord[];
          error?: string;
        }>,
      ]);

      const errors: string[] = [];
      if (!leadersRes.ok || !leadersPayload.ok) {
        errors.push(leadersPayload.error || "تعذر تحميل القادة");
        setLeaders([]);
      } else {
        setLeaders(Array.isArray(leadersPayload.rows) ? leadersPayload.rows : []);
      }
      if (!expertsRes.ok || !expertsPayload.ok) {
        errors.push(expertsPayload.error || "تعذر تحميل الخبراء");
        setExperts([]);
      } else {
        setExperts(Array.isArray(expertsPayload.rows) ? expertsPayload.rows : []);
      }
      if (!celebritiesRes.ok || !celebritiesPayload.ok) {
        errors.push(celebritiesPayload.error || "تعذر تحميل المشاهير");
        setCelebrities([]);
      } else {
        setCelebrities(
          Array.isArray(celebritiesPayload.rows) ? celebritiesPayload.rows : [],
        );
      }
      setError(errors.length ? errors.join(" · ") : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch_failed");
      setLeaders([]);
      setExperts([]);
      setCelebrities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAddInfluencer = () => {
    setInfluencerForm(EMPTY_INFLUENCER_FORM);
    setInfluencerError(null);
    setDrawerOpen(true);
  };

  const closeAddInfluencer = () => {
    if (savingInfluencer) return;
    setDrawerOpen(false);
    setInfluencerError(null);
  };

  const handleSaveInfluencer = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = influencerForm.name.trim();
    if (!name) {
      setInfluencerError("اسم المؤثر مطلوب.");
      return;
    }

    setSavingInfluencer(true);
    setInfluencerError(null);
    try {
      const res = await fetch("/api/crm/celebrities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: influencerForm.phone.trim() || null,
          platforms: influencerForm.platforms.trim() || null,
          content_type: influencerForm.content_type.trim() || null,
          email: influencerForm.email.trim() || null,
        }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        row?: CelebrityRecord;
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.row) {
        throw new Error(payload.error || "تعذر إضافة المؤثر");
      }

      setCelebrities((prev) => [payload.row!, ...prev]);
      setDrawerOpen(false);
      setInfluencerForm(EMPTY_INFLUENCER_FORM);
    } catch (err) {
      setInfluencerError(err instanceof Error ? err.message : "تعذر إضافة المؤثر");
    } finally {
      setSavingInfluencer(false);
    }
  };

  const q = search.trim().toLowerCase();

  const filteredLeaders = useMemo(() => {
    const base = leaders.filter((row) => isActiveInDirectory(row.status));
    if (!q) return base;
    return base.filter((row) =>
      [
        row.name,
        row.phone,
        row.email,
        row.destinations,
        row.languages.join(" "),
        row.city,
        row.countryCode,
        row.category,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [leaders, q]);

  const filteredExperts = useMemo(() => {
    const base = experts.filter((row) => isActiveInDirectory(row.status));
    if (!q) return base;
    return base.filter((row) =>
      [
        row.name,
        row.phone,
        row.email,
        row.specialtyRegions,
        row.city,
        row.countryCode,
        row.category,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [experts, q]);

  const filteredCelebrities = useMemo(() => {
    const base = celebrities.filter((row) => isActiveInDirectory(row.status));
    if (!q) return base;
    return base.filter((row) =>
      [
        row.name,
        row.platforms,
        row.contentFocus,
        row.profileUrl,
        row.phone,
        row.city,
        row.countryCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [celebrities, q]);

  const roleBadge = TABS.find((t) => t.id === activeTab)?.badge ?? "";

  const cardModels: PartnerCardModel[] = useMemo(() => {
    if (activeTab === "leaders") {
      return filteredLeaders.map((row) => ({
        id: row.id,
        name: row.name,
        roleBadge,
        phone: row.phone,
        status: row.status,
        tags:
          row.languages.length > 0
            ? row.languages
            : toTags(row.destinations),
        href: profileHref("leaders", row.id),
        countryCode: row.countryCode,
        city: row.city,
        rating: row.rating,
        completedTrips: row.completedTrips,
        availabilityStatus: row.availabilityStatus,
        category: row.category,
        iban: row.iban,
        showCalendarLink: true,
      }));
    }
    if (activeTab === "experts") {
      return filteredExperts.map((row) => ({
        id: row.id,
        name: row.name,
        roleBadge,
        phone: row.phone,
        status: row.status,
        tags: expertTags(row),
        href: profileHref("experts", row.id),
        countryCode: row.countryCode,
        city: row.city,
        rating: row.rating,
        completedTrips: row.completedTrips,
        availabilityStatus: row.availabilityStatus,
        category: row.category,
        iban: row.iban,
      }));
    }
    return filteredCelebrities.map((row) => ({
      id: row.id,
      name: row.name,
      roleBadge,
      phone: row.phone,
      status: row.status,
      tags: toTags(row.platforms || row.contentFocus),
      href: profileHref("celebrities", row.id),
      countryCode: row.countryCode,
      city: row.city,
      rating: row.rating,
      completedTrips: row.completedTrips,
      availabilityStatus: row.availabilityStatus,
      category: row.category,
      iban: row.iban,
    }));
  }, [
    activeTab,
    filteredCelebrities,
    filteredExperts,
    filteredLeaders,
    roleBadge,
  ]);

  const emptyMessage =
    activeTab === "leaders"
      ? { message: "لا يوجد قادة نشطون بعد.", hint: "اقبل طلبات من رادار الشركاء." }
      : activeTab === "experts"
        ? { message: "لا يوجد خبراء نشطون بعد.", hint: "اقبل طلبات من رادار الشركاء." }
        : {
            message: "لا يوجد مشاهير أو مؤثرون بعد.",
            hint: "أضف مؤثراً يدوياً عبر زر «إضافة مؤثر جديد».",
          };

  return (
    <div className="min-h-full max-w-full overflow-x-hidden bg-[#F9FAFB] font-sans dark:bg-[#1A2421]" dir="rtl">
      <header className="mb-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl bg-slate-900 p-6 text-white shadow-sm md:flex-row md:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/50">
            Partners Network
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-white sm:text-3xl">
            <Handshake className="h-7 w-7 shrink-0 text-[#D4AF37]" aria-hidden />
            شبكة الشركاء
          </h1>
          <p className="mt-2 text-sm text-white/70">
            بطاقات تعريف الشركاء النشطين — الطلبات الجديدة تُراجع في رادار الشركاء
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end">
          <button
            type="button"
            onClick={() => router.push("/crm/partners-radar")}
            className="flex flex-shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-sm transition-all hover:bg-amber-600"
          >
            <Radar className="h-4 w-4 shrink-0" aria-hidden />
            <span>رادار الشركاء (الطلبات الجديدة)</span>
            <span className="rounded-md bg-slate-950/20 px-1.5 py-0.5 text-[10px] text-slate-950">
              {pendingRequestsCount || 0}
            </span>
          </button>
          <label className="relative w-full md:w-72">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في الدليل…"
              className="h-11 w-full rounded-lg border border-white/20 bg-white/10 py-2.5 pl-4 pr-10 text-sm text-white outline-none transition placeholder:text-white/45 focus:ring-2 focus:ring-[#D4AF37]/40"
            />
          </label>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? FILTER_ACTIVE : FILTER_INACTIVE}
            >
              {tab.badge}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-[#2D3F3A] dark:bg-[#1A2421]"
            role="group"
            aria-label="طريقة العرض"
          >
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              aria-pressed={viewMode === "cards"}
              title="عرض البطاقات"
              className={
                viewMode === "cards"
                  ? "flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-slate-900 shadow-sm transition-all dark:bg-[#22302C] dark:text-[#D4AF37]"
                  : "flex items-center justify-center px-3 py-1.5 text-slate-500 transition-all hover:text-slate-700 dark:text-slate-400"
              }
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              <span className="sr-only">بطاقات</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              title="عرض الجدول"
              className={
                viewMode === "table"
                  ? "flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-slate-900 shadow-sm transition-all dark:bg-[#22302C] dark:text-[#D4AF37]"
                  : "flex items-center justify-center px-3 py-1.5 text-slate-500 transition-all hover:text-slate-700 dark:text-slate-400"
              }
            >
              <Table2 className="h-4 w-4" aria-hidden />
              <span className="sr-only">جدول</span>
            </button>
          </div>

          {activeTab === "celebrities" ? (
            <button type="button" onClick={openAddInfluencer} className={CRM_BTN_PRIMARY}>
              <Plus className="h-4 w-4" aria-hidden />
              إضافة مؤثر جديد +
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-[#D4AF37]" />
        </div>
      ) : cardModels.length === 0 ? (
        <EmptyState
          message={emptyMessage.message}
          hint={emptyMessage.hint}
          action={
            activeTab === "celebrities" ? (
              <button
                type="button"
                onClick={openAddInfluencer}
                className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md transition-all hover:bg-[#c29f2f]"
              >
                <span aria-hidden>+</span>
                إضافة مؤثر جديد
              </button>
            ) : null
          }
        />
      ) : viewMode === "cards" ? (
        <div className="crm-stagger grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cardModels.map((row) => (
            <PartnerCard key={row.id} {...row} />
          ))}
        </div>
      ) : (
        <PartnersDenseTable rows={cardModels} />
      )}

      <CrmSlideOver
        open={drawerOpen}
        onClose={closeAddInfluencer}
        busy={savingInfluencer}
        title="إضافة مؤثر جديد"
        subtitle="يُحفظ مباشرة بحالة نشط — بدون رادار."
        labelledBy="add-influencer-title"
        footer={
          <div className="flex gap-2">
            <button
              type="submit"
              form="add-influencer-form"
              disabled={savingInfluencer}
              className={CRM_DRAWER_SAVE}
            >
              {savingInfluencer ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  جاري الحفظ…
                </span>
              ) : (
                "حفظ المؤثر"
              )}
            </button>
            <button
              type="button"
              onClick={closeAddInfluencer}
              disabled={savingInfluencer}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-300"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <form
          id="add-influencer-form"
          onSubmit={(e) => void handleSaveInfluencer(e)}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              اسم المؤثر *
            </span>
            <input
              value={influencerForm.name}
              onChange={(e) =>
                setInfluencerForm((f) => ({ ...f, name: e.target.value }))
              }
              required
              className={CRM_INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              رقم التواصل
            </span>
            <input
              value={influencerForm.phone}
              onChange={(e) =>
                setInfluencerForm((f) => ({ ...f, phone: e.target.value }))
              }
              className={CRM_INPUT}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              البريد الإلكتروني
            </span>
            <input
              type="email"
              value={influencerForm.email}
              onChange={(e) =>
                setInfluencerForm((f) => ({ ...f, email: e.target.value }))
              }
              className={CRM_INPUT}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              المنصات
            </span>
            <input
              value={influencerForm.platforms}
              onChange={(e) =>
                setInfluencerForm((f) => ({ ...f, platforms: e.target.value }))
              }
              className={CRM_INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              نوع المحتوى
            </span>
            <input
              value={influencerForm.content_type}
              onChange={(e) =>
                setInfluencerForm((f) => ({ ...f, content_type: e.target.value }))
              }
              className={CRM_INPUT}
            />
          </label>

          {influencerError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">
              {influencerError}
            </p>
          ) : null}
        </form>
      </CrmSlideOver>
    </div>
  );
}

function PartnerCard({
  id,
  name,
  roleBadge,
  phone,
  status,
  tags = [],
  href,
  countryCode,
  city,
  rating,
  completedTrips,
  availabilityStatus,
  category,
  iban,
  showCalendarLink = false,
}: PartnerCardModel) {
  const [copyingLink, setCopyingLink] = useState(false);
  const location = formatPartnerLocation(countryCode, city);
  const ratingLabel = formatPartnerRating(rating);
  const tripsLabel = formatCompletedTrips(completedTrips);
  const availability = partnerAvailabilityBadge(
    normalizePartnerAvailability(availabilityStatus),
  );
  const wa = phone?.trim() ? whatsAppHref(phone) : null;

  const handleCopyCalendarLink = async () => {
    if (copyingLink) return;
    setCopyingLink(true);
    await copyLeaderCalendarLink(id);
    setCopyingLink(false);
  };

  return (
    <article className="group relative flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-[#2D3F3A] dark:bg-[#22302C]">
      <span
        className={`absolute top-4 right-4 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${statusPillClass(status)}`}
      >
        {statusLabel(status)}
      </span>

      {availability ? (
        <span className={`absolute top-4 left-4 ${availability.className}`}>
          {availability.label}
        </span>
      ) : null}

      <div className="relative mb-4 h-20 w-20">
        <div
          className="flex h-full w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xl font-bold text-slate-700 shadow-sm dark:border-[#D4AF37]/30 dark:bg-[#1A2421] dark:text-[#D4AF37]"
          aria-hidden
        >
          {partnerInitials(name)}
        </div>
      </div>

      <h2 className="mb-1 max-w-full truncate text-lg font-bold text-slate-900 dark:text-white">
        {name}
      </h2>
      <p className="mb-1 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 dark:text-[#D4AF37]/80">
        {category?.trim() || roleBadge}
      </p>

      {location ? (
        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          {location}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {ratingLabel ? (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
            {ratingLabel}
          </span>
        ) : null}
        {tripsLabel ? (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300">
            {tripsLabel}
          </span>
        ) : null}
      </div>

      {phone ? (
        <div className="mb-3 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <Phone className="h-3 w-3 shrink-0" aria-hidden />
          <span dir="ltr" className="truncate">
            {phone}
          </span>
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="mb-5 flex w-full flex-wrap justify-center gap-1.5">
          {tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <div className="mb-5" />
      )}

      <div className="mt-auto flex w-full flex-col gap-2">
        <Link
          href={href}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-900 transition-all duration-200 hover:bg-slate-900 hover:text-white dark:border-[#D4AF37]/50 dark:bg-transparent dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/10"
        >
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          إدارة الملف
        </Link>

        {showCalendarLink ? (
          <button
            type="button"
            onClick={() => void handleCopyCalendarLink()}
            disabled={copyingLink}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-900 hover:text-white disabled:opacity-60 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300 dark:hover:border-[#D4AF37]/40 dark:hover:text-[#D4AF37]"
          >
            {copyingLink ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Link2 className="h-3.5 w-3.5" aria-hidden />
            )}
            نسخ رابط التفرغ 🔗
          </button>
        ) : null}

        <div className="flex gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              واتساب
            </a>
          ) : null}
          {iban?.trim() ? (
            <button
              type="button"
              onClick={() => void copyIban(iban)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-900 hover:text-white dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
              title={iban}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              IBAN
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PartnersDenseTable({ rows }: { rows: PartnerCardModel[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
      <table className="min-w-full text-right">
        <thead className="bg-slate-50 text-sm text-slate-500 dark:bg-[#1A2421] dark:text-slate-400">
          <tr className="border-b border-slate-200 dark:border-[#2D3F3A]">
            <th className="whitespace-nowrap px-4 py-3 font-semibold">الشريك</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">الموقع</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">التقييم</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">الرحلات</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">التوفر</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const location = formatPartnerLocation(row.countryCode, row.city);
            const ratingLabel = formatPartnerRating(row.rating);
            const tripsLabel = formatCompletedTrips(row.completedTrips);
            const availability = partnerAvailabilityBadge(
              normalizePartnerAvailability(row.availabilityStatus),
            );
            const wa = row.phone?.trim() ? whatsAppHref(row.phone) : null;
            return (
              <tr
                key={row.id}
                className="border-b border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-[#2D3F3A] dark:hover:bg-[#1A2421]/50"
              >
                <td className="px-4 py-3 text-sm">
                  <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {row.category?.trim() || row.roleBadge}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                  {location || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium">
                  {ratingLabel || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {tripsLabel || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {availability ? (
                    <span className={availability.className}>{availability.label}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        title="واتساب"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden />
                      </a>
                    ) : null}
                    {row.iban?.trim() ? (
                      <button
                        type="button"
                        onClick={() => void copyIban(row.iban!)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1A2421]"
                        title="نسخ IBAN"
                      >
                        <Copy className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                    <Link
                      href={row.href}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-900 hover:text-white dark:border-[#D4AF37]/40 dark:text-[#D4AF37]"
                    >
                      الملف
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  message,
  hint,
  action,
}: {
  message: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
      <Handshake className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
      <p className="text-lg font-medium text-slate-500 dark:text-slate-400">{message}</p>
      {hint ? (
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">{hint}</p>
      ) : null}
      {action}
    </div>
  );
}
